import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

try {
    // Check and add trial columns
    const columns = db.pragma("table_info(users)");
    const columnNames = columns.map((col: any) => col.name);

    if (!columnNames.includes('trial_ends_at')) {
        console.log("Adding trial_ends_at column...");
        db.exec("ALTER TABLE users ADD COLUMN trial_ends_at TEXT");
        console.log("✓ trial_ends_at added");
    } else {
        console.log("✓ trial_ends_at already exists");
    }

    if (!columnNames.includes('is_trial_user')) {
        console.log("Adding is_trial_user column...");
        db.exec("ALTER TABLE users ADD COLUMN is_trial_user INTEGER DEFAULT 0");
        console.log("✓ is_trial_user added");
    } else {
        console.log("✓ is_trial_user already exists");
    }

    console.log("\nMigration complete!");
} catch (error) {
    console.error("Error:", error);
} finally {
    db.close();
}
