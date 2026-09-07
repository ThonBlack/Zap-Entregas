import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

try {
    // Check if column exists
    // db.pragma devolve "unknown" na tipagem do better-sqlite3; aqui sabemos
    // que é a lista de colunas de PRAGMA table_info.
    const columns = db.pragma("table_info(users)") as { name: string }[];
    const hasColumn = columns.some((col) => col.name === 'daily_goal');

    if (!hasColumn) {
        console.log("Adding daily_goal column...");
        db.exec("ALTER TABLE users ADD COLUMN daily_goal INTEGER DEFAULT 10");
        console.log("Column added successfully!");
    } else {
        console.log("Column daily_goal already exists.");
    }
} catch (error) {
    console.error("Error:", error);
} finally {
    db.close();
}
