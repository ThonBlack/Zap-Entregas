/**
 * Smoke de navegador do "trocar motoboy" — Fila da loja, admin e motoboy.
 *
 * Confere, no Edge de verdade:
 *   (a) Fila: liberar o rascunho escolhendo um motoboy (e a lista não traz
 *       motoboy de outra loja), trocar, devolver pra fila aberta; corrida
 *       coletada mostra só quem está com ela, sem botão;
 *   (b) Admin: trocar a corrida aceita e a COLETADA (que segue coletada);
 *   (c) Motoboy: o antigo não vê mais; o novo vê.
 *
 * Só banco LOCAL (sqlite.db do worktree). Sem VAPID no .env.local e sem
 * push_subscriptions, então nenhum push de verdade sai daqui.
 *
 * Rodar (com `PORT=3005 npm start` no ar):
 *   node scripts/test/smoke-trocar-motoboy.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:3005";
const EDGE = process.env.SMOKE_EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SHOTS = process.env.SMOKE_SHOTS || "./.shots-trocar";
const ADMIN = 1, LOJA = 2, JOAO = 3, MARIA = 4, PEDRO = 5, OUTRA_LOJA = 6;

// ── massa de teste ──────────────────────────────────────────────────────────
const db = new Database(process.env.DATABASE_PATH || "./sqlite.db");
db.pragma("foreign_keys = OFF");
db.exec("DELETE FROM push_subscriptions");
const agora = new Date().toISOString();
const usuario = db.prepare(`INSERT OR IGNORE INTO users (id, name, phone, role, shopkeeper_id, is_active, plan, subscription_status)
                            VALUES (?, ?, ?, ?, ?, 1, 'pro', 'active')`);
usuario.run(MARIA, "Maria Motoboy", "34990000004", "motoboy", LOJA);
usuario.run(OUTRA_LOJA, "Outra Loja", "34990000006", "shopkeeper", null);
usuario.run(PEDRO, "Pedro OutraLoja", "34990000005", "motoboy", OUTRA_LOJA);

function corrida(id, campos) {
    db.prepare("DELETE FROM deliveries WHERE id = ?").run(id);
    db.prepare(`INSERT INTO deliveries (id, shopkeeper_id, address, lat, lng, geo_precision, value, fee, charge_mode,
                    customer_name, motoboy_id, status, daily_seq, accepted_at, picked_up_at, created_at, updated_at)
                VALUES (@id, ${LOJA}, @endereco, -19.7465, -47.9381, 'rua', 0, 9, 'pago',
                    @cliente, @motoboy, @status, @numero, @aceita, @coletada, '${agora}', '${agora}')`)
        .run({ id, motoboy: null, numero: null, aceita: null, coletada: null, ...campos });
}
corrida(201, { endereco: "Rua do Rascunho, 10 - Centro, Uberaba - MG", cliente: "Cliente Rascunho", status: "draft" });
corrida(202, { endereco: "Rua Aceita, 20 - Centro, Uberaba - MG", cliente: "Cliente Aceita", status: "assigned", motoboy: JOAO, numero: 52, aceita: agora });
corrida(203, { endereco: "Rua Coletada, 30 - Centro, Uberaba - MG", cliente: "Cliente Coletada", status: "picked_up", motoboy: JOAO, numero: 53, aceita: agora, coletada: agora });

const TOKEN = crypto.randomBytes(16).toString("hex");
db.prepare(`INSERT INTO shop_queue_sessions (token, shopkeeper_id, operator_name, expires_at, created_at)
            VALUES (?, ?, 'Caixa Smoke', ?, ?)`).run(TOKEN, LOJA, new Date(Date.now() + 3600e3).toISOString(), agora);
const ler = (id) => db.prepare("SELECT status, motoboy_id, picked_up_at FROM deliveries WHERE id = ?").get(id);

// ── navegador ───────────────────────────────────────────────────────────────
const SEGREDO = (() => {
    const linha = fs.readFileSync(".env.local", "utf8").split("\n").find(l => l.startsWith("SESSION_SECRET="));
    return linha.slice("SESSION_SECRET=".length).trim().replace(/^["']|["']$/g, "");
})();
function cookieDeSessao(userId) {
    const corpo = `${userId}.${Date.now()}`;
    return `${corpo}.${crypto.createHmac("sha256", SEGREDO).update(corpo).digest("base64url")}`;
}

fs.mkdirSync(SHOTS, { recursive: true });
const problemas = [];
let checagens = 0;
function checar(nome, ok, detalhe = "") {
    checagens++;
    console.log(`  ${ok ? "ok" : "FALHOU"} — ${nome}${detalhe ? ": " + detalhe : ""}`);
    if (!ok) problemas.push(nome);
}
const espera = (ms) => new Promise(r => setTimeout(r, ms));
async function foto(p, nome) { await p.screenshot({ path: path.join(SHOTS, `${nome}.png`), fullPage: true }); }
async function esperarBanco(id, cond, ms = 8000) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) { if (cond(ler(id))) return true; await espera(200); }
    return false;
}

const navegador = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });
async function paginaComo(userId, largura = 390) {
    const ctx = await navegador.createBrowserContext();
    if (userId) await ctx.setCookie({ name: "session", value: cookieDeSessao(userId), domain: "localhost", path: "/", httpOnly: true });
    const p = await ctx.newPage();
    await p.setViewport({ width: largura, height: 900 });
    // Sem GPS de verdade: a tela do motoboy pergunta, e o headless nega.
    return p;
}
/** O card (li ou div) MAIS DE DENTRO que contém o texto — os de fora também contêm. */
async function cardCom(p, texto, seletor) {
    let melhor = null, tamanho = Infinity;
    for (const el of await p.$$(seletor)) {
        const t = await el.evaluate(e => e.textContent || "");
        if (t.includes(texto) && t.length < tamanho) { melhor = el; tamanho = t.length; }
    }
    return melhor;
}
async function clicarTexto(raiz, texto, seletor = "button") {
    for (const el of await raiz.$$(seletor)) {
        if ((await el.evaluate(e => (e.textContent || "").trim())).includes(texto)) { await el.click(); return true; }
    }
    return false;
}

try {
    // ── (a) Fila da loja ────────────────────────────────────────────────────
    console.log("(a) Fila da loja");
    const fila = await paginaComo(null, 900);
    await fila.goto(`${BASE}/fila/${TOKEN}/conferir/201`, { waitUntil: "networkidle2" });
    const opcoes = await fila.$$eval("#motoboy-destino option", os => os.map(o => ({ v: o.value, t: o.textContent })));
    checar("conferir: seletor tem 'Qualquer um (fila aberta)'", opcoes.some(o => o.v === "" && /Qualquer um/.test(o.t)));
    checar("conferir: equipe da loja aparece", opcoes.some(o => o.v === String(MARIA)) && opcoes.some(o => o.v === String(JOAO)));
    checar("conferir: motoboy de outra loja NÃO aparece", !opcoes.some(o => o.v === String(PEDRO)));
    await fila.select("#motoboy-destino", String(MARIA));
    await foto(fila, "a1-fila-conferir-escolhendo");
    await clicarTexto(fila, "Liberar pros motoboys");
    checar("liberar escolhendo Maria → corrida dela, 'assigned'",
        await esperarBanco(201, c => c.status === "assigned" && c.motoboy_id === MARIA), JSON.stringify(ler(201)));

    await fila.goto(`${BASE}/fila/${TOKEN}`, { waitUntil: "networkidle2" });
    let card = await cardCom(fila, "Cliente Rascunho", "li");
    await clicarTexto(card, "Trocar motoboy");
    card = await cardCom(fila, "Cliente Rascunho", "li");
    await (await card.$("select")).select(String(JOAO));
    await foto(fila, "a2-fila-trocando");
    await clicarTexto(card, "Confirmar");
    checar("fila troca Maria → João", await esperarBanco(201, c => c.motoboy_id === JOAO && c.status === "assigned"), JSON.stringify(ler(201)));

    await fila.goto(`${BASE}/fila/${TOKEN}`, { waitUntil: "networkidle2" });
    card = await cardCom(fila, "Cliente Rascunho", "li");
    await clicarTexto(card, "Trocar motoboy");
    card = await cardCom(fila, "Cliente Rascunho", "li");
    await (await card.$("select")).select("");
    await clicarTexto(card, "Confirmar");
    checar("fila devolve pra fila aberta", await esperarBanco(201, c => c.motoboy_id === null && c.status === "pending"), JSON.stringify(ler(201)));

    await fila.goto(`${BASE}/fila/${TOKEN}`, { waitUntil: "networkidle2" });
    const coletada = await cardCom(fila, "Cliente Coletada", "li");
    const txtColetada = await coletada.evaluate(e => e.textContent);
    checar("coletada: mostra quem está com ela", txtColetada.includes("João Motoboy"));
    checar("coletada: sem botão de trocar", !txtColetada.includes("Trocar motoboy") && !txtColetada.includes("Escolher motoboy"));
    await foto(fila, "a3-fila-depois");

    // ── (b) Admin ───────────────────────────────────────────────────────────
    console.log("(b) Admin");
    const admin = await paginaComo(ADMIN, 900);
    await admin.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    for (const [id, cliente, statusEsperado] of [[202, "Cliente Aceita", "assigned"], [203, "Cliente Coletada", "picked_up"]]) {
        const c = await cardCom(admin, cliente, "div.rounded-xl");
        checar(`admin: card ${id} tem 'Trocar motoboy'`, !!c && await clicarTexto(c, "Trocar motoboy"));
        await admin.waitForSelector('[role="dialog"]');
        const nomes = await admin.$$eval('[role="dialog"] label', ls => ls.map(l => l.textContent));
        checar(`admin: lista de ${id} sem motoboy de outra loja`, !nomes.some(n => n.includes("Pedro")), nomes.join(" | "));
        const dialogo = await admin.$('[role="dialog"]');
        await clicarTexto(dialogo, "Maria Motoboy", "label");
        await foto(admin, `b-${id}-admin-trocando`);
        await clicarTexto(dialogo, "Confirmar");
        checar(`admin: ${id} vai pra Maria e fica '${statusEsperado}'`,
            await esperarBanco(id, r => r.motoboy_id === MARIA && r.status === statusEsperado), JSON.stringify(ler(id)));
        await admin.waitForSelector('[role="dialog"]', { hidden: true, timeout: 8000 }).catch(() => { });
        await admin.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    }
    checar("admin: coletada mantém a hora da coleta", ler(203).picked_up_at === agora);
    await foto(admin, "b-admin-depois");

    // ── (c) Motoboys ────────────────────────────────────────────────────────
    console.log("(c) Motoboys");
    const joao = await paginaComo(JOAO);
    await joao.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    const telaJoao = await joao.evaluate(() => document.body.innerText);
    checar("João não vê mais a aceita nem a coletada", !telaJoao.includes("Cliente Aceita") && !telaJoao.includes("Cliente Coletada"));
    await foto(joao, "c1-motoboy-antigo");

    const maria = await paginaComo(MARIA);
    await maria.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    const telaMaria = await maria.evaluate(() => document.body.innerText);
    checar("Maria vê as duas", telaMaria.includes("Cliente Aceita") && telaMaria.includes("Cliente Coletada"));
    const cardColetadaMaria = await cardCom(maria, "Cliente Coletada", "div.rounded-xl");
    const txt = cardColetadaMaria ? await cardColetadaMaria.evaluate(e => e.textContent) : "";
    checar("Maria: a coletada já está 'Em Rota' com 'Entregue'", txt.includes("Em Rota") && txt.includes("Entregue"), txt.slice(0, 120));
    await foto(maria, "c2-motoboy-novo");
} catch (e) {
    problemas.push(`exceção: ${e.message}`);
    console.error(e);
} finally {
    await navegador.close();
    db.close();
}

console.log(`\n${checagens - problemas.length}/${checagens} ok${problemas.length ? " — FALHAS: " + problemas.join("; ") : ""}`);
process.exit(problemas.length ? 1 : 0);
