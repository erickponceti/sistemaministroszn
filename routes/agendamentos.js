const express = require('express');
const router  = express.Router();
const { pool } = require('../db/database');
const crypto  = require('crypto');
const https   = require('https');

// ===== CONFIGURACAO TELEGRAM =====
// Numero de teste: 81982349298
// Para usar: crie um bot em @BotFather, pegue o TOKEN
// e o CHAT_ID do numero de teste via @userinfobot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_TESTE = process.env.TELEGRAM_CHAT_TESTE || '';

function gerarDiasDoMes(ano, mes) {
  const dias = [];
  const date = new Date(ano, mes - 1, 1);
  while (date.getMonth() === mes - 1) {
    if ([0,4].includes(date.getDay())) dias.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dias;
}

const MESES  = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_PT= ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];

// Enviar mensagem via Telegram Bot API com botoes inline
async function enviarTelegram(chatId, mensagem, botoes) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.log('[Telegram] Token ou chatId nao configurado. Mensagem:', mensagem.substring(0,80));
    return { ok: false, erro: 'Token ou chatId nao configurado' };
  }

  const body = JSON.stringify({
    chat_id: chatId,
    text: mensagem,
    parse_mode: 'Markdown',
    reply_markup: botoes ? { inline_keyboard: [botoes] } : undefined
  });

  return new Promise(function(resolve) {
    const options = {
      hostname: 'api.telegram.org',
      path: '/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, function(res) {
      let data = '';
      res.on('data', function(d) { data += d; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ ok: false, erro: data }); }
      });
    });
    req.on('error', function(e) { resolve({ ok: false, erro: e.message }); });
    req.write(body);
    req.end();
  });
}

// Gerar link Telegram (t.me) para envio manual
function gerarLinkTelegram(telefone, mensagem) {
  const tel = telefone.replace(/\D/g,'');
  const telCompleto = tel.startsWith('55') ? tel : '55' + tel;
  // t.me nao suporta pre-fill, usar link direto para contato
  return 'https://t.me/+' + telCompleto;
}

// ===== PAGINA PRINCIPAL =====
router.get('/', async (req, res) => {
  const hoje = new Date();
  const ano  = parseInt(req.query.ano) || hoje.getFullYear();
  const mes  = parseInt(req.query.mes) || (hoje.getMonth() + 1);

  const dias      = gerarDiasDoMes(ano, mes);
  const igrejas   = await pool.query('SELECT * FROM igrejas ORDER BY nome');
  const ministros = await pool.query(`
    SELECT m.*, i.nome as nome_igreja
    FROM ministros m LEFT JOIN igrejas i ON m.igreja_id = i.id ORDER BY m.nome`);

  const agendResult = await pool.query(`
    SELECT a.*, m.nome as ministro_nome, m.chamado, m.telefone as ministro_telefone,
           i.sigla as igreja_sigla, i.nome as igreja_nome,
           COALESCE(a.confirmacao, 'pendente') as confirmacao
    FROM agendamentos a
    JOIN ministros m ON a.ministro_id = m.id
    JOIN igrejas   i ON a.igreja_id   = i.id
    WHERE EXTRACT(MONTH FROM a.data)=$1 AND EXTRACT(YEAR FROM a.data)=$2
  `, [mes, ano]);

  const agendMap = {};
  agendResult.rows.forEach(function(a) {
    const key = a.data.toISOString().split('T')[0] + '_' + a.turno + '_' + a.igreja_id;
    agendMap[key] = a;
  });

  res.render('agendamento/index', {
    title: 'Agendamento', dias, igrejas: igrejas.rows,
    ministros: ministros.rows, agendMap, ano, mes,
    mesNome: MESES[mes - 1], meses: MESES,
  });
});

// ===== CRIAR/ATUALIZAR AGENDAMENTO =====
router.post('/', async (req, res) => {
  const { data, turno, ministro_id, igreja_id, tema, observacao } = req.body;
  const token = crypto.randomBytes(32).toString('hex');

  try {
    await pool.query(`
      INSERT INTO agendamentos (data, turno, ministro_id, igreja_id, tema, observacao, confirmacao, token_confirmacao)
      VALUES ($1,$2,$3,$4,$5,$6,'pendente',$7)
      ON CONFLICT (data, turno, igreja_id)
      DO UPDATE SET ministro_id=$3, tema=$5, observacao=$6, confirmacao='pendente', token_confirmacao=$7
    `, [data, turno, ministro_id, igreja_id, tema, observacao, token]);

    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.json({ success: false, erro: err.message });
  }
});

// ===== DELETAR =====
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM agendamentos WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// ===== API: GERAR LINK / ENVIAR TELEGRAM =====
router.get('/api/telegram/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, m.nome as ministro_nome, m.telefone as ministro_telefone,
             i.nome as igreja_nome, a.token_confirmacao
      FROM agendamentos a
      JOIN ministros m ON a.ministro_id = m.id
      JOIN igrejas   i ON a.igreja_id   = i.id
      WHERE a.id=$1
    `, [req.params.id]);

    if (!result.rows.length) return res.json({ success: false, erro: 'Agendamento nao encontrado' });

    const a = result.rows[0];

    // Garantir token
    let token = a.token_confirmacao;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE agendamentos SET token_confirmacao=$1 WHERE id=$2', [token, a.id]);
    }

    const d = new Date(a.data); d.setHours(12);
    const diaSemana = DIAS_PT[d.getDay()];
    const dataStr   = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    const baseUrl   = process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
    const linkSim   = baseUrl + '/agendamento/confirmar/' + token + '/sim';
    const linkNao   = baseUrl + '/agendamento/confirmar/' + token + '/nao';

    // Mensagem preview (sem links)
    const mensagemPreview =
      'Ola ministro(a) *' + a.ministro_nome + '*, graca e paz! \u{1F64F}\n\n' +
      'Voce foi escalado(a) para ministrar na:\n' +
      '\u{1F3DB} *' + a.igreja_nome + '*\n' +
      '\u{1F4C5} *' + diaSemana + ', ' + dataStr + '*\n' +
      '\u23F0 *' + a.turno + '*\n' +
      (a.tema ? '\u{1F4D6} Tema: _' + a.tema + '_\n' : '') +
      '\nPor favor, confirme sua presenca.\n\n' +
      '_Que Deus abencoe seu ministerio!_\n' +
      '_\u2014 SMZN | Sistema de Ministros Zona Norte_';

    // Numero de teste fixo: 81982349298
    const telTeste = '5581982349298';
    const telMinistro = a.ministro_telefone
      ? a.ministro_telefone.replace(/\D/g,'')
      : null;
    const telMinistroCompleto = telMinistro
      ? (telMinistro.startsWith('55') ? telMinistro : '55' + telMinistro)
      : null;

    // Botoes inline do Telegram
    const botoes = [
      { text: '\u2705 SIM, confirmo!', url: linkSim },
      { text: '\u274C NAO posso ir',   url: linkNao }
    ];

    // Tentar envio automatico via Bot se configurado
    let envioAutomatico = false;
    let resultadoBot = null;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_TESTE) {
      resultadoBot = await enviarTelegram(TELEGRAM_CHAT_TESTE, mensagemPreview + '\n\n[Confirme clicando nos botoes abaixo]', botoes);
      envioAutomatico = resultadoBot && resultadoBot.ok;
    }

    // Link manual como fallback
    const linkTelegramTeste    = 'https://t.me/+' + telTeste;
    const linkTelegramMinistro = telMinistroCompleto ? 'https://t.me/+' + telMinistroCompleto : null;

    res.json({
      success: true,
      mensagemPreview,
      linkSim, linkNao,
      telefone: a.ministro_telefone || 'nao cadastrado',
      telTeste: '+55 81 98234-9298',
      envioAutomatico,
      resultadoBot,
      linkTelegramTeste,
      linkTelegramMinistro,
      temToken: !!token
    });
  } catch(err) {
    console.error(err);
    res.json({ success: false, erro: err.message });
  }
});

// ===== ENVIAR TODAS AS ESCALAS DO MES =====
router.post('/api/enviar-todas/:mes/:ano', async (req, res) => {
  try {
    const { mes, ano } = req.params;
    const result = await pool.query(`
      SELECT a.*, m.nome as ministro_nome, m.telefone as ministro_telefone,
             i.nome as igreja_nome
      FROM agendamentos a
      JOIN ministros m ON a.ministro_id = m.id
      JOIN igrejas   i ON a.igreja_id   = i.id
      WHERE EXTRACT(MONTH FROM a.data)=$1 AND EXTRACT(YEAR FROM a.data)=$2
        AND COALESCE(a.confirmacao,'pendente') = 'pendente'
      ORDER BY a.data, i.nome
    `, [mes, ano]);

    const baseUrl = process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
    let enviados = 0;
    const erros  = [];

    for (const a of result.rows) {
      let token = a.token_confirmacao;
      if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await pool.query('UPDATE agendamentos SET token_confirmacao=$1 WHERE id=$2', [token, a.id]);
      }

      const d = new Date(a.data); d.setHours(12);
      const diaSemana = DIAS_PT[d.getDay()];
      const dataStr   = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
      const linkSim   = baseUrl + '/agendamento/confirmar/' + token + '/sim';
      const linkNao   = baseUrl + '/agendamento/confirmar/' + token + '/nao';

      const mensagem =
        'Ola ministro(a) *' + a.ministro_nome + '*, graca e paz! \u{1F64F}\n\n' +
        'Voce foi escalado(a) para ministrar na:\n' +
        '\u{1F3DB} *' + a.igreja_nome + '*\n' +
        '\u{1F4C5} *' + diaSemana + ', ' + dataStr + '*\n' +
        '\u23F0 *' + a.turno + '*\n' +
        (a.tema ? '\u{1F4D6} Tema: _' + a.tema + '_\n' : '') +
        '\nConfirme sua presenca:';

      const botoes = [
        { text: '\u2705 SIM, confirmo!', url: linkSim },
        { text: '\u274C NAO posso ir',   url: linkNao }
      ];

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_TESTE) {
        const r = await enviarTelegram(TELEGRAM_CHAT_TESTE, mensagem, botoes);
        if (r && r.ok) enviados++;
        else erros.push(a.ministro_nome + ': ' + JSON.stringify(r));
      } else {
        enviados++;
      }
    }

    res.json({ success: true, total: result.rows.length, enviados, erros });
  } catch(err) {
    console.error(err);
    res.json({ success: false, erro: err.message });
  }
});

// ===== CONFIRMACAO (link clicado pelo ministro) =====
router.get('/confirmar/:token/:resposta', async (req, res) => {
  try {
    const { token, resposta } = req.params;
    if (!['sim','nao'].includes(resposta)) return res.redirect('/');
    const confirmacao = resposta === 'sim' ? 'confirmado' : 'recusado';
    const result = await pool.query(`
      UPDATE agendamentos SET confirmacao=$1, confirmado_em=NOW()
      WHERE token_confirmacao=$2
      RETURNING *, (SELECT nome FROM ministros WHERE id=ministro_id) as ministro_nome,
                   (SELECT nome FROM igrejas WHERE id=igreja_id) as igreja_nome
    `, [confirmacao, token]);

    if (!result.rows.length) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link invalido</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0f4f8">
        <h2 style="color:#e53935">Link invalido ou expirado.</h2></body></html>`);
    }

    const a = result.rows[0];
    const d = new Date(a.data); d.setHours(12);
    const dataStr = d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const isConf  = confirmacao === 'confirmado';
    const cor     = isConf ? '#43a047' : '#e53935';
    const emoji   = isConf ? '\u2705' : '\u274C';
    const titulo  = isConf ? 'Presenca Confirmada!' : 'Presenca Recusada';
    const msg     = isConf
      ? 'Obrigado, <strong>' + a.ministro_nome + '</strong>! Sua presenca foi confirmada. Que Deus abencoe seu ministerio!'
      : 'Entendemos, <strong>' + a.ministro_nome + '</strong>. Sua resposta foi registrada. Que Deus continue te abencooando!';

    res.send(`<!DOCTYPE html><html lang="pt-BR">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${titulo}</title>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Nunito',sans-serif;background:#f0f4f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .card{background:#fff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.12);max-width:420px;width:100%;overflow:hidden}
        .top{background:${cor};padding:32px 24px;text-align:center}
        .emoji{font-size:52px;margin-bottom:10px}
        .top h1{color:#fff;font-size:20px;font-weight:900}
        .body{padding:24px}
        .row{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #e2e8f0}
        .row:last-child{border:none}
        .icon{width:34px;height:34px;border-radius:8px;background:#f0f4f8;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#718096}
        .val{font-size:14px;font-weight:700;color:#1a2332;margin-top:2px}
        .foot{text-align:center;padding:14px;font-size:11px;color:#b0bac9;border-top:1px solid #e2e8f0}
      </style></head>
      <body><div class="card">
        <div class="top"><div class="emoji">${emoji}</div><h1>${titulo}</h1></div>
        <div class="body">
          <div class="row"><div class="icon">\u{1F3DB}</div><div><div class="lbl">Igreja</div><div class="val">${a.igreja_nome}</div></div></div>
          <div class="row"><div class="icon">\u{1F4C5}</div><div><div class="lbl">Data</div><div class="val">${dataStr}</div></div></div>
          <div class="row"><div class="icon">\u23F0</div><div><div class="lbl">Turno</div><div class="val">${a.turno}</div></div></div>
          ${a.tema ? '<div class="row"><div class="icon">\u{1F4D6}</div><div><div class="lbl">Tema</div><div class="val">' + a.tema + '</div></div></div>' : ''}
          <div style="background:#f0f4f8;border-radius:10px;padding:12px;margin-top:14px;font-size:13px;color:#4a5568;text-align:center">${msg}</div>
        </div>
        <div class="foot">SMZN \u00B7 Sistema de Ministros Zona Norte</div>
      </div></body></html>`);
  } catch(err) {
    console.error(err);
    res.send('<h2>Erro interno.</h2>');
  }
});

// ===== API STATS =====
router.get('/api/stats', async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  const porMes = await pool.query(`SELECT EXTRACT(MONTH FROM data) as mes, COUNT(*) as total FROM agendamentos WHERE EXTRACT(YEAR FROM data)=$1 GROUP BY mes ORDER BY mes`, [ano]);
  const porIgreja = await pool.query(`SELECT i.nome, i.sigla, COUNT(a.id) as total FROM igrejas i LEFT JOIN agendamentos a ON a.igreja_id=i.id GROUP BY i.id,i.nome,i.sigla ORDER BY total DESC LIMIT 10`);
  const porMinistro = await pool.query(`SELECT m.nome, m.chamado, COUNT(a.id) as total FROM ministros m LEFT JOIN agendamentos a ON a.ministro_id=m.id GROUP BY m.id,m.nome,m.chamado ORDER BY total DESC LIMIT 10`);
  res.json({ porMes: porMes.rows, porIgreja: porIgreja.rows, porMinistro: porMinistro.rows });
});

router.get('/api/pendentes-count', async (req, res) => {
  try {
    const r = await pool.query(`SELECT COUNT(*) as total FROM agendamentos WHERE status='pendente'`);
    res.json({ total: parseInt(r.rows[0].total) });
  } catch(e) { res.json({ total: 0 }); }
});

module.exports = router;
