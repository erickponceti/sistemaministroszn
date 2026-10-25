const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const { requireAdmin } = require('./auth.middleware');

const PERFIS = [
  { value: 'admin',      label: 'Administrador', desc: 'Acesso total ao sistema' },
  { value: 'secretaria', label: 'Secretaria',    desc: 'Cadastra escalas, sem aprovacoes ou exclusoes' },
  { value: 'email',      label: 'Somente Email', desc: 'Acesso apenas para visualizacao' },
];

// Listar — somente admin
router.get('/', requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome');
  res.render('usuarios/index', { title: 'Usuarios', usuarios: result.rows, PERFIS, erro: req.query.erro || null });
});

// Form novo — somente admin
router.get('/novo', requireAdmin, (req, res) => {
  res.render('usuarios/form', { title: 'Novo Usuario', usuario: null, PERFIS });
});

// Criar
router.post('/', requireAdmin, async (req, res) => {
  const { nome, email, senha, perfil, ativo } = req.body;
  try {
    await pool.query(
      'INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES ($1,$2,$3,$4,$5)',
      [nome, email.trim().toLowerCase(), senha, perfil, ativo === 'on']
    );
    res.redirect('/usuarios');
  } catch(err) {
    const msg = err.code === '23505' ? 'Este e-mail ja esta cadastrado.' : err.message;
    res.render('usuarios/form', { title: 'Novo Usuario', usuario: { nome, email, perfil }, PERFIS, erro: msg });
  }
});

// Form editar
router.get('/:id/editar', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT * FROM usuarios WHERE id=$1', [req.params.id]);
  res.render('usuarios/form', { title: 'Editar Usuario', usuario: r.rows[0], PERFIS, erro: null });
});

// Deletar — ANTES de /:id para nao ser interceptado
router.post('/deletar/:id', requireAdmin, async (req, res) => {
  if (req.session.usuario && req.session.usuario.id == req.params.id) {
    return res.redirect('/usuarios');
  }
  try {
    // Nullificar referencias em agendamentos antes de deletar
    await pool.query('UPDATE agendamentos SET aprovado_por = NULL WHERE aprovado_por = $1', [req.params.id]);
    await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
    res.redirect('/usuarios');
  } catch(e) {
    console.error('[deletar usuario]', e.message);
    const msg = encodeURIComponent('Nao foi possivel excluir: ' + e.message);
    res.redirect('/usuarios?erro=' + msg);
  }
});

// Atualizar
router.post('/:id', requireAdmin, async (req, res) => {
  const { nome, email, senha, perfil, ativo } = req.body;
  try {
    if (senha && senha.trim() !== '') {
      await pool.query(
        'UPDATE usuarios SET nome=$1, email=$2, senha=$3, perfil=$4, ativo=$5 WHERE id=$6',
        [nome, email.trim().toLowerCase(), senha, perfil, ativo === 'on', req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4 WHERE id=$5',
        [nome, email.trim().toLowerCase(), perfil, ativo === 'on', req.params.id]
      );
    }
    res.redirect('/usuarios');
  } catch(err) {
    const msg = err.code === '23505' ? 'Este e-mail ja esta cadastrado.' : err.message;
    const usuario = { id: req.params.id, nome, email, perfil, ativo };
    res.render('usuarios/form', { title: 'Editar Usuario', usuario, PERFIS, erro: msg });
  }
});

module.exports = router;
