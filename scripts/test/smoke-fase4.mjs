/**
 * Smoke de navegador da fase 4: abre as telas no Edge de verdade, tira foto e
 * denuncia erro de JavaScript no console.
 *
 * Rodar (com `PORT=3005 npm start` no ar):
 *   node scripts/test/smoke-fase4.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE || "http://localhost:3005";
// Barra normal mesmo no Windows: o Node aceita e a string não vira campo minado
// de contrabarra quando este arquivo é editado por script.
const EDGE = process.env.SMOKE_EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SHOTS = process.env.SMOKE_SHOTS || "./shots-fase4";
const SEGREDO = lerSegredo();

const MOTOBOY = 3, LOJA = 2;
const TOKEN_CONFERENCIA = "smoketestefase4conferenciatoken00";
const TOKEN_RASTREIO = process.env.SMOKE_TRACKING || "";

function lerSegredo() {
    const env = fs.readFileSync(".env.local", "utf8");
    const linha = env.split("\n").find(l => l.startsWith("SESSION_SECRET="));
    return linha.slice("SESSION_SECRET=".length).trim().replace(/^["']|["']$/g, "");
}

/** Cookie de sessão forjado — mesma conta do src/lib/session.ts. */
function cookieDeSessao(userId) {
    const ts = Date.now();
    const corpo = `${userId}.${ts}`;
    const hmac = crypto.createHmac("sha256", SEGREDO).update(corpo).digest("base64url");
    return `${corpo}.${hmac}`;
}

fs.mkdirSync(SHOTS, { recursive: true });

const problemas = [];
const feitos = [];

async function comPagina(navegador, { largura, altura, escuro, sessao }, fn) {
    // Contexto próprio por tela = cookie próprio. Sem isso, a sessão do motoboy
    // vazava pra /login (que manda quem está logado direto pro /app) e a foto
    // saía errada.
    const contexto = await navegador.createBrowserContext();
    const pagina = await contexto.newPage();
    await pagina.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
    if (escuro !== undefined) {
        await pagina.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: escuro ? "dark" : "light" },
        ]);
    }
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
    return arquivo;
}

function registrar(nome, erros) {
    // Ruído conhecido e aceito: /api/logs devolve 401 nas páginas públicas.
    const relevantes = erros.filter(e =>
        !e.includes("/api/logs") &&
        !e.includes("Failed to load resource: the server responded with a status of 401") &&
        !e.includes("Google Maps") &&
        !e.toLowerCase().includes("favicon") &&
        !/status of (401|404)/.test(e)
    );
    if (relevantes.length) problemas.push({ tela: nome, erros: relevantes });
    console.log(`  ${relevantes.length ? "ERRO JS:" : "console limpo"} ${nome}${relevantes.length ? " -> " + relevantes.join(" | ") : ""}`);
}

const navegador = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ---------------------------------------------------------------- MOTOBOY ---
const MOBILE = { largura: 360, altura: 740 };

console.log("\n== motoboy (360x740, tema escuro do sistema) ==");
let erros = await comPagina(navegador, { ...MOBILE, escuro: true, sessao: MOTOBOY }, async (p) => {
    await p.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    await p.waitForSelector("text/Entregas Pendentes", { timeout: 15000 }).catch(() => { });
    await foto(p, "01-motoboy-app-dark");

    // O service worker registrou?
    const sw = await p.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return r ? (r.active ? "ativo" : "instalando") : "nenhum";
    });
    console.log("  service worker:", sw);
    if (sw === "nenhum") problemas.push({ tela: "/app motoboy", erros: ["service worker não registrou"] });

    // Botões de ação: conferir que têm 44px de altura de verdade.
    const alturas = await p.$$eval("button, a", (els) =>
        els
            .filter(e => /Aceitar corrida|Peguei o pedido|Entregue|Navegar|WhatsApp/.test(e.textContent || ""))
            .map(e => ({ texto: (e.textContent || "").trim().slice(0, 20), altura: Math.round(e.getBoundingClientRect().height) }))
    );
    console.log("  altura dos botões:", JSON.stringify(alturas));
    const baixos = alturas.filter(a => a.altura < 44);
    if (baixos.length) problemas.push({ tela: "botões do card", erros: [`abaixo de 44px: ${JSON.stringify(baixos)}`] });

    // O link "Navegar" leva pra coordenada quando a corrida tem pino?
    const navegar = await p.$$eval('a[href*="google.com/maps"]', (as) => as.map(a => a.getAttribute("href")));
    console.log("  links Navegar:", JSON.stringify(navegar.slice(0, 4)));
});
registrar("/app motoboy (dark)", erros);

console.log("\n== motoboy: card, modal de finalizar e confirmação fora do raio ==");
erros = await comPagina(navegador, { ...MOBILE, escuro: true, sessao: MOTOBOY }, async (p) => {
    await p.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    await p.waitForSelector("text/Entregas Pendentes", { timeout: 15000 }).catch(() => { });

    // Foto de perto de um card só (com a linha de ações nova).
    const card = await p.$("text/Cliente Longe");
    if (card) {
        const caixa = await (await card.evaluateHandle(e => e.closest(".rounded-xl"))).asElement();
        if (caixa) {
            const arquivo = path.join(SHOTS, "02-card-botoes-novos.png");
            await caixa.screenshot({ path: arquivo });
            feitos.push(arquivo);
        }
    }

    // Abre o modal de finalizar da corrida #103 (a que está a 1,4 km).
    const botoes = await p.$$("button");
    for (const b of botoes) {
        const t = await b.evaluate(e => e.textContent);
        if (t && t.includes("Entregue")) {
            const proximo = await b.evaluate(e => {
                const card = e.closest(".rounded-xl");
                return card ? card.textContent : "";
            });
            if (proximo.includes("Cliente Longe")) { await b.click(); break; }
        }
    }
    await p.waitForSelector("text/Finalizar Entrega", { timeout: 8000 });
    await foto(p, "03-modal-finalizar");

    // A loja esconde o valor do pedido do motoboy, então a 1ª opção é
    // "Recebi (informar valor)" — e o valor é obrigatório (trava da fase 1).
    const radios = await p.$$('input[type="radio"]');
    console.log("  opções de recebimento no modal:", radios.length);
    if (radios[0]) await radios[0].click();
    const campoValor = await p.$('input[inputmode="decimal"]');
    if (campoValor) await campoValor.type("145,00");
    const metodos = await p.$$("button");
    for (const m of metodos) {
        const t = await m.evaluate(e => e.textContent);
        if (t && t.trim() === "Dinheiro") { await m.click(); break; }
    }
    for (const m of await p.$$("button")) {
        const t = await m.evaluate(e => e.textContent);
        if (t && t.includes("Confirmar Entrega")) { await m.click(); break; }
    }
    await p.waitForSelector("text/Confirmar mesmo assim?", { timeout: 8000 });
    await foto(p, "04-confirmacao-fora-do-raio");

    // Motivo curto tem que ser recusado NA TELA, sem ir ao servidor.
    await p.evaluate(() => { const t = document.querySelector("#motivo-fora-raio"); if (t) t.value = ""; });
    await p.click("#motivo-fora-raio", { clickCount: 3 });
    await p.type("#motivo-fora-raio", "oi");
    for (const m of await p.$$("button")) {
        const t = await m.evaluate(e => e.textContent);
        if (t && t.includes("Finalizar mesmo assim")) { await m.click(); break; }
    }
    await new Promise(r => setTimeout(r, 400));
    const recusou = await p.evaluate(() => document.body.innerText.includes("pelo menos 5 letras"));
    console.log("  motivo curto recusado:", recusou);
    if (!recusou) problemas.push({ tela: "fora do raio", erros: ["motivo de 2 letras passou"] });
    await foto(p, "05-fora-do-raio-motivo-curto-recusado");
});
registrar("modal finalizar + fora do raio", erros);

console.log("\n== motoboy: histórico e extrato ==");
erros = await comPagina(navegador, { ...MOBILE, escuro: true, sessao: MOTOBOY }, async (p) => {
    await p.goto(`${BASE}/deliveries/history`, { waitUntil: "networkidle2" });
    await foto(p, "06-historico-mes-atual");
    const titulo = await p.title();
    console.log("  título da aba:", titulo);
    if (!titulo.startsWith("Histórico")) problemas.push({ tela: "/deliveries/history", erros: [`título "${titulo}"`] });
    const mostraValor = await p.evaluate(() => document.body.innerText.includes("VALOR"));
    console.log("  mostra bloco Valor pro motoboy:", mostraValor, "(esperado: false, a loja esconde por padrão)");

    // O histórico só pode listar ENTREGUE. Um OR mal fechado no filtro de mês já
    // fez corrida pendente de outro motoboy aparecer aqui — fica de guarda.
    const nomes = await p.evaluate(() =>
        [...document.querySelectorAll("h3")].map(h => h.textContent.trim())
    );
    console.log("  entregas listadas:", JSON.stringify(nomes));
    const intrusos = nomes.filter(n => /Dona Marta|Seu Antônio|Cliente Perto|Venda do PDV/.test(n));
    if (intrusos.length) {
        problemas.push({ tela: "/deliveries/history", erros: [`corrida NÃO entregue apareceu: ${intrusos.join(", ")}`] });
    }

    await p.goto(`${BASE}/finance/extrato`, { waitUntil: "networkidle2" });
    await foto(p, "07-extrato-com-fechamento-pendente");
    const temFechamento = await p.evaluate(() => /fechamento|fech/i.test(document.body.innerText));
    console.log("  card de fechamento presente:", temFechamento);
});
registrar("histórico + extrato", erros);

// ------------------------------------------------------------------ PÚBLICO -
console.log("\n== rastreio público (dark e light) ==");
if (TOKEN_RASTREIO) {
    for (const escuro of [true, false]) {
        erros = await comPagina(navegador, { ...MOBILE, escuro }, async (p) => {
            await p.goto(`${BASE}/tracking/${TOKEN_RASTREIO}`, { waitUntil: "networkidle2" });
            await foto(p, `08-tracking-${escuro ? "dark" : "light"}`);
            const cores = await p.$$eval(".font-medium", (els) =>
                els.slice(0, 4).map(e => ({ texto: (e.textContent || "").slice(0, 24), cor: getComputedStyle(e).color }))
            );
            console.log(`  ${escuro ? "dark" : "light"} — cor dos textos:`, JSON.stringify(cores));
            const claros = cores.filter(c => /rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)/.test(c.cor));
            if (claros.length) problemas.push({ tela: "tracking", erros: [`texto quase branco no fundo claro: ${JSON.stringify(claros)}`] });
            const previsao = await p.evaluate(() => document.body.innerText.includes("Previsão: 15-20 min"));
            console.log("  mostra previsão (corrida em rota, deve ser true):", previsao);
        });
        registrar(`/tracking (${escuro ? "dark" : "light"})`, erros);
    }
} else {
    console.log("  (sem token de rastreio: passe SMOKE_TRACKING=...)");
}

console.log("\n== /confirmar do PDV a 400x600 (tamanho do iframe) ==");
erros = await comPagina(navegador, { largura: 400, altura: 600, escuro: true }, async (p) => {
    await p.goto(`${BASE}/confirmar/${TOKEN_CONFERENCIA}`, { waitUntil: "networkidle2" });
    await foto(p, "09-confirmar-pdv-400x600");
});
registrar("/confirmar (token válido)", erros);

console.log("\n== /confirmar com token vencido: avisa o PDV? ==");
erros = await comPagina(navegador, { largura: 400, altura: 600, escuro: true }, async (p) => {
    await p.goto(`${BASE}/confirmar/tokenqueNAOexiste0000000000000000`, { waitUntil: "networkidle2" });
    await foto(p, "10-confirmar-link-invalido");
    const texto = await p.evaluate(() => document.body.innerText);
    console.log("  texto:", texto.replace(/\n+/g, " | ").slice(0, 120));
});
registrar("/confirmar (inválido)", erros);

console.log("\n== login e 404 ==");
erros = await comPagina(navegador, { ...MOBILE, escuro: true }, async (p) => {
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
    await foto(p, "11-login");
    const campos = await p.$$eval("input", (els) =>
        els.map(e => ({ nome: e.name, tipo: e.type, inputMode: e.inputMode, autoComplete: e.autocomplete }))
    );
    console.log("  campos:", JSON.stringify(campos));
});
registrar("/login", erros);

erros = await comPagina(navegador, { ...MOBILE, escuro: true }, async (p) => {
    const resposta = await p.goto(`${BASE}/nao-existe`, { waitUntil: "networkidle2" });
    console.log("  status:", resposta.status());
    await foto(p, "12-404");
    const texto = await p.evaluate(() => document.body.innerText);
    console.log("  texto:", texto.replace(/\n+/g, " | ").slice(0, 120));
    if (!texto.includes("Página não encontrada")) problemas.push({ tela: "404", erros: ["não é a página em PT-BR"] });
});
registrar("/nao-existe (404)", erros);

// -------------------------------------------------------------------- LOJA --
console.log("\n== loja (1280x800) ==");
const DESKTOP = { largura: 1280, altura: 800 };
erros = await comPagina(navegador, { ...DESKTOP, escuro: true, sessao: LOJA }, async (p) => {
    await p.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
    await foto(p, "13-loja-app-fechar-o-dia");
    const temFechar = await p.evaluate(() => /fechar o dia/i.test(document.body.innerText));
    console.log("  card 'Fechar o dia' presente:", temFechar);

    await p.goto(`${BASE}/motoboys/${MOTOBOY}/fechamento`, { waitUntil: "networkidle2" });
    await foto(p, "14-loja-fechamento-motoboy");
    console.log("  título:", await p.title());
});
registrar("/app loja + fechamento", erros);

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
