import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

try {
    // Check if column exists
    const columns = db.pragma("table_info(users)");
    const hasColumn = columns.some((col: any) => col.name === 'daily_goal');

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
