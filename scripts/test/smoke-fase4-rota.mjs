/**
 * Segunda parte do smoke da fase 4: "Gerar Rota" (lojista) e o modal de excluir.
 *
 * Ficou separado do smoke-fase4.mjs porque MEXE no banco (reordena paradas e
 * apaga uma corrida) — rodar depois das fotos, com a massa do seed-smoke.
 *
 * Rodar: node scripts/test/smoke-fase4-rota.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:3005";
const EDGE = process.env.SMOKE_EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SHOTS = process.env.SMOKE_SHOTS || "./shots-fase4";
const LOJA = 2;

const segredo = fs.readFileSync(".env.local", "utf8")
    .split("\n").find(l => l.startsWith("SESSION_SECRET="))
    .slice("SESSION_SECRET=".length).trim();

const ts = Date.now();
const corpo = `${LOJA}.${ts}`;
const cookie = `${corpo}.${crypto.createHmac("sha256", segredo).update(corpo).digest("base64url")}`;

fs.mkdirSync(SHOTS, { recursive: true });
const problemas = [];

const navegador = await puppeteer.launch({
    executablePath: EDGE, headless: true, args: ["--no-sandbox"],
});
const contexto = await navegador.createBrowserContext();
await contexto.setCookie({ name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true });
const p = await contexto.newPage();
await p.setViewport({ width: 1280, height: 800 });
const errosJs = [];
p.on("pageerror", e => errosJs.push(e.message));
p.on("console", m => { if (m.type() === "error" && !/status of 40[14]|api\/logs/.test(m.text())) errosJs.push(m.text()); });

await p.goto(`${BASE}/app`, { waitUntil: "networkidle2" });

// --- Gerar Rota ------------------------------------------------------------
const caixas = await p.$$('input[name="selectedDelivery"]');
console.log("corridas selecionáveis:", caixas.length);
for (const c of caixas.slice(0, 3)) await c.click();

let botaoRota = null;
for (const b of await p.$$("button")) {
    const t = await b.evaluate(e => e.textContent);
    if (t && t.includes("Gerar Rota")) { botaoRota = b; break; }
}
if (!botaoRota) { problemas.push('botão "Gerar Rota" não encontrado'); }
else {
    await botaoRota.click();
    // Trava enquanto roda? (o segundo clique não pode disparar a action de novo)
    const travado = await p.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(e => /Gerar Rota|Montando/.test(e.textContent || ""));
        return b ? { texto: b.textContent.trim(), desabilitado: b.disabled } : null;
    });
    console.log("estado do botão logo após o clique:", JSON.stringify(travado));
    if (travado && !travado.desabilitado) problemas.push("Gerar Rota não trava durante a action (dá pra clicar duas vezes)");

    await p.waitForSelector("text/Abrir rota no Google Maps", { timeout: 20000 });
    const href = await p.$eval('a[href*="maps/dir"]', a => a.getAttribute("href"));
    console.log("link da rota:", href);
    // O ponto todo do conserto: destino e paradas com lat,lng, não com texto.
    const temCoordenada = /destination=-?\d+\.\d+%2C-?\d+\.\d+/.test(href);
    console.log("destino em lat,lng:", temCoordenada);
    if (!temCoordenada) problemas.push("rota ainda montada com o texto do endereço");
    await p.screenshot({ path: path.join(SHOTS, "15-loja-rota-gerada.png"), fullPage: true });
}

// --- Modal de excluir ------------------------------------------------------
for (const b of await p.$$("button")) {
    const t = await b.evaluate(e => e.textContent);
    if (t && t.includes("Excluir")) { await b.click(); break; }
}
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
const acessivel = await p.$eval('[role="dialog"]', d => ({
    ariaModal: d.getAttribute("aria-modal"),
    ariaLabel: d.getAttribute("aria-label"),
    temXComRotulo: !!d.querySelector('[aria-label="Fechar"]'),
}));
console.log("modal de exclusão:", JSON.stringify(acessivel));
if (acessivel.ariaModal !== "true") problemas.push("modal sem aria-modal");
if (!acessivel.temXComRotulo) problemas.push("X do modal sem aria-label");
await p.screenshot({ path: path.join(SHOTS, "16-modal-excluir.png"), fullPage: true });

// Escape tem que fechar (no Android era o botão Voltar saindo da página).
await p.keyboard.press("Escape");
await new Promise(r => setTimeout(r, 400));
const fechou = (await p.$('[role="dialog"]')) === null;
console.log("Escape fecha o modal:", fechou);
if (!fechou) problemas.push("Escape não fecha o modal");

await navegador.close();

console.log("\n== resumo ==");
if (errosJs.length) console.log("erros de JS:", errosJs.join(" | "));
if (problemas.length || errosJs.length) {
    for (const x of problemas) console.log("  PROBLEMA:", x);
    process.exitCode = 1;
} else {
    console.log("tudo certo");
}
