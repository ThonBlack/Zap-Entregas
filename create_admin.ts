import Database from "better-sqlite3";

// Script para criar usuário admin
// Uso: npx tsx create_admin.ts

const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

const name = "Thon Black";
const phone = "34996802886";
const password = "admin123"; // Trocar depois

try {
    // Verificar se já existe
    const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);

    if (existing) {
        console.log(`Usuário ${phone} já existe. Atualizando para admin...`);
        db.prepare("UPDATE users SET role = 'admin' WHERE phone = ?").run(phone);
    } else {
        console.log(`Criando novo usuário admin: ${name}`);
        db.prepare(`
            INSERT INTO users (name, phone, password, role, plan, subscription_status)
            VALUES (?, ?, ?, 'admin', 'enterprise', 'active')
        `).run(name, phone, password);
    }

    console.log(`✅ Admin ${name} (${phone}) criado/atualizado com sucesso!`);
    console.log(`Senha: ${password}`);
    console.log(`Acesse: https://zapentregas.duckdns.org/login`);
    console.log(`Painel Admin: https://zapentregas.duckdns.org/admin/saas`);
} catch (error) {
    console.error("Erro:", error);
}

db.close();
