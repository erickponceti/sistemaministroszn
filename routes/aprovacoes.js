const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireLogin, requireAdmin } = require('./auth.middleware');

// Listar pendentes (todos podem ver, mas só admin aprova)
router.get('/', requireLogin, async (req, res) => {
  const statusFiltro = req.query.status || 'pendente';
  const igrejaFiltro = parseInt(req.query.igreja) || 0;

  let where = '1=1';
  const params = [];
  let pIdx = 1;

  if (statusFiltro !== 'todos') {
    where += ` AND a.status = $${pIdx++}`;
    params.push(statusFiltro);
  }
  if (igrejaFiltro) {
    where += ` AND a.igreja_id = $${pIdx++}`;
    params.push(igrejaFiltro);
  }

  const result = await pool.query(`
    SELECT
      a.id,
      a.data,
      a.turno,
      a.tema,
      a.observacao,
      a.status,
      a.motivo_rejeicao,
      a.aprovado_em,
      m.nome  AS ministro_nome,
      m.chamado,
      COALESCE(m.chamados, '{}') as chamados,
      i.nome  AS igreja_nome,
      i.sigla AS igreja_sigla,
      u.nome  AS aprovado_por_nome
    FROM agendamentos a
    JOIN ministros m ON a.ministro_id = m.id
    JOIN igrejas   i ON a.igreja_id   = i.id
    LEFT JOIN usuarios u ON a.aprovado_por = u.id
    WHERE ${where}
    ORDER BY a.data DESC, a.created_at DESC
  `, params);

  const igrejas = await pool.query('SELECT * FROM igrejas ORDER BY nome');

  res.render('aprovacoes/index', {
    title: 'Aprovações',
    escalas: result.rows,
    igrejas: igrejas.rows,
    usuario: req.session.usuario,
    filtros: { status: statusFiltro, igreja: igrejaFiltro },
  });
});

// Aprovar — somente admin
router.post('/:id/aprovar', requireAdmin, async (req, res) => {
  const userId = req.session.usuario.id;
  await pool.query(`
    UPDATE agendamentos
    SET status = 'aprovado', aprovado_por = $1, aprovado_em = NOW()
    WHERE id = $2
  `, [userId, req.params.id]);
  res.json({ success: true, status: 'aprovado' });
});

// Rejeitar — somente admin
router.post('/:id/rejeitar', requireAdmin, async (req, res) => {
  const userId = req.session.usuario.id;
  const { motivo } = req.body;
  await pool.query(`
    UPDATE agendamentos
    SET status = 'rejeitado', aprovado_por = $1, aprovado_em = NOW(), motivo_rejeicao = $2
    WHERE id = $3
  `, [userId, motivo || null, req.params.id]);
  res.json({ success: true, status: 'rejeitado' });
});

// API: contagem de pendentes para o badge no menu
router.get('/api/pendentes-count', requireLogin, async (req, res) => {
  const result = await pool.query(`SELECT COUNT(*) as total FROM agendamentos WHERE status = 'pendente'`);
  res.json({ total: parseInt(result.rows[0].total) });
});

module.exports = router;
