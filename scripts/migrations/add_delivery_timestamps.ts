import Database from "better-sqlite3";

const db = new Database("sqlite.db");

// Add new columns to deliveries table if they don't exist
const columns = [
    { name: "accepted_at", type: "TEXT" },
    { name: "picked_up_at", type: "TEXT" },
    { name: "delivered_at", type: "TEXT" }
];

for (const col of columns) {
    try {
        db.exec(`ALTER TABLE deliveries ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
    } catch (e: any) {
        if (e.message.includes("duplicate column name")) {
            console.log(`⏭️ Column already exists: ${col.name}`);
        } else {
            console.error(`❌ Error adding ${col.name}:`, e.message);
        }
    }
}

console.log("\n✅ Migration complete!");
db.close();
