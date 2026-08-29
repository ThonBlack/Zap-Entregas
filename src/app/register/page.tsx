import { isGoogleLoginConfigured } from "@/lib/google-oauth";
import { conviteDeLojistaValido } from "@/lib/registerInvite";
import RegisterForm from "./RegisterForm";

// Sem isto o Next monta a página no BUILD, dentro da imagem, onde
// GOOGLE_CLIENT_ID (e o código do convite) não existem — e a tela sairia errada
// em produção.
export const dynamic = "force-dynamic";

export default async function RegisterPage({
    searchParams,
}: {
    searchParams: Promise<{ convite_lojista?: string }>;
}) {
    const { convite_lojista } = await searchParams;

    // Só quem chega com o código da loja na URL enxerga a opção "Sou Lojista".
    const conviteLojista = conviteDeLojistaValido(convite_lojista) ? convite_lojista! : null;

    return (
        <RegisterForm
            googleEnabled={isGoogleLoginConfigured()}
            conviteLojista={conviteLojista}
        />
    );
}
