import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getAuthUserWithRole, getSessionUserId } from "@/lib/session";
import { isAddressSuspicious } from "@/lib/routeUtils";
import DraftConfirmForm from "@/components/deliveries/DraftConfirmForm";
import { getBrowserMapsKey } from "@/lib/mapsKey";
import { fmtShortDateTime } from "@/lib/datetime";

/**
 * Corrigir uma corrida que já foi liberada mas ninguém aceitou ainda.
 *
 * Reaproveita a tela de conferência do PDV em modo "edicao": os campos são os
 * mesmos (endereço no mapa, cliente, telefone, valor, taxa, observação), só muda
 * o que acontece ao salvar.
 */
export default async function EditarCorridaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: rawId } = await params;
    const id = Number(rawId);

    const sessionUserId = await getSessionUserId();
    const auth = await getAuthUserWithRole(["shopkeeper", "admin"]);
    if ("error" in auth) redirect(sessionUserId ? "/app" : "/login");
    const me = auth.user;

    if (!Number.isInteger(id) || id <= 0) redirect("/app");

    const corrida = await db.query.deliveries.findFirst({ where: eq(deliveries.id, id) });

    // Lojista só mexe no que é dele; admin vê tudo.
    if (!corrida || (me.role !== "admin" && corrida.shopkeeperId !== me.id)) redirect("/app");

    // Rascunho tem tela própria (a de conferência). Aceita/entregue não se edita.
    if (corrida.status === "draft") redirect(`/deliveries/${id}/confirmar`);
    if (corrida.status !== "pending" || corrida.motoboyId != null) redirect("/app");

    const settings = corrida.shopkeeperId != null
        ? await db.query.shopSettings.findFirst({ where: eq(shopSettings.userId, corrida.shopkeeperId) })
        : null;

    const isSuspect = isAddressSuspicious(
        corrida.lat ?? 0, corrida.lng ?? 0, settings?.shopLat, settings?.shopLng, 100
    );

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            <header className="border-b border-zinc-800 bg-zinc-900/95 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                    <Link href="/app" className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Pencil size={20} className="text-green-400" />
                        <div>
                            <h1 className="font-bold leading-tight">Editar corrida #{corrida.id}</h1>
                            <p className="text-xs text-zinc-400">
                                Ninguém aceitou ainda{corrida.createdAt ? ` · criada ${fmtShortDateTime(corrida.createdAt)}` : ""}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 md:p-6">
                <DraftConfirmForm
                    modo="edicao"
                    draft={{
                        id: corrida.id,
                        address: corrida.address,
                        lat: corrida.lat,
                        lng: corrida.lng,
                        customerName: corrida.customerName,
                        customerPhone: corrida.customerPhone,
                        value: corrida.value,
                        fee: corrida.fee,
                        observation: corrida.observation,
                        createdAt: corrida.createdAt,
                        geoPrecision: corrida.geoPrecision,
                    }}
                    shopLat={settings?.shopLat ?? null}
                    shopLng={settings?.shopLng ?? null}
                    defaultCity={settings?.defaultCity ?? null}
                    defaultState={settings?.defaultState ?? null}
                    isSuspect={isSuspect}
                    hidesValueFromMotoboy={settings?.showOrderValue === false}
                    googleMapsKey={getBrowserMapsKey()}
                />
            </main>
        </div>
    );
}
