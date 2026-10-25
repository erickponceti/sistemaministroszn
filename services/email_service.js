const nodemailer = require('nodemailer');

// Configuracao do email — use Gmail com App Password
// ou outro SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  }
});

const EMAIL_DESTINO = process.env.EMAIL_ADMIN || 'erickponceti@hotmail.com';

async function enviarResetSenha(nomeUsuario, emailUsuario, token, baseUrl) {
  const link = baseUrl + '/reset-senha/' + token;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f0f4f8;padding:30px 20px">
      <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1)">
        <div style="background:#5C0E1A;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">SMZN</h1>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">Sistema de Ministros Zona Norte</p>
        </div>
        <div style="padding:28px 24px">
          <h2 style="color:#1a2332;font-size:18px;margin:0 0 12px">Redefinicao de Senha</h2>
          <p style="color:#4a5568;font-size:14px;line-height:1.6">
            Ola, <strong>${nomeUsuario}</strong>!<br><br>
            Uma solicitacao de redefinicao de senha foi feita para o usuario <strong>${emailUsuario}</strong>.<br>
            Clique no botao abaixo para criar uma nova senha:
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${link}" style="background:#5C0E1A;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block">
              Redefinir Senha
            </a>
          </div>
          <p style="color:#718096;font-size:12px;line-height:1.5">
            Este link expira em <strong>1 hora</strong>.<br>
            Se voce nao solicitou a redefinicao, ignore este email.<br><br>
            Link: <a href="${link}" style="color:#5C0E1A">${link}</a>
          </p>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#b0bac9">
          SMZN — Sistema de Ministros Zona Norte
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: '"SMZN - Sistema de Ministros Zona Norte" <' + (process.env.EMAIL_USER || 'noreply@senseyou.com') + '>',
      to: EMAIL_DESTINO,
      subject: 'Redefinicao de Senha — ' + nomeUsuario + ' (' + emailUsuario + ')',
      html,
    });
    console.log('[Email] Reset de senha enviado para:', EMAIL_DESTINO);
    return { ok: true };
  } catch(err) {
    console.error('[Email] Erro ao enviar:', err.message);
    return { ok: false, erro: err.message };
  }
}

async function enviarBoasVindas(nomeUsuario, emailUsuario, senha, baseUrl) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f0f4f8;padding:30px 20px">
      <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1)">
        <div style="background:#5C0E1A;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">SMZN</h1>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">Sistema de Ministros Zona Norte</p>
        </div>
        <div style="padding:28px 24px">
          <h2 style="color:#1a2332;font-size:18px;margin:0 0 12px">Bem-vindo ao SMZN!</h2>
          <p style="color:#4a5568;font-size:14px;line-height:1.6">
            Ola, <strong>${nomeUsuario}</strong>!<br><br>
            Sua conta foi criada com sucesso. Aqui estao seus dados de acesso:
          </p>
          <div style="background:#f0f4f8;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#4a5568"><strong>Email:</strong> ${emailUsuario}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#4a5568"><strong>Senha temporaria:</strong> ${senha}</p>
          </div>
          <p style="color:#718096;font-size:12px">
            Voce sera solicitado a trocar sua senha no primeiro acesso.
          </p>
          <div style="text-align:center;margin:20px 0">
            <a href="${baseUrl}/login" style="background:#5C0E1A;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block">
              Acessar o Sistema
            </a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:11px;color:#b0bac9">
          SMZN — Sistema de Ministros Zona Norte
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: '"SMZN - Sistema de Ministros Zona Norte" <' + (process.env.EMAIL_USER || 'noreply@senseyou.com') + '>',
      to: EMAIL_DESTINO,
      subject: 'Novo Usuario Criado — ' + nomeUsuario,
      html,
    });
    return { ok: true };
  } catch(err) {
    console.error('[Email] Erro boas-vindas:', err.message);
    return { ok: false, erro: err.message };
  }
}

module.exports = { enviarResetSenha, enviarBoasVindas };
