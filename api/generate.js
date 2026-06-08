// Vercel Serverless Function — AI4Autism API Proxy
// Fallback chain: nếu provider chính fail → thử provider tiếp theo tự động

// Provider tối ưu theo từng tính năng + fallback chain
const PROVIDER_CHAINS = {
  // Ngôn ngữ tự nhiên, narrative → Claude mạnh nhất
  story:      ['claude', 'openai', 'gemini'],
  podcast:    ['claude', 'openai', 'gemini'],
  script:     ['claude', 'openai', 'gemini'],
  // Visual description, creative prompt → Gemini tốt cho multimodal context
  image:      ['gemini', 'claude', 'openai'],
  reel:       ['gemini', 'claude', 'openai'],
  storyboard: ['gemini', 'claude', 'openai'],
  // Structured output, scenario, technical → OpenAI
  scenario:   ['openai', 'claude', 'gemini'],
  sensory:    ['openai', 'claude', 'gemini'],
  voiceover:  ['openai', 'claude', 'gemini'],
};

// Nếu client gửi provider cụ thể (không phải mode), build chain từ đó
const FALLBACK_FROM = {
  claude: ['claude', 'openai', 'gemini'],
  gemini: ['gemini', 'claude', 'openai'],
  openai: ['openai', 'claude', 'gemini'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, mode, prompt, maxTokens = 1024, system = '' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // Xác định fallback chain: ưu tiên theo mode, fallback theo provider
  const chain = PROVIDER_CHAINS[mode] || FALLBACK_FROM[provider] || ['claude', 'openai', 'gemini'];

  const errors = [];
  for (const p of chain) {
    try {
      const text = await callProvider(p, prompt, maxTokens, system);
      return res.status(200).json({ text, usedProvider: p });
    } catch (err) {
      errors.push(`[${p}] ${err.message}`);
      // Chỉ fallback nếu lỗi là rate limit / server error, không fallback lỗi key missing
      if (err.message.includes('chưa được cài đặt')) continue;
    }
  }

  return res.status(500).json({
    error: 'Tất cả providers đều thất bại',
    details: errors,
  });
}

async function callProvider(provider, prompt, maxTokens, system) {
  switch (provider) {
    case 'claude':  return callClaude(prompt, maxTokens, system);
    case 'gemini':  return callGemini(prompt, maxTokens);
    case 'openai':  return callOpenAI(prompt, maxTokens, system);
    default: throw new Error('Unknown provider: ' + provider);
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
