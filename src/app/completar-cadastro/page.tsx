import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import CompleteProfileForm from "./CompleteProfileForm";

/**
 * Tela de "Complete seu cadastro" — só aparece pra quem criou a conta pelo
 * Google e ainda não informou o telefone. Quem já tem telefone volta pro app.
 */
export default async function CompletarCadastroPage() {
    const userId = await getSessionUserId();
    if (!userId) redirect("/login");

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, name: true, email: true, phone: true, isActive: true },
    });

    if (!user || user.isActive === false) redirect("/login");
    if (user.phone) redirect("/app");

    return <CompleteProfileForm nome={user.name} email={user.email} />;
}
