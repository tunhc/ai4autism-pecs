// Vercel Serverless Function — Image Generation
// Primary: DALL-E 3 (OpenAI) → Fallback: Imagen 3 (Gemini)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, size = '1024x1024' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  // Try DALL-E 3 first
  if (process.env.OPENAI_KEY) {
    try {
      const result = await callDallE(prompt, size);
      return res.status(200).json({ ...result, usedProvider: 'dall-e-3' });
    } catch (err) {
      console.error('[DALL-E 3 failed]', err.message);
    }
  }

  // Fallback: Imagen 3
  if (process.env.GEMINI_KEY) {
    try {
      const result = await callImagen(prompt);
      return res.status(200).json({ ...result, usedProvider: 'imagen-3' });
    } catch (err) {
      console.error('[Imagen 3 failed]', err.message);
      return res.status(500).json({ error: 'Tất cả image providers thất bại: ' + err.message });
    }
  }

  return res.status(500).json({ error: 'Không có OPENAI_KEY hoặc GEMINI_KEY trên server' });
}

async function callDallE(prompt, size) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.OPENAI_KEY,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: 'standard',
    }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  const data = await r.json();
  return {
    type: 'url',
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
  };
}

async function callImagen(prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${process.env.GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    }
  );
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  const data = await r.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen 3 không trả về ảnh');
  return {
    type: 'base64',
    url: `data:image/png;base64,${b64}`,
  };
}
