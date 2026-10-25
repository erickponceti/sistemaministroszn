# 🚗 ZeloFrota — Sistema de Controle de Frota

Sistema completo de gestão de frota para empresas de aluguel de veículos para motoristas de aplicativo (Uber, 99, etc.).

---

## ✅ Funcionalidades

### 🔐 Autenticação
- Login com e-mail e senha
- Perfil Admin e Operador
- Esqueci minha senha (com token de redefinição)

### 🚗 Gestão de Veículos
- Cadastro de carros e motos
- Campos: placa, marca, modelo, ano, cor, RENAVAM, chassi, combustível, KM, valor/semana
- Status: Disponível, Alugado, Manutenção, Inativo
- Histórico de aluguéis por veículo
- Histórico de manutenções por veículo

### 👥 Cadastros
- Clientes (motoristas Uber)
- Fornecedores (oficinas, borracheiros, etc.)
- Empresas parceiras
- Campos: CPF/CNPJ, telefone, WhatsApp, endereço completo

### 🔑 Controle de Aluguéis
- Criação de contratos semanais
- Cálculo automático de data de término
- Status: Ativo, Encerrado, Atrasado
- Destaque visual de contratos vencendo em ≤ 7 dias
- Botão de envio de WhatsApp para aviso de vencimento

### ✅ Check-in / Check-out (Inspeção de Veículos)
- Checklist completo com 25 itens de inspeção
- Grupos: Iluminação, Pneus, Motor/Fluidos, Portas, Combustível/Lataria, Documentos
- Campos específicos com opções por item (ex: Pneu: Novo / Bom / Desgastado / Careca)
- Registro de KM no momento da inspeção
- Campo de observações livres
- Registro de data/hora e responsável

### 🔍 Módulo de Comparação (Auditoria)
- Popup com comparativo Check-in vs Check-out
- **Destaque em vermelho** de itens divergentes
- Ex: Pneu estava "Novo" no check-in e "Careca" no check-out
- Contador de avarias encontradas
- Exibição de observações de ambos os registros

### 💰 Pagamentos
- Registro por aluguel
- Formas: PIX, Dinheiro, Cartão, Transferência
- Referência por semana

### 🔧 Manutenções
- Registro de todos os serviços
- Vinculação a fornecedor
- Próximo KM / Data para revisão

### 📊 Dashboard com Gráficos
1. **Crescimento da Frota** — Barras mensais de novos veículos
2. **Fluxo de Caixa** — Linha: Receita vs Custos (últimos 6 meses)
3. **Rentabilidade por Veículo** — Barras: Receita / Custos / Lucro por veículo
4. **Grid de Vencimentos** — Contratos próximos do vencimento com alerta visual + botão WhatsApp

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express |
| Banco de Dados | PostgreSQL |
| Template Engine | EJS |
| CSS | Custom Design System (variáveis CSS) |
| Gráficos | Chart.js |
| Ícones | Font Awesome 6 |
| Fontes | Sora + JetBrains Mono (Google Fonts) |

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- PostgreSQL 13+

### Passo 1 — Clone e instale dependências
```bash
git clone <seu-repositorio>
cd zelofrota
npm install
```

### Passo 2 — Configure o banco de dados
```bash
# Crie o banco
psql -U postgres -c "CREATE DATABASE zelofrota;"

# Execute o schema
psql -U postgres -d zelofrota -f database.sql
```

### Passo 3 — Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zelofrota
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
SESSION_SECRET=zelofrota_secret_seguro_2024
PORT=3000
```

### Passo 4 — Inicie o sistema
```bash
# Produção
npm start

# Desenvolvimento (com auto-reload)
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🔑 Login Padrão

| Campo | Valor |
|-------|-------|
| E-mail | admin@zelofrota.com |
| Senha | Admin@123 |

> ⚠️ **Importante:** Troque a senha após o primeiro acesso!

---

## 📁 Estrutura do Projeto

```
zelofrota/
├── database.sql              # Schema completo do banco
├── .env.example              # Variáveis de ambiente (modelo)
├── package.json
├── public/
│   ├── css/
│   │   └── main.css          # Design system completo
│   └── js/
│       └── main.js           # JS: sidebar, modais, comparação, WhatsApp
└── src/
    ├── server.js             # Servidor Express principal
    ├── db.js                 # Conexão PostgreSQL (Pool)
    ├── middleware/
    │   └── auth.js           # Autenticação e autorização
    ├── routes/
    │   ├── auth.js           # Login, logout, esqueci senha
    │   ├── dashboard.js      # Dashboard + queries de gráficos
    │   ├── veiculos.js       # CRUD de veículos
    │   ├── pessoas.js        # CRUD clientes/fornecedores/empresas
    │   ├── alugueis.js       # Controle de contratos
    │   ├── checklists.js     # Check-in, check-out, API comparação
    │   ├── manutencoes.js    # Registro de manutenções
    │   ├── pagamentos.js     # Registro de pagamentos
    │   └── relatorios.js     # Relatórios
    └── views/
        ├── partials/
        │   ├── header.ejs    # Sidebar + topbar
        │   └── footer.ejs   # Scripts + fechamento HTML
        ├── auth/             # Login, esqueci senha, redefinir
        ├── dashboard/        # Dashboard com gráficos
        ├── veiculos/         # Lista, form, detalhe
        ├── pessoas/          # Lista, form
        ├── alugueis/         # Lista, form, detalhe
        ├── checklists/       # Lista, form completo
        ├── manutencoes/      # Lista, form
        ├── pagamentos/       # Lista, form
        └── relatorios/       # Índice de relatórios
```

---

## 🎨 Design System

O sistema usa um conjunto de variáveis CSS centralizadas em `public/css/main.css`:

```css
--primary: #0EA5E9   /* Azul principal */
--success: #10B981   /* Verde - disponível/ativo */
--danger:  #EF4444   /* Vermelho - alerta/avaria */
--warning: #F59E0B   /* Amarelo - atenção */
--info:    #6366F1   /* Roxo - informação */
```

---

## 📱 Responsividade

O sistema é totalmente responsivo:
- **Desktop**: Sidebar fixa lateral
- **Mobile/Tablet**: Sidebar retrátil com botão hambúrguer
- Grids adaptáveis com CSS Grid + `auto-fit`

---

## 🔒 Segurança

- Senhas hasheadas com **bcryptjs** (salt 10)
- Sessões seguras com **express-session**
- Proteção de rotas com middleware `isAuthenticated`
- Proteção de admin com middleware `isAdmin`
- SQL parametrizado (prevenção de SQL Injection)
- Tokens de recuperação de senha com expiração de 1 hora

---

## 🔮 Próximas Melhorias Sugeridas

- [ ] Exportação PDF/Excel dos relatórios
- [ ] Upload de fotos do veículo e da inspeção
- [ ] Notificações automáticas via WhatsApp API (Evolution API / Z-API)
- [ ] App mobile (React Native / PWA)
- [ ] Módulo financeiro completo (DRE, fluxo de caixa)
- [ ] Múltiplas filiais / empresas
- [ ] Assinatura digital do checklist pelo cliente
- [ ] Integração com DETRAN para consulta de veículos

---

## 📄 Licença

Desenvolvido para uso interno. Todos os direitos reservados.

---

**ZeloFrota** — Cuide da sua frota com zelo. 🚗✨
