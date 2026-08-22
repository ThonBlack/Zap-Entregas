import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PackageCheck } from "lucide-react";
import { isAddressSuspicious } from "@/lib/routeUtils";
import DraftConfirmForm from "@/components/deliveries/DraftConfirmForm";

/**
 * Conferência aberta pelo PDV, por cima da venda.
 *
 * Quem abre é o caixa, que não tem conta no Zap: a autorização é o código da URL,
 * que vale só pra esta corrida, expira e some depois de usado. Por isso a página
 * mostra o mínimo — nada de menu, saldo ou outras entregas.
 */
export default async function ConfirmarPeloPdvPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const draft = token && token.length >= 16
        ? await db.query.deliveries.findFirst({ where: eq(deliveries.confirmToken, token) })
        : null;

    const expirado = Boolean(
        draft?.confirmTokenExpiresAt && new Date(draft.confirmTokenExpiresAt) < new Date()
    );

    if (!draft || draft.status !== "draft" || expirado) {
        return (
            <Recado
                titulo={
                    !draft ? "Link inválido"
                        : expirado ? "Link expirado"
                            : draft.status === "canceled" ? "Corrida cancelada"
                                : "Corrida já liberada"
                }
                texto={
                    !draft ? "Esse link de conferência não existe mais."
                        : expirado ? "Esse link venceu. Confira a corrida pelo aplicativo do Zap Entregas."
                            : draft.status === "canceled" ? "Essa corrida foi cancelada."
                                : "Alguém já conferiu e liberou essa corrida pros motoboys."
                }
            />
        );
    }

    const settings = draft.shopkeeperId != null
        ? await db.query.shopSettings.findFirst({ where: eq(shopSettings.userId, draft.shopkeeperId) })
        : null;

    const isSuspect = isAddressSuspicious(
        draft.lat ?? 0, draft.lng ?? 0, settings?.shopLat, settings?.shopLng, 100
    );

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            <header className="border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
                <PackageCheck size={18} className="text-green-400" />
                <h1 className="font-bold">Conferir endereço da entrega</h1>
            </header>

            <main className="max-w-3xl mx-auto p-4">
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
                    confirmToken={token}
                />
            </main>
        </div>
    );
}

function Recado({ titulo, texto }: { titulo: string; texto: string }) {
    return (
        <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
            <div className="max-w-sm text-center space-y-3">
                <h1 className="text-xl font-bold">{titulo}</h1>
                <p className="text-zinc-400 text-sm">{texto}</p>
                <p className="text-zinc-500 text-xs">Pode fechar esta janela.</p>
            </div>
        </div>
    );
}
