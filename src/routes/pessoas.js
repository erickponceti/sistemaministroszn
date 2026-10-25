const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  const { tipo, busca } = req.query;
  let query = 'SELECT * FROM pessoas WHERE ativo = TRUE';
  const params = [];
  let idx = 1;
  if (tipo) { query += ` AND tipo = $${idx++}`; params.push(tipo); }
  if (busca) { query += ` AND (nome ILIKE $${idx} OR cpf_cnpj ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${busca}%`); idx++; }
  query += ' ORDER BY nome';
  try {
    const pessoas = await db.query(query, params);
    res.render('pessoas/index', { title: 'Cadastros - ZeloFrota', pessoas: pessoas.rows, filtros: { tipo, busca } });
  } catch (err) {
    req.flash('error', 'Erro ao listar cadastros.');
    res.redirect('/dashboard');
  }
});

router.get('/novo', isAuthenticated, (req, res) => {
  res.render('pessoas/form', { title: 'Novo Cadastro', pessoa: null, tipo_pre: req.query.tipo || 'cliente' });
});

router.post('/', isAuthenticated, async (req, res) => {
  const { tipo, nome, cpf_cnpj, email, telefone, whatsapp, endereco, cidade, estado, cep, observacoes } = req.body;
  try {
    await db.query(`
      INSERT INTO pessoas (tipo, nome, cpf_cnpj, email, telefone, whatsapp, endereco, cidade, estado, cep, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [tipo, nome, cpf_cnpj||null, email||null, telefone||null, whatsapp||null, endereco||null, cidade||null, estado||null, cep||null, observacoes||null]);
    req.flash('success', 'Cadastro realizado com sucesso!');
    res.redirect('/pessoas');
  } catch (err) {
    req.flash('error', 'Erro ao cadastrar.');
    res.redirect('/pessoas/novo');
  }
});

router.get('/:id/editar', isAuthenticated, async (req, res) => {
  const pessoa = await db.query('SELECT * FROM pessoas WHERE id = $1', [req.params.id]);
  if (!pessoa.rows[0]) { req.flash('error', 'Não encontrado.'); return res.redirect('/pessoas'); }
  res.render('pessoas/form', { title: 'Editar Cadastro', pessoa: pessoa.rows[0], tipo_pre: pessoa.rows[0].tipo });
});

router.put('/:id', isAuthenticated, async (req, res) => {
  const { tipo, nome, cpf_cnpj, email, telefone, whatsapp, endereco, cidade, estado, cep, observacoes } = req.body;
  try {
    await db.query(`
      UPDATE pessoas SET tipo=$1, nome=$2, cpf_cnpj=$3, email=$4, telefone=$5, whatsapp=$6,
        endereco=$7, cidade=$8, estado=$9, cep=$10, observacoes=$11, atualizado_em=NOW()
      WHERE id=$12
    `, [tipo, nome, cpf_cnpj||null, email||null, telefone||null, whatsapp||null, endereco||null, cidade||null, estado||null, cep||null, observacoes||null, req.params.id]);
    req.flash('success', 'Atualizado com sucesso!');
    res.redirect('/pessoas');
  } catch (err) {
    req.flash('error', 'Erro ao atualizar.');
    res.redirect(`/pessoas/${req.params.id}/editar`);
  }
});

router.delete('/:id', isAuthenticated, async (req, res) => {
  await db.query('UPDATE pessoas SET ativo = FALSE WHERE id = $1', [req.params.id]);
  req.flash('success', 'Cadastro inativado.');
  res.redirect('/pessoas');
});

module.exports = router;
