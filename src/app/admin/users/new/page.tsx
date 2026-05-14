import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import AdminCreateUserForm from "./AdminCreateUserForm";

export default async function AdminNewUserPage() {
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (me?.role !== "admin") redirect("/app");

    return (
        <div className="min-h-screen bg-zinc-900 pb-20">
            <header className="bg-gradient-to-r from-green-900 to-emerald-900 border-b border-green-700 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Link
                        href="/admin/users"
                        className="p-2 text-green-300 hover:text-white rounded-lg hover:bg-green-800/50 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <UserPlus size={20} /> Criar Usuário
                        </h1>
                        <p className="text-green-300 text-xs">Lojista, motoboy ou admin — sem passar pelo cadastro público</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                <Card className="p-6 bg-zinc-800 border-zinc-700">
                    <AdminCreateUserForm />
                </Card>
            </main>
        </div>
    );
}
