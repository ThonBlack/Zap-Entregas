import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Use /data/sqlite.db in production (Docker) or sqlite.db locally
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const sqlite = new Database(dbPath);

// O SQLite ignora chave estrangeira por padrão — cada conexão precisa ligar.
// Sem isto, apagar um motoboy deixava corridas e lançamentos apontando pra um
// usuário que não existe mais (a dívida sumia da conta da loja).
// Com isto ligado, apagar quem tem histórico dá erro — por isso a exclusão de
// motoboy virou desativação (is_active = 0) em src/app/actions/motoboy.ts.
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
