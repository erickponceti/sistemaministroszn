const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const crypto = require('crypto');

// GET /
router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login - ZeloFrota' });
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    req.flash('error', 'Preencha e-mail e senha.');
    return res.redirect('/login');
  }

  try {
    // Testa conexão com o banco
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE', [email.trim().toLowerCase()]);

    if (result.rows.length === 0) {
      req.flash('error', 'E-mail ou senha inválidos.');
      return res.redirect('/login');
    }

    const user = result.rows[0];

    // Verifica se a senha é o hash bcrypt ou texto puro (primeira execução)
    let match = false;
    if (user.senha.startsWith('$2')) {
      // Senha já está hasheada com bcrypt
      match = await bcrypt.compare(senha, user.senha);
    } else {
      // Senha ainda em texto puro (fallback para setup inicial)
      match = (senha === user.senha);
      if (match) {
        // Atualiza para hash seguro
        const novoHash = await bcrypt.hash(senha, 10);
        await db.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [novoHash, user.id]);
      }
    }

    if (!match) {
      req.flash('error', 'E-mail ou senha inválidos.');
      return res.redirect('/login');
    }

    req.session.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil
    };

    req.session.save((err) => {
      if (err) {
        console.error('Erro ao salvar sessão:', err);
        req.flash('error', 'Erro ao iniciar sessão.');
        return res.redirect('/login');
      }
      res.redirect('/dashboard');
    });

  } catch (err) {
    console.error('ERRO LOGIN:', err.message);
    if (err.message && err.message.includes('connect')) {
      req.flash('error', 'Erro de conexão com o banco de dados. Verifique as configurações no arquivo .env');
    } else {
      req.flash('error', 'Erro ao fazer login: ' + err.message);
    }
    res.redirect('/login');
  }
});

// GET /esqueci-senha
router.get('/esqueci-senha', (req, res) => {
  res.render('auth/esqueci-senha', { title: 'Esqueci a Senha - ZeloFrota' });
});

// POST /esqueci-senha
router.post('/esqueci-senha', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hora
      await db.query('UPDATE usuarios SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3', [token, expiry, email]);
      // Em produção: enviar email. Aqui apenas exibimos o link
      req.flash('success', `Link de redefinição gerado. Token: ${token} (em produção seria enviado por email)`);
    } else {
      req.flash('success', 'Se o e-mail estiver cadastrado, você receberá instruções.');
    }
    res.redirect('/esqueci-senha');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erro ao processar solicitação.');
    res.redirect('/esqueci-senha');
  }
});

// GET /redefinir-senha/:token
router.get('/redefinir-senha/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM usuarios WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    if (result.rows.length === 0) {
      req.flash('error', 'Link inválido ou expirado.');
      return res.redirect('/login');
    }
    res.render('auth/redefinir-senha', { title: 'Redefinir Senha', token });
  } catch (err) {
    res.redirect('/login');
  }
});

// POST /redefinir-senha
router.post('/redefinir-senha', async (req, res) => {
  const { token, nova_senha } = req.body;
  try {
    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query(
      'UPDATE usuarios SET senha = $1, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = $2',
      [hash, token]
    );
    req.flash('success', 'Senha redefinida com sucesso!');
    res.redirect('/login');
  } catch (err) {
    req.flash('error', 'Erro ao redefinir senha.');
    res.redirect('/login');
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
