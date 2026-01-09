import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// Use /data/sqlite.db in production (Docker) or sqlite.db locally
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
