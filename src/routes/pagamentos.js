const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  const pagamentos = await db.query(`
    SELECT pg.*, a.data_inicio, v.placa, v.modelo, p.nome as cliente_nome
    FROM pagamentos pg JOIN alugueis a ON pg.aluguel_id = a.id
    JOIN veiculos v ON a.veiculo_id = v.id
    JOIN pessoas p ON a.cliente_id = p.id
    ORDER BY pg.data_pagamento DESC LIMIT 100
  `);
  res.render('pagamentos/index', { title: 'Pagamentos - ZeloFrota', pagamentos: pagamentos.rows });
});

router.get('/novo', isAuthenticated, async (req, res) => {
  const alugueis = await db.query(`
    SELECT a.id, a.status, a.data_inicio, a.data_fim_prevista,
           v.placa, v.modelo, p.nome as cliente_nome, a.valor_semanal
    FROM alugueis a JOIN veiculos v ON a.veiculo_id = v.id
    JOIN pessoas p ON a.cliente_id = p.id
    WHERE a.status IN ('ativo', 'encerrado', 'atrasado')
    ORDER BY a.status ASC, p.nome ASC
  `);
  res.render('pagamentos/form', { title: 'Registrar Pagamento', alugueis: alugueis.rows, aluguel_pre: req.query.aluguel_id || null });
});

router.post('/', isAuthenticated, async (req, res) => {
  const { aluguel_id, valor, data_pagamento, forma_pagamento, referencia_semana, observacoes } = req.body;
  try {
    await db.query(`
      INSERT INTO pagamentos (aluguel_id, valor, data_pagamento, forma_pagamento, referencia_semana, observacoes, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [aluguel_id, valor, data_pagamento, forma_pagamento||null, referencia_semana||null, observacoes||null, req.session.user.id]);
    req.flash('success', 'Pagamento registrado!');
    res.redirect('/pagamentos');
  } catch (err) {
    req.flash('error', 'Erro ao registrar pagamento.');
    res.redirect('/pagamentos/novo');
  }
});

module.exports = router;
