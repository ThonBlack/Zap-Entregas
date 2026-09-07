import { redirect } from "next/navigation";
import { getAuthUserWithRole } from "@/lib/session";
import NewMasterProductForm from "@/components/admin/NewMasterProductForm";

/**
 * Cadastro de produto no painel master.
 *
 * A tela era um componente de cliente SEM guarda nenhuma — a única página de
 * /admin que abria pra quem não estava logado. Agora o servidor confere o papel
 * antes de mandar qualquer coisa pro navegador; o formulário virou componente.
 */
export default async function NovoProdutoMasterPage() {
    const auth = await getAuthUserWithRole("admin");
    if ("error" in auth) redirect("/app");

    return <NewMasterProductForm />;
}
