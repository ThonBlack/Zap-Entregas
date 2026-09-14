"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2, Phone, Pencil, Navigation, Loader2, AlertTriangle, MapPin, X, UserPlus } from "lucide-react";
import Link from "next/link";
import { optimizeSelectedRouteAction } from "@/app/actions/logistics";
import type { DeliveryReceipt } from "@/lib/receipt";
import { chargeModeDaCorrida, rotuloCobranca, tomCobranca } from "@/lib/chargeMode";
import { rotuloCorrida } from "@/lib/dailySeq-shared";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import CompleteDeliveryModal from "@/components/deliveries/CompleteDeliveryModal";
import RefreshButton from "@/components/shared/RefreshButton";
import { linkNavegacao } from "@/lib/mapsLink";
import {
    avaliarCerca,
    precisaJustificar,
    distanciaLegivel,
    perguntaDaCerca,
    motivoValido,
    AVISO_MOTIVO_CURTO,
    type SituacaoCerca,
} from "@/lib/geofence";

interface Delivery {
    id: number;
    address: string;
    customerName: string | null;
    customerPhone: string | null;
    value: number | null;
    observation: string | null;
    publicToken: string | null;
    stopOrder: number | null;
    lat: number | null;
    lng: number | null;
    status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'canceled';
    motoboyId: number | null;
    /** "Corrida N" do dia (por loja). Ausente em corrida antiga: o rótulo some. */
    dailySeq?: number | null;
    /** "receber" | "conferir" | "pago". Ausente = corrida antiga (cai na régua do valor). */
    chargeMode?: string | null;
    /** Nome de quem está com a corrida — só a loja recebe isto. */
    motoboyName?: string | null;
    isSuspectAddress?: boolean;
    /**
     * Corrida de outra loja, ainda sem dono: o servidor já tirou nome, telefone
     * e o endereço com número. Aqui só mudamos o jeito de mostrar.
     */
    masked?: boolean;
    /** De que loja veio — é o que sobra pra decidir se vale a pena pegar. */
    shopName?: string | null;
}

interface PendingDeliveriesFormProps {
    deliveries: Delivery[];
    isMotoboy?: boolean;
    currentUserId?: number;
    /** Endereço público do site (APP_URL), vindo do servidor. Vazio = usa a janela atual. */
    baseUrl?: string;
    /**
     * Motoboys ativos da equipe (só vai pra tela da loja). É com esta lista que
     * a loja destina uma corrida e diz quem fez a entrega ao finalizar sem GPS.
     */
    motoboys?: { id: number; name: string }[];
}

/**
 * Link do WhatsApp com o endereço de rastreio COMPLETO.
 *
 * O endereço do site vem do servidor (APP_URL) porque aqui, no navegador, o
 * componente é renderizado ANTES no servidor — onde `window` não existe e o link
 * sairia "/tracking/abc", sem domínio e inútil pro cliente.
 *
 * Se APP_URL não estiver configurada, o clique cai no endereço da própria janela
 * (window.location.origin), que sempre existe na hora do clique.
 */
function montarLinkWhatsApp(delivery: Delivery, baseUrl: string) {
    const fone = (delivery.customerPhone || "").replace(/\D/g, '');
    const raiz = baseUrl.replace(/\/+$/, "");
    const rastreio = delivery.publicToken && raiz
        ? `\nAcompanhe em tempo real: ${raiz}/tracking/${delivery.publicToken}`
        : "";
    const texto = `Olá ${delivery.customerName || 'Cliente'}, seu pedido está a caminho! 🏍️${rastreio}`;
    return `https://wa.me/55${fone}?text=${encodeURIComponent(texto)}`;
}

/** Classe base dos botões de ação: 44px de altura é o mínimo pra tocar de capacete. */
const BOTAO = "min-h-11 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function PendingDeliveriesForm({
    deliveries, isMotoboy = false, currentUserId, baseUrl = "", motoboys = [],
}: PendingDeliveriesFormProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<number[]>([]);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [gpsNegado, setGpsNegado] = useState(false);
    const [loadingAction, setLoadingAction] = useState<number | null>(null);
    /** Erro por corrida — faixa vermelha DENTRO do card, no lugar do alert() do navegador. */
    const [erros, setErros] = useState<Record<number, string>>({});
    const [pendente, iniciarTransicao] = useTransition();

    const mostrarErro = (id: number, msg: string) => setErros(e => ({ ...e, [id]: msg }));
    const limparErro = (id: number) => setErros(e => {
        const { [id]: _, ...resto } = e;
        return resto;
    });

    /**
     * Recarrega os dados sem recarregar a página inteira (era
     * window.location.reload(): 3-6 segundos de tela branca por corrida fechada,
     * e a rolagem voltava pro topo). O loading só sai quando o refresh termina.
     */
    const recarregar = (aoTerminar?: () => void) => {
        iniciarTransicao(() => {
            router.refresh();
            aoTerminar?.();
        });
    };

    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setGpsNegado(true);
            return;
        }

        const watcher = navigator.geolocation.watchPosition(
            (position) => {
                setGpsNegado(false);
                setCurrentLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                // Erro de GPS não pode morrer no console: sem localização a loja não
                // vê o motoboy no mapa e a cerca de 200m deixa de funcionar.
                console.warn("Sem localização:", error);
                setGpsNegado(true);
                setCurrentLocation(null);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    const toggle = (id: number) => {
        setSelected(atual => atual.includes(id) ? atual.filter(i => i !== id) : [...atual, id]);
    };

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        action: () => Promise<void>;
        requireWord?: string;
        variant: "danger" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", action: async () => { }, variant: "warning" });

    // Handler para ACEITAR entrega
    const handleAcceptClick = async (id: number) => {
        limparErro(id);
        setLoadingAction(id);
        try {
            const m = await import("@/app/actions/logistics");
            const res = await m.acceptDeliveryAction(id);
            if (res && "error" in res && res.error) {
                mostrarErro(id, res.error);
                setLoadingAction(null);
            } else {
                recarregar(() => setLoadingAction(null));
            }
        } catch {
            mostrarErro(id, "Não consegui aceitar agora. Confira a internet e tente de novo.");
            setLoadingAction(null);
        }
    };

    // Handler para PEGAR entrega (saiu para entregar)
    const handlePickupClick = async (id: number) => {
        limparErro(id);
        setLoadingAction(id);
        try {
            const m = await import("@/app/actions/logistics");
            const res = await m.pickupDeliveryAction(id);
            if (res && "error" in res && res.error) {
                mostrarErro(id, res.error);
                setLoadingAction(null);
            } else {
                recarregar(() => setLoadingAction(null));
            }
        } catch {
            mostrarErro(id, "Não consegui marcar a coleta. Confira a internet e tente de novo.");
            setLoadingAction(null);
        }
    };

    // Actions wrapped with client-side modal
    const handleDeleteClick = (id: number) => {
        limparErro(id);
        setModalConfig({
            isOpen: true,
            title: "Excluir Entrega",
            description: "Tem certeza que deseja excluir esta entrega? Esta ação não pode ser desfeita.",
            requireWord: "EXCLUIR",
            variant: "danger",
            action: async () => {
                const m = await import("@/app/actions/logistics");
                const res = await m.deleteDeliveryAction(id);
                // Erro sobe pro modal, que fica aberto e mostra a mensagem.
                if (res && "error" in res && res.error) throw new Error(res.error);
                recarregar();
            }
        });
    };

    /** Corrida em processo de finalização (modal de recebimento aberto). */
    const [completingId, setCompletingId] = useState<number | null>(null);
    const [completing, setCompleting] = useState(false);
    /** Segunda etapa: o motoboy está fora do raio e precisa escrever o motivo. */
    const [justificativa, setJustificativa] = useState<{
        id: number;
        receipt: DeliveryReceipt;
        situacao: SituacaoCerca;
    } | null>(null);
    const [motivo, setMotivo] = useState("");
    const [erroMotivo, setErroMotivo] = useState("");

    /**
     * Quem fez a entrega, quando quem finaliza é a LOJA. Vazio enquanto a
     * corrida já tem motoboy (aí é ele mesmo). A carteira precisa de um dono:
     * sem isso a taxa e o dinheiro ficariam sem cair na conta de ninguém.
     */
    const [motoboyDaEntrega, setMotoboyDaEntrega] = useState<number | null>(null);
    /** Corrida esperando a loja escolher o motoboy: "entregue" abre o recibo depois. */
    const [escolhendo, setEscolhendo] = useState<{ id: number; para: "entregue" | "destinar" } | null>(null);
    const [destinando, setDestinando] = useState(false);

    const handleCompleteClick = (id: number) => {
        limparErro(id);
        const alvo = deliveries.find(d => d.id === id);
        // Loja finalizando corrida que ninguém aceitou: primeiro "quem entregou?".
        if (!isMotoboy && alvo && alvo.motoboyId == null) {
            if (!motoboys.length) {
                mostrarErro(id, "Cadastre um motoboy na sua equipe antes de marcar a entrega.");
                return;
            }
            setMotoboyDaEntrega(null);
            setEscolhendo({ id, para: "entregue" });
            return;
        }
        setMotoboyDaEntrega(null);
        setCompletingId(id);
    };

    /** Destinar (ou devolver pra fila) uma corrida — só a loja faz isso. */
    const destinar = async (id: number, motoboyId: number | null) => {
        limparErro(id);
        setDestinando(true);
        try {
            const m = await import("@/app/actions/logistics");
            const res = await m.assignDeliveryAction(id, motoboyId);
            if (res && "error" in res && res.error) {
                mostrarErro(id, res.error);
                setDestinando(false);
                return;
            }
            setEscolhendo(null);
            recarregar(() => setDestinando(false));
        } catch {
            mostrarErro(id, "Não consegui destinar agora. Confira a internet e tente de novo.");
            setDestinando(false);
        }
    };

    /** Manda pro servidor de verdade (já com motivo, se houve). */
    const finalizar = async (
        id: number,
        receipt: DeliveryReceipt,
        contexto?: { foraDoRaio: boolean; motivo: string; distanciaMetros: number | null },
    ) => {
        setCompleting(true);
        try {
            const m = await import("@/app/actions/logistics");
            const res = await m.completeDeliveryAction(id, receipt, contexto, motoboyDaEntrega);
            if (res && "error" in res && res.error) {
                if (justificativa) setErroMotivo(res.error);
                else mostrarErro(id, res.error);
                setCompleting(false);
                return;
            }
            setCompletingId(null);
            setJustificativa(null);
            setMotivo("");
            setErroMotivo("");
            setMotoboyDaEntrega(null);
            recarregar(() => setCompleting(false));
        } catch {
            const msg = "Não consegui finalizar agora. Confira a internet e tente de novo.";
            if (justificativa) setErroMotivo(msg);
            else mostrarErro(id, msg);
            setCompleting(false);
        }
    };

    const handleCompleteConfirm = async (receipt: DeliveryReceipt) => {
        if (completingId == null) return;
        const alvo = deliveries.find(d => d.id === completingId);
        const situacao = avaliarCerca({
            aplicar: isMotoboy,
            gpsDisponivel: !gpsNegado && currentLocation != null,
            posicao: currentLocation,
            destino: { lat: alvo?.lat ?? null, lng: alvo?.lng ?? null },
        });

        // Longe do endereço (ou sem GPS): não trava o botão, pede o motivo.
        if (precisaJustificar(situacao)) {
            setJustificativa({ id: completingId, receipt, situacao });
            // Campo VAZIO de propósito: quem carimba "[sem GPS]" / "[fora do raio
            // 1,4 km]" é o servidor. Se a tela já viesse escrita, o texto saía
            // duplicado na observação e a regra dos 5 caracteres não pegava nada.
            setMotivo("");
            setErroMotivo("");
            return;
        }

        await finalizar(completingId, receipt);
    };

    const confirmarJustificativa = async () => {
        if (!justificativa) return;
        if (!motivoValido(motivo)) {
            setErroMotivo(AVISO_MOTIVO_CURTO);
            return;
        }
        const dist = justificativa.situacao.tipo === "fora"
            ? justificativa.situacao.distanciaMetros
            : null;
        await finalizar(justificativa.id, justificativa.receipt, {
            foraDoRaio: true,
            motivo: motivo.trim(),
            distanciaMetros: dist,
        });
    };

    /** "Gerar Rota": trava enquanto roda e o link vira um botão de verdade. */
    const [gerandoRota, setGerandoRota] = useState(false);
    const [urlRota, setUrlRota] = useState("");
    const [erroRota, setErroRota] = useState("");

    const gerarRota = async () => {
        if (selected.length < 1 || gerandoRota) return;
        setGerandoRota(true);
        setErroRota("");
        setUrlRota("");
        try {
            const result = await optimizeSelectedRouteAction(selected);
            if (result && "url" in result && result.success && result.url) {
                // Antes era window.open() DEPOIS do await: no 4G a resposta demora
                // mais que os ~5s que o Chrome dá e o pop-up era bloqueado sem aviso.
                // Agora vira um link normal, que o toque do usuário abre na hora.
                setUrlRota(result.url);
                router.refresh(); // a ordem das paradas mudou no banco
            } else {
                setErroRota(
                    (result && "error" in result && result.error) ||
                    "Não deu pra montar a rota. Confira se as corridas têm endereço."
                );
            }
        } catch {
            setErroRota("Não deu pra montar a rota agora. Tente de novo.");
        } finally {
            setGerandoRota(false);
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={modalConfig.action}
                title={modalConfig.title}
                description={modalConfig.description}
                requireConfirmationWord={modalConfig.requireWord}
                variant={modalConfig.variant}
                confirmText="Confirmar"
                pendingText="Excluindo…"
            />
            {escolhendo && (
                <EscolherMotoboy
                    titulo={escolhendo.para === "entregue" ? "Quem fez essa entrega?" : "Destinar a corrida"}
                    ajuda={escolhendo.para === "entregue"
                        ? "A taxa e o dinheiro recebido entram na conta de quem você escolher."
                        : "Só esse motoboy vai receber o aviso. Ele não precisa aceitar de novo."}
                    motoboys={motoboys}
                    atual={deliveries.find(d => d.id === escolhendo.id)?.motoboyId ?? null}
                    permiteFila={escolhendo.para === "destinar"}
                    salvando={destinando || completing || pendente}
                    erro={erros[escolhendo.id] ?? ""}
                    onCancelar={() => setEscolhendo(null)}
                    onEscolher={(motoboyId) => {
                        if (escolhendo.para === "destinar") {
                            void destinar(escolhendo.id, motoboyId);
                            return;
                        }
                        // "Quem entregou" é a primeira metade: agora abre o recibo.
                        setMotoboyDaEntrega(motoboyId);
                        setCompletingId(escolhendo.id);
                        setEscolhendo(null);
                    }}
                />
            )}

            {completingId != null && justificativa == null && escolhendo == null && (() => {
                const alvo = deliveries.find(d => d.id === completingId);
                return (
                    <CompleteDeliveryModal
                        key={completingId}
                        isOpen
                        onClose={() => { setCompletingId(null); setMotoboyDaEntrega(null); }}
                        onConfirm={handleCompleteConfirm}
                        orderValue={alvo?.value ?? null}
                        chargeMode={chargeModeDaCorrida(alvo ?? {})}
                        porLoja={!isMotoboy}
                        loading={completing || pendente}
                    />
                );
            })()}

            {justificativa && (
                <ConfirmacaoForaDoRaio
                    pergunta={perguntaDaCerca(justificativa.situacao)}
                    motivo={motivo}
                    onMotivo={(v) => { setMotivo(v); setErroMotivo(""); }}
                    erro={erroMotivo}
                    salvando={completing || pendente}
                    onCancelar={() => { setJustificativa(null); setMotivo(""); setErroMotivo(""); }}
                    onConfirmar={confirmarJustificativa}
                />
            )}

            <div className="space-y-4">
                {/* GPS desligado: precisa aparecer, senão a loja não vê o motoboy
                    no mapa e ninguém desconfia de nada. */}
                {isMotoboy && gpsNegado && (
                    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2 text-sm">
                        <MapPin size={18} className="text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-amber-100">
                            <p className="font-bold">Localização desligada — a loja não te vê no mapa</p>
                            <p className="text-amber-200/90 text-xs mt-0.5">
                                Ligue o GPS do celular e, no navegador, toque no cadeado ao lado do
                                endereço → <strong>Configurações do site</strong> → <strong>Localização</strong> → Permitir.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4 gap-2">
                    {/* A loja passou a ver também as que já estão com alguém
                        ("em rota") — é lá que ficam o "Marcar entregue" e o
                        "Trocar". Por isso o título muda pra ela. */}
                    <h3 className="font-bold text-white">
                        {isMotoboy ? "Entregas Pendentes" : "Entregas em aberto"} ({deliveries.length})
                    </h3>
                    <div className="flex items-center gap-2">
                        <RefreshButton />
                        <button
                            type="button"
                            onClick={gerarRota}
                            disabled={selected.length < 1 || gerandoRota}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 min-h-11 rounded-lg text-sm font-bold transition-colors shadow-lg active:scale-95"
                        >
                            {gerandoRota
                                ? <Loader2 size={16} className="animate-spin" />
                                : <Play size={16} fill="currentColor" />}
                            {gerandoRota ? "Montando…" : `Gerar Rota (${selected.length})`}
                        </button>
                    </div>
                </div>

                {urlRota && (
                    <a
                        href={urlRota}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 min-h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg"
                    >
                        <Navigation size={18} />
                        Abrir rota no Google Maps
                    </a>
                )}
                {erroRota && (
                    <p className="text-sm text-red-300 bg-red-950/60 border border-red-500/50 rounded-lg px-3 py-2">
                        {erroRota}
                    </p>
                )}

                <div className="space-y-3">
                    {deliveries.map((delivery) => {
                        const situacao = avaliarCerca({
                            aplicar: isMotoboy,
                            gpsDisponivel: !gpsNegado && currentLocation != null,
                            posicao: currentLocation,
                            destino: { lat: delivery.lat, lng: delivery.lng },
                        });
                        const longe = situacao.tipo === "fora";
                        const carregando = loadingAction === delivery.id;

                        const modoCobranca = chargeModeDaCorrida(delivery);

                        const podeAceitar = isMotoboy && delivery.status === 'pending' && !delivery.motoboyId;
                        const podePegar = isMotoboy && delivery.status === 'assigned' && delivery.motoboyId === currentUserId;
                        const podeEntregar = (isMotoboy && delivery.status === 'picked_up' && delivery.motoboyId === currentUserId) || !isMotoboy;
                        // Destinar/trocar de motoboy só enquanto ninguém coletou: depois
                        // disso a mercadoria já está na mão de alguém.
                        const podeDestinar = !isMotoboy && motoboys.length > 0
                            && (delivery.status === 'pending' || delivery.status === 'assigned');

                        return (
                            <div key={delivery.id} className={`block bg-zinc-800 p-4 rounded-xl shadow-sm border transition-all ${selected.includes(delivery.id) ? 'border-green-500 ring-1 ring-green-500 bg-zinc-700' : 'border-zinc-700'}`}>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="selectedDelivery"
                                        value={delivery.id}
                                        checked={selected.includes(delivery.id)}
                                        onChange={() => toggle(delivery.id)}
                                        className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <h4 className="font-bold text-white text-sm min-w-0 break-words">
                                                {delivery.masked
                                                    ? (delivery.shopName || "Outra loja")
                                                    : (delivery.customerName || "Cliente")}
                                            </h4>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {delivery.status !== 'pending' && (
                                                    <span className={`px-2 py-1 text-xs font-bold rounded ${delivery.status === 'assigned' ? 'bg-yellow-500 text-yellow-950' :
                                                        delivery.status === 'picked_up' ? 'bg-blue-500 text-white' :
                                                            'bg-zinc-600 text-white'
                                                        }`}>
                                                        {delivery.status === 'assigned' ? '📦 Aceita' :
                                                            delivery.status === 'picked_up' ? '🏍️ Em Rota' :
                                                                delivery.status === 'delivered' ? '✅ Entregue' :
                                                                    delivery.status === 'canceled' ? '✖ Cancelada' : ''}
                                                    </span>
                                                )}
                                                {/* "Corrida 7" é como a loja chama a corrida no
                                                    grupo de WhatsApp. Corrida antiga (sem número)
                                                    continua mostrando o id do banco. */}
                                                {rotuloCorrida(delivery.dailySeq) ? (
                                                    <span className="px-2 py-1 text-xs font-bold rounded bg-green-600 text-white">
                                                        {rotuloCorrida(delivery.dailySeq)}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 text-xs font-mono">#{delivery.id}</span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-zinc-300 text-sm mb-1 break-words">
                                            {delivery.masked && "📍 "}{delivery.address}
                                        </p>
                                        {delivery.masked && (
                                            <p className="text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1 mb-1 inline-block">
                                                Corrida de outra loja — endereço e contato do cliente aparecem quando você aceitar.
                                            </p>
                                        )}
                                        {delivery.isSuspectAddress && (
                                            <p className="text-xs text-amber-300 bg-amber-900/30 border border-amber-700/40 rounded px-2 py-1 mb-1 inline-flex items-center gap-1" title="Endereço caiu a mais de 100km da sua loja — pode estar geocodificado errado">
                                                ⚠️ Endereço fora do raio da loja — verifique
                                            </p>
                                        )}
                                        {longe && (
                                            <p className="text-xs text-orange-300 bg-orange-900/30 border border-orange-700/40 rounded px-2 py-1 mb-1 inline-flex items-center gap-1">
                                                📍 Você está a {distanciaLegivel(situacao.distanciaMetros)} do endereço
                                            </p>
                                        )}
                                        {delivery.observation && (
                                            <p className="text-zinc-400 text-xs italic mb-1 border-l-2 border-zinc-600 pl-2">
                                                📝 {delivery.observation}
                                            </p>
                                        )}
                                        {/* Tipo de cobrança: é o que o motoboy precisa saber ANTES
                                            de tocar a campainha — cobrar, só conferir o Pix da
                                            loja, ou nada. Some na corrida mascarada de outra loja. */}
                                        {!delivery.masked && (
                                            <p className={`text-xs font-bold rounded px-2 py-1 mb-1 inline-flex items-center gap-1 border ${tomCobranca(modoCobranca)}`}>
                                                {rotuloCobranca(modoCobranca, delivery.value)}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                                            <span>Ordem: {delivery.stopOrder || '-'}</span>
                                            {!isMotoboy && delivery.motoboyName && (
                                                <span className="text-zinc-300">🏍️ {delivery.motoboyName}</span>
                                            )}
                                            {delivery.value != null && delivery.value > 0 && (
                                                <span>Valor: R$ {delivery.value.toFixed(2).replace('.', ',')}</span>
                                            )}
                                            {situacao.tipo === "dentro" && isMotoboy && situacao.distanciaMetros > 0 && (
                                                <span className="text-green-400">
                                                    Distância: {distanciaLegivel(situacao.distanciaMetros)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>

                                {erros[delivery.id] && (
                                    <div className="mt-3 flex items-start gap-2 text-sm bg-red-950/70 border border-red-500/60 rounded-lg px-3 py-2">
                                        <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                                        <p className="text-red-200 flex-1 min-w-0 break-words">{erros[delivery.id]}</p>
                                        <button
                                            type="button"
                                            onClick={() => limparErro(delivery.id)}
                                            aria-label="Fechar aviso"
                                            className="text-red-400 hover:text-red-200 shrink-0"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Linha de ações: fora do canto flutuante, com 44px de altura e o
                                    botão principal ocupando a largura. Antes eram botões de ~24px
                                    empilhados sobre o texto — o "Entregue" colava no WhatsApp. */}
                                <div className="mt-3 pt-3 border-t border-zinc-700 flex flex-wrap items-stretch gap-2">
                                    {podeAceitar && (
                                        <button
                                            type="button"
                                            onClick={() => handleAcceptClick(delivery.id)}
                                            disabled={carregando}
                                            className={`${BOTAO} flex-1 basis-full sm:basis-0 bg-yellow-500 text-yellow-950 hover:bg-yellow-400`}
                                        >
                                            {carregando ? <Loader2 size={16} className="animate-spin" /> : "🙋"}
                                            Aceitar corrida
                                        </button>
                                    )}
                                    {podePegar && (
                                        <button
                                            type="button"
                                            onClick={() => handlePickupClick(delivery.id)}
                                            disabled={carregando}
                                            className={`${BOTAO} flex-1 basis-full sm:basis-0 bg-blue-500 text-white hover:bg-blue-400`}
                                        >
                                            {carregando ? <Loader2 size={16} className="animate-spin" /> : "📦"}
                                            Peguei o pedido
                                        </button>
                                    )}
                                    {podeEntregar && (
                                        <button
                                            type="button"
                                            onClick={() => handleCompleteClick(delivery.id)}
                                            disabled={carregando}
                                            className={`${BOTAO} flex-1 basis-full sm:basis-0 bg-green-600 text-white hover:bg-green-500`}
                                            title={longe ? `Você está a ${distanciaLegivel(situacao.distanciaMetros)} do local — vai pedir uma confirmação a mais.` : "Marcar como Entregue"}
                                        >
                                            {isMotoboy ? "✅ Entregue" : "✅ Marcar entregue"}
                                        </button>
                                    )}

                                    {podeDestinar && (
                                        <button
                                            type="button"
                                            onClick={() => { limparErro(delivery.id); setEscolhendo({ id: delivery.id, para: "destinar" }); }}
                                            disabled={destinando}
                                            className={`${BOTAO} bg-indigo-600 text-white hover:bg-indigo-500`}
                                            title={delivery.motoboyId ? "Trocar o motoboy ou devolver pra fila" : "Mandar essa corrida pra um motoboy específico"}
                                        >
                                            <UserPlus size={16} />
                                            {delivery.motoboyId ? "Trocar" : "Destinar"}
                                        </button>
                                    )}

                                    {/* Navegar: link direto, sem depender da "Gerar Rota". Vai com
                                        lat/lng quando a corrida tem pino conferido. */}
                                    {!delivery.masked && (
                                        <a
                                            href={linkNavegacao(delivery)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${BOTAO} bg-zinc-700 text-white hover:bg-zinc-600`}
                                            title="Abrir o endereço no Google Maps"
                                        >
                                            <Navigation size={16} />
                                            Navegar
                                        </a>
                                    )}

                                    {delivery.customerPhone && (
                                        <a
                                            href={montarLinkWhatsApp(delivery, baseUrl)}
                                            onClick={(e) => {
                                                if (baseUrl) return; // já tem link completo
                                                e.preventDefault();
                                                window.open(montarLinkWhatsApp(delivery, window.location.origin), '_blank', 'noopener,noreferrer');
                                            }}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${BOTAO} bg-green-700 text-white hover:bg-green-600`}
                                            title="Enviar Link de Rastreio"
                                        >
                                            <Phone size={16} />
                                            WhatsApp
                                        </a>
                                    )}

                                    {!isMotoboy && delivery.status === 'pending' && !delivery.motoboyId && (
                                        <Link
                                            href={`/deliveries/${delivery.id}/editar`}
                                            className={`${BOTAO} bg-zinc-700 text-white hover:bg-zinc-600`}
                                            title="Editar esta corrida"
                                            aria-label="Editar esta corrida"
                                        >
                                            <Pencil size={16} />
                                            <span className="sr-only sm:not-sr-only">Editar</span>
                                        </Link>
                                    )}

                                    {!isMotoboy && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteClick(delivery.id)}
                                            className={`${BOTAO} bg-red-700 text-white hover:bg-red-600`}
                                            title="Excluir esta corrida"
                                            aria-label="Excluir esta corrida"
                                        >
                                            <Trash2 size={16} />
                                            <span className="sr-only sm:not-sr-only">Excluir</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {deliveries.length === 0 && (
                    <div className="p-8 text-center text-zinc-400 bg-zinc-800 rounded-xl border border-dashed border-zinc-700">
                        Nenhuma entrega cadastrada.
                    </div>
                )}
            </div>
        </>
    );
}

/**
 * "Quem faz essa corrida?" — a escolha do motoboy pela LOJA.
 *
 * Serve pras duas coisas que a loja passou a poder fazer: destinar uma corrida
 * a alguém da equipe (em vez de jogar na fila aberta) e dizer quem fez a
 * entrega na hora de marcar como entregue sem GPS. Nos dois casos o dono da
 * corrida é o que decide em qual carteira o dinheiro cai.
 */
function EscolherMotoboy({
    titulo, ajuda, motoboys, atual, permiteFila, salvando, erro, onCancelar, onEscolher,
}: {
    titulo: string;
    ajuda: string;
    motoboys: { id: number; name: string }[];
    atual: number | null;
    /** Mostra o "devolver pra fila" (só faz sentido ao destinar). */
    permiteFila: boolean;
    salvando: boolean;
    erro: string;
    onCancelar: () => void;
    onEscolher: (motoboyId: number | null) => void;
}) {
    const [escolhido, setEscolhido] = useState<number | null>(atual);

    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape" && !salvando) onCancelar(); };
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [onCancelar, salvando]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!salvando) onCancelar(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-full"><UserPlus className="w-6 h-6 text-indigo-600" /></div>
                    <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">{ajuda}</p>

                <div className="space-y-2 mb-4">
                    {motoboys.map((m) => (
                        <label
                            key={m.id}
                            className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${escolhido === m.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}
                        >
                            <input
                                type="radio"
                                name="motoboy-escolhido"
                                checked={escolhido === m.id}
                                onChange={() => setEscolhido(m.id)}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">
                                {m.name}{atual === m.id ? " (está com ela)" : ""}
                            </span>
                        </label>
                    ))}
                    {permiteFila && (
                        <label className={`flex items-center gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${escolhido === null ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}>
                            <input
                                type="radio"
                                name="motoboy-escolhido"
                                checked={escolhido === null}
                                onChange={() => setEscolhido(null)}
                                className="w-4 h-4 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-800">↩️ Deixar na fila (qualquer motoboy pega)</span>
                        </label>
                    )}
                </div>

                {erro && <p className="mb-3 text-sm font-medium text-red-600">{erro}</p>}

                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={salvando}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
                    >
                        Voltar
                    </button>
                    <button
                        type="button"
                        onClick={() => onEscolher(escolhido)}
                        disabled={salvando || (!permiteFila && escolhido === null)}
                        className="min-h-11 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {salvando && <Loader2 size={16} className="animate-spin" />}
                        {salvando ? "Salvando…" : "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * A confirmação a mais de quem está longe do endereço (ou sem GPS).
 * O motivo é obrigatório: é o que a loja lê depois pra entender o que houve.
 */
function ConfirmacaoForaDoRaio({
    pergunta, motivo, onMotivo, erro, salvando, onCancelar, onConfirmar,
}: {
    pergunta: string;
    motivo: string;
    onMotivo: (v: string) => void;
    erro: string;
    salvando: boolean;
    onCancelar: () => void;
    onConfirmar: () => void;
}) {
    const campo = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        campo.current?.focus();
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape" && !salvando) onCancelar(); };
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [onCancelar, salvando]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!salvando) onCancelar(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Finalizar entrega fora do endereço"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-orange-100 rounded-full"><MapPin className="w-6 h-6 text-orange-600" /></div>
                    <h3 className="text-lg font-bold text-gray-900">Confirmar mesmo assim?</h3>
                </div>
                <p className="text-gray-700 mb-4 text-sm leading-relaxed">{pergunta}</p>

                <label htmlFor="motivo-fora-raio" className="block text-sm font-medium text-gray-700 mb-1">
                    Por que você está finalizando daqui?
                </label>
                <textarea
                    id="motivo-fora-raio"
                    ref={campo}
                    value={motivo}
                    onChange={(e) => onMotivo(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Ex.: entreguei na portaria, o pino está na rua errada..."
                    className="w-full px-4 py-2 bg-white text-zinc-900 placeholder-zinc-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                />
                {erro && <p className="mt-2 text-sm font-medium text-red-600">{erro}</p>}
                <p className="mt-2 text-xs text-gray-500">
                    Isso fica anotado na corrida pra loja conferir depois.
                </p>

                <div className="flex gap-3 justify-end mt-5">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={salvando}
                        className="min-h-11 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
                    >
                        Voltar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmar}
                        disabled={salvando}
                        className="min-h-11 px-4 rounded-lg font-bold bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {salvando && <Loader2 size={16} className="animate-spin" />}
                        {salvando ? "Salvando…" : "Finalizar mesmo assim"}
                    </button>
                </div>
            </div>
        </div>
    );
}
