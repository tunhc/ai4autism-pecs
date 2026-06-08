// Video Generation — Veo 2 via Gemini API (long-running, returns operationId)
// Client polls /api/video-poll?op=... every 3s to check status

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, aspectRatio = '16:9', durationSeconds = 5 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const key = process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_KEY chưa được cài đặt trên server' });

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { aspectRatio, durationSeconds },
      }),
    }
  );

  if (!r.ok) {
    const e = await r.json();
    return res.status(500).json({ error: e.error?.message || r.statusText });
  }

  const data = await r.json();
  // data.name = "operations/xxxx"
  const operationId = data.name;
  if (!operationId) return res.status(500).json({ error: 'Veo 2 không trả về operation ID' });

  return res.status(200).json({ operationId, status: 'pending' });
}
