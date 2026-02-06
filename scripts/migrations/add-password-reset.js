/**
 * Migração: Adicionar campos para recuperação de senha
 * 
 * Executa: node scripts/migrations/add-password-reset.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../sqlite.db');
const db = new Database(dbPath);

console.log('🚀 Iniciando migração: password_resets e campos de usuário...\n');

try {
    // 1. Adicionar campo email na tabela users (se não existir)
    try {
        db.exec(`ALTER TABLE users ADD COLUMN email TEXT UNIQUE`);
        console.log('✅ Campo "email" adicionado à tabela users');
    } catch (e) {
        if (e.message.includes('duplicate column')) {
            console.log('⏭️  Campo "email" já existe');
        } else {
            throw e;
        }
    }

    // 2. Adicionar campo is_active na tabela users (se não existir)
    try {
        db.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`);
        console.log('✅ Campo "is_active" adicionado à tabela users');
    } catch (e) {
        if (e.message.includes('duplicate column')) {
            console.log('⏭️  Campo "is_active" já existe');
        } else {
            throw e;
        }
    }

    // 3. Criar tabela password_resets
    db.exec(`
        CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Tabela "password_resets" criada');

    // 4. Criar índice para busca rápida por token
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)
    `);
    console.log('✅ Índice em "token" criado');

    // 5. Criar índice para limpeza de tokens antigos
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at)
    `);
    console.log('✅ Índice em "expires_at" criado');

    console.log('\n🎉 Migração concluída com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('   - Campo email adicionado à tabela users');
    console.log('   - Campo is_active adicionado à tabela users');
    console.log('   - Tabela password_resets criada');
    console.log('   - Índices criados para performance');

} catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
} finally {
    db.close();
}
