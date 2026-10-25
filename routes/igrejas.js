const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { requireAdmin } = require('./auth.middleware');

// Listar — todos logados
router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  res.render('igrejas/index', { igrejas: result.rows, title: 'Igrejas' });
});

// Form nova — somente admin
router.get('/nova', requireAdmin, (req, res) => {
  res.render('igrejas/form', { igreja: null, title: 'Nova Igreja' });
});

// Criar — somente admin
router.post('/', requireAdmin, async (req, res) => {
  const { nome, sigla, pastor_responsavel, endereco } = req.body;
  await pool.query(
    'INSERT INTO igrejas (nome, sigla, pastor_responsavel, endereco) VALUES ($1,$2,$3,$4)',
    [nome, sigla.toUpperCase(), pastor_responsavel, endereco]
  );
  res.redirect('/igrejas');
});

// Form editar — somente admin
router.get('/:id/editar', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT * FROM igrejas WHERE id=$1', [req.params.id]);
  res.render('igrejas/form', { igreja: result.rows[0], title: 'Editar Igreja' });
});

// Atualizar — somente admin
router.post('/:id', requireAdmin, async (req, res) => {
  const { nome, sigla, pastor_responsavel, endereco } = req.body;
  await pool.query(
    'UPDATE igrejas SET nome=$1, sigla=$2, pastor_responsavel=$3, endereco=$4 WHERE id=$5',
    [nome, sigla.toUpperCase(), pastor_responsavel, endereco, req.params.id]
  );
  res.redirect('/igrejas');
});

// Deletar — somente admin
router.post('/:id/deletar', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM igrejas WHERE id=$1', [req.params.id]);
  res.redirect('/igrejas');
});

// API JSON — todos logados
router.get('/api/lista', async (req, res) => {
  const result = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  res.json(result.rows);
});

module.exports = router;
