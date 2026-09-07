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
    if (specifier === "server-only") {
        // Marcador do Next pra proibir import no navegador; fora do Next não faz nada.
        return { url: "data:text/javascript,export{}", shortCircuit: true, format: "module" };
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
