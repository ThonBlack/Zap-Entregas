"use client";

import { useState, useEffect } from "react";
import { Play, Plus, Trash2, Phone, MapPin } from "lucide-react";
import { optimizeSelectedRouteAction } from "@/app/actions/logistics";
import ConfirmationModal from "./ConfirmationModal";
import RefreshButton from "./RefreshButton";

interface Delivery {
    id: number;
    address: string;
    customerName: string | null;
    customerPhone: string | null;
    value: number | null;
    stopOrder: number | null;
    lat: number | null;
    lng: number | null;
}

interface PendingDeliveriesFormProps {
    deliveries: Delivery[];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export default function PendingDeliveriesForm({ deliveries }: PendingDeliveriesFormProps) {
    const [selected, setSelected] = useState<number[]>([]);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);

    useEffect(() => {
        if (!("geolocation" in navigator)) return;

        const watcher = navigator.geolocation.watchPosition(
            (position) => {
                setCurrentLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => console.error("Error getting location", error),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

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
                    <h3 className="font-bold text-white">Entregas Pendentes ({deliveries.length})</h3>
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
                            className="flex items-center gap-2 bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg active:scale-95"
                        >
                            <Play size={16} fill="currentColor" />
                            Gerar Rota ({selected.length})
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {deliveries.map((delivery) => {
                        let distance = 0;
                        let canDeliver = true; // Default to true if no geofencing data

                        if (delivery.lat && delivery.lng && currentLocation) {
                            distance = calculateDistance(currentLocation.lat, currentLocation.lng, delivery.lat, delivery.lng);
                            // Enable if within 100m (or slightly more to be safe, e.g., 150m due to GPS inaccuracy)
                            canDeliver = distance <= 150;
                        }

                        return (
                            <div key={delivery.id} className={`group relative block bg-zinc-800 p-4 rounded-xl shadow-sm border transition-all ${selected.includes(delivery.id) ? 'border-green-500 ring-1 ring-green-500 bg-zinc-700' : 'border-zinc-700'}`}>
                                {/* Actions Overlay */}
                                <div className="absolute top-2 right-2 flex gap-2">
                                    {delivery.customerPhone && (
                                        <a
                                            href={`https://wa.me/55${delivery.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${delivery.customerName || 'Cliente'}, seu pedido está a caminho! 🏍️\nAcompanhe em tempo real: http://192.168.1.17:4000/tracking/${delivery.id}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 px-2 bg-green-500 text-white text-xs font-bold rounded flex items-center gap-1 hover:bg-green-400 shadow-sm"
                                            title="Enviar Link de Rastreio"
                                        >
                                            <Phone size={14} />
                                            <span className="hidden md:inline">WhatsApp</span>
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); handleCompleteClick(delivery.id); }}
                                        disabled={!canDeliver}
                                        className={`p-1 px-2 text-xs font-bold rounded flex items-center gap-1 shadow-sm transition-colors
                                        ${canDeliver
                                                ? 'bg-green-600 text-white hover:bg-green-500'
                                                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                            }`}
                                        title={!canDeliver ? `Você está a ${Math.round(distance)}m do local. Aproxime-se para finalizar.` : "Marcar como Entregue"}
                                    >
                                        <CheckCircleIcon canDeliver={canDeliver} />
                                        <span>Entregue</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); handleDeleteClick(delivery.id); }}
                                        className="p-1 bg-red-600 text-white rounded hover:bg-red-500"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <label className="flex items-start gap-4 cursor-pointer mt-8 md:mt-0">
                                    <input
                                        type="checkbox"
                                        name="selectedDelivery"
                                        value={delivery.id}
                                        checked={selected.includes(delivery.id)}
                                        onChange={() => toggle(delivery.id)}
                                        className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-green-500 focus:ring-green-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-white text-sm">{delivery.customerName || "Cliente"}</h4>
                                            <span className="text-zinc-400 text-xs font-mono mr-12 md:mr-32">#{delivery.id}</span>
                                        </div>
                                        <p className="text-zinc-300 text-sm mb-1">{delivery.address}</p>
                                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                                            <span>Ordem: {delivery.stopOrder || '-'}</span>
                                            <span>Valor: R$ {delivery.value || 0}</span>
                                            {currentLocation && delivery.lat && (
                                                <span className={distance > 150 ? "text-orange-400" : "text-green-400"}>
                                                    Distância: {distance > 1000 ? (distance / 1000).toFixed(1) + 'km' : Math.round(distance) + 'm'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>
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

function CheckCircleIcon({ canDeliver }: { canDeliver: boolean }) {
    if (canDeliver) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
    );
}
