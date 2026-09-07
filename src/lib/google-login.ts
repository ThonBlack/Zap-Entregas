import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { GoogleProfile } from "@/lib/google-oauth";
import { defaultsDeContaNova } from "@/lib/signup";

/**
 * Quem é a pessoa que voltou do Google — e, se ainda não for ninguém, criar.
 *
 * Fica separado da rota de callback de propósito: aqui não há cookie, sessão
 * nem redirecionamento, só banco. Assim dá pra testar a regra sem o Google.
 *
 * A conta criada por aqui nasce SEMPRE como motoboy — o papel de menor
 * privilégio. Lojista e administrador continuam sendo criados por dentro do
 * app (cadastro por telefone ou painel do admin); ninguém vira dono da loja só
 * por ter uma conta Google.
 */

export type UsuarioDoBanco = typeof users.$inferSelect;

export type ResultadoGoogle =
    | { ok: true; user: UsuarioDoBanco; contaNova: boolean }
    /** `erro` é o código que a tela de login sabe traduzir. */
    | { ok: false; erro: string };

export async function resolverOuCriarUsuarioGoogle(
    profile: GoogleProfile
): Promise<ResultadoGoogle> {
    // E-mail não verificado no Google não prova identidade nenhuma.
    if (!profile.emailVerified) return { ok: false, erro: "google_email_nao_verificado" };

    const email = profile.email.toLowerCase();

    // 1) Conta Google já vinculada: é essa pessoa.
    const vinculado = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) });
    if (vinculado) return finalizar(vinculado, false);

    // 2) O e-mail (verificado) já está no cadastro: vincula a conta Google a ele.
    const porEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (porEmail) {
        // Já tem OUTRA conta Google ligada: não troca por baixo dos panos.
        if (porEmail.googleId && porEmail.googleId !== profile.sub) {
            return { ok: false, erro: "google_email_em_uso" };
        }
        await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, porEmail.id));
        return finalizar({ ...porEmail, googleId: profile.sub }, false);
    }

    // 3) Ninguém: cria a conta como motoboy, sem telefone (o app pede depois).
    const padroes = await defaultsDeContaNova();
    let criado: UsuarioDoBanco | undefined;
    try {
        criado = await db.insert(users).values({
            name: (profile.name || email.split("@")[0]).slice(0, 120),
            phone: null,
            email,
            googleId: profile.sub,
            role: "motoboy",
            password: null, // entra pelo Google; pode cadastrar senha depois
            avatarUrl: null,
            ...padroes,
            createdAt: new Date().toISOString(),
        }).returning().get();
    } catch {
        // Duas abas ao mesmo tempo: o índice único barrou a segunda. Busca a que ficou.
        const jaCriado = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub) });
        if (jaCriado) return finalizar(jaCriado, false);
        return { ok: false, erro: "google_falhou" };
    }

    if (!criado) return { ok: false, erro: "google_falhou" };
    return finalizar(criado, true);
}

function finalizar(user: UsuarioDoBanco, contaNova: boolean): ResultadoGoogle {
    if (user.isActive === false) return { ok: false, erro: "conta_desativada" };
    return { ok: true, user, contaNova };
}
