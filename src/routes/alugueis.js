const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT a.*, v.placa, v.modelo, v.marca, v.tipo as veiculo_tipo,
           p.nome as cliente_nome, p.whatsapp as cliente_whatsapp,
           (a.data_fim_prevista - CURRENT_DATE) as dias_restantes
    FROM alugueis a
    JOIN veiculos v ON a.veiculo_id = v.id
    JOIN pessoas p ON a.cliente_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ` AND a.status = $1`; params.push(status); }
  query += ' ORDER BY a.data_inicio DESC';
  try {
    const alugueis = await db.query(query, params);
    res.render('alugueis/index', { title: 'Aluguéis - ZeloFrota', alugueis: alugueis.rows, filtros: { status } });
  } catch (err) {
    req.flash('error', 'Erro ao listar aluguéis.');
    res.redirect('/dashboard');
  }
});

router.get('/novo', isAuthenticated, async (req, res) => {
  const veiculos = await db.query("SELECT id, placa, marca, modelo, valor_semanal FROM veiculos WHERE status = 'disponivel' ORDER BY modelo");
  const clientes = await db.query("SELECT id, nome FROM pessoas WHERE tipo = 'cliente' AND ativo = TRUE ORDER BY nome");
  res.render('alugueis/form', { title: 'Novo Aluguel', aluguel: null, veiculos: veiculos.rows, clientes: clientes.rows });
});

router.post('/', isAuthenticated, async (req, res) => {
  const { veiculo_id, cliente_id, data_inicio, data_fim_prevista, valor_semanal, observacoes } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO alugueis (veiculo_id, cliente_id, data_inicio, data_fim_prevista, valor_semanal, observacoes, criado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
    `, [veiculo_id, cliente_id, data_inicio, data_fim_prevista, valor_semanal, observacoes||null, req.session.user.id]);
    await client.query("UPDATE veiculos SET status = 'alugado' WHERE id = $1", [veiculo_id]);
    await client.query('COMMIT');
    req.flash('success', 'Aluguel registrado! Faça o check-in do veículo.');
    res.redirect(`/checklists/novo?aluguel_id=${result.rows[0].id}&tipo=checkin`);
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Erro ao registrar aluguel.');
    res.redirect('/alugueis/novo');
  } finally {
    client.release();
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const aluguel = await db.query(`
      SELECT a.*, v.placa, v.modelo, v.marca, v.tipo as veiculo_tipo, v.id as vid,
             p.nome as cliente_nome, p.telefone, p.whatsapp
      FROM alugueis a JOIN veiculos v ON a.veiculo_id = v.id
      JOIN pessoas p ON a.cliente_id = p.id WHERE a.id = $1
    `, [req.params.id]);
    if (!aluguel.rows[0]) { return res.redirect('/alugueis'); }
    const pagamentos = await db.query('SELECT * FROM pagamentos WHERE aluguel_id = $1 ORDER BY data_pagamento DESC', [req.params.id]);
    const checklists = await db.query(`
      SELECT c.*, u.nome as realizado_por_nome FROM checklists c
      LEFT JOIN usuarios u ON c.realizado_por = u.id
      WHERE c.aluguel_id = $1 ORDER BY c.tipo
    `, [req.params.id]);
    res.render('alugueis/detalhe', {
      title: 'Detalhe do Aluguel',
      aluguel: aluguel.rows[0],
      pagamentos: pagamentos.rows,
      checklists: checklists.rows
    });
  } catch (err) {
    res.redirect('/alugueis');
  }
});

// Encerrar aluguel
router.post('/:id/encerrar', isAuthenticated, async (req, res) => {
  const { data_fim_real } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const aluguel = await client.query('SELECT * FROM alugueis WHERE id = $1', [req.params.id]);
    await client.query(`
      UPDATE alugueis SET status = 'encerrado', data_fim_real = $1, atualizado_em = NOW() WHERE id = $2
    `, [data_fim_real || new Date(), req.params.id]);
    await client.query("UPDATE veiculos SET status = 'disponivel' WHERE id = $1", [aluguel.rows[0].veiculo_id]);
    await client.query('COMMIT');
    req.flash('success', 'Aluguel encerrado! Faça o check-out do veículo.');
    res.redirect(`/checklists/novo?aluguel_id=${req.params.id}&tipo=checkout`);
  } catch (err) {
    await client.query('ROLLBACK');
    req.flash('error', 'Erro ao encerrar aluguel.');
    res.redirect(`/alugueis/${req.params.id}`);
  } finally {
    client.release();
  }
});

module.exports = router;
