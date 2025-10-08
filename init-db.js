const Database = require('better-sqlite3');
const fs = require('fs');

console.log('Criando banco de dados...');

const db = new Database('order_management.db');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync('schema.sql', 'utf8');
db.exec(schema);

console.log('✅ Banco de dados criado com sucesso!');
console.log('✅ Dados de exemplo inseridos!');
db.close();