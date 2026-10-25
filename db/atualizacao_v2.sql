-- ============================================
-- SenseYou — Atualização: Usuários e Aprovações
-- Execute este script no pgAdmin > Query Tool
-- no banco senseyou_db
-- ============================================

-- Tabela de usuários (login)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  senha VARCHAR(200) NOT NULL,
  perfil VARCHAR(20) NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('admin','usuario')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar coluna de status e aprovação nos agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovado','rejeitado')),
  ADD COLUMN IF NOT EXISTS aprovado_por INTEGER REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- Inserir usuário admin padrão (senha: admin123)
-- A senha está em texto simples para facilitar o início.
-- Recomenda-se usar bcrypt em produção.
INSERT INTO usuarios (nome, email, senha, perfil)
VALUES ('Administrador', 'admin@senseyou.com', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir usuário padrão comum
INSERT INTO usuarios (nome, email, senha, perfil)
VALUES ('Usuário Padrão', 'usuario@senseyou.com', '123456', 'usuario')
ON CONFLICT (email) DO NOTHING;
