import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import SettingsForm from "@/components/SettingsForm";
import AvatarForm from "@/components/AvatarForm";
import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, Number(userId))
    });

    if (!user) redirect("/login");

    const currentSettings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, Number(userId))
    });

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
                <Link href="/" className="p-2 -ml-2 text-zinc-400 hover:text-green-400 rounded-full hover:bg-zinc-700 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex items-center gap-2">
                    <Settings size={20} className="text-green-400" />
                    <h1 className="text-xl font-bold text-white">Configurações da Loja</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-6 space-y-6">
                <AvatarForm
                    user={{
                        id: user.id,
                        name: user.name,
                        avatarUrl: user.avatarUrl
                    }}
                />
                <SettingsForm initialData={currentSettings as any} />
            </main>
        </div>
    );
}

