/**
 * Deixa o Node entender os caminhos "@/..." que o projeto usa (que normalmente
 * só o Next/TypeScript resolve). Serve pros testes daqui importarem os arquivos
 * de src/lib direto, sem precisar subir o servidor.
 */
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const raizSrc = path.resolve(import.meta.dirname, "..", "..", "src");

export async function resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
        const base = path.join(raizSrc, specifier.slice(2));
        for (const tentativa of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
            if (existsSync(tentativa)) {
                return next(pathToFileURL(tentativa).href, context);
            }
        }
    }
    return next(specifier, context);
}
