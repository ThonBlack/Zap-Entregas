import { isGoogleLoginConfigured } from "@/lib/google-oauth";
import LoginForm from "./LoginForm";

/** Mensagens dos retornos de login com Google que não deram certo. */
const AVISOS: Record<string, string> = {
    google_desligado: "Login com Google ainda não está configurado neste servidor.",
    google_cancelado: "Login com Google cancelado.",
    google_state: "A tentativa de login expirou. Tente de novo.",
    google_falhou: "Não consegui falar com o Google. Tente de novo.",
    google_email_nao_verificado: "Esse e-mail não está verificado no Google.",
    google_sem_conta: "Essa conta Google não está ligada a nenhum usuário. Entre com telefone e senha e conecte o Google em Configurações.",
    conta_desativada: "Conta desativada. Fale com o administrador.",
    sessao_expirada: "Sua sessão expirou. Entre de novo.",
};

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ erro?: string }>;
}) {
    const { erro } = await searchParams;

    return (
        <LoginForm
            googleEnabled={isGoogleLoginConfigured()}
            avisoExterno={erro ? AVISOS[erro] : undefined}
        />
    );
}
