// Procura em TODOS os bancos do PostgreSQL onde estao as tabelas do sistema
// Uso:  node procurar_dados.js
require('dotenv').config();
const { Client } = require('pg');

const HOST = process.env.DB_HOST || 'localhost';
const USER = process.env.DB_USER || 'postgres';
const PASS = process.env.DB_PASSWORD || '123456';
const PORTAS = [5432, 5433, 5434, 5435, 5436];
const TABELAS = ['igrejas', 'ministros', 'usuarios', 'agendamentos'];

async function conectar(port, database) {
  const c = new Client({ host: HOST, port, user: USER, password: PASS, database, connectionTimeoutMillis: 3000 });
  await c.connect();
  return c;
}

(async () => {
  console.log('Configuracao atual (.env): banco=' + (process.env.DB_NAME) + ' porta=' + (process.env.DB_PORT) + '\n');
  for (const port of PORTAS) {
    let admin;
    try { admin = await conectar(port, 'postgres'); }
    catch (e) {
      if (!/ECONNREFUSED|timeout/i.test(e.message)) console.log('Porta ' + port + ': ' + e.message);
      continue;
    }
    const v = await admin.query('SHOW server_version');
    console.log('=== PostgreSQL ' + v.rows[0].server_version + ' na porta ' + port + ' ===');
    const dbs = await admin.query("SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname");
    await admin.end();
    for (const { datname } of dbs.rows) {
      let c;
      try { c = await conectar(port, datname); } catch (e) { console.log('  ' + datname + ': sem acesso (' + e.message + ')'); continue; }
      const t = await c.query(
        "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = ANY($1) AND table_schema NOT IN ('pg_catalog','information_schema')",
        [TABELAS]);
      if (t.rows.length === 0) { console.log('  ' + datname + ': (nenhuma tabela do sistema)'); await c.end(); continue; }
      const partes = [];
      for (const r of t.rows) {
        const n = await c.query('SELECT COUNT(*) AS n FROM "' + r.table_schema + '"."' + r.table_name + '"');
        partes.push((r.table_schema !== 'public' ? r.table_schema + '.' : '') + r.table_name + '=' + n.rows[0].n);
      }
      console.log('  >> ' + datname + ': ' + partes.join(', '));
      await c.end();
    }
    console.log('');
  }
  console.log('Fim. Me envie tudo o que apareceu acima.');
})().catch(e => console.error('ERRO:', e.message));
