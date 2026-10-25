-- ============================================
-- ZeloFrota - Schema do Banco de Dados
-- PostgreSQL
-- ============================================

-- Tabela de Usuários (Admin e outros perfis)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  perfil VARCHAR(50) DEFAULT 'operador', -- admin, operador
  ativo BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Clientes / Fornecedores / Empresas
CREATE TABLE IF NOT EXISTS pessoas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(30) NOT NULL, -- cliente, fornecedor, empresa
  nome VARCHAR(200) NOT NULL,
  cpf_cnpj VARCHAR(20),
  email VARCHAR(150),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Veículos
CREATE TABLE IF NOT EXISTS veiculos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL, -- carro, moto
  placa VARCHAR(10) UNIQUE NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  cor VARCHAR(50),
  renavam VARCHAR(20),
  chassi VARCHAR(50),
  combustivel VARCHAR(30), -- flex, gasolina, diesel, elétrico
  km_atual INTEGER DEFAULT 0,
  valor_semanal DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'disponivel', -- disponivel, alugado, manutencao, inativo
  proprietario_id INTEGER REFERENCES pessoas(id),
  foto_url VARCHAR(500),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Aluguéis
CREATE TABLE IF NOT EXISTS alugueis (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
  cliente_id INTEGER NOT NULL REFERENCES pessoas(id),
  data_inicio DATE NOT NULL,
  data_fim_prevista DATE NOT NULL,
  data_fim_real DATE,
  valor_semanal DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'ativo', -- ativo, encerrado, atrasado
  observacoes TEXT,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,
  aluguel_id INTEGER NOT NULL REFERENCES alugueis(id),
  valor DECIMAL(10,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento VARCHAR(50), -- pix, dinheiro, cartao, transferencia
  referencia_semana DATE,
  observacoes TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Checklist (Check-in e Check-out)
CREATE TABLE IF NOT EXISTS checklists (
  id SERIAL PRIMARY KEY,
  aluguel_id INTEGER NOT NULL REFERENCES alugueis(id),
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
  tipo VARCHAR(10) NOT NULL, -- checkin, checkout
  data_hora TIMESTAMP DEFAULT NOW(),
  km_veiculo INTEGER,
  -- Itens do checklist
  lampadas_dianteiras VARCHAR(50), -- Bom, Regular, Ruim, Quebrado
  lampadas_traseiras VARCHAR(50),
  farol_principal VARCHAR(50),
  farol_milha VARCHAR(50),
  pneu_dianteiro_esq VARCHAR(50), -- Novo, Bom, Desgastado, Careca
  pneu_dianteiro_dir VARCHAR(50),
  pneu_traseiro_esq VARCHAR(50),
  pneu_traseiro_dir VARCHAR(50),
  pneu_estepe VARCHAR(50),
  motor VARCHAR(50), -- Funcionando, Com Ruído, Com Vazamento
  nivel_oleo VARCHAR(50), -- Cheio, Adequado, Baixo
  nivel_agua VARCHAR(50),
  macaneta_esquerda VARCHAR(50), -- Funcionando, Com Defeito
  macaneta_direita VARCHAR(50),
  macaneta_traseira_esq VARCHAR(50),
  macaneta_traseira_dir VARCHAR(50),
  tanque_combustivel VARCHAR(50), -- Cheio, 3/4, 1/2, 1/4, Vazio
  lataria VARCHAR(50), -- Sem Avarias, Com Arranhões, Com Amassados
  vidros VARCHAR(50),
  espelhos VARCHAR(50),
  interior_limpeza VARCHAR(50),
  documentacao VARCHAR(50), -- Completa, Incompleta
  triangulo VARCHAR(50), -- Presente, Ausente
  macaco VARCHAR(50),
  chave_roda VARCHAR(50),
  observacoes TEXT,
  realizado_por INTEGER REFERENCES usuarios(id),
  assinatura_cliente TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Tabela de Manutenções / Custos
CREATE TABLE IF NOT EXISTS manutencoes (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
  tipo VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor DECIMAL(10,2),
  data_manutencao DATE NOT NULL,
  fornecedor_id INTEGER REFERENCES pessoas(id),
  km_manutencao INTEGER,
  proximo_km INTEGER,
  proxima_data DATE,
  status VARCHAR(30) DEFAULT 'concluida',
  observacoes TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alugueis_veiculo ON alugueis(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_alugueis_cliente ON alugueis(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alugueis_status ON alugueis(status);
CREATE INDEX IF NOT EXISTS idx_checklists_aluguel ON checklists(aluguel_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON veiculos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_aluguel ON pagamentos(aluguel_id);

-- Insert admin padrão (senha: Admin@123)
-- A senha em texto puro será hasheada automaticamente no primeiro login.
INSERT INTO usuarios (nome, email, senha, perfil)
VALUES ('Administrador', 'admin@zelofrota.com', 'Admin@123', 'admin')
ON CONFLICT (email) DO NOTHING;
