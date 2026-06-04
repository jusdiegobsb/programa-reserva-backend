const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const PROMPT = `Extraia dados de uma reserva do Airbnb.
Responda SOMENTE com JSON valido, sem markdown, sem explicacoes.
{"nome":"nome completo ou null","genero":"M ou F ou null","quantidade":numero inteiro,"dataEntrada":"YYYY-MM-DD ou null","dataSaida":"YYYY-MM-DD ou null","valor":numero decimal ou null}
Regras: datas em portugues converta para YYYY-MM-DD. Ano 2025 ou 2026. Genero pelo nome.`;

app.get('/', (req, res) => res.json({ status: 'Backend DeepSeek OK' }));

app.post('/extrair', async (req, res) => {
  try {
    const { texto, imagem, mime } = req.body;
    let messages;

    if (imagem) {
      // Modo imagem — DeepSeek Vision
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${imagem}` } },
          { type: 'text', text: PROMPT }
        ]
      }];
    } else if (texto) {
      // Modo texto
      messages = [{
        role: 'user',
        content: PROMPT + '\n\nTexto da reserva:\n' + texto
      }];
    } else {
      return res.status(400).json({ error: 'Envie texto ou imagem' });
    }

    const r = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 300,
        temperature: 0.1
      })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.error?.message || 'Erro DeepSeek' });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) return res.status(422).json({ error: 'IA nao retornou JSON valido' });

    res.json(JSON.parse(match[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend DeepSeek rodando na porta ${PORT}`));
