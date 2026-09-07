// Título da aba: sem isso toda tela do app se chama "Zap Entregas".
export const metadata = { title: "Histórico · Zap Entregas" };

import { db } from "@/db";
import { deliveries, users, shopSettings } from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, ShieldCheck } from "lucide-react";
import { fmtDateTime, hojeBrasilia } from "@/lib/datetime";
import { formatBRL, parseMonth } from "@/lib/wallet-shared";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "cartao" cru na tela virava "cartao" sem cedilha; aqui vira "Cartão". */
const METHOD_LABEL: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao: "Cartão",
};

/**
 * Teto de segurança. Com 29 entregas por dia, um mês dá ~870 cards; 200 já é
 * mais do que qualquer pessoa rola. Sem isso a tela carregava o histórico
 * INTEIRO (no admin, o banco todo) num HTML só.
 */
const LIMITE = 200;

/** Datas convivem em dois formatos no banco: comparar por `datetime()` do SQLite. */
const noMes = (col: AnySQLiteColumn, inicio: string, fim: string) =>
    sql`datetime(${col}, '-3 hours') >= ${inicio} AND datetime(${col}, '-3 hours') < ${fim}`;

function limitesDoMes(month: number, year: number) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
        inicio: `${year}-${pad(month)}-01`,
        fim: month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`,
    };
}

export default async function HistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ m?: string; y?: string }>;
}) {
    // requireUser: conta desativada não abre o histórico com a sessão antiga.
    const sessao = await requireUser();

    const user = await db.query.users.findFirst({
        where: eq(users.id, sessao.id),
    });

    if (!user) redirect("/login");

    // Mesmo padrão de navegação de mês do extrato (?m=&y=), pra quem usa os dois
    // não ter que aprender duas coisas.
    const { month, year } = parseMonth(await searchParams);
    const { inicio, fim } = limitesDoMes(month, year);
    const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
    const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };
    const hoje = hojeBrasilia();
    const temProximo = next.y < hoje.year || (next.y === hoje.year && next.m <= hoje.month);

    // A data que vale é a da entrega; corrida antiga sem deliveredAt cai no updatedAt.
    const doMes = sql`(${noMes(deliveries.deliveredAt, inicio, fim)}) OR (${deliveries.deliveredAt} IS NULL AND (${noMes(deliveries.updatedAt, inicio, fim)}))`;

    const escopo =
        user.role === "admin" ? eq(deliveries.status, "delivered") :
            user.role === "shopkeeper"
                ? and(eq(deliveries.shopkeeperId, user.id), eq(deliveries.status, "delivered"))
                : and(eq(deliveries.motoboyId, user.id), eq(deliveries.status, "delivered"));

    let history: any[] = await db.select()
        .from(deliveries)
        .where(and(escopo, doMes))
        .orderBy(desc(deliveries.deliveredAt), desc(deliveries.updatedAt))
        .limit(LIMITE);

    if (user.role === "motoboy") {
        // O valor do pedido segue a MESMA regra do painel: se a loja escolheu não
        // mostrar, aqui também não aparece. Antes o histórico ignorava a config e
        // a loja achava que tinha escondido o valor — e não tinha.
        const lojas = Array.from(new Set(history.map(d => d.shopkeeperId).filter((x): x is number => x != null)));
        const mostraValor = new Map<number, boolean>();
        if (lojas.length) {
            const cfg = await db.select({
                userId: shopSettings.userId,
                showOrderValue: shopSettings.showOrderValue,
            }).from(shopSettings).where(inArray(shopSettings.userId, lojas));
            for (const c of cfg) mostraValor.set(c.userId, c.showOrderValue ?? false);
        }

        history = history.map(d => ({
            ...d,
            address: "🔒 Endereço Protegido (LGPD)",
            customerPhone: "🔒 (xx) xxxxx-xxxx",
            observation: "🔒 Dados Ocultos",
            // Padrão do app é NÃO mostrar valor pro motoboy (igual ao painel).
            value: (d.shopkeeperId != null && mostraValor.get(d.shopkeeperId)) ? d.value : null,
            customerName: d.customerName,
            stopOrder: d.stopOrder,
        }));
    }

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
                <Link href="/app" className="p-2 -ml-2 text-zinc-400 hover:text-green-400 rounded-full hover:bg-zinc-700 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-white">Histórico de Entregas</h1>
                    <p className="text-sm text-zinc-400">
                        {user.role === 'shopkeeper' ? 'Todas as entregas realizadas' : 'Suas entregas realizadas'}
                    </p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-4">
                {/* Navegação de mês — igual à do extrato */}
                <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-2">
                    <Link href={`/deliveries/history?m=${prev.m}&y=${prev.y}`} className="p-2 text-zinc-300 hover:text-white" aria-label="Mês anterior">
                        <ChevronLeft size={20} />
                    </Link>
                    <span className="font-bold text-white capitalize">{MESES[month - 1]} / {year}</span>
                    {temProximo ? (
                        <Link href={`/deliveries/history?m=${next.m}&y=${next.y}`} className="p-2 text-zinc-300 hover:text-white" aria-label="Próximo mês">
                            <ChevronRight size={20} />
                        </Link>
                    ) : (
                        <span className="p-2 text-zinc-700" aria-hidden="true">
                            <ChevronRight size={20} />
                        </span>
                    )}
                </div>

                {user.role === 'motoboy' && (
                    <div className="bg-green-900/30 border border-green-700 p-4 rounded-xl flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-green-400 mt-0.5" />
                        <div className="text-sm text-green-200">
                            <p className="font-bold">Privacidade Ativa</p>
                            <p>Para conformidade com a LGPD e segurança, dados de contato dos clientes são removidos do seu histórico após a conclusão da entrega.</p>
                        </div>
                    </div>
                )}

                {history.length >= LIMITE && (
                    <p className="text-xs text-amber-300 bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2">
                        Mostrando as {LIMITE} entregas mais recentes deste mês. Use as setas pra ver outro mês.
                    </p>
                )}

                {history.length === 0 ? (
                    <div className="text-center p-12 text-zinc-400 bg-zinc-800 rounded-2xl border border-zinc-700">
                        Nenhuma entrega neste mês.
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-700 flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold uppercase rounded-full">
                                        Entregue
                                    </span>
                                    <span className="text-zinc-400 text-xs">
                                        {fmtDateTime(item.deliveredAt || item.updatedAt)}
                                    </span>
                                </div>
                                <h3 className="font-bold text-white text-lg">
                                    {item.customerName || "Cliente"}
                                    {item.stopOrder && (
                                        <span className="ml-2 text-xs font-normal text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded-full border border-zinc-600">
                                            Parada #{item.stopOrder}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2 text-zinc-300">
                                    <MapPin size={16} className="text-green-400" />
                                    <span className={user.role === 'motoboy' ? "italic text-zinc-500" : ""}>
                                        {item.address}
                                    </span>
                                </div>
                                {item.receiptStatus && (
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                        <span className={`px-2 py-1 font-bold rounded-full ${item.receiptStatus === 'nao_recebido' ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-zinc-700 text-zinc-200 border border-zinc-600'}`}>
                                            {item.receiptStatus === 'recebido' && `💵 Recebido: ${formatBRL(item.receivedAmount ?? 0)}${item.receivedMethod ? ` (${METHOD_LABEL[item.receivedMethod] ?? item.receivedMethod})` : ""}`}
                                            {item.receiptStatus === 'valor_diferente' && `✏️ Recebido (outro valor): ${formatBRL(item.receivedAmount ?? 0)}${item.receivedMethod ? ` (${METHOD_LABEL[item.receivedMethod] ?? item.receivedMethod})` : ""}`}
                                            {item.receiptStatus === 'nao_recebido' && '🚫 Não recebido'}
                                            {item.receiptStatus === 'nada_a_receber' && '💳 Já estava pago'}
                                        </span>
                                        {item.receiptNote && (
                                            <span className="text-zinc-400 italic">📝 {item.receiptNote}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {item.value != null && (
                                <div className="flex flex-col items-end justify-center min-w-[100px] border-t md:border-t-0 md:border-l border-zinc-700 pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
                                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Valor</span>
                                    {/* formatBRL já escreve "R$" — o cifrão do ícone virava "$ R$ 180,00". */}
                                    <div className="text-xl font-bold text-white">
                                        {formatBRL(item.value)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    );
}
