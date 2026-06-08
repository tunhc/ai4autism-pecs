// Vercel Serverless Function — Image Generation
// Chain: DALL-E 3 → Gemini 2.0 Flash (native image gen) → Claude (describe only)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, size = '1024x1024' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const errors = [];

  // 1. DALL-E 3
  if (process.env.OPENAI_KEY) {
    try {
      const result = await callDallE(prompt, size);
      return res.status(200).json({ ...result, usedProvider: 'DALL-E 3' });
    } catch (err) {
      errors.push('DALL-E 3: ' + err.message);
    }
  }

  // 2. Gemini 2.0 Flash native image generation
  if (process.env.GEMINI_KEY) {
    try {
      const result = await callGeminiImage(prompt);
      return res.status(200).json({ ...result, usedProvider: 'Gemini 2.0 Flash' });
    } catch (err) {
      errors.push('Gemini: ' + err.message);
    }
  }

  return res.status(500).json({
    error: 'Tất cả image providers thất bại',
    details: errors,
  });
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
      size,           // "1024x1024" | "1792x1024" | "1024x1792"
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

async function callGeminiImage(prompt) {
  // Gemini 2.0 Flash Experimental — native image generation
  // Returns inlineData base64 image in parts
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${process.env.GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    }
  );
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  const data = await r.json();

  // Find image part in response
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) throw new Error('Gemini không trả về ảnh trong response');

  return {
    type: 'base64',
    url: `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`,
  };
}
