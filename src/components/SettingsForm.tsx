"use client";

import { updateSettingsAction } from "@/app/actions/settings";
import { useActionState, useState } from "react";
import { CheckCircle, Save, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    } | null;
}

const PAYMENT_MODELS = [
    { id: "fixed", label: "Taxa Fixa", description: "Valor único por entrega realizada." },
    { id: "distance", label: "Por KM", description: "Calculado pela distância da rota." },
    { id: "hybrid", label: "Fixo + KM", description: "Taxa de saída + valor por Km rodado." },
    { id: "daily", label: "Diária", description: "Valor fixo por dia de trabalho." },
] as const;

export default function SettingsForm({ initialData }: SettingsFormProps) {
    const [state, formAction, isPending] = useActionState(updateSettingsAction, initialState);
    const [model, setModel] = useState(initialData?.remunerationModel || "fixed");

    return (
        <form action={formAction} className="space-y-8">
            {/* Remuneration Model Section */}
            <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Save size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900">Modelo de Pagamento</h2>
                        <p className="text-sm text-zinc-500">Como você paga seus entregadores?</p>
                    </div>
                </div>

                {/* Active Status Summary */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-6 text-white shadow-lg mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <CheckCircle size={24} className="text-white" />
                        </div>
                        <div>
                            <p className="text-blue-100 text-sm font-medium">Modelo Atual</p>
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
                                    ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200 ring-offset-2"
                                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                            )}
                        >
                            {model === item.id && (
                                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">
                                    Ativo
                                </div>
                            )}
                            <div className="flex justify-between items-center mb-2">
                                <span className={`font-bold ${model === item.id ? "text-blue-700" : "text-zinc-700"}`}>
                                    {item.label}
                                </span>
                                {model === item.id && <CheckCircle size={20} className="text-blue-600" />}
                            </div>
                            <p className={cn("text-xs", model === item.id ? "text-blue-600" : "text-zinc-500")}>
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>

                <input type="hidden" name="remunerationModel" value={model} />

                <div className="space-y-4">
                    {(model === "fixed" || model === "hybrid") && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Taxa Fixa (por entrega)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="fixedValue"
                                    type="text"
                                    defaultValue={initialData?.fixedValue?.toFixed(2).replace('.', ',')}
                                    placeholder="5,00"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {(model === "distance" || model === "hybrid") && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Valor por KM</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="valuePerKm"
                                    type="text"
                                    defaultValue={initialData?.valuePerKm?.toFixed(2).replace('.', ',')}
                                    placeholder="1,50"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {model === "daily" && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Valor da Diária</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-zinc-400">R$</span>
                                <input
                                    name="dailyValue"
                                    type="text"
                                    defaultValue={initialData?.dailyvalue?.toFixed(2).replace('.', ',')}
                                    placeholder="50,00"
                                    className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-zinc-100">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 mb-1">
                            Mínimo Garantido (Opcional)
                            <div title="Se o motoboy não atingir esse valor no dia, você completa." className="text-zinc-400 cursor-help">
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
                                className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Valor mínimo que o motoboy recebe no dia, independente das entregas.</p>
                    </div>
                </div>
            </Card>

            {state?.message && (
                <div className={`p-4 rounded-xl text-center font-medium ${state.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {state.message}
                </div>
            )}

            <Button
                type="submit"
                disabled={isPending}
                className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/10"
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
