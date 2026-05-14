"use client";

import { updateSettingsAction } from "@/app/actions/settings";
import { useActionState, useState } from "react";
import { CheckCircle, Save, HelpCircle, DollarSign, Eye, EyeOff, MapPin, Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState = {
    message: "",
    success: false
};

interface SettingsFormProps {
    initialData?: {
        remunerationModel: "fixed" | "distance" | "daily" | "hybrid";
        fixedValue: number;
        valuePerKm: number;
        dailyvalue: number;
        guaranteedMinimum: number;
        showCustomerName?: boolean | null;
        showCustomerPhone?: boolean | null;
        showOrderValue?: boolean | null;
        showObservation?: boolean | null;
        defaultCity?: string | null;
        defaultState?: string | null;
        shopLat?: number | null;
        shopLng?: number | null;
    } | null;
}

const PRIVACY_FIELDS = [
    { key: "showCustomerName", label: "Nome do cliente", desc: "Aparece como cabeçalho de cada entrega.", default: true },
    { key: "showCustomerPhone", label: "Telefone / WhatsApp do cliente", desc: "Habilita o botão de mensagem direta no WhatsApp.", default: true },
    { key: "showOrderValue", label: "Valor do pedido", desc: "Preço dos produtos (não é a taxa do motoboy).", default: false },
    { key: "showObservation", label: "Observação do pedido", desc: "Instruções extras (ex.: \"tocar interfone 10\").", default: true },
] as const;

const PAYMENT_MODELS = [
    { id: "fixed", label: "Taxa Fixa", description: "Valor único por entrega realizada." },
    { id: "distance", label: "Por KM", description: "Calculado pela distância da rota." },
    { id: "hybrid", label: "Fixo + KM", description: "Taxa de saída + valor por Km rodado." },
    { id: "daily", label: "Diária", description: "Valor fixo por dia de trabalho." },
] as const;

export default function SettingsForm({ initialData }: SettingsFormProps) {
    const [state, formAction, isPending] = useActionState(updateSettingsAction, initialState);
    const [model, setModel] = useState(initialData?.remunerationModel || "fixed");

    const [shopLat, setShopLat] = useState<string>(
        initialData?.shopLat != null ? String(initialData.shopLat) : ""
    );
    const [shopLng, setShopLng] = useState<string>(
        initialData?.shopLng != null ? String(initialData.shopLng) : ""
    );
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    const captureLocation = () => {
        setLocateError(null);
        if (!("geolocation" in navigator)) {
            setLocateError("Navegador não suporta geolocalização.");
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setShopLat(pos.coords.latitude.toFixed(6));
                setShopLng(pos.coords.longitude.toFixed(6));
                setLocating(false);
            },
            (err) => {
                setLocateError(err.message || "Falha ao obter localização.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <form action={formAction} className="space-y-8">
            {/* Remuneration Model Section */}
            <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-green-600 rounded-lg">
                        <DollarSign size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Modelo de Pagamento</h2>
                        <p className="text-sm text-zinc-400">Como você paga seus entregadores?</p>
                    </div>
                </div>

                {/* Active Status Summary */}
                <div className="bg-green-600 rounded-xl p-6 text-white shadow-lg mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <CheckCircle size={24} className="text-white" />
                        </div>
                        <div>
                            <p className="text-green-100 text-sm font-medium">Modelo Atual</p>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {model === "fixed" && <>Taxa Fixa <span className="text-white/80 font-normal">(R$ {initialData?.fixedValue?.toFixed(2).replace('.', ',') || '0,00'})</span></>}
                                {model === "distance" && <>Por KM <span className="text-white/80 font-normal">(R$ {initialData?.valuePerKm?.toFixed(2).replace('.', ',') || '0,00'}/km)</span></>}
                                {model === "hybrid" && <>Híbrido <span className="text-white/80 font-normal text-sm">(R$ {initialData?.fixedValue?.toFixed(2).replace('.', ',')} + R$ {initialData?.valuePerKm?.toFixed(2).replace('.', ',')}/km)</span></>}
                                {model === "daily" && <>Diária <span className="text-white/80 font-normal">(R$ {initialData?.dailyvalue?.toFixed(2).replace('.', ',') || '0,00'})</span></>}
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {PAYMENT_MODELS.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setModel(item.id)}
                            className={cn(
                                "cursor-pointer border-2 rounded-xl p-4 transition-all relative overflow-hidden",
                                model === item.id
                                    ? "border-green-500 bg-green-900/30"
                                    : "border-zinc-600 hover:border-zinc-500 bg-zinc-700/50"
                            )}
                        >
                            {model === item.id && (
                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">
                                    Ativo
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-2">
                                <span className={`font-bold ${model === item.id ? "text-green-400" : "text-white"}`}>
                                    {item.label}
                                </span>
                                {model === item.id && <CheckCircle size={20} className="text-green-400" />}
                            </div>
                            <p className={cn("text-xs", model === item.id ? "text-green-300" : "text-zinc-400")}>
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>

                <input type="hidden" name="remunerationModel" value={model} />

                <div className="space-y-4">
                    {(model === "fixed" || model === "hybrid") && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Taxa Fixa (por entrega)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="fixedValue"
                                    type="text"
                                    defaultValue={initialData?.fixedValue?.toFixed(2).replace('.', ',')}
                                    placeholder="5,00"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {(model === "distance" || model === "hybrid") && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Valor por KM</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="valuePerKm"
                                    type="text"
                                    defaultValue={initialData?.valuePerKm?.toFixed(2).replace('.', ',')}
                                    placeholder="1,50"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {model === "daily" && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">Valor da Diária</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="dailyValue"
                                    type="text"
                                    defaultValue={initialData?.dailyvalue?.toFixed(2).replace('.', ',')}
                                    placeholder="50,00"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-zinc-700">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                            Mínimo Garantido (Opcional)
                            <div title="Se o motoboy não atingir esse valor no dia, você completa." className="text-zinc-500 cursor-help">
                                <HelpCircle size={14} />
                            </div>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                            <input
                                name="guaranteedMinimum"
                                type="text"
                                defaultValue={initialData?.guaranteedMinimum?.toFixed(2).replace('.', ',')}
                                placeholder="0,00"
                                className="w-full pl-10 pr-4 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Valor mínimo que o motoboy recebe no dia, independente das entregas.</p>
                    </div>
                </div>
            </div>

            {/* Localização da Loja */}
            <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-amber-600 rounded-lg">
                        <MapPin size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Localização da Loja</h2>
                        <p className="text-sm text-zinc-400">
                            Quando um endereço chegar sem cidade/UF (ex.: "Rua dos Bobos, 123"), o sistema completa automaticamente com sua cidade pra evitar geocodificar em estado errado.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-zinc-300 mb-1">
                            Cidade padrão
                        </label>
                        <input
                            name="defaultCity"
                            type="text"
                            defaultValue={initialData?.defaultCity ?? ""}
                            placeholder="Uberaba"
                            className="w-full px-3 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">
                            UF
                        </label>
                        <input
                            name="defaultState"
                            type="text"
                            maxLength={2}
                            defaultValue={initialData?.defaultState ?? ""}
                            placeholder="MG"
                            className="w-full px-3 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white placeholder-zinc-500 uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <div>
                            <p className="text-sm font-medium text-zinc-300">Coordenada da loja (opcional)</p>
                            <p className="text-xs text-zinc-500">
                                Limita a busca de endereços a ~60km da sua loja — evita resultado em outro estado.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={captureLocation}
                            disabled={locating}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                        >
                            {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                            {locating ? "Localizando..." : "Capturar minha localização"}
                        </button>
                    </div>

                    {locateError && (
                        <p className="text-xs text-red-400 mb-2">⚠️ {locateError}</p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Latitude</label>
                            <input
                                name="shopLat"
                                type="text"
                                value={shopLat}
                                onChange={(e) => setShopLat(e.target.value)}
                                placeholder="-19.7472"
                                className="w-full px-3 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Longitude</label>
                            <input
                                name="shopLng"
                                type="text"
                                value={shopLng}
                                onChange={(e) => setShopLng(e.target.value)}
                                placeholder="-47.9381"
                                className="w-full px-3 py-2 border border-zinc-600 bg-zinc-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    {shopLat && shopLng && (
                        <a
                            href={`https://www.openstreetmap.org/?mlat=${shopLat}&mlon=${shopLng}#map=16/${shopLat}/${shopLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-3 text-xs text-amber-400 hover:text-amber-300"
                        >
                            <MapPin size={12} /> Ver no mapa
                        </a>
                    )}
                </div>
            </div>

            {/* Privacidade do Motoboy */}
            <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-600 rounded-lg">
                        <Eye size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Privacidade — o que o motoboy enxerga</h2>
                        <p className="text-sm text-zinc-400">Endereço e taxa do motoboy são sempre visíveis. Os demais campos você escolhe.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {PRIVACY_FIELDS.map((f) => {
                        const checked = (initialData as any)?.[f.key] ?? f.default;
                        return (
                            <label
                                key={f.key}
                                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-700 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    name={f.key}
                                    defaultChecked={!!checked}
                                    className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-white text-sm font-medium">{f.label}</div>
                                    <div className="text-zinc-500 text-xs">{f.desc}</div>
                                </div>
                            </label>
                        );
                    })}
                </div>
                <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
                    <EyeOff size={12} /> Campos desmarcados ficam ocultos para o motoboy mesmo se a sua API/PDV enviar o dado.
                </p>
            </div>

            {state?.message && (
                <div className={`p-4 rounded-xl text-center font-medium ${state.success ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
                    {state.message}
                </div>
            )}

            <Button
                type="submit"
                disabled={isPending}
                className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-500"
            >
                {isPending ? "Salvando..." : (
                    <>
                        <Save size={20} className="mr-2" />
                        Salvar Configurações
                    </>
                )}
            </Button>
        </form>
    );
}
