// Poll Veo 2 operation status
// GET /api/video-poll?op=operations/xxxx

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { op } = req.query;
  if (!op) return res.status(400).json({ error: 'Missing op parameter' });

  const key = process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_KEY chưa được cài' });

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${op}?key=${key}`,
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!r.ok) {
    const e = await r.json();
    return res.status(500).json({ error: e.error?.message || r.statusText });
  }

  const data = await r.json();

  if (!data.done) {
    return res.status(200).json({ status: 'pending' });
  }

  // Done — extract video
  const predictions = data.response?.predictions || [];
  const vid = predictions[0];

  if (!vid) return res.status(500).json({ error: 'Không có video trong response' });

  // Veo 2 trả về base64 hoặc URI
  if (vid.bytesBase64Encoded) {
    return res.status(200).json({
      status: 'done',
      type: 'base64',
      url: `data:video/mp4;base64,${vid.bytesBase64Encoded}`,
    });
  }
  if (vid.video?.uri) {
    return res.status(200).json({
      status: 'done',
      type: 'url',
      url: vid.video.uri,
    });
  }

  return res.status(500).json({ error: 'Veo 2 response không có video data', raw: vid });
}
