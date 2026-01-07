const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    console.log('Checking for Admin user...');
    // 1. Check if admin exists
    const existing = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();

    if (existing) {
        console.log('An admin user already exists. ID:', existing.id);
        console.log('Start FRESH? Updating password to "admin"...');
        db.prepare("UPDATE users SET password = 'admin' WHERE id = ?").run(existing.id);
        console.log('Password reset to: admin');
        return;
    }

    // 2. Insert new admin
    console.log('Creating new Admin user...');
    const stmt = db.prepare(`
        INSERT INTO users (name, phone, password, role, plan)
        VALUES (?, ?, ?, ?, ?)
    `);

    const info = stmt.run('Super Admin', 'admin', 'admin', 'admin', 'enterprise');
    console.log('Admin user created! ID:', info.lastInsertRowid);
    console.log('Credentials -> User: admin | Pass: admin');

} catch (e) {
    console.error('Failed to seed admin:', e);
}
