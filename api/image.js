// Image Generation — DALL-E 3 only (Gemini 2.0 Flash image gen deprecated)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, size = '1024x1024' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  if (!process.env.OPENAI_KEY) {
    return res.status(500).json({ error: 'OPENAI_KEY chưa được cài đặt trên server' });
  }

  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_KEY },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality: 'standard' }),
  });
  if (!r.ok) {
    const e = await r.json();
    return res.status(500).json({ error: e.error?.message || r.statusText });
  }
  const data = await r.json();
  return res.status(200).json({
    type: 'url',
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
    usedProvider: 'DALL-E 3',
  });
}
