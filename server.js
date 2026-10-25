require('dotenv').config();
const express = require('express');

// Faz com que erros em rotas async caiam no tratador de erros
// (no Express 4, sem isso a requisição fica "pendurada" e a tela não mostra nada)
(function patchAsyncErrors() {
  const Layer = require('express/lib/router/layer');
  Layer.prototype.handle_request = function(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const r = fn(req, res, next);
      if (r && typeof r.catch === 'function') r.catch(next);
    } catch (err) { next(err); }
  };
})();
process.on('unhandledRejection', function(err) { console.error('[unhandledRejection]', err); });
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const session = require('express-session');
const path = require('path');
const { initDB } = require('./db/database');
const { requireLogin } = require('./routes/auth.middleware');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Mostra no terminal as telas que demoram mais de 1 segundo
app.use(function(req, res, next) {
  const t0 = Date.now();
  res.on('finish', function() {
    const ms = Date.now() - t0;
    if (ms > 1000) console.log('[LENTO] ' + req.method + ' ' + req.originalUrl + ' levou ' + ms + ' ms');
  });
  next();
});
app.use('/img', express.static(path.join(__dirname, 'public', 'img'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(session({ secret: process.env.SESSION_SECRET || 'senseyou2024', resave: false, saveUninitialized: false }));

app.use(function(req, res, next) {
  res.locals.usuarioLogado  = req.session.usuario  || null;
  res.locals.ministroLogado = req.session.ministro || null;
  next();
});

app.use('/login',      require('./routes/login'));
app.use('/ministro',   require('./routes/ministro'));
app.get('/',           requireLogin, function(req,res){ res.render('index',{title:'Dashboard'}); });

// Troca de senha obrigatória (usuário do sistema)
const { pool } = require('./db/database');
app.get('/trocar-senha-obrigatorio', function(req, res) {
  if (!req.session.usuario) return res.redirect('/login');
  res.render('trocar-senha-obrigatorio', { erro: null });
});
app.post('/trocar-senha-obrigatorio', async function(req, res) {
  if (!req.session.usuario) return res.redirect('/login');
  const { senha, confirmar } = req.body;
  if (senha !== confirmar)
    return res.render('trocar-senha-obrigatorio', { erro: 'As senhas não conferem!' });
  if (senha.length < 6)
    return res.render('trocar-senha-obrigatorio', { erro: 'Mínimo 6 caracteres.' });
  try {
    await pool.query(
      'UPDATE usuarios SET senha=$1, primeiro_login=FALSE WHERE id=$2',
      [senha, req.session.usuario.id]
    );
    req.session.usuario.primeiro_login = false;
    return res.redirect('/');
  } catch(err) {
    console.error('[trocar-senha-obrigatorio]', err.message);
    return res.render('trocar-senha-obrigatorio', { erro: 'Erro interno: ' + err.message });
  }
});
app.use('/igrejas',    requireLogin, require('./routes/igrejas'));
app.use('/ministros',  requireLogin, require('./routes/ministros'));
app.use('/agendamento',requireLogin, require('./routes/agendamentos'));
app.use('/relatorio',  requireLogin, require('./routes/relatorio'));
app.use('/aprovacoes', requireLogin, require('./routes/aprovacoes'));
app.use('/usuarios',   requireLogin, require('./routes/usuarios'));
app.get('/403', function(req,res){ res.render('403',{title:'Acesso Negado'}); });

// Tratador de erros: registra no terminal e devolve resposta em vez de travar
app.use(function(err, req, res, next) {
  console.error('[ERRO] ' + req.method + ' ' + req.originalUrl + ' ->', err.message);
  if (res.headersSent) return next(err);
  const querJson = req.xhr || (req.headers.accept || '').indexOf('json') !== -1 ||
                   req.originalUrl.indexOf('/api/') !== -1 || req.is('json');
  if (querJson) return res.status(500).json({ success: false, erro: err.message });
  res.status(500).send('<h2>Erro interno</h2><pre>' + String(err.message).replace(/</g,'&lt;') +
    '</pre><p><a href="javascript:history.back()">Voltar</a></p>');
});


const PORT = process.env.PORT || 3000;
initDB().then(function() {
  app.listen(PORT, function() {
    console.log('\n🚀 SMZN - Sistema de Ministros Zona Norte rodando em http://localhost:' + PORT);
    console.log('   Admin:      admin@senseyou.com / admin123');
    console.log('   Secretaria: secretaria@senseyou.com / 123456\n');
  });
});
