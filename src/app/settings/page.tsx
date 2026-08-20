import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import SettingsForm from "@/components/admin/SettingsForm";
import AvatarForm from "@/components/auth/AvatarForm";
import ApiKeyForm from "@/components/admin/ApiKeyForm";
import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { isGoogleLoginConfigured } from "@/lib/google-oauth";
import GoogleAccountCard from "@/components/auth/GoogleAccountCard";

const AVISOS_GOOGLE: Record<string, string> = {
    google_em_uso: "Essa conta Google já está ligada a outro usuário.",
    google_cancelado: "Conexão com o Google cancelada.",
    google_state: "A tentativa expirou. Tente de novo.",
    google_falhou: "Não consegui falar com o Google. Tente de novo.",
    google_email_nao_verificado: "Esse e-mail não está verificado no Google.",
    google_desligado: "Login com Google não está configurado neste servidor.",
};

export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ erro?: string; google?: string }>;
}) {
    const { erro, google } = await searchParams;
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) redirect("/login");

    const currentSettings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, userId)
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
                <GoogleAccountCard
                    connected={Boolean(user.googleId)}
                    email={user.email}
                    enabled={isGoogleLoginConfigured()}
                    aviso={erro ? AVISOS_GOOGLE[erro] : undefined}
                    sucesso={google === "conectado"}
                />
                <ApiKeyForm userId={user.id} currentApiKey={user.apiKey || null} />
            </main>
        </div>
    );
}

