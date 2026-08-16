const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const PROTHEUS_BASE_URL = process.env.PROTHEUS_BASE_URL || 'https://protheus.example.com';
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 15000);
const INSECURE_TLS = process.env.INSECURE_TLS === 'true';

const agent = new https.Agent({ rejectUnauthorized: !INSECURE_TLS });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'middleware' });
});

app.all('/proxy/protheus/*', async (req, res) => {
  try {
    const targetPath = req.originalUrl.replace('/proxy/protheus', '');
    const url = `${PROTHEUS_BASE_URL}${targetPath}`;
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Authorization': req.headers['authorization'] || '',
        'X-Tenant-Id': req.headers['x-tenant-id'] || '',
        'X-Company-Id': req.headers['x-company-id'] || '',
      },
      timeout: TIMEOUT_MS,
      httpsAgent: agent,
      validateStatus: () => true,
    });

    res.status(response.status).set({
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    }).send(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'bad_gateway',
      message: error.message,
    });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('middleware running');
});
