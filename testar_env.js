// Salve em C:\senseyou\testar_env.js
// Execute: node testar_env.js

require('dotenv').config();

console.log('=== CONTEUDO DO .ENV ===');
console.log('DB_HOST:     ', JSON.stringify(process.env.DB_HOST));
console.log('DB_PORT:     ', JSON.stringify(process.env.DB_PORT));
console.log('DB_NAME:     ', JSON.stringify(process.env.DB_NAME));
console.log('DB_USER:     ', JSON.stringify(process.env.DB_USER));
console.log('DB_PASSWORD: ', JSON.stringify(process.env.DB_PASSWORD));
console.log('');

if (!process.env.DB_PASSWORD) {
  console.log('PROBLEMA: DB_PASSWORD esta vazio ou nao foi lido!');
  console.log('Verifique se o arquivo .env existe em C:\\senseyou\\.env');
} else {
  console.log('OK: .env lido com sucesso!');
}
