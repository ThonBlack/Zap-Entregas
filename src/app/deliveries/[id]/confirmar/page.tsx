import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { getAuthUserWithRole } from "@/lib/session";
import { isAddressSuspicious } from "@/lib/routeUtils";
import DraftConfirmForm from "@/components/deliveries/DraftConfirmForm";

/**
 * Conferência da corrida criada pelo PDV: ajustar endereço no mapa, definir
 * cobrança e observação antes de liberar pros motoboys.
 */
export default async function ConfirmarCorridaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: rawId } = await params;
    const id = Number(rawId);

    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect("/login");
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) redirect("/app");

    const draft = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });

    // Lojista só mexe no que é dele; admin vê tudo.
    if (!draft || (me.role !== "admin" && draft.shopkeeperId !== me.id)) redirect("/app");

    // Já liberada (ou cancelada): não há o que conferir.
    if (draft.status !== "draft") redirect("/app");

    const settings = draft.shopkeeperId != null
        ? await db.query.shopSettings.findFirst({ where: eq(shopSettings.userId, draft.shopkeeperId) })
        : null;

    const isSuspect = isAddressSuspicious(
        draft.lat ?? 0, draft.lng ?? 0, settings?.shopLat, settings?.shopLng, 100
    );

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            <header className="border-b border-zinc-800 bg-zinc-900/95 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                    <Link href="/app" className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <PackageCheck size={20} className="text-green-400" />
                        <div>
                            <h1 className="font-bold leading-tight">Conferir corrida</h1>
                            <p className="text-xs text-zinc-400">
                                Veio do PDV{draft.createdAt ? ` · ${new Date(draft.createdAt + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6">
                <DraftConfirmForm
                    draft={{
                        id: draft.id,
                        address: draft.address,
                        lat: draft.lat,
                        lng: draft.lng,
                        customerName: draft.customerName,
                        customerPhone: draft.customerPhone,
                        value: draft.value,
                        fee: draft.fee,
                        observation: draft.observation,
                        createdAt: draft.createdAt,
                        geoPrecision: draft.geoPrecision,
                    }}
                    shopLat={settings?.shopLat ?? null}
                    shopLng={settings?.shopLng ?? null}
                    defaultCity={settings?.defaultCity ?? null}
                    defaultState={settings?.defaultState ?? null}
                    isSuspect={isSuspect}
                    hidesValueFromMotoboy={settings?.showOrderValue === false}
                />
            </main>
        </div>
    );
}
