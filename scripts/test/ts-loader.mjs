/**
 * Carregador que deixa o Node importar os arquivos `.ts` de `src/` direto,
 * com o atalho `@/` do projeto.
 *
 * Por que existe: o projeto não tem `tsx` nem suíte de testes, e os testes
 * precisam chamar as funções de verdade (a régua do resumo do dia) em vez de
 * uma cópia — cópia envelhece e passa a testar outra coisa.
 *
 * Uso:  node --import ./scripts/test/ts-loader.mjs scripts/test/<arquivo>.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-loader-hooks.mjs", pathToFileURL(import.meta.filename));
