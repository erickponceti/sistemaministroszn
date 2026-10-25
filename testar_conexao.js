// Salve este arquivo em C:\senseyou\testar_conexao.js
// Execute com: node testar_conexao.js
// Me envie o resultado completo

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testar() {
  try {
    // 1. Testar conexão
    console.log('--- TESTE 1: Conexão ---');
    await pool.query('SELECT 1');
    console.log('OK - Conectado ao banco:', process.env.DB_NAME);

    // 2. Contar ministros
    console.log('\n--- TESTE 2: Total de ministros ---');
    const total = await pool.query('SELECT COUNT(*) as total FROM ministros');
    console.log('Total:', total.rows[0].total);

    // 3. Listar colunas
    console.log('\n--- TESTE 3: Colunas da tabela ministros ---');
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ministros' ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(' -', r.column_name));

    // 4. SELECT simples sem coluna chamados
    console.log('\n--- TESTE 4: SELECT simples ---');
    const r = await pool.query('SELECT id, nome, chamado FROM ministros ORDER BY nome LIMIT 5');
    r.rows.forEach(row => console.log(row));

    // 5. SELECT com chamados
    console.log('\n--- TESTE 5: SELECT com chamados ---');
    const r2 = await pool.query('SELECT id, nome, chamados FROM ministros LIMIT 3');
    r2.rows.forEach(row => console.log(row));

  } catch(err) {
    console.error('ERRO:', err.message);
  } finally {
    await pool.end();
  }
}

testar();
