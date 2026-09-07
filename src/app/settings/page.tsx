import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import SettingsForm from "@/components/admin/SettingsForm";
import AvatarForm from "@/components/auth/AvatarForm";
import ApiKeyForm from "@/components/admin/ApiKeyForm";
import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireShopkeeper } from "@/lib/session";
import { isGoogleLoginConfigured } from "@/lib/google-oauth";
import GoogleAccountCard from "@/components/auth/GoogleAccountCard";
import PasskeyCard from "@/components/auth/PasskeyCard";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";
import { webauthnCredentials } from "@/db/schema";

const AVISOS_GOOGLE: Record<string, string> = {
    google_em_uso: "Essa conta Google já está ligada a outro usuário.",
    google_email_em_uso: "O e-mail dessa conta Google já está cadastrado aqui por outra pessoa. Entre com ele ou use outra conta Google.",
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
    // Tela da LOJA: motoboy não entra (aqui ficam a regra de pagamento, o que ele
    // pode ver de cada entrega e a chave de API do PDV). Conta desativada também não.
    const sessao = await requireShopkeeper();
    const userId = sessao.id;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) redirect("/login");

    const currentSettings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.userId, userId)
    });

    const passkeys = await db.select({
        id: webauthnCredentials.id,
        deviceName: webauthnCredentials.deviceName,
        createdAt: webauthnCredentials.createdAt,
        lastUsedAt: webauthnCredentials.lastUsedAt,
    }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));

    return (
        <div className="min-h-screen bg-zinc-900 pb-20 md:pb-8">
            <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-md">
                <Link href="/app" className="p-2 -ml-2 text-zinc-400 hover:text-green-400 rounded-full hover:bg-zinc-700 transition-colors">
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
                <ChangePasswordCard temSenha={Boolean(user.password)} />
                <PasskeyCard passkeys={passkeys} />
                <ApiKeyForm userId={user.id} currentApiKey={user.apiKey || null} />
            </main>
        </div>
    );
}

