/**
 * Os ganchos de verdade do carregador (rodam numa thread separada do Node).
 *
 *  - `resolve`: traduz "@/lib/x" → "<raiz>/src/lib/x.ts" e completa a extensão
 *    que o TypeScript deixa implícita.
 *  - `load`: tira os tipos do arquivo `.ts` com o compilador que já está
 *    instalado no projeto (typescript é devDependency), sem gravar nada em disco.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const SRC = path.join(RAIZ, "src");
const EXTENSOES = [".ts", ".tsx", ".mts", ".js", ".mjs"];

/**
 * Pedaços do Next que só existem DENTRO do servidor dele — fora, o import nem
 * resolve, e o teste morre antes de rodar uma linha do nosso código.
 *
 * Aqui eles viram versões de mentirinha, com o comportamento honesto de "não
 * tem requisição nenhuma acontecendo":
 *
 *  - `server-only`: marcador do Next pra proibir import no navegador. Fora
 *    dele não faz nada mesmo.
 *  - `next/cache`: `revalidatePath` manda o Next re-renderizar uma tela. Não é
 *    o que teste nenhum está olhando, e sem isto NENHUMA server action poderia
 *    ser testada.
 *  - `next/headers`: sem requisição não há cookie. Devolver "vazio" faz o
 *    `getSessionUserId` responder "ninguém logado", que é a verdade num teste —
 *    e é justamente o cenário da Fila da loja, onde quem autoriza é o código da
 *    URL, não a sessão.
 */
const FINGIDOS = {
    "server-only": "export {};",
    "next/cache": "export const revalidatePath = () => {}; export const revalidateTag = () => {};",
    "next/headers": [
        "export const cookies = async () => ({",
        "  get: () => undefined, getAll: () => [], has: () => false,",
        "  set: () => {}, delete: () => {},",
        "});",
        "export const headers = async () => new Headers();",
    ].join("\n"),
    // `redirect` sai do fluxo jogando uma exceção especial — aqui joga uma
    // comum, com o destino na mensagem. Teste que cair num redirect vê o erro em
    // vez de "passou": é o que a gente quer, porque redirect nunca é o caminho
    // esperado de uma função que devolve resultado.
    "next/navigation": [
        "export const redirect = (destino) => { throw new Error(`[teste] redirect para ${destino}`); };",
        "export const notFound = () => { throw new Error('[teste] notFound()'); };",
    ].join("\n"),
};

function completar(base) {
    if (existsSync(base) && !base.endsWith(path.sep)) {
        const stat = existsSync(base) && path.extname(base) !== "";
        if (stat) return base;
    }
    for (const ext of EXTENSOES) {
        const tentativa = base + ext;
        if (existsSync(tentativa)) return tentativa;
    }
    for (const ext of EXTENSOES) {
        const tentativa = path.join(base, "index" + ext);
        if (existsSync(tentativa)) return tentativa;
    }
    return null;
}

export async function resolve(specifier, context, next) {
    const fingido = FINGIDOS[specifier];
    if (fingido) {
        return {
            url: `data:text/javascript,${encodeURIComponent(fingido)}`,
            shortCircuit: true,
            format: "module",
        };
    }

    if (specifier.startsWith("@/")) {
        const alvo = completar(path.join(SRC, specifier.slice(2)));
        if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true, format: "module" };
    }

    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
        const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
        if (!path.extname(base) || !existsSync(base)) {
            const alvo = completar(base);
            if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true, format: "module" };
        }
    }

    return next(specifier, context);
}

export async function load(url, context, next) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
        const arquivo = fileURLToPath(url);
        const fonte = await readFile(arquivo, "utf8");
        const saida = ts.transpileModule(fonte, {
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2022,
                jsx: ts.JsxEmit.ReactJSX,
                esModuleInterop: true,
            },
            fileName: arquivo,
        });
        return { format: "module", source: saida.outputText, shortCircuit: true };
    }
    return next(url, context);
}
