const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

const CHECKLIST_CAMPOS = [
  { key: 'lampadas_dianteiras', label: 'Lâmpadas Dianteiras', opcoes: ['Bom', 'Regular', 'Ruim', 'Quebrado'] },
  { key: 'lampadas_traseiras', label: 'Lâmpadas Traseiras', opcoes: ['Bom', 'Regular', 'Ruim', 'Quebrado'] },
  { key: 'farol_principal', label: 'Farol Principal', opcoes: ['Bom', 'Regular', 'Ruim', 'Quebrado'] },
  { key: 'farol_milha', label: 'Farol de Milha', opcoes: ['Bom', 'Regular', 'Ruim', 'Quebrado'] },
  { key: 'pneu_dianteiro_esq', label: 'Pneu Dianteiro Esq.', opcoes: ['Novo', 'Bom', 'Desgastado', 'Careca'] },
  { key: 'pneu_dianteiro_dir', label: 'Pneu Dianteiro Dir.', opcoes: ['Novo', 'Bom', 'Desgastado', 'Careca'] },
  { key: 'pneu_traseiro_esq', label: 'Pneu Traseiro Esq.', opcoes: ['Novo', 'Bom', 'Desgastado', 'Careca'] },
  { key: 'pneu_traseiro_dir', label: 'Pneu Traseiro Dir.', opcoes: ['Novo', 'Bom', 'Desgastado', 'Careca'] },
  { key: 'pneu_estepe', label: 'Pneu Estepe', opcoes: ['Novo', 'Bom', 'Desgastado', 'Careca', 'Ausente'] },
  { key: 'motor', label: 'Motor', opcoes: ['Funcionando', 'Com Ruído', 'Com Vazamento', 'Inoperante'] },
  { key: 'nivel_oleo', label: 'Nível de Óleo', opcoes: ['Cheio', 'Adequado', 'Baixo'] },
  { key: 'nivel_agua', label: 'Nível de Água', opcoes: ['Cheio', 'Adequado', 'Baixo'] },
  { key: 'macaneta_esquerda', label: 'Maçaneta Esq. Frente', opcoes: ['Funcionando', 'Com Defeito', 'Quebrada'] },
  { key: 'macaneta_direita', label: 'Maçaneta Dir. Frente', opcoes: ['Funcionando', 'Com Defeito', 'Quebrada'] },
  { key: 'macaneta_traseira_esq', label: 'Maçaneta Esq. Trás', opcoes: ['Funcionando', 'Com Defeito', 'Quebrada'] },
  { key: 'macaneta_traseira_dir', label: 'Maçaneta Dir. Trás', opcoes: ['Funcionando', 'Com Defeito', 'Quebrada'] },
  { key: 'tanque_combustivel', label: 'Tanque de Combustível', opcoes: ['Cheio', '3/4', '1/2', '1/4', 'Vazio'] },
  { key: 'lataria', label: 'Lataria', opcoes: ['Sem Avarias', 'Com Arranhões', 'Com Amassados', 'Com Trincas'] },
  { key: 'vidros', label: 'Vidros', opcoes: ['Sem Avarias', 'Com Arranhões', 'Trincado', 'Quebrado'] },
  { key: 'espelhos', label: 'Espelhos', opcoes: ['Funcionando', 'Com Defeito', 'Quebrado', 'Ausente'] },
  { key: 'interior_limpeza', label: 'Interior / Limpeza', opcoes: ['Limpo', 'Regular', 'Sujo'] },
  { key: 'documentacao', label: 'Documentação', opcoes: ['Completa', 'Incompleta', 'Ausente'] },
  { key: 'triangulo', label: 'Triângulo', opcoes: ['Presente', 'Ausente'] },
  { key: 'macaco', label: 'Macaco', opcoes: ['Presente', 'Ausente'] },
  { key: 'chave_roda', label: 'Chave de Roda', opcoes: ['Presente', 'Ausente'] }
];

// Listar todos os checklists
router.get('/', isAuthenticated, async (req, res) => {
  const { busca, tipo_filtro } = req.query;
  let query = `
    SELECT c.*, v.placa, v.modelo, v.marca, u.nome as realizado_por_nome,
           p.nome as cliente_nome
    FROM checklists c
    JOIN veiculos v ON c.veiculo_id = v.id
    LEFT JOIN usuarios u ON c.realizado_por = u.id
    LEFT JOIN alugueis a ON c.aluguel_id = a.id
    LEFT JOIN pessoas p ON a.cliente_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;
  if (busca && busca.trim()) {
    query += ` AND (v.placa ILIKE $${idx} OR v.modelo ILIKE $${idx} OR v.marca ILIKE $${idx} OR p.nome ILIKE $${idx})`;
    params.push('%' + busca.trim() + '%');
    idx++;
  }
  if (tipo_filtro && tipo_filtro !== '') {
    query += ` AND c.tipo = $${idx}`;
    params.push(tipo_filtro);
    idx++;
  }
  query += ` ORDER BY c.criado_em DESC LIMIT 200`;

  const checklists = await db.query(query, params);
  res.render('checklists/index', {
    title: 'Checklists - ZeloFrota',
    checklists: checklists.rows,
    campos: CHECKLIST_CAMPOS,
    filtros: { busca: busca || '', tipo_filtro: tipo_filtro || '' }
  });
});

// Form novo checklist
router.get('/novo', isAuthenticated, async (req, res) => {
  const { aluguel_id, tipo } = req.query;
  let aluguel = null;
  if (aluguel_id) {
    const r = await db.query(`
      SELECT a.*, v.placa, v.modelo, v.marca, v.km_atual, p.nome as cliente_nome
      FROM alugueis a JOIN veiculos v ON a.veiculo_id = v.id
      JOIN pessoas p ON a.cliente_id = p.id WHERE a.id = $1
    `, [aluguel_id]);
    aluguel = r.rows[0];
  }
  const alugueis = await db.query(`
    SELECT a.id, a.status, a.data_inicio,
           v.placa, v.modelo, p.nome as cliente_nome
    FROM alugueis a JOIN veiculos v ON a.veiculo_id = v.id
    JOIN pessoas p ON a.cliente_id = p.id
    WHERE a.status IN ('ativo', 'encerrado', 'atrasado')
    ORDER BY a.status ASC, a.data_inicio DESC
    LIMIT 100
  `);
  res.render('checklists/form', {
    title: tipo === 'checkin' ? 'Check-in do Veículo' : 'Check-out do Veículo',
    tipo: tipo || 'checkin',
    aluguel,
    aluguel_id: aluguel_id || null,
    alugueis: alugueis.rows,
    campos: CHECKLIST_CAMPOS
  });
});

// Salvar checklist
router.post('/', isAuthenticated, async (req, res) => {
  const { aluguel_id, tipo, km_veiculo, observacoes, ...campos } = req.body;
  try {
    const aluguel = await db.query('SELECT * FROM alugueis WHERE id = $1', [aluguel_id]);
    if (!aluguel.rows[0]) { req.flash('error', 'Aluguel não encontrado.'); return res.redirect('/checklists/novo'); }
    const veiculo_id = aluguel.rows[0].veiculo_id;

    const keys = CHECKLIST_CAMPOS.map(c => c.key);
    const vals = keys.map(k => campos[k] || null);

    await db.query(`
      INSERT INTO checklists (aluguel_id, veiculo_id, tipo, km_veiculo, observacoes, realizado_por,
        lampadas_dianteiras, lampadas_traseiras, farol_principal, farol_milha,
        pneu_dianteiro_esq, pneu_dianteiro_dir, pneu_traseiro_esq, pneu_traseiro_dir, pneu_estepe,
        motor, nivel_oleo, nivel_agua,
        macaneta_esquerda, macaneta_direita, macaneta_traseira_esq, macaneta_traseira_dir,
        tanque_combustivel, lataria, vidros, espelhos, interior_limpeza,
        documentacao, triangulo, macaco, chave_roda)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
    `, [aluguel_id, veiculo_id, tipo, km_veiculo||null, observacoes||null, req.session.user.id, ...vals]);

    if (km_veiculo) {
      await db.query('UPDATE veiculos SET km_atual = $1 WHERE id = $2', [km_veiculo, veiculo_id]);
    }

    req.flash('success', `${tipo === 'checkin' ? 'Check-in' : 'Check-out'} registrado com sucesso!`);
    res.redirect(`/alugueis/${aluguel_id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erro ao salvar checklist.');
    res.redirect('/checklists/novo');
  }
});

// API: Comparação checkin vs checkout
router.get('/comparar/:aluguel_id', isAuthenticated, async (req, res) => {
  try {
    const checklists = await db.query(`
      SELECT c.*, u.nome as realizado_por_nome FROM checklists c
      LEFT JOIN usuarios u ON c.realizado_por = u.id
      WHERE c.aluguel_id = $1 ORDER BY c.tipo
    `, [req.params.aluguel_id]);

    const checkin = checklists.rows.find(c => c.tipo === 'checkin');
    const checkout = checklists.rows.find(c => c.tipo === 'checkout');

    const campos = CHECKLIST_CAMPOS.map(campo => {
      const valIn = checkin ? checkin[campo.key] : null;
      const valOut = checkout ? checkout[campo.key] : null;
      return {
        label: campo.label,
        key: campo.key,
        checkin: valIn,
        checkout: valOut,
        diverge: valIn && valOut && valIn !== valOut
      };
    });

    res.json({ checkin, checkout, campos });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao comparar' });
  }
});

module.exports = router;
module.exports.CHECKLIST_CAMPOS = CHECKLIST_CAMPOS;
