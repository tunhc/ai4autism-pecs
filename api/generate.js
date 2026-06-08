// Vercel Serverless Function — AI4Autism API Proxy
// Keys read from process.env, never exposed to browser

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, prompt, maxTokens = 1024, system = '' } = req.body;

  if (!provider || !prompt) {
    return res.status(400).json({ error: 'Missing provider or prompt' });
  }

  try {
    let text;
    switch (provider) {
      case 'claude':
        text = await callClaude(prompt, maxTokens, system);
        break;
      case 'gemini':
        text = await callGemini(prompt, maxTokens);
        break;
      case 'openai':
        text = await callOpenAI(prompt, maxTokens, system);
        break;
      default:
        return res.status(400).json({ error: 'Unknown provider: ' + provider });
    }
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function callClaude(prompt, maxTokens, system) {
  const key = process.env.CLAUDE_KEY;
  if (!key) throw new Error('CLAUDE_KEY chưa được cài đặt trên server');

  const body = {
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  return (await r.json()).content[0].text;
}

async function callGemini(prompt, maxTokens) {
  const key = process.env.GEMINI_KEY;
  if (!key) throw new Error('GEMINI_KEY chưa được cài đặt trên server');

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  return (await r.json()).candidates[0].content.parts[0].text;
}

async function callOpenAI(prompt, maxTokens, system) {
  const key = process.env.OPENAI_KEY;
  if (!key) throw new Error('OPENAI_KEY chưa được cài đặt trên server');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: maxTokens, messages }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error?.message || r.statusText);
  }
  return (await r.json()).choices[0].message.content;
}
