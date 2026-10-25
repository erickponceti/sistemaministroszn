require('dotenv').config();
const { Pool } = require('pg');

// No Windows, 'localhost' tenta primeiro o IPv6 (::1); se o Postgres só escuta IPv4,
// cada nova conexão perde ~2s antes de cair no 127.0.0.1. Forçamos IPv4.
const dbHost = (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') ? '127.0.0.1' : process.env.DB_HOST;

const pool = new Pool({
  host:     dbHost,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'senseyou_db_',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '123456',
  connectionTimeoutMillis: 5000,
  max: 10,
  idleTimeoutMillis: 0,   // mantém conexões abertas (evita reconectar a cada clique)
  keepAlive: true,
});

pool.on('error', function(err) {
  console.error('[Postgres] Erro na conexao do pool:', err.message);
});


const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS igrejas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(200) NOT NULL,
        sigla VARCHAR(20) NOT NULL,
        pastor_responsavel VARCHAR(200) NOT NULL,
        endereco TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ministros (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(200) NOT NULL,
        igreja_id INTEGER REFERENCES igrejas(id),
        chamado VARCHAR(50) NOT NULL CHECK (chamado IN ('Apóstolo','Evangelista','Pastor','Mestre','Profeta')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(200) NOT NULL,
        email VARCHAR(200) NOT NULL UNIQUE,
        senha VARCHAR(200) NOT NULL,
        perfil VARCHAR(20) NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('admin','usuario','secretaria','email')),
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        data DATE NOT NULL,
        turno VARCHAR(10) NOT NULL CHECK (turno IN ('Manhã','Tarde','Noite')),
        ministro_id INTEGER REFERENCES ministros(id),
        igreja_id INTEGER REFERENCES igrejas(id),
        tema VARCHAR(300),
        observacao TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
        aprovado_por INTEGER REFERENCES usuarios(id),
        aprovado_em TIMESTAMP,
        motivo_rejeicao TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(data, turno, igreja_id)
      );
    `);

    // Inserir admin padrão se não existir
    await client.query(`
      INSERT INTO usuarios (nome, email, senha, perfil)
      VALUES ('Administrador', 'admin@senseyou.com', 'admin123', 'admin')
      ON CONFLICT (email) DO NOTHING;

      INSERT INTO usuarios (nome, email, senha, perfil)
      VALUES ('Usuário Padrão', 'usuario@senseyou.com', '123456', 'usuario')
      ON CONFLICT (email) DO NOTHING;
    `);

    // Adicionar colunas se já existia a tabela sem elas (migração segura)
    await client.query(`
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente';
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS aprovado_por INTEGER REFERENCES usuarios(id);
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP;
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
    `).catch(() => {}); // ignora se constraint já existe

    // Migração: colunas da tabela usuarios
    await client.query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS primeiro_login BOOLEAN DEFAULT TRUE;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_reset VARCHAR(200);
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_reset_exp TIMESTAMP;
    `).catch(() => {});

    // Garante que admin existente tenha primeiro_login = TRUE (senha ainda é texto puro)
    await client.query(`
      UPDATE usuarios SET primeiro_login = TRUE
      WHERE primeiro_login IS NULL
    `).catch(() => {});

    // Migração: colunas de acesso do portal do ministro
    await client.query(`
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS email_acesso VARCHAR(200);
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS senha_acesso VARCHAR(200);
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS primeiro_login BOOLEAN DEFAULT TRUE;
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS chamados TEXT[] DEFAULT '{}';
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS convidado BOOLEAN DEFAULT FALSE;
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS licenciado BOOLEAN DEFAULT FALSE;
      ALTER TABLE ministros ADD COLUMN IF NOT EXISTS ordenado BOOLEAN DEFAULT FALSE;
    `).catch(() => {});

    // Migração: ampliar check constraint do perfil para aceitar secretaria/email
    await client.query(`
      ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
      ALTER TABLE usuarios ADD CONSTRAINT usuarios_perfil_check
        CHECK (perfil IN ('admin','usuario','secretaria','email'));
    `).catch(() => {});

    // Migração: colunas de confirmação do ministro (usadas em routes/agendamentos.js)
    await client.query(`
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS confirmacao VARCHAR(20) DEFAULT 'pendente';
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMP;
      ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS token_confirmacao VARCHAR(200);
    `).catch(function(e) { console.error('[migracao confirmacao]', e.message); });

    // Inserir secretaria padrão se não existir
    await client.query(`
      INSERT INTO usuarios (nome, email, senha, perfil)
      VALUES ('Secretaria', 'secretaria@senseyou.com', '123456', 'secretaria')
      ON CONFLICT (email) DO NOTHING;
    `).catch(() => {});

        console.log('✅ Banco de dados inicializado com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar banco:', err);
  } finally {
    client.release();
  }

  // Diagnóstico: mostra quantos registros existem em cada tabela
  try {
    const r = await pool.query(`
      SELECT current_database() AS banco,
        (SELECT COUNT(*) FROM igrejas)      AS igrejas,
        (SELECT COUNT(*) FROM ministros)    AS ministros,
        (SELECT COUNT(*) FROM agendamentos) AS agendamentos,
        (SELECT COUNT(*) FROM usuarios)     AS usuarios`);
    const d = r.rows[0];
    console.log('📊 Banco "' + d.banco + '": ' + d.igrejas + ' igrejas, ' + d.ministros +
      ' ministros, ' + d.agendamentos + ' agendamentos, ' + d.usuarios + ' usuarios');
  } catch (e) {
    console.error('[diagnostico]', e.message);
  }
};

module.exports = { pool, initDB };
