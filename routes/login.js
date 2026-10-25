const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const crypto  = require('crypto');

const BASE_URL   = process.env.BASE_URL   || 'http://localhost:3000';
const EMAIL_ADMIN = process.env.EMAIL_ADMIN || 'erickponceti@hotmail.com';

async function tentarEnviarEmail(assunto, corpo) {
  try {
    const nodemailer = require('nodemailer');
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Credenciais nao configuradas. Assunto:', assunto);
      return false;
    }
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await t.sendMail({ from: process.env.EMAIL_USER, to: EMAIL_ADMIN, subject: assunto, html: corpo });
    return true;
  } catch(e) {
    console.error('[Email] Erro:', e.message);
    return false;
  }
}

// ===== GET login =====
router.get('/', (req, res) => {
  if (req.session.usuario)  return res.redirect('/');
  if (req.session.ministro) return res.redirect('/ministro');
  res.render('login', { title: 'Login', erro: null, msg: req.query.msg || null });
});

// ===== POST login =====
router.post('/', async (req, res) => {
  const { email, senha } = req.body;
  const em = email.trim().toLowerCase();
  try {
    // Tentar usuario do sistema
    const ru = await pool.query(
      'SELECT * FROM usuarios WHERE LOWER(email)=$1 AND senha=$2 AND ativo=TRUE',
      [em, senha]
    );
    if (ru.rows.length > 0) {
      const u = ru.rows[0];
      req.session.usuario = { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
      if (u.primeiro_login === true) return res.redirect('/trocar-senha-obrigatorio');
      return res.redirect('/');
    }

    // Tentar ministro
    const rm = await pool.query(
      'SELECT * FROM ministros WHERE LOWER(email_acesso)=$1 AND senha_acesso=$2',
      [em, senha]
    ).catch(() => ({ rows: [] }));
    if (rm.rows.length > 0) {
      const m = rm.rows[0];
      req.session.ministro = { id: m.id, nome: m.nome, email: m.email_acesso };
      if (m.primeiro_login === true) return res.redirect('/ministro/trocar-senha');
      return res.redirect('/ministro');
    }

    return res.render('login', { title: 'Login', erro: 'E-mail ou senha incorretos.', msg: null });
  } catch(err) {
    console.error('[login]', err);
    return res.render('login', { title: 'Login', erro: 'Erro interno. Tente novamente.', msg: null });
  }
});

// ===== Logout =====
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ===== ESQUECI SENHA =====
router.get('/esqueci-senha', (req, res) => {
  res.render('esqueci-senha', { title: 'Esqueci a Senha', erro: null, sucesso: null });
});

router.post('/esqueci-senha', async (req, res) => {
  const em = req.body.email.trim().toLowerCase();
  try {
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);
    let nome = '', encontrado = false;

    const ru = await pool.query('SELECT * FROM usuarios WHERE LOWER(email)=$1', [em]);
    if (ru.rows.length > 0) {
      nome = ru.rows[0].nome;
      await pool.query(
        'UPDATE usuarios SET token_reset=$1, token_reset_exp=$2 WHERE LOWER(email)=$3',
        [token, expiry, em]
      );
      encontrado = true;
    } else {
      const rm = await pool.query(
        'SELECT * FROM ministros WHERE LOWER(email_acesso)=$1', [em]
      ).catch(() => ({ rows: [] }));
      if (rm.rows.length > 0) {
        nome = rm.rows[0].nome;
        encontrado = true;
      }
    }

    const link = BASE_URL + '/login/reset-senha/' + token;
    const corpo = `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#5C0E1A;padding:20px;text-align:center;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0">SMZN — Redefinicao de Senha</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 12px 12px">
          <p>Ola, <strong>${nome || em}</strong>!</p>
          <p>Foi solicitada a redefinicao de senha para: <strong>${em}</strong></p>
          <p><a href="${link}" style="background:#5C0E1A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:16px 0">Redefinir Senha</a></p>
          <p style="font-size:12px;color:#718096">Link: ${link}<br>Expira em 1 hora.</p>
        </div>
      </div>`;

    await tentarEnviarEmail('Reset de Senha SMZN — ' + (nome || em), corpo);

    res.render('esqueci-senha', {
      title: 'Esqueci a Senha', erro: null,
      sucesso: 'Instrucoes enviadas! Verifique o email: ' + EMAIL_ADMIN +
               (encontrado ? '' : ' (email nao encontrado, mas admin foi notificado)')
    });
  } catch(err) {
    console.error('[esqueci-senha]', err);
    res.render('esqueci-senha', { title: 'Esqueci a Senha', erro: 'Erro ao processar.', sucesso: null });
  }
});

// ===== RESET via token =====
router.get('/reset-senha/:token', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM usuarios WHERE token_reset=$1 AND token_reset_exp > NOW()',
    [req.params.token]
  ).catch(() => ({ rows: [] }));
  const valido = r.rows.length > 0;
  res.render('reset-senha', { title: 'Nova Senha', token: req.params.token, valido, erro: null, sucesso: null });
});

router.post('/reset-senha/:token', async (req, res) => {
  const { senha, confirmar } = req.body;
  if (senha !== confirmar)
    return res.render('reset-senha', { title: 'Nova Senha', token: req.params.token, valido: true, erro: 'Senhas nao conferem.', sucesso: null });
  if (senha.length < 6)
    return res.render('reset-senha', { title: 'Nova Senha', token: req.params.token, valido: true, erro: 'Minimo 6 caracteres.', sucesso: null });
  try {
    const r = await pool.query(
      'UPDATE usuarios SET senha=$1, token_reset=NULL, token_reset_exp=NULL, primeiro_login=FALSE WHERE token_reset=$2 RETURNING id',
      [senha, req.params.token]
    );
    if (!r.rows.length)
      return res.render('reset-senha', { title: 'Nova Senha', token: '', valido: false, erro: 'Link invalido ou expirado.', sucesso: null });
    res.render('reset-senha', { title: 'Nova Senha', token: '', valido: false, erro: null, sucesso: 'Senha alterada! Faca login.' });
  } catch(err) {
    console.error('[reset-senha]', err.message);
    res.render('reset-senha', { title: 'Nova Senha', token: '', valido: false, erro: 'Erro: ' + err.message, sucesso: null });
  }
});

// ===== TROCAR SENHA OBRIGATORIA (usuario do sistema) =====
router.get('/trocar-senha-obrigatorio', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');
  res.render('trocar-senha-obrigatorio', { title: 'Definir Nova Senha', erro: null });
});

router.post('/trocar-senha-obrigatorio', async (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');
  const { senha, confirmar } = req.body;
  if (senha !== confirmar)
    return res.render('trocar-senha-obrigatorio', { title: 'Definir Nova Senha', erro: 'Senhas nao conferem.' });
  if (senha.length < 6)
    return res.render('trocar-senha-obrigatorio', { title: 'Definir Nova Senha', erro: 'Minimo 6 caracteres.' });
  try {
    const r = await pool.query(
      'UPDATE usuarios SET senha=$1, primeiro_login=FALSE WHERE id=$2 RETURNING id',
      [senha, req.session.usuario.id]
    );
    if (!r.rows.length)
      return res.render('trocar-senha-obrigatorio', { title: 'Definir Nova Senha', erro: 'Erro ao salvar. Tente novamente.' });
    req.session.usuario.primeiro_login = false;
    return res.redirect('/');
  } catch(err) {
    console.error('[trocar-senha-obrigatorio] ERRO:', err.message);
    return res.render('trocar-senha-obrigatorio', { title: 'Definir Nova Senha', erro: 'Erro interno: ' + err.message });
  }
});

module.exports = router;
