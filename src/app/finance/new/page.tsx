import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { requireShopkeeper } from "@/lib/session";
import { getBalances, MANUAL_ENTRY_OPTIONS, safeReturnTo, type ManualEntryKey } from "@/lib/wallet";
import ManualEntryForm from "@/components/finance/ManualEntryForm";

export default async function NewTransactionPage({
    searchParams,
}: {
    searchParams: Promise<{ motoboyId?: string; entry?: string; amount?: string; returnTo?: string }>;
}) {
    await requireShopkeeper();
    const sp = await searchParams;

    const motoboys = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.role, "motoboy"));
    const balances = await getBalances(motoboys.map(m => m.id));
    const list = motoboys.map(m => ({ ...m, balance: balances.get(m.id) ?? 0 }));

    const defaultMotoboyId = sp.motoboyId ? Number(sp.motoboyId) : undefined;
    const defaultEntry = sp.entry && sp.entry in MANUAL_ENTRY_OPTIONS ? (sp.entry as ManualEntryKey) : undefined;
    const defaultAmount = sp.amount ? Number(sp.amount) : undefined;
    const returnTo = safeReturnTo(sp.returnTo);

    return (
        <div className="min-h-screen bg-zinc-50 pb-20">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex items-center gap-4 shadow-sm">
                <Link href={returnTo} className="text-zinc-500 hover:text-zinc-900">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Lançamento na carteira</h1>
            </header>

            <main className="max-w-xl mx-auto p-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200">
                    {list.length === 0 ? (
                        <p className="text-zinc-600">
                            Nenhum motoboy cadastrado.{" "}
                            <Link href="/motoboys" className="text-green-700 underline">Cadastre um primeiro</Link>.
                        </p>
                    ) : (
                        <ManualEntryForm
                            motoboys={list}
                            defaultMotoboyId={defaultMotoboyId}
                            defaultEntry={defaultEntry}
                            defaultAmount={Number.isFinite(defaultAmount) ? defaultAmount : undefined}
                            returnTo={returnTo}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
