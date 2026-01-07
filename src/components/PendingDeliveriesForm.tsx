"use client";

import { useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { optimizeSelectedRouteAction } from "@/app/actions/logistics";
import ConfirmationModal from "./ConfirmationModal";
import RefreshButton from "./RefreshButton";

interface Delivery {
    id: number;
    address: string;
    customerName: string | null;
    value: number | null;
    stopOrder: number | null;
}

interface PendingDeliveriesFormProps {
    deliveries: Delivery[];
}

export default function PendingDeliveriesForm({ deliveries }: PendingDeliveriesFormProps) {
    const [selected, setSelected] = useState<number[]>([]);

    const toggle = (id: number) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(i => i !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        action: () => Promise<void>;
        requireWord?: string;
        variant: "danger" | "warning";
    }>({ isOpen: false, title: "", description: "", action: async () => { }, variant: "danger" });

    // Actions wrapped with client-side modal
    const handleDeleteClick = (id: number) => {
        setModalConfig({
            isOpen: true,
            title: "Excluir Entrega",
            description: "Tem certeza que deseja excluir esta entrega? Esta ação não pode ser desfeita.",
            requireWord: "EXCLUIR",
            variant: "danger",
            action: async () => {
                try {
                    const m = await import("@/app/actions/logistics");
                    const res = await m.deleteDeliveryAction(id);
                    if (res?.error) {
                        alert(res.error);
                    } else {
                        // Success
                        // Force a router refresh to ensure UI sync
                        // (Though revalidatePath should handle it, this is a fallback)
                        import("next/navigation").then(({ useRouter }) => {
                            // Can't use hook in callback easily, but we can assume revalidate works or reload
                            window.location.reload();
                        });
                    }
                } catch (e) {
                    alert("Erro ao conectar com servidor.");
                }
            }
        });
    };

    const handleCompleteClick = (id: number) => {
        setModalConfig({
            isOpen: true,
            title: "Finalizar Entrega",
            description: "ATENÇÃO: Ao confirmar a entrega, os dados sensíveis do cliente (endereço, telefone) ficarão ocultos para proteção de privacidade (LGPD). Confirma a entrega?",
            variant: "warning",
            action: async () => {
                const m = await import("@/app/actions/logistics");
                await m.completeDeliveryAction(id);
                window.location.reload();
            }
        });
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
            />
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-zinc-800">Entregas Pendentes ({deliveries.length})</h3>
                    <div className="flex items-center gap-2">
                        <RefreshButton />
                        <button
                            onClick={async () => {
                                if (selected.length < 1) return;

                                // Call server action to optimize and get URL
                                const result = await optimizeSelectedRouteAction(selected);

                                if (result.success && result.url) {
                                    window.open(result.url, '_blank');
                                } else {
                                    alert("Erro ao gerar rota ou rota vazia.");
                                }
                            }}
                            disabled={selected.length < 1}
                            className="flex items-center gap-2 bg-blue-600 disabled:bg-zinc-300 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/10 active:scale-95"
                        >
                            <Play size={16} fill="currentColor" />
                            Gerar Rota ({selected.length})
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {deliveries.map((delivery) => (
                        <div key={delivery.id} className={`group relative block bg-white p-4 rounded-xl shadow-sm border transition-all ${selected.includes(delivery.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-zinc-200'}`}>
                            {/* Quick Actions overlay on hover (desktop) or always visible (mobile) if improved */}
                            <div className="absolute top-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); handleCompleteClick(delivery.id); }}
                                    className="p-1 px-2 bg-green-100 text-green-700 text-xs font-bold rounded hover:bg-green-200"
                                    title="Marcar como Entregue"
                                >
                                    Entregue
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); handleDeleteClick(delivery.id); }}
                                    className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <label className="flex items-start gap-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="selectedDelivery"
                                    value={delivery.id}
                                    checked={selected.includes(delivery.id)}
                                    onChange={() => toggle(delivery.id)}
                                    className="mt-1 w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-zinc-900 text-sm">{delivery.customerName || "Cliente"}</h4>
                                        <span className="text-zinc-500 text-xs font-mono mr-12">#{delivery.id}</span>
                                    </div>
                                    <p className="text-zinc-600 text-sm mb-1">{delivery.address}</p>
                                    <div className="text-xs text-zinc-500">
                                        Ordem Atual: {delivery.stopOrder || '-'} • Valor: R$ {delivery.value || 0}
                                    </div>
                                </div>
                            </label>
                        </div>
                    ))}
                </div>

                {deliveries.length === 0 && (
                    <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                        Nenhuma entrega cadastrada.
                    </div>
                )}
            </div>
        </>
    );
}
