import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

/**
 * Usado nas telas de entrar/criar conta: quem já está logado vai direto pro app
 * (ou pra completar o cadastro, quando a conta veio do Google e ainda não tem
 * telefone). Conta desativada — ou que sumiu do banco — NÃO é redirecionada:
 * a pessoa precisa ver a tela de login pra sair do limbo.
 *
 * `redirect` do Next funciona lançando uma exceção: nunca chame dentro de
 * try/catch, senão o desvio é engolido.
 */
export async function redirecionarSeJaLogado(): Promise<void> {
    const userId = await getSessionUserId();
    if (!userId) return;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, phone: true, isActive: true },
    });

    if (!user || user.isActive === false) return;

    redirect(user.phone ? "/app" : "/completar-cadastro");
}
