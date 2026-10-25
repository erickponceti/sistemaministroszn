# SMZN — Sistema de Ministros Zona Norte

Sistema web para organizar a **escala de ministros** das igrejas da Zona Norte: cadastro de igrejas e ministros, montagem dos agendamentos por data e turno, aprovação das escalas, confirmação pelo próprio ministro e relatórios.

---

## Funcionalidades

### Acesso e perfis
- Login com e-mail e senha
- Perfis: **Admin**, **Secretaria**, **Usuário** e **E-mail**
- Troca de senha obrigatória no primeiro acesso
- "Esqueci minha senha" com link de redefinição enviado por e-mail
- Gestão de usuários do sistema (somente admin)

### Igrejas
- Cadastro, edição e exclusão de igrejas

### Ministros
- Cadastro com nome, igreja, telefone e chamado
- Chamados: Apóstolo, Evangelista, Pastor, Mestre e Profeta (um ou mais por ministro)
- Marcações de **convidado**, **licenciado** e **ordenado**
- Lista de ministros ainda sem escala no período
- Exportação da lista de ministros para Excel

### Agendamentos (escala)
- Escala por **data** e **turno** (Manhã, Tarde, Noite), com ministro, igreja, tema e observação
- Painel com estatísticas do mês
- Envio da escala ao ministro por **Telegram**, individualmente ou o mês inteiro
- Link de confirmação: o ministro confirma ou recusa a escala

### Aprovações
- Agendamentos entram como **pendentes** e são aprovados ou rejeitados pelo admin
- Filtros por status e por igreja, com contador de pendentes

### Portal do Ministro
- Acesso próprio do ministro (`/ministro`) para ver suas escalas
- Edição do próprio perfil e troca de senha

### Relatórios
- Relatório das escalas por período: data, turno, igreja, ministro, chamado, tema, status e quem aprovou

---

## Tecnologias

- **Node.js** + **Express**
- **EJS** (páginas renderizadas no servidor)
- **PostgreSQL** (driver `pg`)
- **express-session** (login)
- **Nodemailer** (e-mails)
- **API do Telegram** (envio das escalas)

---

## Estrutura

```
sistemaministroszn/
├── server.js              # Inicialização do Express e rotas
├── db/
│   └── database.js        # Conexão e criação/migração das tabelas
├── routes/                # Rotas: login, igrejas, ministros, agendamentos,
│                          #        aprovacoes, relatorio, usuarios, ministro (portal)
├── services/
│   └── email_service.js   # Envio de e-mails
├── views/                 # Telas (EJS)
├── public/                # CSS, JS e imagens (logo SMZN)
└── .env                   # Configurações locais (não vai para o GitHub)
```

### Banco de dados (`smzn`)

| Tabela | Conteúdo |
|---|---|
| `igrejas` | Igrejas atendidas |
| `ministros` | Ministros, chamados, contato e acesso ao portal |
| `agendamentos` | Escala (data, turno, ministro, igreja, status, confirmação) |
| `usuarios` | Usuários do sistema e seus perfis |

As tabelas são criadas e atualizadas automaticamente ao iniciar o servidor.

---

## Instalação

### Pré-requisitos
- Node.js 18 ou superior
- PostgreSQL 14 ou superior

### 1. Clonar e instalar
```bash
git clone https://github.com/erickponceti/sistemaministroszn.git
cd sistemaministroszn
npm install
```

### 2. Criar o banco
No pgAdmin (ou `psql`):
```sql
CREATE DATABASE smzn;
```

### 3. Configurar o `.env`
Crie um arquivo `.env` na raiz:
```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=smzn
DB_USER=postgres
DB_PASSWORD=sua_senha
SESSION_SECRET=uma_frase_secreta_longa
BASE_URL=http://localhost:3000

# Opcional: e-mail (redefinição de senha)
EMAIL_USER=
EMAIL_PASS=
EMAIL_ADMIN=

# Opcional: Telegram (envio das escalas)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_TESTE=
```

### 4. Iniciar
```bash
npm start        # produção
npm run dev      # desenvolvimento (nodemon)
```

Acesse **http://localhost:3000**. No primeiro início o sistema cria as tabelas e os usuários padrão, que aparecem no terminal. **Troque essas senhas logo no primeiro acesso.**

---

## Atualizar o GitHub

```bash
git add .
git commit -m "descrição da mudança"
git push
```
