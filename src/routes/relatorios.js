const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  res.render('relatorios/index', { title: 'Relatórios - ZeloFrota' });
});

module.exports = router;
