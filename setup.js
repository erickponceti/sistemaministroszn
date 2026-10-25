/**
 * ZeloFrota - Script de Setup Inicial
 * 
 * Execute APÓS criar o banco e rodar o database.sql:
 *   node setup.js
 * 
 * Este script:
 *  1. Testa a conexão com o banco
 *  2. Hasheia a senha do admin se ainda estiver em texto puro
 *  3. Confirma que o login está funcionando
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'zelofrota',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function setup() {
  console.log('\n🚗 ZeloFrota — Setup Inicial\n');
  console.log('──────────────────────────────────────');

  // 1. Testar conexão
  try {
    const test = await pool.query('SELECT NOW()');
    console.log('✅ Banco de dados conectado:', test.rows[0].now);
  } catch (err) {
    console.error('❌ ERRO DE CONEXÃO:', err.message);
    console.log('\n📋 Verifique seu arquivo .env:');
    console.log('   DB_HOST=' + (process.env.DB_HOST || 'localhost'));
    console.log('   DB_PORT=' + (process.env.DB_PORT || '5432'));
    console.log('   DB_NAME=' + (process.env.DB_NAME || 'zelofrota'));
    console.log('   DB_USER=' + (process.env.DB_USER || 'postgres'));
    console.log('   DB_PASSWORD=' + (process.env.DB_PASSWORD ? '(definida)' : '(VAZIA - verifique!)'));
    process.exit(1);
  }

  // 2. Verificar tabela de usuários
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'usuarios'
    `);
    if (tables.rows.length === 0) {
      console.error('❌ Tabela "usuarios" não encontrada.');
      console.log('   Execute: psql -U postgres -d zelofrota -f database.sql');
      process.exit(1);
    }
    console.log('✅ Tabelas do banco encontradas');
  } catch (err) {
    console.error('❌ Erro ao verificar tabelas:', err.message);
    process.exit(1);
  }

  // 3. Verificar/criar admin
  try {
    let admin = await pool.query('SELECT * FROM usuarios WHERE email = $1', ['admin@zelofrota.com']);

    if (admin.rows.length === 0) {
      // Admin não existe, criar
      console.log('⚠️  Admin não encontrado. Criando...');
      const hash = await bcrypt.hash('Admin@123', 10);
      await pool.query(`
        INSERT INTO usuarios (nome, email, senha, perfil, ativo)
        VALUES ('Administrador', 'admin@zelofrota.com', $1, 'admin', true)
      `, [hash]);
      console.log('✅ Admin criado com sucesso!');
    } else {
      const user = admin.rows[0];
      // Verificar se a senha está hasheada
      if (!user.senha.startsWith('$2')) {
        console.log('🔐 Senha do admin em texto puro. Hasheando...');
        const senhaPlain = user.senha;
        const hash = await bcrypt.hash(senhaPlain, 10);
        await pool.query('UPDATE usuarios SET senha = $1 WHERE email = $2', [hash, 'admin@zelofrota.com']);
        console.log('✅ Senha hasheada com bcrypt!');
      } else {
        console.log('✅ Admin já configurado com senha bcrypt');
      }
    }
  } catch (err) {
    console.error('❌ Erro ao configurar admin:', err.message);
    process.exit(1);
  }

  // 4. Testar o login
  try {
    const user = await pool.query('SELECT * FROM usuarios WHERE email = $1', ['admin@zelofrota.com']);
    const match = await bcrypt.compare('Admin@123', user.rows[0].senha);
    if (match) {
      console.log('✅ Login testado com sucesso!');
    } else {
      console.log('⚠️  Senha não bate. Recriando hash...');
      const hash = await bcrypt.hash('Admin@123', 10);
      await pool.query('UPDATE usuarios SET senha = $1 WHERE email = $2', [hash, 'admin@zelofrota.com']);
      console.log('✅ Hash recriado!');
    }
  } catch (err) {
    console.error('❌ Erro ao testar login:', err.message);
  }

  console.log('\n──────────────────────────────────────');
  console.log('🎉 Setup concluído! Inicie o sistema:');
  console.log('   npm start');
  console.log('\n🔑 Login:');
  console.log('   E-mail: admin@zelofrota.com');
  console.log('   Senha:  Admin@123');
  console.log('──────────────────────────────────────\n');

  await pool.end();
}

setup().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
