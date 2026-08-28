import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Estado em que uma conta nova nasce.
 *
 * Fica aqui pra valer igual pros dois caminhos de cadastro (por telefone e
 * pelo Google): quem entra pelo Google não pode nascer com plano diferente de
 * quem entra digitando o telefone.
 */

const TRIAL_DAYS = 30;
const MAX_TRIAL_USERS = 100;

export interface ContaNovaDefaults {
    plan: "free" | "enterprise";
    subscriptionStatus: "active" | "trial";
    isTrialUser: boolean;
    trialEndsAt: string | null;
}

/** Os 100 primeiros cadastros ganham 30 dias de teste; depois disso, plano free. */
export async function defaultsDeContaNova(): Promise<ContaNovaDefaults> {
    const contagem = await db.select({ count: sql<number>`count(*)` }).from(users).get();
    const total = contagem?.count || 0;
    const ganhaTeste = total < MAX_TRIAL_USERS;

    return {
        plan: ganhaTeste ? "enterprise" : "free",
        subscriptionStatus: ganhaTeste ? "trial" : "active",
        isTrialUser: ganhaTeste,
        trialEndsAt: ganhaTeste
            ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
            : null,
    };
}
