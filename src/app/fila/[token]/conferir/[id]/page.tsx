import Link from "next/link";
import { db } from "@/db";
import { deliveries, shopSettings } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import DraftConfirmForm from "@/components/deliveries/DraftConfirmForm";
import FilaExpirada from "@/components/fila/FilaExpirada";
import { carregarSessaoValida } from "@/lib/queueSession";
import { isAddressSuspicious } from "@/lib/routeUtils";
import { getBrowserMapsKey } from "@/lib/mapsKey";

export const metadata = { title: "Conferir corrida · Fila da loja" };
export const dynamic = "force-dynamic";

/**
 * Conferir o rascunho da venda, autorizado pelo código da FILA.
 *
 * É a mesma tela que o caixa vê na janelinha do PDV (`/confirmar/<código>`) —
 * o mesmo `DraftConfirmForm`, com mapa, pino e escolha de cobrança. O que muda
 * é só quem autoriza e pra onde a tela volta depois: aqui o código vale a loja
 * inteira e o vendedor volta pra fila.
 *
 * O rascunho é buscado com `shopkeeper_id` da sessão no WHERE: trocar o número
 * na URL não alcança a corrida de outra loja — ela simplesmente não existe.
 */
export default async function ConferirPelaFilaPage({
    params,
}: {
    params: Promise<{ token: string; id: string }>;
}) {
    const { token, id: idBruto } = await params;
    const sessao = await carregarSessaoValida(token);
    if (!sessao) return <FilaExpirada />;

    const base = `/fila/${token}`;
    const id = Number(idBruto);

    const rascunho = Number.isInteger(id) && id > 0
        ? await db.query.deliveries.findFirst({
            where: and(
                eq(deliveries.id, id),
                eq(deliveries.shopkeeperId, sessao.shopkeeperId),
            ),
        })
        : null;

    // Já conferida por outro PC do balcão, ou cancelada no meio do caminho:
    // recado curto e o caminho de volta. Nada de erro na cara do vendedor.
    if (!rascunho || rascunho.status !== "draft") {
        return (
            <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center p-6">
                <div className="max-w-sm text-center space-y-4">
                    <h1 className="text-xl font-bold text-white">
                        {rascunho ? "Essa corrida já foi conferida" : "Corrida não encontrada"}
                    </h1>
                    <p className="text-sm text-zinc-400">
                        {rascunho
                            ? "Alguém do balcão já cuidou dela — ou ela foi cancelada."
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
        rascunho.lat ?? 0, rascunho.lng ?? 0, settings?.shopLat, settings?.shopLng, 100
    );

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
                        <ClipboardCheck size={18} className="text-green-400 shrink-0" />
                        <h1 className="font-bold truncate text-white">Conferir endereço da entrega</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4">
                {/* Onde a loja fica vai pra esta tela de propósito: é a PRÓPRIA
                    loja conferindo uma venda dela, e o pino da loja é a
                    referência pro vendedor arrastar o pino do cliente. */}
                <DraftConfirmForm
                    draft={{
                        id: rascunho.id,
                        address: rascunho.address,
                        lat: rascunho.lat,
                        lng: rascunho.lng,
                        customerName: rascunho.customerName,
                        customerPhone: rascunho.customerPhone,
                        value: rascunho.value,
                        // A taxa do motoboy NÃO desce pra esta tela. Prop que vai
                        // pro componente de cliente é serializada no código-fonte
                        // da página — mandar o número aqui o entregaria ao painel
                        // do EpicStore mesmo sem nada aparecer na tela.
                        fee: null,
                        observation: rascunho.observation,
                        createdAt: rascunho.createdAt,
                        geoPrecision: rascunho.geoPrecision,
                        chargeMode: rascunho.chargeMode,
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
                    // Quanto o motoboy ganha não é assunto de quem está no
                    // balcão. O valor calculado pela regra da loja continua
                    // gravado — ele só não aparece nem é editável aqui.
                    mostrarTaxa={false}
                />
            </main>
        </div>
    );
}
