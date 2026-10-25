const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { requireLogin } = require('./auth.middleware');

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

router.get('/', requireLogin, async (req, res) => {
  const hoje = new Date();
  // mes = 0 -> Todos os meses | ano = 0 -> Todos os anos
  const lerNum = (v, padrao) => {
    if (v === undefined || v === '') return padrao;
    const n = parseInt(v, 10);
    return isNaN(n) ? padrao : n;
  };
  const ano  = lerNum(req.query.ano, hoje.getFullYear());
  const mes  = lerNum(req.query.mes, hoje.getMonth() + 1);
  const ministroFiltro = req.query.ministro || '';
  const igrejaFiltro   = parseInt(req.query.igreja) || 0;

  // Buscar dados para filtros
  const igrejas    = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  const ministros  = await pool.query('SELECT * FROM ministros ORDER BY nome');

  // Montar query dinâmica
  let where = `1=1`;
  const params = [];
  let pIdx = 1;

  if (mes >= 1 && mes <= 12) {
    where += ` AND EXTRACT(MONTH FROM a.data) = $${pIdx++}`;
    params.push(mes);
  }
  if (ano > 0) {
    where += ` AND EXTRACT(YEAR FROM a.data) = $${pIdx++}`;
    params.push(ano);
  }

  if (igrejaFiltro) {
    where += ` AND a.igreja_id = $${pIdx++}`;
    params.push(igrejaFiltro);
  }
  if (ministroFiltro) {
    where += ` AND m.nome ILIKE $${pIdx++}`;
    params.push(`%${ministroFiltro.trim()}%`);
  }

  const result = await pool.query(`
    SELECT
      a.id,
      a.data,
      a.turno,
      a.tema,
      a.observacao,
      a.status,
      a.created_at,
      m.nome  AS ministro_nome,
      m.chamado,
      COALESCE(m.chamados, '{}') as chamados,
      i.nome  AS igreja_nome,
      i.sigla AS igreja_sigla,
      u.nome  AS aprovado_por_nome,
      a.aprovado_em
    FROM agendamentos a
    JOIN ministros m ON a.ministro_id = m.id
    JOIN igrejas   i ON a.igreja_id   = i.id
    LEFT JOIN usuarios u ON a.aprovado_por = u.id
    WHERE ${where}
    ORDER BY a.data, i.nome, a.turno
  `, params);

  res.render('relatorio/index', {
    title: 'Relatório',
    escalas: result.rows,
    igrejas: igrejas.rows,
    ministros: ministros.rows,
    ano, mes,
    mesNome: (mes >= 1 && mes <= 12) ? MESES[mes - 1] : 'Todos os meses',
    anoNome: ano > 0 ? String(ano) : 'Todos os anos',
    meses: MESES,
    filtros: { ministro: ministroFiltro, igreja: igrejaFiltro },
  });
});

module.exports = router;
