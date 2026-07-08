// server.js — adicionar estas rotas/middlewares ao express existente

const { generateToken, verifyToken } = require('./auth/jwtMiddleware');

// Rota pública: gera token para o widget (chamada interna do Protheus/iframe)
app.post('/auth/token', (req, res) => {
  const { user, session_id, environment } = req.body;
  if (!user || !session_id) {
    return res.status(400).json({ error: 'user e session_id são obrigatórios.' });
  }
  const token = generateToken({ user, session_id, environment: environment || 'validacao' });
  res.json({ token });
});

// Proteger /chat/ask com JWT
// Substituir a linha: app.post('/chat/ask', chatHandler)
// Por:
app.post('/chat/ask', verifyToken, chatHandler);
