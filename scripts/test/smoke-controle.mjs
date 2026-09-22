/**
 * Smoke de navegador da tela "Controle": abre as telas no Edge de verdade,
 * tira foto (PC e celular) e denuncia erro de JavaScript no console.
 *
 * Rodar (com `PORT=3005 npm start` no ar, e com dados no banco local):
 *   node scripts/test/smoke-controle.mjs
 *
 * Mesma receita do smoke-fase4.mjs: cookie de sessão forjado com a
 * SESSION_SECRET do .env.local, um contexto de navegador por tela.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:3005";
// Barra normal mesmo no Windows: o Node aceita e a string não vira campo minado
// de contrabarra quando este arquivo é editado por script.
const EDGE = process.env.SMOKE_EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SHOTS = process.env.SMOKE_SHOTS || "./.shots-controle";
const SEGREDO = lerSegredo();

const ADMIN = 1, LOJA = 2, MOTOBOY = 3, OUTRA_LOJA = 4;
const DIA = process.env.SMOKE_DIA || "2026-09-16";

function lerSegredo() {
    const env = fs.readFileSync(".env.local", "utf8");
    const linha = env.split("\n").find(l => l.startsWith("SESSION_SECRET="));
    return linha.slice("SESSION_SECRET=".length).trim().replace(/^["']|["']$/g, "");
}

/** Cookie de sessão forjado — mesma conta do src/lib/sessionToken.ts. */
function cookieDeSessao(userId) {
    const corpo = `${userId}.${Date.now()}`;
    return `${corpo}.${crypto.createHmac("sha256", SEGREDO).update(corpo).digest("base64url")}`;
}

fs.mkdirSync(SHOTS, { recursive: true });

const problemas = [];
const feitos = [];

const DESKTOP = { largura: 1280, altura: 900 };
const MOBILE = { largura: 360, altura: 740 };

async function comPagina(navegador, { largura, altura, sessao }, fn) {
    // Contexto próprio por tela = cookie próprio (senão a sessão vaza entre as telas).
    const contexto = await navegador.createBrowserContext();
    const pagina = await contexto.newPage();
    await pagina.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
    const erros = [];
    pagina.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
    pagina.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
    if (sessao) {
        await contexto.setCookie({
            name: "session", value: cookieDeSessao(sessao),
            domain: "localhost", path: "/", httpOnly: true,
        });
    }
    try {
        await fn(pagina, erros);
    } finally {
        await pagina.close();
        await contexto.close();
    }
    return erros;
}

async function foto(pagina, nome) {
    const arquivo = path.join(SHOTS, `${nome}.png`);
    await pagina.screenshot({ path: arquivo, fullPage: true });
    feitos.push(arquivo);
}

function registrar(nome, erros) {
    // Ruído conhecido e aceito: /api/logs devolve 401 nas páginas públicas.
    const relevantes = erros.filter(e =>
        !e.includes("/api/logs") &&
        !e.toLowerCase().includes("favicon") &&
        !/status of (401|404)/.test(e)
    );
    if (relevantes.length) problemas.push({ tela: nome, erros: relevantes });
    console.log(`  ${relevantes.length ? "ERRO JS:" : "console limpo"} ${nome}${relevantes.length ? " -> " + relevantes.join(" | ") : ""}`);
}

function conferir(condicao, tela, queixa) {
    if (!condicao) problemas.push({ tela, erros: [queixa] });
}

const texto = (p) => p.evaluate(() => document.body.innerText);

/** Botão/link abaixo de 44px é dedo escorregando no celular. */
async function alturasDeBotao(p) {
    return p.$$eval("a, button", (els) => els
        .filter(e => /Controle|Registrar devolução|Dia|Semana|Mês/.test((e.textContent || "").trim()))
        .map(e => ({ texto: (e.textContent || "").trim().slice(0, 28), altura: Math.round(e.getBoundingClientRect().height) }))
        .filter(x => x.altura > 0));
}

const navegador = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ------------------------------------------------------------------- LOJA ---
console.log("\n== loja: entrada pro Controle no financeiro do motoboy ==");
let erros = await comPagina(navegador, { ...DESKTOP, sessao: LOJA }, async (p) => {
    await p.goto(`${BASE}/motoboys/${MOTOBOY}/financeiro`, { waitUntil: "networkidle2" });
    await foto(p, "01-financeiro-com-botao-controle");
    const t = await texto(p);
    conferir(t.includes("Controle"), "/motoboys/3/financeiro", "não achei o botão Controle");
    conferir(t.includes("Resumo do dia"), "/motoboys/3/financeiro", "o botão Resumo do dia sumiu");
});
registrar("/motoboys/3/financeiro", erros);

for (const [nome, tela] of [["pc", DESKTOP], ["celular", MOBILE]]) {
    console.log(`\n== loja: Controle — visão Dia (${nome}) ==`);
    erros = await comPagina(navegador, { ...tela, sessao: LOJA }, async (p) => {
        await p.goto(`${BASE}/motoboys/${MOTOBOY}/financeiro/controle?v=dia&m=9&y=2026`, { waitUntil: "networkidle2" });
        await foto(p, `02-controle-dia-${nome}`);
        const t = await texto(p);
        conferir(/Devolveu/.test(t), "Controle dia", "nenhum selo de devolução na tela");
        conferir(/Não devolveu/.test(t), "Controle dia", "faltou o selo 'Não devolveu' (dia 16 tem dinheiro sem devolução)");
        conferir(/Falta devolver|Está tudo devolvido|a mais/.test(t), "Controle dia", "faltou o resumo de 'falta devolver'");
        conferir(/Saldo no fim do dia/.test(t), "Controle dia", "faltou o saldo no fim do dia");
        conferir(/Devoluções/.test(t), "Controle dia", "faltou o bloco de Devoluções");
        conferir(/Registrar devolução/.test(t), "Controle dia", "a loja tem que ter o botão de registrar");

        const baixos = (await alturasDeBotao(p)).filter(b => b.altura < 44);
        conferir(baixos.length === 0, "Controle dia", `botão abaixo de 44px: ${JSON.stringify(baixos)}`);
        if (nome === "celular") {
            const rolaDeLado = await p.evaluate(() =>
                document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
            conferir(!rolaDeLado, "Controle dia", "a tela rola de lado no celular");
        }
        console.log("  " + t.split("\n").filter(Boolean).slice(0, 14).join(" | "));
    });
    registrar(`Controle dia (${nome})`, erros);
}

console.log("\n== loja: Controle — Semana e Mês ==");
for (const v of ["semana", "mes"]) {
    erros = await comPagina(navegador, { ...MOBILE, sessao: LOJA }, async (p) => {
        await p.goto(`${BASE}/motoboys/${MOTOBOY}/financeiro/controle?v=${v}&m=9&y=2026`, { waitUntil: "networkidle2" });
        await foto(p, `03-controle-${v}-celular`);
        const t = await texto(p);
        if (v === "semana") {
            conferir(/\d{2}\/\d{2} a \d{2}\/\d{2}/i.test(t), "Controle semana", "faltou o rótulo '14/09 a 20/09'");
            conferir(!/-Feira/.test(t), "Controle semana", "o CSS capitalize voltou a escrever 'Sexta-Feira'");
        } else {
            conferir(/setembro\/2026/i.test(t), "Controle mês", "faltou o nome do mês");
        }
        conferir(/Saldo/.test(t), `Controle ${v}`, "faltou saldo inicial/final");
        console.log(`  ${v}: ` + t.split("\n").filter(Boolean).slice(6, 16).join(" | "));
    });
    registrar(`Controle ${v}`, erros);
}

console.log("\n== loja: Resumo do dia com 'Devolvido neste dia' ==");
erros = await comPagina(navegador, { ...MOBILE, sessao: LOJA }, async (p) => {
    await p.goto(`${BASE}/motoboys/${MOTOBOY}/fechamento?d=${DIA}`, { waitUntil: "networkidle2" });
    await foto(p, "04-resumo-do-dia-devolucao");
    const t = await texto(p);
    conferir(/Devolvido neste dia/.test(t), "Resumo do dia", "faltou 'Devolvido neste dia'");
    conferir(/Registrar devolução deste dia/.test(t), "Resumo do dia", "faltou o botão de registrar a devolução do dia");
});
registrar("/motoboys/3/fechamento", erros);

console.log("\n== loja: lançamento já com a data do dia ==");
erros = await comPagina(navegador, { ...MOBILE, sessao: LOJA }, async (p) => {
    await p.goto(`${BASE}/finance/new?motoboyId=${MOTOBOY}&entry=recebi&d=${DIA}&amount=210.00`, { waitUntil: "networkidle2" });
    await foto(p, "05-lancamento-com-data");
    const campo = await p.$eval('input[type="date"]', (e) => ({ valor: e.value, min: e.min, max: e.max }));
    console.log("  campo Data:", JSON.stringify(campo));
    conferir(campo.valor === DIA, "/finance/new", `a data não veio da URL: ${JSON.stringify(campo)}`);
    conferir(campo.max > campo.min, "/finance/new", "os limites do campo saíram errados");
    const valor = await p.$eval('input[name="amount"]', (e) => e.value);
    conferir(valor === "210,00", "/finance/new", `valor sugerido veio "${valor}"`);
});
registrar("/finance/new?d=", erros);

console.log("\n== loja: ícone do Controle na lista da equipe ==");
erros = await comPagina(navegador, { ...DESKTOP, sessao: LOJA }, async (p) => {
    await p.goto(`${BASE}/motoboys`, { waitUntil: "networkidle2" });
    await foto(p, "06-lista-equipe");
    const links = await p.$$eval('a[href*="/financeiro/controle"]', (as) => as.length);
    conferir(links >= 1, "/motoboys", "o atalho do Controle não apareceu na lista");
});
registrar("/motoboys", erros);

console.log("\n== admin abre o Controle de qualquer motoboy ==");
erros = await comPagina(navegador, { ...DESKTOP, sessao: ADMIN }, async (p) => {
    const r = await p.goto(`${BASE}/motoboys/${MOTOBOY}/financeiro/controle`, { waitUntil: "networkidle2" });
    console.log("  status:", r.status());
    conferir(r.status() === 200, "admin no Controle", `admin levou ${r.status()}`);
    await foto(p, "07-controle-admin-pc");
});
registrar("Controle (admin)", erros);

console.log("\n== lojista de OUTRA loja não abre o Controle deste motoboy ==");
erros = await comPagina(navegador, { ...DESKTOP, sessao: OUTRA_LOJA }, async (p) => {
    const r = await p.goto(`${BASE}/motoboys/${MOTOBOY}/financeiro/controle`, { waitUntil: "networkidle2" });
    const t = await texto(p);
    console.log("  status:", r.status(), "| texto:", t.split("\n").filter(Boolean)[0]);
    conferir(
        /Página não encontrada/.test(t),
        "escopo de loja",
        `a outra loja VIU a carteira do motoboy alheio (status ${r.status()})`,
    );
    conferir(!/João|Devoluções/.test(t), "escopo de loja", "vazou dado do motoboy pra outra loja");
    await foto(p, "08-controle-outra-loja-404");
});
registrar("Controle (outra loja)", erros);

// ---------------------------------------------------------------- MOTOBOY ---
console.log("\n== motoboy: extrato com o link e o próprio Controle ==");
erros = await comPagina(navegador, { ...MOBILE, sessao: MOTOBOY }, async (p) => {
    await p.goto(`${BASE}/finance/extrato`, { waitUntil: "networkidle2" });
    await foto(p, "09-extrato-motoboy-com-link");
    conferir((await texto(p)).includes("Controle"), "/finance/extrato", "faltou o link pro Controle");

    await p.goto(`${BASE}/finance/extrato/controle?v=dia&m=9&y=2026`, { waitUntil: "networkidle2" });
    await foto(p, "10-controle-motoboy-celular");
    const t = await texto(p);
    conferir(/Meu controle/.test(t), "Controle do motoboy", "título errado");
    conferir(/com você/.test(t), "Controle do motoboy", "o texto tinha que falar com ele ('com você')");
    conferir(!/Registrar devolução/.test(t), "Controle do motoboy", "o motoboy NÃO pode ter botão de lançar");
    console.log("  " + t.split("\n").filter(Boolean).slice(0, 12).join(" | "));
});
registrar("/finance/extrato/controle", erros);

await navegador.close();

console.log("\n================ RESUMO ================");
console.log(`screenshots: ${feitos.length}`);
for (const f of feitos) console.log("  " + f);
if (problemas.length) {
    console.log("\nPROBLEMAS:");
    for (const p of problemas) console.log(`  [${p.tela}] ${p.erros.join(" | ")}`);
    process.exitCode = 1;
} else {
    console.log("\nNenhum erro de JS e nenhuma checagem falhou.");
}
