/** Liga o alias-hook antes de qualquer import dos testes. */
import { register } from "node:module";
register("./alias-hook.mjs", import.meta.url);
