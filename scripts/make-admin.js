const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

try {
    console.log('Promoting user with ID 1 to Admin...');
    const info = db.prepare("UPDATE users SET role = 'admin', plan = 'pro' WHERE id = 1").run();

    if (info.changes > 0) {
        console.log('Success! User 1 is now an Admin.');
    } else {
        console.log('No user found with ID 1.');
    }
} catch (e) {
    console.error('Operation Failed:', e);
}
