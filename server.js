const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Programa Reserva 4.0 - Backend Gemini' });
});

const PROMPT = `Extraia dados de uma reserva do Airbnb do conteúdo fornecido.
Responda SOMENTE com JSON válido, sem markdown, sem texto adicional.
{"nome":"nome completo do hóspede ou null","genero":"M para masculino, F para feminino, ou null","quantidade":número inteiro de hóspedes,"dataEntrada":"YYYY-MM-DD ou null","dataSaida":"YYYY-MM-DD ou null"}
Regras: datas por extenso em português converta para YYYY-MM-DD. Ano de referência: 2025 ou 2026. Gênero pelo nome.`;

app.post('/claude', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
  }

  try {
    const { type, base64, mime, prompt, content } = req.body;

    let parts = [];

    if (type === 'image' && base64) {
      parts = [
        { inline_data: { mime_type: mime || 'image/jpeg', data: base64 } },
        { text: PROMPT }
      ];
    } else {
      parts = [{ text: PROMPT + '\n\nTexto da reserva:\n' + content }];
    }

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(clean);
      res.json({ success: true, result: parsed });
    } catch {
      res.status(500).json({ error: 'Resposta inválida da IA: ' + text });
    }

  } catch (err) {
    console.error('Erro:', err.message);
    res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Gemini rodando na porta ${PORT}`);
});
