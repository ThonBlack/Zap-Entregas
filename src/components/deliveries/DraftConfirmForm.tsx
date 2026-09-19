"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bike, Loader2, MapPin, Trash2 } from "lucide-react";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { confirmDraftAction, cancelDraftAction } from "@/app/actions/drafts";
import { updatePendingDeliveryAction } from "@/app/actions/deliveries";
import {
    cancelarCorridaDaFilaAction,
    conferirRascunhoDaFilaAction,
    editarCorridaDaFilaAction,
} from "@/app/actions/queue";
import {
    CHARGE_MODES,
    CHARGE_MODE_AJUDA,
    CHARGE_MODE_LABEL,
    chargeModeDaCorrida,
    type ChargeMode,
} from "@/lib/chargeMode";

const PinPicker = dynamic(() => import("@/components/map/PinPicker"), {
    ssr: false,
    loading: () => <div className="h-[300px] w-full bg-zinc-800 rounded-xl animate-pulse" />,
});

export interface DraftForConfirm {
    id: number;
    address: string;
    lat: number | null;
    lng: number | null;
    customerName: string | null;
    customerPhone: string | null;
    value: number | null;
    fee: number | null;
    observation: string | null;
    createdAt: string | null;
    /** exata | rua | bairro | cidade — o quanto dá pra confiar no pino que veio */
    geoPrecision?: string | null;
    /** "receber" | "conferir" | "pago". Ausente = corrida antiga (régua do valor). */
    chargeMode?: string | null;
}

interface DraftConfirmFormProps {
    draft: DraftForConfirm;
    shopLat: number | null;
    shopLng: number | null;
    defaultCity: string | null;
    defaultState: string | null;
    /** Endereço caiu longe da loja: provavelmente o geocoder errou. */
    isSuspect: boolean;
    /** A loja esconde o valor do pedido do motoboy — cobrança combinada não apareceria pra ele. */
    hidesValueFromMotoboy: boolean;
    /** Presente quando a tela foi aberta pelo PDV (sem login). Muda o "depois de salvar". */
    confirmToken?: string;
    /**
     * Código da Fila da loja. Quando vem, é ELE que autoriza: o formulário passa
     * a falar com as ações de src/app/actions/queue.ts, que revalidam o código e
     * conferem que a corrida é da loja dele antes de qualquer coisa.
     *
     * O formulário é o mesmo de propósito — o vendedor confere endereço, pino e
     * cobrança exatamente como o caixa faz pela janelinha do PDV.
     */
    queueToken?: string;
    /**
     * Pra onde voltar depois de salvar ou cancelar. Usado pela fila (volta pra
     * lista). Sem isto vale o comportamento de sempre: pelo PDV a janela avisa a
     * venda e fecha; logado, vai pro /app.
     */
    voltarPara?: string;
    /** Chave do Google pro navegador (vem do servidor). Vazia = mapa do OpenStreetMap. */
    googleMapsKey?: string | null;
    /**
     * "conferencia" (padrão) = rascunho do PDV virando corrida.
     * "edicao" = corrida já liberada, ainda sem motoboy, sendo corrigida pelo lojista.
     */
    modo?: "conferencia" | "edicao";
    /**
     * Motoboys ativos da equipe. Vazio pela tela do PDV (sem login não dá pra
     * saber de que loja é quem está conferindo) — aí o campo nem aparece.
     */
    motoboys?: { id: number; name: string }[];
    /**
     * Mostrar o campo "Taxa da corrida"? Padrão sim.
     *
     * A Fila da loja desliga: quem está nessa tela é o VENDEDOR, e quanto o
     * motoboy ganha é acerto entre a loja e ele. O valor já gravado não se perde
     * — viaja num campo escondido (ver lá embaixo).
     */
    mostrarTaxa?: boolean;
}

// Dinheiro na tela é sempre "150,50" — nunca "150.5".
const money = (n: number | null | undefined) =>
    n == null ? "" : n.toFixed(2).replace(".", ",");

export default function DraftConfirmForm({
    draft, shopLat, shopLng, defaultCity, defaultState, isSuspect, hidesValueFromMotoboy, confirmToken,
    googleMapsKey, modo = "conferencia", motoboys = [], queueToken, voltarPara,
    mostrarTaxa = true,
}: DraftConfirmFormProps) {
    const editando = modo === "edicao";
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [showCancel, setShowCancel] = useState(false);

    // Sem coordenada (geocode falhou) cai no centro da loja pra ter de onde arrastar.
    const startLat = draft.lat && draft.lat !== 0 ? draft.lat : (shopLat ?? -19.7472);
    const startLng = draft.lng && draft.lng !== 0 ? draft.lng : (shopLng ?? -47.9381);
    const hadNoPin = !draft.lat || draft.lat === 0;

    const [lat, setLat] = useState(startLat);
    const [lng, setLng] = useState(startLng);
    const [pinTouched, setPinTouched] = useState(false);
    const [recenter, setRecenter] = useState(0);
    const [cobranca, setCobranca] = useState<ChargeMode>(chargeModeDaCorrida(draft));
    const [concluido, setConcluido] = useState<"liberada" | "cancelada" | null>(null);
    /** Vazio = fila aberta (qualquer motoboy pega), como sempre foi. */
    const [motoboyId, setMotoboyId] = useState("");
    const pedeValor = cobranca !== "pago";

    const doPdv = Boolean(confirmToken);
    const daFila = Boolean(queueToken);

    /**
     * O que fazer depois que deu certo.
     *
     * Três destinos: a fila volta pra lista dela, a janelinha do PDV avisa a
     * venda e fecha, e o app logado vai pro painel.
     */
    const aoTerminar = (resultado: "liberada" | "cancelada") => {
        if (voltarPara) {
            router.push(voltarPara);
            router.refresh();
            return;
        }
        if (doPdv) { encerrarPeloPdv(resultado); return; }
        router.push("/app");
        router.refresh();
    };

    /**
     * Aberto pelo PDV: avisa a tela da venda e fecha sozinho.
     * Nada de router.push — aqui não existe app em volta, só esta janela.
     */
    const encerrarPeloPdv = (resultado: "liberada" | "cancelada") => {
        setConcluido(resultado);
        try {
            window.parent?.postMessage({ tipo: "zap-entregas:conferencia", resultado, deliveryId: draft.id }, "*");
            window.opener?.postMessage({ tipo: "zap-entregas:conferencia", resultado, deliveryId: draft.id }, "*");
        } catch { /* janela sem parente: só mostra o aviso abaixo */ }
        setTimeout(() => { try { window.close(); } catch { } }, 1200);
    };

    // O pino quase nunca cai na porta da casa: dizer QUÃO perto ele está evita
    // que alguém libere uma corrida apontando pro meio do bairro sem perceber.
    const aviso = (pinTouched || (editando && !hadNoPin && !isSuspect)) ? null
        : hadNoPin
            ? "Não achei esse endereço no mapa. Arraste o pino até o lugar certo antes de liberar."
            : isSuspect
                ? "Esse endereço caiu longe da loja — confira se o pino está no lugar certo."
                : draft.geoPrecision === "cidade"
                    ? "Só consegui localizar a cidade — o pino está no centro, longe do lugar real. Ajuste antes de liberar."
                    : draft.geoPrecision === "bairro"
                        ? "Localizei só o bairro, não a rua. Confira o pino antes de liberar."
                        : draft.geoPrecision === "rua"
                            ? "Achei a rua, mas não o número exato. Confira se o pino está na altura certa."
                            : null;

    const handlePinMove = useCallback((newLat: number, newLng: number) => {
        setLat(newLat);
        setLng(newLng);
        setPinTouched(true);
    }, []);

    const handleAddressChange = useCallback((_address: string, newLat?: number, newLng?: number) => {
        if (newLat != null && newLng != null) {
            setLat(newLat);
            setLng(newLng);
            setPinTouched(true);
            setRecenter(v => v + 1);
        }
    }, []);

    // Endereço que nem o Google nem o OpenStreetMap acharam: o pino começa no
    // meio da loja. Liberar sem mexer nele gravava a LOJA como destino "exato" —
    // e o motoboy ficava sem conseguir fechar a entrega na casa do cliente.
    // (Só na conferência do rascunho — ao EDITAR uma corrida já liberada o
    // servidor refaz a busca do endereço sozinho, sem carimbar "exata".)
    const precisaColocarPino = !editando && hadNoPin && !pinTouched;

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        if (precisaColocarPino) {
            setError("Arraste o pino até o lugar da entrega antes de liberar — esse endereço não foi encontrado no mapa.");
            return;
        }
        const fd = new FormData(e.currentTarget);
        fd.set("lat", String(lat));
        fd.set("lng", String(lng));
        if (confirmToken) fd.set("confirmToken", confirmToken);
        if (queueToken) fd.set("queueToken", queueToken);
        fd.set("pinTouched", pinTouched ? "1" : "0");
        startTransition(async () => {
            const res = daFila
                ? (editando
                    ? await editarCorridaDaFilaAction(fd)
                    : await conferirRascunhoDaFilaAction(fd))
                : (editando
                    ? await updatePendingDeliveryAction(fd)
                    : await confirmDraftAction(fd));
            if (res && "error" in res) { setError(res.error); return; }
            aoTerminar("liberada");
        });
    };

    const doCancel = () => {
        setShowCancel(false);
        setError("");
        const fd = new FormData();
        fd.set("id", String(draft.id));
        if (confirmToken) fd.set("confirmToken", confirmToken);
        if (queueToken) fd.set("queueToken", queueToken);
        startTransition(async () => {
            const res = daFila
                ? await cancelarCorridaDaFilaAction(fd)
                : await cancelDraftAction(fd);
            if (res && "error" in res) { setError(res.error); return; }
            aoTerminar("cancelada");
        });
    };

    if (concluido) {
        // Dentro do iframe do PDV, window.close() é no-op: quem fecha é o PDV,
        // reagindo ao postMessage. Só prometer "fecha sozinha" quando esta janela
        // realmente puder fechar (aberta por script, não embutida).
        const dentroDeIframe = typeof window !== "undefined" && window.parent !== window;
        return (
            <div className="p-6 rounded-2xl bg-zinc-800 border border-zinc-700 text-center space-y-2">
                <p className="text-lg font-semibold text-white">
                    {concluido === "liberada" ? "✅ Corrida liberada pros motoboys" : "Corrida cancelada"}
                </p>
                <p className="text-sm text-zinc-400">
                    {dentroDeIframe ? "Pode voltar pra venda." : "Pode fechar esta janela."}
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-5">
            <input type="hidden" name="id" value={draft.id} />

            {aviso && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/40">
                    <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-200">{aviso}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Endereço da entrega</label>
                <AddressAutocomplete
                    name="address"
                    value={draft.address}
                    onChange={handleAddressChange}
                    defaultCity={defaultCity ?? "Uberaba"}
                    defaultState={defaultState ?? "MG"}
                    shopLat={shopLat}
                    shopLng={shopLng}
                    confirmToken={confirmToken}
                    filaToken={queueToken}
                    required
                />
                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                    <MapPin size={13} />
                    Arraste o pino ou toque no mapa pra ajustar o ponto exato.
                    {pinTouched && <span className="text-green-400">Ponto ajustado ✓</span>}
                </p>
            </div>

            <PinPicker
                lat={lat}
                lng={lng}
                onMove={handlePinMove}
                recenterTrigger={recenter}
                shopLat={shopLat}
                shopLng={shopLng}
                googleMapsKey={googleMapsKey}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Cliente</label>
                    <input
                        name="customerName"
                        defaultValue={draft.customerName ?? ""}
                        className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Telefone</label>
                    <input
                        name="customerPhone"
                        defaultValue={draft.customerPhone ?? ""}
                        inputMode="tel"
                        className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                    />
                </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 space-y-3">
                <p className="text-sm font-medium text-white">Como esse pedido é pago?</p>
                {/* Três casos diferentes que antes viviam num checkbox só: cobrar
                    na porta não é a mesma coisa que conferir o Pix DA LOJA — no
                    segundo o dinheiro nem passa pela mão do motoboy. */}
                <input type="hidden" name="chargeMode" value={cobranca} />
                <div className="space-y-2">
                    {CHARGE_MODES.map((modo) => (
                        <label
                            key={modo}
                            className={`flex items-start gap-3 p-3 min-h-11 rounded-lg border cursor-pointer transition-colors ${cobranca === modo ? "border-green-500 bg-green-500/10" : "border-zinc-600 hover:bg-zinc-700/60"}`}
                        >
                            <input
                                type="radio"
                                name="chargeModeRadio"
                                checked={cobranca === modo}
                                onChange={() => setCobranca(modo)}
                                className="mt-0.5 w-5 h-5 accent-green-600"
                            />
                            <span>
                                <span className="block text-sm font-medium text-white">
                                    {modo === "receber" ? "💵 " : modo === "conferir" ? "🔎 " : "✅ "}
                                    {CHARGE_MODE_LABEL[modo]}
                                </span>
                                <span className="block text-xs text-zinc-400">{CHARGE_MODE_AJUDA[modo]}</span>
                            </span>
                        </label>
                    ))}
                </div>

                {pedeValor && (
                    <>
                        <div>
                            <label htmlFor="valor-cobranca" className="block text-xs text-zinc-400 mb-1">
                                {cobranca === "conferir" ? "Valor do Pix (R$)" : "Quanto receber (R$)"}
                            </label>
                            <input
                                id="valor-cobranca"
                                name="value"
                                defaultValue={money(draft.value)}
                                inputMode="decimal"
                                placeholder="0,00"
                                className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                            />
                        </div>
                        {hidesValueFromMotoboy && (
                            <p className="text-xs text-yellow-300">
                                Atenção: nas configurações da loja o valor do pedido está escondido do motoboy —
                                ele não vai ver quanto {cobranca === "conferir" ? "conferir" : "cobrar"}. Escreva na observação ou ligue &quot;mostrar valor&quot; em Configurações.
                            </p>
                        )}
                    </>
                )}
            </div>

            {motoboys.length > 0 && (
                <div>
                    <label htmlFor="motoboy-destino" className="block text-sm font-medium text-zinc-300 mb-2">
                        Motoboy (opcional)
                    </label>
                    <select
                        id="motoboy-destino"
                        name="motoboyId"
                        value={motoboyId}
                        onChange={(e) => setMotoboyId(e.target.value)}
                        className="w-full px-3 py-2.5 min-h-11 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                    >
                        <option value="">Deixar na fila (qualquer motoboy pega)</option>
                        {motoboys.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">
                        Escolhendo alguém, só ele recebe o aviso e a corrida já sai no nome dele.
                    </p>
                </div>
            )}

            {/* Quem NÃO pode ver o ganho do motoboy não recebe o campo de jeito
                nenhum — nem escondido. Um `type="hidden"` continua escrito no
                código-fonte da página, e a fila da loja roda DENTRO do painel do
                EpicStore: bastaria o vendedor abrir o inspetor pra ler quanto o
                motoboy ganha.

                Quem guarda a taxa nesse caminho é o servidor: a conferência pela
                fila relê o valor do banco (src/app/actions/queue.ts) e a edição
                pela fila nem toca no campo. */}
            {mostrarTaxa && (
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Taxa da corrida (R$)</label>
                    <input
                        name="fee"
                        defaultValue={money(draft.fee)}
                        inputMode="decimal"
                        placeholder="0,00"
                        className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">É o que o motoboy ganha por essa entrega.</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Observação pro motoboy</label>
                <textarea
                    name="observation"
                    defaultValue={draft.observation ?? ""}
                    rows={3}
                    placeholder="Ex.: portão azul, chamar no interfone, entregar na portaria…"
                    className="w-full px-3 py-2.5 rounded-lg border border-zinc-600 bg-zinc-700 text-white outline-none focus:border-green-500"
                />
            </div>

            {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3">{error}</p>
            )}

            <div className="flex flex-col-reverse md:flex-row gap-3 pt-1">
                {editando ? (
                    <button
                        type="button"
                        onClick={() => router.push(voltarPara ?? "/app")}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        Voltar sem salvar
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowCancel(true)}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={18} /> Cancelar corrida
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isPending || precisaColocarPino}
                    title={precisaColocarPino ? "Coloque o pino no lugar da entrega primeiro" : undefined}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
                    {editando ? "Salvar alterações" : "Liberar pros motoboys"}
                </button>
            </div>

            <ConfirmationModal
                isOpen={showCancel}
                onClose={() => setShowCancel(false)}
                onConfirm={doCancel}
                title="Cancelar essa corrida?"
                description="A corrida some da lista e nenhum motoboy vai vê-la. A venda no PDV não é afetada."
                confirmText="Cancelar corrida"
                cancelText="Voltar"
                variant="danger"
            />
        </form>
    );
}
