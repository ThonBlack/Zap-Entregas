import Link from "next/link";
import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft, Plus } from "lucide-react";
import NovaCorridaDaFilaForm from "@/components/fila/NovaCorridaDaFilaForm";
import FilaExpirada from "@/components/fila/FilaExpirada";
import { carregarSessaoValida } from "@/lib/queueSession";

export const metadata = { title: "Lançar corrida · Fila da loja" };
export const dynamic = "force-dynamic";

/**
 * Lançar uma corrida que não veio do PDV — cliente ligou, passou na loja, pediu
 * no WhatsApp.
 *
 * Nasce já liberada pros motoboys (não vira rascunho): quem digita é a mesma
 * pessoa que conferiria depois, então pedir uma conferência seria um clique à
 * toa.
 *
 * O local da loja vai pra tela porque é ela conferindo uma entrega dela — é a
 * referência que puxa as sugestões de endereço pra perto em vez de espalhar
 * pelo Brasil.
 */
export default async function LancarPelaFilaPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const sessao = await carregarSessaoValida(token);
    if (!sessao) return <FilaExpirada />;

    const base = `/fila/${token}`;

    const settings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, sessao.shopkeeperId),
        columns: { defaultCity: true, defaultState: true, shopLat: true, shopLng: true },
    });

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
                        <Plus size={18} className="text-green-400 shrink-0" />
                        <h1 className="font-bold truncate text-white">Lançar corrida</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4">
                <NovaCorridaDaFilaForm
                    queueToken={token}
                    voltarPara={base}
                    defaultCity={settings?.defaultCity ?? null}
                    defaultState={settings?.defaultState ?? null}
                    shopLat={settings?.shopLat ?? null}
                    shopLng={settings?.shopLng ?? null}
                />
            </main>
        </div>
    );
}
