/*
 * Confere a regra de "entrar/criar conta pelo Google" sem precisar do Google.
 * Mexe no banco (cria e apaga usuários), então SÓ roda em banco descartável.
 *
 * Como preparar e rodar:
 *   cp sqlite.db /tmp/zap-teste.db
 *   BACKUP=0 DATABASE_PATH=/tmp/zap-teste.db node scripts/utils/make_phone_nullable.js
 *   DATABASE_PATH=/tmp/zap-teste.db npx tsx scripts/utils/test_google_login.ts
 */
import path from "node:path";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolverOuCriarUsuarioGoogle } from "@/lib/google-login";
import type { GoogleProfile } from "@/lib/google-oauth";

// Trava de segurança: nunca rodar no banco de trabalho nem no de produção.
const caminho = process.env.DATABASE_PATH || "";
if (!caminho || path.resolve(caminho) === path.resolve("sqlite.db") || caminho === "/app/sqlite.db") {
    console.error("Aponte DATABASE_PATH pra um banco descartável (veja o cabeçalho deste arquivo).");
    process.exit(1);
}

let falhas = 0;
function ok(nome: string, condicao: boolean, extra?: unknown) {
    console.log(`${condicao ? "PASSOU" : "FALHOU"}  ${nome}`, condicao ? "" : extra ?? "");
    if (!condicao) falhas++;
}

const perfil = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
    sub: "sub-joao-1",
    email: "joao@example.com",
    emailVerified: true,
    name: "João da Silva",
    ...over,
});

async function main() {
    // 1) e-mail novo => cria conta de motoboy sem telefone
    const r1 = await resolverOuCriarUsuarioGoogle(perfil());
    ok("1. cria conta nova", r1.ok === true && r1.contaNova === true, r1);
    if (r1.ok) {
        ok("1a. papel motoboy", r1.user.role === "motoboy", r1.user.role);
        ok("1b. telefone vazio", r1.user.phone === null, r1.user.phone);
        ok("1c. sem senha", r1.user.password === null, r1.user.password);
        ok("1d. googleId gravado", r1.user.googleId === "sub-joao-1");
        ok("1e. e-mail gravado", r1.user.email === "joao@example.com");
        ok("1f. ativo", r1.user.isActive !== false);
        ok("1g. nasce em teste como o cadastro por telefone",
            r1.user.isTrialUser === true && r1.user.subscriptionStatus === "trial" && r1.user.plan === "enterprise",
            { plan: r1.user.plan, status: r1.user.subscriptionStatus });
    }

    // 2) mesma conta Google de novo => entra, não cria outra
    const r2 = await resolverOuCriarUsuarioGoogle(perfil());
    ok("2. segunda entrada não cria conta", r2.ok === true && r2.contaNova === false, r2);
    ok("2a. mesmo usuário", r1.ok && r2.ok && r1.user.id === r2.user.id);
    const total = await db.select().from(users);
    ok("2b. só 1 usuário no banco", total.length === 1, total.length);

    // 3) e-mail já cadastrado (login por telefone) => vincula em vez de criar
    await db.insert(users).values({
        name: "Maria Lojista", phone: "34999990000", email: "maria@example.com",
        role: "shopkeeper", password: "$2a$10$fake",
    });
    const r3 = await resolverOuCriarUsuarioGoogle(perfil({ sub: "sub-maria", email: "maria@example.com" }));
    ok("3. vincula em conta existente", r3.ok === true && r3.contaNova === false, r3);
    ok("3a. papel preservado (não vira motoboy)", r3.ok && r3.user.role === "shopkeeper");
    ok("3b. telefone preservado", r3.ok && r3.user.phone === "34999990000");
    const maria = await db.query.users.findFirst({ where: eq(users.email, "maria@example.com") });
    ok("3c. googleId salvo no banco", maria?.googleId === "sub-maria", maria?.googleId);

    // 4) mesmo e-mail, OUTRA conta Google => recusa (não sequestra a conta)
    const r4 = await resolverOuCriarUsuarioGoogle(perfil({ sub: "sub-invasor", email: "maria@example.com" }));
    ok("4. recusa outra conta Google no mesmo e-mail",
        r4.ok === false && r4.erro === "google_email_em_uso", r4);

    // 5) e-mail não verificado => recusa
    const r5 = await resolverOuCriarUsuarioGoogle(perfil({ sub: "sub-x", email: "x@example.com", emailVerified: false }));
    ok("5. recusa e-mail não verificado", r5.ok === false && r5.erro === "google_email_nao_verificado", r5);

    // 6) conta desativada => recusa
    await db.update(users).set({ isActive: false }).where(eq(users.googleId, "sub-joao-1"));
    const r6 = await resolverOuCriarUsuarioGoogle(perfil());
    ok("6. recusa conta desativada", r6.ok === false && r6.erro === "conta_desativada", r6);

    // 7) dois cadastros pelo Google convivem sem telefone (índice único aceita vazio)
    const r7 = await resolverOuCriarUsuarioGoogle(perfil({ sub: "sub-pedro", email: "pedro@example.com", name: "Pedro" }));
    ok("7. segundo motoboy sem telefone", r7.ok === true && r7.contaNova === true && r7.user.phone === null, r7);

    // 8) sem nome no perfil => usa a parte antes do @
    const r8 = await resolverOuCriarUsuarioGoogle(perfil({ sub: "sub-anon", email: "anon.silva@example.com", name: undefined }));
    ok("8. nome sai do e-mail quando o Google não manda", r8.ok === true && r8.user.name === "anon.silva", r8.ok && r8.user.name);

    console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
    process.exit(falhas === 0 ? 0 : 1);
}

main();
