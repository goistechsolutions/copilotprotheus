require('dotenv').config();
const axios = require('axios');
const https = require('https');

async function testConnection() {
  console.log('Validando conexão com Protheus REST...');
  console.log(`URL Base: ${process.env.PROTHEUS_BASE_URL}`);
  console.log(`Usuário: ${process.env.PROTHEUS_USER}`);
  
  try {
    const url = process.env.PROTHEUS_BASE_URL + '/swagger';
    console.log('Acessando:', url);
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      auth: { username: process.env.PROTHEUS_USER, password: process.env.PROTHEUS_PASSWORD },
      headers: { 'Authorization': 'Basic','TenantId': '01,0101' },
      timeout: 10000
    });
    console.log('\n✅ CONEXÃO BEM SUCEDIDA COM O SWAGGER!');
    const paths = Object.keys(response.data.paths || {});
    const myApis = paths.filter(p => p.toLowerCase().includes('pedido') || p.toLowerCase().includes('saldo') || p.toLowerCase().includes('titulo') || p.toLowerCase().includes('produto') || p.toLowerCase().includes('cliente'));
    console.log(`Total de Rotas Publicadas: ${paths.length}`);
    console.log(`Rotas customizadas do Copilot encontradas: ${myApis.length}`);
    if (myApis.length > 0) {
      console.log(myApis);
    } else {
      console.log('NENHUMA ROTA DO COPILOT (PedidoStatus, SaldoRest, etc) FOI ENCONTRADA NO SERVIDOR!');
    }
  } catch (error) {
    // Se o erro vier do Protheus (ex: 404 Pedido não encontrado), a conexão funcionou!
    if (error.message && error.message.includes('não encontrado')) {
       console.log('\n✅ CONEXÃO BEM SUCEDIDA COM O PROTHEUS!');
       console.log('A rede e a senha funcionaram. O retorno foi: ' + error.message);
    } else {
       console.log('\n❌ FALHA NA CONEXÃO!');
       console.log('Status HTTP:', error.response?.status || 'Nenhum');
       console.log('Dados do Erro (Body):', error.response?.data || error.message);
       console.log('\nDicas de diagnóstico:');
       console.log('1. O usuário ou senha podem estar errados no arquivo middleware/.env');
       console.log('2. O serviço REST do Protheus (appserver.ini) pode estar desligado na porta 10707');
       console.log('3. O arquivo prw (advpl_apis.prw) não foi compilado no ambiente atual');
    }
  }
}

testConnection();
