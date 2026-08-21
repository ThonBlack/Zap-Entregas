"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bike, Loader2, MapPin, Trash2 } from "lucide-react";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import { confirmDraftAction, cancelDraftAction } from "@/app/actions/drafts";

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
}

const money = (n: number | null | undefined) =>
    n == null ? "" : String(n).replace(".", ",");

export default function DraftConfirmForm({
    draft, shopLat, shopLng, defaultCity, defaultState, isSuspect, hidesValueFromMotoboy,
}: DraftConfirmFormProps) {
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
    const [collect, setCollect] = useState((draft.value ?? 0) > 0);

    // O pino quase nunca cai na porta da casa: dizer QUÃO perto ele está evita
    // que alguém libere uma corrida apontando pro meio do bairro sem perceber.
    const aviso = pinTouched ? null
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

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        fd.set("lat", String(lat));
        fd.set("lng", String(lng));
        startTransition(async () => {
            const res = await confirmDraftAction(fd);
            if (res && "error" in res) { setError(res.error); return; }
            router.push("/app");
            router.refresh();
        });
    };

    const doCancel = () => {
        setShowCancel(false);
        setError("");
        const fd = new FormData();
        fd.set("id", String(draft.id));
        startTransition(async () => {
            const res = await cancelDraftAction(fd);
            if (res && "error" in res) { setError(res.error); return; }
            router.push("/app");
            router.refresh();
        });
    };

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
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        name="collect"
                        checked={collect}
                        onChange={(e) => setCollect(e.target.checked)}
                        className="w-5 h-5 accent-green-600"
                    />
                    <span className="text-sm font-medium text-white">O motoboy tem que receber do cliente</span>
                </label>

                {collect && (
                    <>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Quanto receber (R$)</label>
                            <input
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
                                ele não vai ver quanto cobrar. Escreva na observação ou ligue &quot;mostrar valor&quot; em Configurações.
                            </p>
                        )}
                    </>
                )}
                {!collect && (
                    <p className="text-xs text-zinc-400">Desmarcado = pedido já pago, o motoboy só entrega.</p>
                )}
            </div>

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
                <button
                    type="button"
                    onClick={() => setShowCancel(true)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                    <Trash2 size={18} /> Cancelar corrida
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <Bike size={18} />}
                    Liberar pros motoboys
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
