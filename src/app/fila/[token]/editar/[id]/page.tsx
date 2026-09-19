import Link from "next/link";
import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Pencil } from "lucide-react";
import DraftConfirmForm from "@/components/deliveries/DraftConfirmForm";
import FilaExpirada from "@/components/fila/FilaExpirada";
import { carregarSessaoValida } from "@/lib/queueSession";
import { podeEditarNaFila } from "@/lib/fila-shared";
import { isAddressSuspicious } from "@/lib/routeUtils";
import { getBrowserMapsKey } from "@/lib/mapsKey";
import { rotuloCorrida } from "@/lib/dailySeq-shared";

export const metadata = { title: "Editar corrida · Fila da loja" };
export const dynamic = "force-dynamic";

/**
 * Corrigir uma corrida já liberada, pela fila da loja.
 *
 * Mesma tela do lojista logado (`/deliveries/[id]/editar`) — o `DraftConfirmForm`
 * em modo "edicao". A diferença é a autorização (código da fila, não sessão) e
 * a janela: aqui vale também a corrida que já está no nome de um motoboy que
 * ainda não veio buscar. É o caso real do balcão — o cliente liga corrigindo o
 * número da casa enquanto o motoboy está vindo.
 *
 * A régua de quem pode ser editada mora em src/lib/fila-shared.ts e é conferida
 * DE NOVO na action: a tela é só a primeira barreira.
 */
export default async function EditarPelaFilaPage({
    params,
}: {
    params: Promise<{ token: string; id: string }>;
}) {
    const { token, id: idBruto } = await params;
    const sessao = await carregarSessaoValida(token);
    if (!sessao) return <FilaExpirada />;

    const base = `/fila/${token}`;
    const id = Number(idBruto);

    const corrida = Number.isInteger(id) && id > 0
        ? await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.shopkeeperId, sessao.shopkeeperId),
            ),
        })
        : null;

    if (!corrida || !podeEditarNaFila(corrida)) {
        return (
            <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
                <div className="max-w-sm text-center space-y-4">
                    <h1 className="text-xl font-bold text-white">
                        {corrida ? "Essa corrida não dá mais pra corrigir" : "Corrida não encontrada"}
                    </h1>
                    <p className="text-sm text-zinc-400">
                        {corrida
                            ? "O motoboy já saiu com o pedido. Fale com ele pelo telefone."
                            : "Ela não está mais na fila desta loja."}
                    </p>
                    <Link
                        href={base}
                        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 transition-colors"
                    >
                        Voltar pra fila
                    </Link>
                </div>
            </div>
        );
    }

    const settings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, sessao.shopkeeperId),
    });

    const isSuspect = isAddressSuspicious(
        corrida.lat ?? 0, corrida.lng ?? 0, settings?.shopLat, settings?.shopLng, 100
    );

    const comoChamar = rotuloCorrida(corrida.dailySeq) ?? `#${corrida.id}`;

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link
                        href={base}
                        aria-label="Voltar pra fila"
                        className="flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2 min-w-0">
                        <Pencil size={18} className="text-green-400 shrink-0" />
                        <h1 className="font-bold truncate text-white">Editar {comoChamar}</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4">
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
                        chargeMode: corrida.chargeMode,
                    }}
                    shopLat={settings?.shopLat ?? null}
                    shopLng={settings?.shopLng ?? null}
                    defaultCity={settings?.defaultCity ?? null}
                    defaultState={settings?.defaultState ?? null}
                    isSuspect={isSuspect}
                    hidesValueFromMotoboy={settings?.showOrderValue === false}
                    googleMapsKey={getBrowserMapsKey()}
                    queueToken={token}
                    voltarPara={base}
                    mostrarTaxa={false}
                />
            </main>
        </div>
    );
}
