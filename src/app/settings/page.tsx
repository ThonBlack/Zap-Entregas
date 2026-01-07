import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SettingsForm from "@/components/SettingsForm";
import { db } from "@/db";
import { shopSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const cookieStore = await cookies();
    const userId = cookieStore.get("user_id")?.value;

    if (!userId) redirect("/login");

    // Fetch existing settings
    const currentSettings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, Number(userId))
    });

    return (
        <div className="min-h-screen bg-zinc-50 pb-20 md:pb-8">
            <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
                <Link href="/" className="p-2 -ml-2 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-bold text-zinc-900">Configurações da Loja</h1>
            </header>

            <main className="max-w-2xl mx-auto p-6">
                {/* Pass data to Client Component */}
                <SettingsForm initialData={currentSettings as any} />
            </main>
        </div>
    );
}
