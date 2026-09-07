/**
 * Smoke por HTTP do P0 do 2FA: um token de "2FA pendente" colado no cookie
 * `session` NÃO pode logar ninguém — e a sessão de verdade tem que continuar
 * funcionando (senão todo mundo cai no login no dia do deploy).
 *
 * Rodar (com o servidor no ar):
 *   BASE_URL=http://localhost:3005 SESSION_SECRET=<a mesma do .env.local> \
 *     node --import ./scripts/test/register.mjs scripts/test/smoke-2fa-cookie.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3005";

// Sem SESSION_SECRET no ambiente, pega a do .env.local (é a que o servidor usa).
if (!process.env.SESSION_SECRET) {
    const envPath = path.resolve(import.meta.dirname, "..", "..", ".env.local");
    const linha = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find(l => l.startsWith("SESSION_SECRET="));
    if (!linha) throw new Error("SESSION_SECRET não encontrada nem no ambiente nem no .env.local");
    process.env.SESSION_SECRET = linha.slice("SESSION_SECRET=".length).trim();
}

const { buildToken } = await import("@/lib/sessionToken");

const USER_ID = Number(process.env.USER_ID || 3); // motoboy João Teste no banco local

async function abrirApp(cookie) {
    const r = await fetch(`${BASE}/app`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
    });
    return { status: r.status, location: r.headers.get("location") || "" };
}

let falhas = 0;
function checa(nome, condicao, detalhe) {
    if (condicao) {
        console.log(`ok   ${nome}`);
    } else {
        falhas++;
        console.log(`FALHA ${nome} — ${detalhe}`);
    }
}

// 1. Sem cookie nenhum: manda pro login.
{
    const r = await abrirApp(null);
    checa("sem cookie /app manda pro login", r.location.includes("/login"), JSON.stringify(r));
}

// 2. Cookie de 2FA pendente colado no lugar da sessão: tem que ser recusado.
{
    const pendente = buildToken(USER_ID, "2fa");
    const r = await abrirApp(`session=${pendente}`);
    checa(
        "token de 2FA no cookie session NÃO loga",
        r.location.includes("/login"),
        `esperava redirect pro login, veio ${r.status} ${r.location}`
    );
}

// 3. Sessão de verdade: continua entrando.
{
    const sessao = buildToken(USER_ID, "session");
    const r = await abrirApp(`session=${sessao}`);
    checa(
        "sessão válida continua entrando em /app",
        r.status === 200,
        `esperava 200, veio ${r.status} ${r.location}`
    );
}

// 4. O caminho inverso, direto na ação que confere o código de 6 dígitos:
//    token de sessão no cookie `2fa_pending` não pode valer como "meio login".
//    (A página /login/2fa é estática e sempre abre; quem guarda é a ação.)
const ACAO_VERIFICAR_2FA = process.env.ACTION_ID_VERIFY_2FA || acharIdDaAcao("verifyTwoFactorAction");

function acharIdDaAcao(nome) {
    const manifesto = path.resolve(
        import.meta.dirname, "..", "..", ".next", "server", "server-reference-manifest.json"
    );
    if (!fs.existsSync(manifesto)) return null;
    const m = JSON.parse(fs.readFileSync(manifesto, "utf8"));
    const achado = Object.entries(m.node || {}).find(([, e]) => e.exportedName === nome);
    return achado ? achado[0] : null;
}

async function chamarVerificar2fa(cookie) {
    const corpo = new FormData();
    corpo.set("0", '["123456"]');
    const r = await fetch(`${BASE}/login/2fa`, {
        method: "POST",
        headers: { "Next-Action": ACAO_VERIFICAR_2FA, cookie },
        body: corpo,
    });
    return r.text();
}

if (!ACAO_VERIFICAR_2FA) {
    console.log("pulo  ação de 2FA (rode `npm run build` antes pra ter o manifesto)");
} else {
    const sessao = buildToken(USER_ID, "session");
    const texto = await chamarVerificar2fa(`2fa_pending=${sessao}`);
    checa(
        "token de sessão no cookie 2fa_pending não vira meio login",
        texto.includes("Sessão expirada"),
        texto.slice(0, 200)
    );

    // E o token certo passa da porta (o erro seguinte já é sobre o código).
    const pendenteOk = buildToken(USER_ID, "2fa");
    const texto2 = await chamarVerificar2fa(`2fa_pending=${pendenteOk}`);
    checa(
        "token de 2FA legítimo é aceito como meio login",
        !texto2.includes("Sessão expirada"),
        texto2.slice(0, 200)
    );
}

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
