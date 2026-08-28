import { isGoogleLoginConfigured } from "@/lib/google-oauth";
import RegisterForm from "./RegisterForm";

// Sem isto o Next monta a página no BUILD, dentro da imagem, onde
// GOOGLE_CLIENT_ID não existe — e o botão do Google sumiria em produção.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
    return <RegisterForm googleEnabled={isGoogleLoginConfigured()} />;
}
