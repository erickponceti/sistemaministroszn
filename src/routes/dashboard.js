const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Totais de resumo
    const totalVeiculos = await db.query("SELECT COUNT(*) FROM veiculos WHERE status != 'inativo'");
    const veiculosAlugados = await db.query("SELECT COUNT(*) FROM veiculos WHERE status = 'alugado'");
    const veiculosDisponiveis = await db.query("SELECT COUNT(*) FROM veiculos WHERE status = 'disponivel'");
    const totalClientes = await db.query("SELECT COUNT(*) FROM pessoas WHERE tipo = 'cliente' AND ativo = TRUE");

    // Receita do mês atual
    const receitaMes = await db.query(`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM pagamentos
      WHERE DATE_TRUNC('month', data_pagamento) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Custos do mês atual
    const custosMes = await db.query(`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM manutencoes
      WHERE DATE_TRUNC('month', data_manutencao) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Aluguéis vencendo em 7 dias
    const vencendoBreve = await db.query(`
      SELECT a.*, v.placa, v.modelo, v.marca, v.tipo as veiculo_tipo,
             p.nome as cliente_nome, p.whatsapp as cliente_whatsapp,
             (a.data_fim_prevista - CURRENT_DATE) as dias_restantes
      FROM alugueis a
      JOIN veiculos v ON a.veiculo_id = v.id
      JOIN pessoas p ON a.cliente_id = p.id
      WHERE a.status = 'ativo'
        AND a.data_fim_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY a.data_fim_prevista ASC
      LIMIT 10
    `);

    // Gráfico: Crescimento da frota (últimos 6 meses)
    const crescimentoFrota = await db.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', criado_em), 'Mon/YY') as mes,
             COUNT(*) as novos
      FROM veiculos
      WHERE criado_em >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', criado_em)
      ORDER BY DATE_TRUNC('month', criado_em)
    `);

    // Gráfico: Fluxo de caixa (últimos 6 meses)
    const fluxoCaixa = await db.query(`
      SELECT mes,
             COALESCE(receita, 0) as receita,
             COALESCE(custos, 0) as custos
      FROM (
        SELECT TO_CHAR(DATE_TRUNC('month', generate_series), 'Mon/YY') as mes,
               DATE_TRUNC('month', generate_series) as mes_date
        FROM generate_series(NOW() - INTERVAL '5 months', NOW(), INTERVAL '1 month')
      ) meses
      LEFT JOIN (
        SELECT DATE_TRUNC('month', data_pagamento) as mes_pag, SUM(valor) as receita
        FROM pagamentos GROUP BY mes_pag
      ) pag ON mes_date = pag.mes_pag
      LEFT JOIN (
        SELECT DATE_TRUNC('month', data_manutencao) as mes_man, SUM(valor) as custos
        FROM manutencoes GROUP BY mes_man
      ) man ON mes_date = man.mes_man
      ORDER BY mes_date
    `);

    // Gráfico: Rentabilidade por veículo (top 8)
    const rentabilidade = await db.query(`
      SELECT v.placa, v.modelo,
             COALESCE(rec.total_receita, 0) as receita,
             COALESCE(cst.total_custos, 0) as custos,
             COALESCE(rec.total_receita, 0) - COALESCE(cst.total_custos, 0) as lucro
      FROM veiculos v
      LEFT JOIN (
        SELECT a.veiculo_id, SUM(p.valor) as total_receita
        FROM pagamentos p JOIN alugueis a ON p.aluguel_id = a.id
        GROUP BY a.veiculo_id
      ) rec ON v.id = rec.veiculo_id
      LEFT JOIN (
        SELECT veiculo_id, SUM(valor) as total_custos
        FROM manutencoes GROUP BY veiculo_id
      ) cst ON v.id = cst.veiculo_id
      WHERE v.status != 'inativo'
      ORDER BY lucro DESC
      LIMIT 8
    `);

    // Aluguéis ativos recentes
    const alugueisAtivos = await db.query(`
      SELECT a.*, v.placa, v.modelo, v.marca, v.tipo as veiculo_tipo,
             p.nome as cliente_nome
      FROM alugueis a
      JOIN veiculos v ON a.veiculo_id = v.id
      JOIN pessoas p ON a.cliente_id = p.id
      WHERE a.status = 'ativo'
      ORDER BY a.data_inicio DESC
      LIMIT 5
    `);

    res.render('dashboard/index', {
      title: 'Dashboard - ZeloFrota',
      stats: {
        totalVeiculos: totalVeiculos.rows[0].count,
        veiculosAlugados: veiculosAlugados.rows[0].count,
        veiculosDisponiveis: veiculosDisponiveis.rows[0].count,
        totalClientes: totalClientes.rows[0].count,
        receitaMes: parseFloat(receitaMes.rows[0].total),
        custosMes: parseFloat(custosMes.rows[0].total),
        lucroMes: parseFloat(receitaMes.rows[0].total) - parseFloat(custosMes.rows[0].total)
      },
      vencendoBreve: vencendoBreve.rows,
      graficos: {
        crescimentoFrota: crescimentoFrota.rows,
        fluxoCaixa: fluxoCaixa.rows,
        rentabilidade: rentabilidade.rows
      },
      alugueisAtivos: alugueisAtivos.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.render('dashboard/index', {
      title: 'Dashboard - ZeloFrota',
      stats: { totalVeiculos: 0, veiculosAlugados: 0, veiculosDisponiveis: 0, totalClientes: 0, receitaMes: 0, custosMes: 0, lucroMes: 0 },
      vencendoBreve: [],
      graficos: { crescimentoFrota: [], fluxoCaixa: [], rentabilidade: [] },
      alugueisAtivos: []
    });
  }
});

module.exports = router;
