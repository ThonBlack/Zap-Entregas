import Database from "better-sqlite3";

// Script para promover usuário a admin
// Uso: npx tsx promote_admin.ts <telefone>

const phone = process.argv[2];

if (!phone) {
    console.log("Uso: npx tsx promote_admin.ts <telefone>");
    console.log("Exemplo: npx tsx promote_admin.ts 11999999999");
    process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

try {
    const user = db.prepare("SELECT id, name, phone, role FROM users WHERE phone = ?").get(phone) as any;

    if (!user) {
        console.log(`❌ Usuário com telefone ${phone} não encontrado.`);
        process.exit(1);
    }

    console.log(`Usuário encontrado: ${user.name} (${user.phone})`);
    console.log(`Role atual: ${user.role}`);

    db.prepare("UPDATE users SET role = 'admin' WHERE phone = ?").run(phone);

    console.log(`✅ ${user.name} agora é ADMIN!`);
    console.log(`Acesse: https://zapentregas.duckdns.org/admin/saas`);
} catch (error) {
    console.error("Erro:", error);
}

db.close();
