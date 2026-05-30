const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Permite chamadas de qualquer origem (Snack, celular, etc.)
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Programa Reserva 4.0 - Backend' });
});

// Proxy para a API do Claude
app.post('/claude', async (req, res) => {
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY não configurada no servidor.' });
  }

  try {
    const { content, type } = req.body;

    // Monta o conteúdo da mensagem
    let messageContent;

    if (type === 'image') {
      // Recebe { base64, mime, prompt }
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: req.body.mime || 'image/jpeg',
            data: req.body.base64,
          },
        },
        {
          type: 'text',
          text: req.body.prompt || PROMPT_DEFAULT,
        },
      ];
    } else {
      // Texto puro
      messageContent = content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Tenta parsear JSON da resposta
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      res.json({ success: true, result: parsed });
    } catch {
      res.json({ success: true, result: null, raw: text });
    }

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ error: 'Erro ao chamar a API do Claude: ' + err.message });
  }
});

const PROMPT_DEFAULT = `Extraia dados de reserva Airbnb. JSON somente, sem markdown.
{"nome":"nome ou null","genero":"M ou F ou null","quantidade":número,"dataEntrada":"YYYY-MM-DD ou null","dataSaida":"YYYY-MM-DD ou null"}
Datas por extenso → YYYY-MM-DD. Ano: 2025 ou 2026. Gênero pelo nome.`;

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
