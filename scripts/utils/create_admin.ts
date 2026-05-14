import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

// Cria/atualiza usuário admin. Uso:
//   ADMIN_NAME="Nome" ADMIN_PHONE="34999999999" ADMIN_PASSWORD="senha-forte" npx tsx scripts/utils/create_admin.ts

const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const name = process.env.ADMIN_NAME;
const phone = process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;

if (!name || !phone || !password) {
    console.error("ERRO: defina ADMIN_NAME, ADMIN_PHONE e ADMIN_PASSWORD no ambiente.");
    process.exit(1);
}
if (password.length < 8) {
    console.error("ERRO: senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
}

const db = new Database(dbPath);

try {
    const hashed = bcrypt.hashSync(password, 10);
    const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);

    if (existing) {
        console.log(`Usuário ${phone} já existe. Atualizando para admin e resetando senha...`);
        db.prepare("UPDATE users SET role = 'admin', password = ? WHERE phone = ?").run(hashed, phone);
    } else {
        console.log(`Criando novo usuário admin: ${name}`);
        db.prepare(`
            INSERT INTO users (name, phone, password, role, plan, subscription_status)
            VALUES (?, ?, ?, 'admin', 'enterprise', 'active')
        `).run(name, phone, hashed);
    }

    console.log(`✅ Admin ${name} (${phone}) criado/atualizado.`);
} catch (error) {
    console.error("Erro:", error);
    process.exit(1);
} finally {
    db.close();
}
