export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  const body = req.body || {};
  const model = body.model || '';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const openrouterEndpoint = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';

  const requestBody = {
    model,
    messages,
    temperature: body.temperature ?? 0.15,
    top_p: body.top_p ?? 0.9,
    max_tokens: body.max_tokens ?? 1200,
    stream: false,
    ...(body.extra || {})
  };

  try {
    const response = await fetch(openrouterEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drekee.vercel.app',
        'X-Title': 'Drekee AI'
      },
      body: JSON.stringify(requestBody)
    });

    const rawText = await response.text().catch(() => '');
    let data = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        data = null;
      }
    }

    if (!response.ok) {
      const errorPayload = data || { error: rawText || 'OpenRouter returned empty response' };
      return res.status(response.status).json(errorPayload);
    }

    if (!rawText) {
      return res.status(502).json({ error: 'OpenRouter returned empty response body' });
    }

    if (data === null) {
      return res.status(502).json({ error: 'OpenRouter returned invalid JSON', rawText });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ [OPENROUTER PROXY] Error:', error);
    return res.status(500).json({ error: 'OpenRouter proxy error', details: error.message || String(error) });
  }
}

