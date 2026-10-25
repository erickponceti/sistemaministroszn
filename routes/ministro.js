const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');

const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function requireMinistro(req, res, next) {
  if (!req.session.ministro) return res.redirect('/login');
  next();
}

// Dashboard do ministro
router.get('/', requireMinistro, async (req, res) => {
  const id  = req.session.ministro.id;
  const ano = parseInt(req.query.ano) || new Date().getFullYear();

  const [mInfo, escalas, proximas, igrejas] = await Promise.all([
    pool.query('SELECT m.*, i.nome as nome_igreja FROM ministros m LEFT JOIN igrejas i ON m.igreja_id=i.id WHERE m.id=$1', [id]),
    pool.query(`
      SELECT a.id, a.data, a.turno, a.tema, a.observacao, a.ministro_id, a.igreja_id,
             i.nome as igreja_nome, i.sigla,
             COALESCE(a.confirmacao,'pendente') as confirmacao,
             COALESCE(a.status,'pendente') as status_aprovacao
      FROM agendamentos a
      JOIN igrejas i ON a.igreja_id=i.id
      WHERE a.ministro_id=$1 AND EXTRACT(YEAR FROM a.data)=$2
      ORDER BY a.data
    `, [id, ano]),
    pool.query(`
      SELECT a.id, a.data, a.turno, a.tema, a.observacao, a.ministro_id, a.igreja_id,
             i.nome as igreja_nome, i.sigla,
             COALESCE(a.confirmacao,'pendente') as confirmacao,
             COALESCE(a.status,'pendente') as status_aprovacao
      FROM agendamentos a
      JOIN igrejas i ON a.igreja_id=i.id
      WHERE a.ministro_id=$1 AND a.data >= CURRENT_DATE
      ORDER BY a.data LIMIT 5
    `, [id]),
    pool.query(`
      SELECT DISTINCT i.nome, i.sigla, COUNT(a.id) as total
      FROM agendamentos a JOIN igrejas i ON a.igreja_id=i.id
      WHERE a.ministro_id=$1
      GROUP BY i.id, i.nome, i.sigla ORDER BY total DESC
    `, [id]),
  ]);

  // Stats
  const total     = escalas.rows.length;
  const confirmadas = escalas.rows.filter(e => e.confirmacao === 'confirmado').length;
  const pendentes   = escalas.rows.filter(e => e.confirmacao === 'pendente').length;

  // Por mes para grafico
  const porMes = Array.from({length:12}, (_,i) => {
    return escalas.rows.filter(e => new Date(e.data).getMonth() === i).length;
  });

  res.render('ministro/index', {
    title: 'Minha Area',
    ministro: mInfo.rows[0],
    escalas: escalas.rows,
    proximas: proximas.rows,
    igrejas: igrejas.rows,
    stats: { total, confirmadas, pendentes },
    porMes, MESES, ano,
    usuarioLogado: null,
    ministroLogado: req.session.ministro,
  });
});

// Perfil — editar dados
router.get('/perfil', requireMinistro, async (req, res) => {
  const r = await pool.query('SELECT * FROM ministros WHERE id=$1', [req.session.ministro.id]);
  res.render('ministro/perfil', {
    title: 'Meu Perfil',
    ministro: r.rows[0],
    erro: null, sucesso: null,
    usuarioLogado: null,
    ministroLogado: req.session.ministro,
  });
});

router.post('/perfil', requireMinistro, async (req, res) => {
  const { nome, telefone } = req.body;
  await pool.query('UPDATE ministros SET nome=$1, telefone=$2 WHERE id=$3', [nome, telefone||null, req.session.ministro.id]);
  req.session.ministro.nome = nome;
  const r = await pool.query('SELECT * FROM ministros WHERE id=$1', [req.session.ministro.id]);
  res.render('ministro/perfil', {
    title: 'Meu Perfil', ministro: r.rows[0],
    erro: null, sucesso: 'Dados atualizados com sucesso!',
    usuarioLogado: null, ministroLogado: req.session.ministro,
  });
});

// Trocar senha (primeiro login)
router.get('/trocar-senha', requireMinistro, (req, res) => {
  res.render('ministro/trocar-senha', {
    title: 'Definir Nova Senha', erro: null,
    usuarioLogado: null, ministroLogado: req.session.ministro,
  });
});

router.post('/trocar-senha', requireMinistro, async (req, res) => {
  const { senha, confirmar } = req.body;
  if (senha !== confirmar)
    return res.render('ministro/trocar-senha', { title: 'Definir Nova Senha', erro: 'Senhas nao conferem.', usuarioLogado: null, ministroLogado: req.session.ministro });
  if (senha.length < 6)
    return res.render('ministro/trocar-senha', { title: 'Definir Nova Senha', erro: 'Minimo 6 caracteres.', usuarioLogado: null, ministroLogado: req.session.ministro });

  await pool.query('UPDATE ministros SET senha_acesso=$1, primeiro_login=FALSE WHERE id=$2', [senha, req.session.ministro.id]);
  res.redirect('/ministro');
});

// Logout ministro
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

module.exports = router;
