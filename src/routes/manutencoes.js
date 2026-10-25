const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  const manutencoes = await db.query(`
    SELECT m.*, v.placa, v.modelo, p.nome as fornecedor_nome
    FROM manutencoes m JOIN veiculos v ON m.veiculo_id = v.id
    LEFT JOIN pessoas p ON m.fornecedor_id = p.id
    ORDER BY m.data_manutencao DESC LIMIT 100
  `);
  res.render('manutencoes/index', { title: 'Manutenções - ZeloFrota', manutencoes: manutencoes.rows });
});

router.get('/novo', isAuthenticated, async (req, res) => {
  const veiculos = await db.query("SELECT id, placa, modelo FROM veiculos WHERE status != 'inativo' ORDER BY modelo");
  const fornecedores = await db.query("SELECT id, nome FROM pessoas WHERE tipo = 'fornecedor' AND ativo = TRUE ORDER BY nome");
  res.render('manutencoes/form', { title: 'Nova Manutenção', manutencao: null, veiculos: veiculos.rows, fornecedores: fornecedores.rows });
});

router.post('/', isAuthenticated, async (req, res) => {
  const { veiculo_id, tipo, descricao, valor, data_manutencao, fornecedor_id, km_manutencao, proximo_km, proxima_data, observacoes } = req.body;
  try {
    await db.query(`
      INSERT INTO manutencoes (veiculo_id, tipo, descricao, valor, data_manutencao, fornecedor_id, km_manutencao, proximo_km, proxima_data, observacoes, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [veiculo_id, tipo, descricao||null, valor||null, data_manutencao, fornecedor_id||null, km_manutencao||null, proximo_km||null, proxima_data||null, observacoes||null, req.session.user.id]);
    req.flash('success', 'Manutenção registrada!');
    res.redirect('/manutencoes');
  } catch (err) {
    req.flash('error', 'Erro ao registrar manutenção.');
    res.redirect('/manutencoes/novo');
  }
});

module.exports = router;
