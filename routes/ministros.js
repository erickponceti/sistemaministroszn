const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

const CHAMADOS = ['Apóstolo', 'Evangelista', 'Pastor', 'Mestre', 'Profeta'];

// Colunas da tabela não mudam com o servidor rodando: consulta uma vez e guarda em cache
let colunasCache = null;
async function getColunas() {
  if (colunasCache) return colunasCache;
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ministros'`);
  colunasCache = r.rows.map(function(x) { return x.column_name; });
  return colunasCache;
}

// Listar
router.get('/', async (req, res) => {
  try {
    const colunas = await getColunas();
    const temChamados  = colunas.indexOf('chamados')  !== -1;
    const temConvidado = colunas.indexOf('convidado')  !== -1;
    const temTelefone  = colunas.indexOf('telefone')   !== -1;
    const temLicenc    = colunas.indexOf('licenciado')  !== -1;
    const temOrdenado  = colunas.indexOf('ordenado')    !== -1;
    const select = `
      SELECT m.id, m.nome, m.chamado, m.igreja_id,
        ${temChamados  ? "COALESCE(m.chamados, '{}') as chamados," : "ARRAY[]::TEXT[] as chamados,"}
        ${temConvidado ? 'COALESCE(m.convidado, false) as convidado,' : 'false as convidado,'}
        ${temTelefone  ? 'm.telefone,' : 'null as telefone,'}
        ${temLicenc    ? 'COALESCE(m.licenciado, false) as licenciado,' : 'false as licenciado,'}
        ${temOrdenado  ? 'COALESCE(m.ordenado, false) as ordenado,' : 'false as ordenado,'}
        i.nome AS nome_igreja, i.sigla
      FROM ministros m
      LEFT JOIN igrejas i ON m.igreja_id = i.id
      ORDER BY m.nome`;
    const result = await pool.query(select);
    const ministros = result.rows.map(function(m) {
      var chamados = [];
      if (Array.isArray(m.chamados) && m.chamados.length > 0) chamados = m.chamados;
      else if (m.chamado && m.chamado !== '') chamados = [m.chamado];
      return Object.assign({}, m, { chamados: chamados });
    });
    res.render('ministros/index', { ministros: ministros, title: 'Ministros', CHAMADOS: CHAMADOS, erro: null });
  } catch (err) {
    console.error('Erro ao listar ministros:', err);
    res.render('ministros/index', { ministros: [], title: 'Ministros', CHAMADOS: CHAMADOS, erro: 'Erro: ' + err.message });
  }
});

// Form novo — ANTES de /:id
router.get('/novo', async (req, res) => {
  const igrejas = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  res.render('ministros/form', { ministro: null, igrejas: igrejas.rows, title: 'Novo Ministro', CHAMADOS: CHAMADOS });
});

// API JSON — ANTES de /:id
router.get('/api/lista', async (req, res) => {
  try {
    const colunas = await getColunas();
    const temChamados = colunas.indexOf('chamados') !== -1;
    const result = await pool.query(`
      SELECT m.id, m.nome, m.chamado,
             ${temChamados ? "COALESCE(m.chamados,'{}') as chamados," : "ARRAY[]::TEXT[] as chamados,"}
             m.convidado, m.telefone, m.licenciado, m.ordenado,
             i.nome as igreja
      FROM ministros m LEFT JOIN igrejas i ON m.igreja_id = i.id ORDER BY m.nome`);
    res.json(result.rows);
  } catch(err) { res.json([]); }
});

// API: ministros sem escala no ano — ANTES de /:id
router.get('/api/sem-escala', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano) || new Date().getFullYear();
    const colunas = await getColunas();
    const temChamados = colunas.indexOf('chamados') !== -1;
    const result = await pool.query(`
      SELECT m.id, m.nome, m.chamado,
             ${temChamados ? "COALESCE(m.chamados, '{}') as chamados" : "ARRAY[]::TEXT[] as chamados"}
      FROM ministros m
      WHERE m.id NOT IN (
        SELECT DISTINCT a.ministro_id
        FROM agendamentos a
        WHERE a.ministro_id IS NOT NULL
          AND EXTRACT(YEAR FROM a.data) = $1
      )
      ORDER BY m.nome
    `, [ano]);
    const lista = result.rows.map(function(m) {
      var chamados = [];
      if (Array.isArray(m.chamados) && m.chamados.length > 0) chamados = m.chamados;
      else if (m.chamado && m.chamado !== '') chamados = [m.chamado];
      var chamado = chamados.join(', ');
      return { id: m.id, nome: m.nome, chamado: chamado };
    });
    res.json(lista);
  } catch (err) {
    console.error('Erro api sem-escala:', err);
    res.json([]);
  }
});

// Deletar via AJAX — ANTES de /:id para não ser capturado
// Se o ministro tiver escalas, NÃO exclui direto: devolve temEscalas + total
// para a tela perguntar. Com ?forcar=1 exclui as escalas e o ministro juntos.
router.post('/deletar-ajax/:id', async (req, res) => {
  const id = req.params.id;
  const forcar = req.query.forcar === '1' || (req.body && req.body.forcar === '1');
  const client = await pool.connect();
  try {
    const cont = await client.query(
      'SELECT COUNT(*)::int AS total FROM agendamentos WHERE ministro_id = $1', [id]);
    const total = cont.rows[0].total;

    if (total > 0 && !forcar) {
      return res.json({ success: false, temEscalas: true, total: total });
    }

    await client.query('BEGIN');
    if (total > 0) {
      await client.query('DELETE FROM agendamentos WHERE ministro_id = $1', [id]);
    }
    await client.query('DELETE FROM ministros WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true, escalasRemovidas: total });
  } catch(err) {
    try { await client.query('ROLLBACK'); } catch(e) {}
    console.error('Erro ao deletar:', err);
    res.json({ success: false, erro: err.message });
  } finally {
    client.release();
  }
});

// Criar
router.post('/', async (req, res) => {
  try {
    const colunas = await getColunas();
    const { nome, igreja_id, convidado, telefone } = req.body;
    var chamados = req.body.chamados || [];
    if (!Array.isArray(chamados)) chamados = [chamados];
    const isConvidado  = convidado           === 'on';
    const isLicenciado = req.body.licenciado === 'on';
    const isOrdenado   = req.body.ordenado   === 'on';
    const igrejId      = isConvidado ? null : (igreja_id || null);
    let cols = ['nome', 'igreja_id', 'chamado'];
    let vals = [nome, igrejId, chamados[0] || null];
    let idx  = 4;
    if (colunas.indexOf('chamados')  !== -1) { cols.push('chamados');  vals.push(chamados);      idx++; }
    if (colunas.indexOf('convidado') !== -1) { cols.push('convidado'); vals.push(isConvidado);   idx++; }
    if (colunas.indexOf('telefone')  !== -1) { cols.push('telefone');  vals.push(telefone||null);idx++; }
    if (colunas.indexOf('licenciado')!== -1) { cols.push('licenciado');vals.push(isLicenciado);  idx++; }
    if (colunas.indexOf('ordenado')  !== -1) { cols.push('ordenado');  vals.push(isOrdenado);    idx++; }
    var emailAcessoNovo = req.body.email_acesso || '';
    var senhaAcessoNova = req.body.senha_acesso || '';
    if (colunas.indexOf('email_acesso') !== -1 && emailAcessoNovo.trim()) { cols.push('email_acesso'); vals.push(emailAcessoNovo.trim().toLowerCase()); idx++; }
    if (colunas.indexOf('senha_acesso') !== -1 && senhaAcessoNova.trim()) { cols.push('senha_acesso'); vals.push(senhaAcessoNova); idx++; }
    const ph = vals.map(function(_, i) { return '$' + (i+1); });
    await pool.query('INSERT INTO ministros (' + cols.join(',') + ') VALUES (' + ph.join(',') + ')', vals);
    res.redirect('/ministros');
  } catch (err) {
    console.error('Erro ao criar ministro:', err);
    res.redirect('/ministros');
  }
});

// Form editar
router.get('/:id/editar', async (req, res) => {
  const m = await pool.query('SELECT * FROM ministros WHERE id = $1', [req.params.id]);
  const igrejas = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  var ministro = m.rows[0];
  if (ministro) {
    ministro.chamados   = Array.isArray(ministro.chamados) ? ministro.chamados : (ministro.chamado ? [ministro.chamado] : []);
    ministro.convidado  = ministro.convidado  || false;
    ministro.licenciado = ministro.licenciado || false;
    ministro.ordenado   = ministro.ordenado   || false;
  }
  res.render('ministros/form', { ministro: ministro, igrejas: igrejas.rows, title: 'Editar Ministro', CHAMADOS: CHAMADOS });
});

// Deletar normal (form POST)
router.post('/:id/deletar', async (req, res) => {
  await pool.query('DELETE FROM ministros WHERE id = $1', [req.params.id]);
  res.redirect('/ministros');
});

// Atualizar — por último pois captura qualquer /:id
router.post('/:id', async (req, res) => {
  try {
    const colunas = await getColunas();
    const { nome, igreja_id, convidado, telefone } = req.body;
    var chamados = req.body.chamados || [];
    if (!Array.isArray(chamados)) chamados = [chamados];
    const isConvidado  = convidado           === 'on';
    const isLicenciado = req.body.licenciado === 'on';
    const isOrdenado   = req.body.ordenado   === 'on';
    const igrejId      = isConvidado ? null : (igreja_id || null);
    let sets = ['nome=$1', 'igreja_id=$2', 'chamado=$3'];
    let vals = [nome, igrejId, chamados[0] || null];
    let idx  = 4;
    if (colunas.indexOf('chamados')  !== -1) { sets.push('chamados=$'  + idx); vals.push(chamados);      idx++; }
    if (colunas.indexOf('convidado') !== -1) { sets.push('convidado=$' + idx); vals.push(isConvidado);   idx++; }
    if (colunas.indexOf('telefone')  !== -1) { sets.push('telefone=$'  + idx); vals.push(telefone||null);idx++; }
    if (colunas.indexOf('licenciado')!== -1) { sets.push('licenciado=$'+ idx); vals.push(isLicenciado);  idx++; }
    if (colunas.indexOf('ordenado')   !== -1) { sets.push('ordenado=$'  + idx); vals.push(isOrdenado);    idx++; }
    // email e senha do portal do ministro
    var emailAcesso = req.body.email_acesso || '';
    var senhaAcesso = req.body.senha_acesso || '';
    if (colunas.indexOf('email_acesso') !== -1 && emailAcesso.trim()) { sets.push('email_acesso=$' + idx); vals.push(emailAcesso.trim().toLowerCase()); idx++; }
    if (colunas.indexOf('senha_acesso') !== -1 && senhaAcesso.trim()) { sets.push('senha_acesso=$' + idx); vals.push(senhaAcesso); idx++; sets.push('primeiro_login=$' + idx); vals.push(true); idx++; }
    vals.push(req.params.id);
    await pool.query('UPDATE ministros SET ' + sets.join(', ') + ' WHERE id=$' + idx, vals);
    res.redirect('/ministros');
  } catch (err) {
    console.error('Erro ao atualizar ministro:', err);
    res.redirect('/ministros');
  }
});

module.exports = router;
