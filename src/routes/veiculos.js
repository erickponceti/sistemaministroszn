const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

// Listar veículos
router.get('/', isAuthenticated, async (req, res) => {
  const { status, tipo, busca } = req.query;
  let query = `
    SELECT v.*, p.nome as proprietario_nome
    FROM veiculos v
    LEFT JOIN pessoas p ON v.proprietario_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (status) { query += ` AND v.status = $${idx++}`; params.push(status); }
  if (tipo) { query += ` AND v.tipo = $${idx++}`; params.push(tipo); }
  if (busca) { query += ` AND (v.placa ILIKE $${idx} OR v.modelo ILIKE $${idx} OR v.marca ILIKE $${idx})`; params.push(`%${busca}%`); idx++; }
  query += ' ORDER BY v.criado_em DESC';

  try {
    const veiculos = await db.query(query, params);
    const pessoas = await db.query("SELECT id, nome FROM pessoas WHERE ativo = TRUE ORDER BY nome");
    res.render('veiculos/index', {
      title: 'Veículos - ZeloFrota',
      veiculos: veiculos.rows,
      pessoas: pessoas.rows,
      filtros: { status, tipo, busca }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erro ao listar veículos.');
    res.redirect('/dashboard');
  }
});

// Novo veículo - form
router.get('/novo', isAuthenticated, async (req, res) => {
  const pessoas = await db.query("SELECT id, nome FROM pessoas WHERE ativo = TRUE ORDER BY nome");
  res.render('veiculos/form', { title: 'Novo Veículo', veiculo: null, pessoas: pessoas.rows });
});

// Criar veículo
router.post('/', isAuthenticated, async (req, res) => {
  const { tipo, placa, marca, modelo, ano_fabricacao, ano_modelo, cor, renavam, chassi,
          combustivel, km_atual, valor_semanal, proprietario_id, observacoes } = req.body;
  try {
    await db.query(`
      INSERT INTO veiculos (tipo, placa, marca, modelo, ano_fabricacao, ano_modelo, cor, renavam,
        chassi, combustivel, km_atual, valor_semanal, proprietario_id, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [tipo, placa.toUpperCase(), marca, modelo, ano_fabricacao||null, ano_modelo||null, cor, renavam||null,
        chassi||null, combustivel, km_atual||0, valor_semanal||null, proprietario_id||null, observacoes||null]);
    req.flash('success', 'Veículo cadastrado com sucesso!');
    res.redirect('/veiculos');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erro ao cadastrar veículo. Verifique se a placa já existe.');
    res.redirect('/veiculos/novo');
  }
});

// Editar veículo - form
router.get('/:id/editar', isAuthenticated, async (req, res) => {
  try {
    const veiculo = await db.query('SELECT * FROM veiculos WHERE id = $1', [req.params.id]);
    const pessoas = await db.query("SELECT id, nome FROM pessoas WHERE ativo = TRUE ORDER BY nome");
    if (!veiculo.rows[0]) { req.flash('error', 'Veículo não encontrado.'); return res.redirect('/veiculos'); }
    res.render('veiculos/form', { title: 'Editar Veículo', veiculo: veiculo.rows[0], pessoas: pessoas.rows });
  } catch (err) {
    res.redirect('/veiculos');
  }
});

// Atualizar veículo
router.put('/:id', isAuthenticated, async (req, res) => {
  const { tipo, placa, marca, modelo, ano_fabricacao, ano_modelo, cor, renavam, chassi,
          combustivel, km_atual, valor_semanal, status, proprietario_id, observacoes } = req.body;
  try {
    await db.query(`
      UPDATE veiculos SET tipo=$1, placa=$2, marca=$3, modelo=$4, ano_fabricacao=$5, ano_modelo=$6,
        cor=$7, renavam=$8, chassi=$9, combustivel=$10, km_atual=$11, valor_semanal=$12,
        status=$13, proprietario_id=$14, observacoes=$15, atualizado_em=NOW()
      WHERE id=$16
    `, [tipo, placa.toUpperCase(), marca, modelo, ano_fabricacao||null, ano_modelo||null, cor, renavam||null,
        chassi||null, combustivel, km_atual||0, valor_semanal||null, status, proprietario_id||null,
        observacoes||null, req.params.id]);
    req.flash('success', 'Veículo atualizado!');
    res.redirect('/veiculos');
  } catch (err) {
    req.flash('error', 'Erro ao atualizar veículo.');
    res.redirect(`/veiculos/${req.params.id}/editar`);
  }
});

// Ver detalhes do veículo
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const veiculo = await db.query(`
      SELECT v.*, p.nome as proprietario_nome FROM veiculos v
      LEFT JOIN pessoas p ON v.proprietario_id = p.id WHERE v.id = $1
    `, [req.params.id]);
    if (!veiculo.rows[0]) { req.flash('error', 'Veículo não encontrado.'); return res.redirect('/veiculos'); }

    const historicoAlugueis = await db.query(`
      SELECT a.*, p.nome as cliente_nome FROM alugueis a
      JOIN pessoas p ON a.cliente_id = p.id
      WHERE a.veiculo_id = $1 ORDER BY a.data_inicio DESC LIMIT 10
    `, [req.params.id]);

    const manutencoes = await db.query(`
      SELECT * FROM manutencoes WHERE veiculo_id = $1 ORDER BY data_manutencao DESC LIMIT 10
    `, [req.params.id]);

    const checklists = await db.query(`
      SELECT c.*, u.nome as realizado_por_nome FROM checklists c
      LEFT JOIN usuarios u ON c.realizado_por = u.id
      WHERE c.veiculo_id = $1 ORDER BY c.criado_em DESC LIMIT 20
    `, [req.params.id]);

    res.render('veiculos/detalhe', {
      title: `${veiculo.rows[0].marca} ${veiculo.rows[0].modelo} - ZeloFrota`,
      veiculo: veiculo.rows[0],
      historicoAlugueis: historicoAlugueis.rows,
      manutencoes: manutencoes.rows,
      checklists: checklists.rows
    });
  } catch (err) {
    console.error(err);
    res.redirect('/veiculos');
  }
});

// Excluir veículo
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    await db.query("UPDATE veiculos SET status = 'inativo' WHERE id = $1", [req.params.id]);
    req.flash('success', 'Veículo inativado.');
    res.redirect('/veiculos');
  } catch (err) {
    req.flash('error', 'Erro ao inativar veículo.');
    res.redirect('/veiculos');
  }
});

module.exports = router;
