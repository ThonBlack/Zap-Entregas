/**
 * Smoke de navegador do "Navegar com Google Maps ou Waze".
 *
 * Confere, no Edge de verdade e no tamanho de celular:
 *   1. sem preferência, o clique em "Navegar" abre a perguntinha;
 *   2. escolher Waze com "lembrar" abre o link do Waze;
 *   3. no clique seguinte já vai direto pro Waze, sem perguntar;
 *   4. as Configurações do motoboy mostram e trocam a escolha.
 *
 * O `window.open` é trocado por um espião antes da página carregar, senão o
 * Edge abriria o Waze de verdade a cada teste.
 *
 * Rodar (com `PORT=3005 npm start` no ar e o seed-smoke.mjs já aplicado):
 *   node scripts/test/smoke-navegar.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:3005";
const EDGE = process.env.SMOKE_EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SHOTS = process.env.SMOKE_SHOTS || "./.shots-navegar";
const MOTOBOY = 3;

const SEGREDO = (() => {
    const env = fs.readFileSync(".env.local", "utf8");
    const linha = env.split("\n").find(l => l.startsWith("SESSION_SECRET="));
    return linha.slice("SESSION_SECRET=".length).trim().replace(/^["']|["']$/g, "");
})();

function cookieDeSessao(userId) {
    const corpo = `${userId}.${Date.now()}`;
    const hmac = crypto.createHmac("sha256", SEGREDO).update(corpo).digest("base64url");
    return `${corpo}.${hmac}`;
}

fs.mkdirSync(SHOTS, { recursive: true });
const problemas = [];
const feitos = [];

function checar(nome, ok, detalhe = "") {
    console.log(`  ${ok ? "ok" : "FALHOU"} — ${nome}${detalhe ? ": " + detalhe : ""}`);
    if (!ok) problemas.push(`${nome}${detalhe ? " — " + detalhe : ""}`);
}

async function foto(pagina, nome) {
    const arquivo = path.join(SHOTS, `${nome}.png`);
    await pagina.screenshot({ path: arquivo, fullPage: true });
    feitos.push(arquivo);
}

/** Clica no primeiro botão/link cujo texto bate. */
async function clicarPorTexto(pagina, texto, seletor = "button, a") {
    for (const el of await pagina.$$(seletor)) {
        const t = await el.evaluate(e => (e.textContent || "").trim());
        if (t.includes(texto)) { await el.click(); return true; }
    }
    return false;
}

const navegador = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const contexto = await navegador.createBrowserContext();
await contexto.setCookie({
    name: "session", value: cookieDeSessao(MOTOBOY),
    domain: "localhost", path: "/", httpOnly: true,
});

const pagina = await contexto.newPage();
await pagina.setViewport({ width: 360, height: 740, deviceScaleFactor: 1 });
await pagina.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

// Espião: em vez de abrir o Waze/Maps de verdade, guarda a URL.
//
// São DOIS caminhos, porque a tela usa os dois: o window.open (quando a pessoa
// escolhe no modal) e o próprio <a target="_blank"> (quando já tem
// preferência). Sem segurar o link, o Edge abre uma aba no waze.com de
// verdade — e o teste passa a depender da internet e trava.
await pagina.evaluateOnNewDocument(() => {
    window.__abertos = [];
    window.open = (url) => { window.__abertos.push(String(url)); return null; };
    document.addEventListener("click", (e) => {
        const alvo = e.target instanceof Element ? e.target.closest('a[target="_blank"]') : null;
        if (!alvo) return;
        const href = alvo.getAttribute("href") || "";
        if (href.startsWith(location.origin) || href.startsWith("/")) return;
        e.preventDefault(); // captura: roda ANTES do React, que segue normal
        window.__abertos.push(href);
    }, true);
});

const erros = [];
pagina.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
pagina.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

// ---------------------------------------- 1) sem preferência: pergunta ------
console.log("\n== 1) primeiro clique, sem preferência ==");
await pagina.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
await pagina.evaluate(() => { try { localStorage.clear(); } catch { } });
await pagina.reload({ waitUntil: "networkidle2" });
await pagina.waitForSelector("text/Entregas Pendentes", { timeout: 15000 }).catch(() => { });
await foto(pagina, "01-app-motoboy-sem-preferencia");

const alturaNavegar = await pagina.$$eval("a", (as) => {
    const a = as.find(e => (e.textContent || "").includes("Navegar"));
    return a ? Math.round(a.getBoundingClientRect().height) : 0;
});
checar("botão Navegar tem 44px ou mais", alturaNavegar >= 44, `${alturaNavegar}px`);

await new Promise(r => setTimeout(r, 500)); // deixa a hidratação terminar
checar("clicou em Navegar", await clicarPorTexto(pagina, "Navegar", "a"));
await pagina.waitForSelector('[aria-label="Abrir com qual aplicativo"]', { timeout: 8000 })
    .then(() => checar("a perguntinha apareceu", true))
    .catch(() => checar("a perguntinha apareceu", false, "modal não abriu"));
await foto(pagina, "02-escolha-maps-ou-waze");

const alturas = await pagina.$$eval('[aria-label="Abrir com qual aplicativo"] button', (bs) =>
    bs.map(b => ({ texto: (b.textContent || "").trim(), altura: Math.round(b.getBoundingClientRect().height) }))
);
console.log("  botões do modal:", JSON.stringify(alturas));
checar("botões do modal com 44px ou mais", alturas.every(b => b.altura >= 44), JSON.stringify(alturas.filter(b => b.altura < 44)));

const lembrarMarcado = await pagina.$eval('[aria-label="Abrir com qual aplicativo"] input[type="checkbox"]', (c) => c.checked);
checar('"Lembrar minha escolha" já vem marcado', lembrarMarcado === true);

// ------------------------------------------- 2) escolher Waze e lembrar -----
console.log("\n== 2) escolhendo Waze ==");
// O clique que abriu o modal já foi segurado pelo espião; zera pra medir só o
// que a escolha abre.
await pagina.evaluate(() => { window.__abertos = []; });
checar("clicou em Waze", await clicarPorTexto(pagina, "Waze", '[aria-label="Abrir com qual aplicativo"] button'));
await new Promise(r => setTimeout(r, 400));

const abertos = await pagina.evaluate(() => window.__abertos || []);
console.log("  URL aberta:", JSON.stringify(abertos));
checar("abriu um link do Waze", abertos.length === 1 && abertos[0].startsWith("https://waze.com/ul?"), abertos[0] || "nada");
checar("o link do Waze já começa a navegação", (abertos[0] || "").includes("navigate=yes"));

const gravado = await pagina.evaluate(() => { try { return localStorage.getItem("zap_navegador_preferido"); } catch { return "ERRO"; } });
checar("a escolha foi gravada no aparelho", gravado === "waze", String(gravado));

const modalFechou = await pagina.$('[aria-label="Abrir com qual aplicativo"]') === null;
checar("o modal fechou depois de escolher", modalFechou);
await foto(pagina, "03-depois-de-escolher-waze");

// ----------------------------------- 3) próximo clique vai direto pro Waze --
console.log("\n== 3) segundo clique (já com preferência) ==");
await pagina.reload({ waitUntil: "networkidle2" });
await pagina.waitForSelector("text/Entregas Pendentes", { timeout: 15000 }).catch(() => { });

const hrefs = await pagina.$$eval("a", (as) =>
    as.filter(a => (a.textContent || "").includes("Navegar")).map(a => a.getAttribute("href"))
);
console.log("  href dos botões Navegar:", JSON.stringify(hrefs));
checar("todo Navegar aponta pro Waze", hrefs.length > 0 && hrefs.every(h => h.startsWith("https://waze.com/ul?")));
checar("corrida COM pino vai de ll=", hrefs.some(h => h.includes("ll=")), hrefs.join(" "));
checar("corrida SEM pino vai de q=", hrefs.some(h => h.includes("q=")), hrefs.join(" "));

await pagina.evaluate(() => { window.__abertos = []; });
// Um respiro: clicar no meio da hidratação faz o clique se perder.
await new Promise(r => setTimeout(r, 500));
checar("clicou em Navegar de novo", await clicarPorTexto(pagina, "Navegar", "a"));
await new Promise(r => setTimeout(r, 500));
const perguntouDeNovo = await pagina.$('[aria-label="Abrir com qual aplicativo"]') !== null;
checar("não perguntou de novo", perguntouDeNovo === false);
const foiDireto = await pagina.evaluate(() => window.__abertos || []);
checar("o clique já foi direto pro Waze", foiDireto.some(u => u.startsWith("https://waze.com/ul?")), JSON.stringify(foiDireto));
await foto(pagina, "04-segundo-clique-sem-perguntar");

// ------------------------------------------------ 4) Configurações ----------
console.log("\n== 4) Configurações do motoboy ==");
await pagina.goto(`${BASE}/settings/motoboy`, { waitUntil: "networkidle2" });
await pagina.waitForSelector("text/Navegar com", { timeout: 10000 })
    .then(() => checar('o cartão "Navegar com" aparece', true))
    .catch(() => checar('o cartão "Navegar com" aparece', false, "não achei o título"));
await foto(pagina, "05-configuracoes-motoboy-waze");

const marcado = await pagina.$$eval('input[name="navegador-preferido"]', (rs) =>
    rs.map((r, i) => ({ i, checked: r.checked }))
);
console.log("  opções:", JSON.stringify(marcado));
checar("o Waze está marcado (índice 1)", marcado[1]?.checked === true);

// Troca pro Google Maps.
await pagina.$$eval('input[name="navegador-preferido"]', (rs) => rs[0].click());
await new Promise(r => setTimeout(r, 300));
const depois = await pagina.evaluate(() => { try { return localStorage.getItem("zap_navegador_preferido"); } catch { return "ERRO"; } });
checar("trocar pro Google Maps grava maps", depois === "maps", String(depois));
await foto(pagina, "06-configuracoes-motoboy-maps");

// E "Perguntar sempre" limpa tudo.
await pagina.$$eval('input[name="navegador-preferido"]', (rs) => rs[2].click());
await new Promise(r => setTimeout(r, 300));
const limpou = await pagina.evaluate(() => { try { return localStorage.getItem("zap_navegador_preferido"); } catch { return "ERRO"; } });
checar('"Perguntar sempre" apaga a preferência', limpou === null, String(limpou));

// Volta pro /app pra conferir que voltou a perguntar.
await pagina.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
await pagina.waitForSelector("text/Entregas Pendentes", { timeout: 15000 }).catch(() => { });
const voltouAoMaps = await pagina.$$eval("a", (as) =>
    as.filter(a => (a.textContent || "").includes("Navegar")).map(a => a.getAttribute("href"))
);
checar("sem preferência o href volta pro Maps", voltouAoMaps.every(h => h.includes("google.com/maps")), voltouAoMaps.join(" "));
await clicarPorTexto(pagina, "Navegar", "a");
await new Promise(r => setTimeout(r, 500));
checar("e volta a perguntar", await pagina.$('[aria-label="Abrir com qual aplicativo"]') !== null);

// -------------------------------------------------------- 5) no PC ---------
console.log("\n== 5) mesma coisa no PC (1280x800) ==");
await pagina.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await foto(pagina, "07-escolha-no-pc");
await pagina.goto(`${BASE}/settings/motoboy`, { waitUntil: "networkidle2" });
await pagina.waitForSelector("text/Navegar com", { timeout: 10000 }).catch(() => { });
await foto(pagina, "08-configuracoes-no-pc");

// ---------------------------------------------------------------------------
await pagina.close();
await contexto.close();
await navegador.close();

const ruido = erros.filter(e =>
    !e.includes("/api/logs") && !/status of (401|404)/.test(e) && !e.toLowerCase().includes("favicon")
);
console.log("\n================ RESUMO ================");
console.log(`screenshots: ${feitos.length}`);
for (const f of feitos) console.log("  " + f);
if (ruido.length) {
    console.log("\nERROS DE JS:");
    for (const e of ruido) console.log("  " + e);
    problemas.push(`erros de JS no console: ${ruido.length}`);
}
if (problemas.length) {
    console.log("\nPROBLEMAS:");
    for (const p of problemas) console.log("  " + p);
    process.exitCode = 1;
} else {
    console.log("\nTudo passou.");
}
