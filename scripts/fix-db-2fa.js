const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    console.log('Checking users table schema for 2FA...');
    const columns = db.pragma('table_info(users)');

    const hasSecret = columns.some(c => c.name === 'two_factor_secret');
    const hasEnabled = columns.some(c => c.name === 'two_factor_enabled');

    if (!hasSecret) {
        console.log('Adding two_factor_secret column...');
        db.prepare("ALTER TABLE users ADD COLUMN two_factor_secret TEXT").run();
    }

    if (!hasEnabled) {
        console.log('Adding two_factor_enabled column...');
        db.prepare("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0").run();
    }

    console.log('Database patched for 2FA fields.');
} catch (e) {
    console.error('Database Operation Failed:', e);
}
