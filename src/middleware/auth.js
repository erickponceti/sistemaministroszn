function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Faça login para continuar.');
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.perfil === 'admin') return next();
  req.flash('error', 'Acesso restrito ao administrador.');
  res.redirect('/dashboard');
}

module.exports = { isAuthenticated, isAdmin };
