// Middleware: protege rotas que exigem login
function requireLogin(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

// Middleware: somente admin
function requireAdmin(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  if (req.session.usuario.perfil !== 'admin') {
    return res.status(403).render('403', { title: 'Acesso Negado' });
  }
  next();
}

// Middleware: admin OU secretaria (pode agendar, mas nao aprovar/excluir)
function requireAdminOuSecretaria(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  var perfil = req.session.usuario.perfil;
  if (perfil !== 'admin' && perfil !== 'secretaria') {
    return res.status(403).render('403', { title: 'Acesso Negado' });
  }
  next();
}

// Verificar se pode excluir (somente admin)
function podeExcluir(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  if (req.session.usuario.perfil !== 'admin') {
    return res.status(403).render('403', { title: 'Acesso Negado' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin, requireAdminOuSecretaria, podeExcluir };
