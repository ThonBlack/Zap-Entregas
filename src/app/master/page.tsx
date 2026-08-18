import { redirect } from "next/navigation";

// Página canônica é /admin/master — este arquivo só redireciona links antigos.
export default function MasterRedirect() {
    redirect("/admin/master");
}
