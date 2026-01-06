const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    console.log('Checking users table schema...');
    const columns = db.pragma('table_info(users)');

    const hasPlan = columns.some(c => c.name === 'plan');
    const hasSub = columns.some(c => c.name === 'subscription_status');

    if (!hasPlan) {
        console.log('Adding plan column...');
        db.prepare("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free' NOT NULL").run();
    }

    if (!hasSub) {
        console.log('Adding subscription_status column...');
        db.prepare("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active' NOT NULL").run();
    }

    console.log('Database patched for SaaS fields.');
} catch (e) {
    console.error('Database Operation Failed:', e);
}
