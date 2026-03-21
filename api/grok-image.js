const XAI_IMAGE_ENDPOINT = 'https://api.x.ai/v1/images/generations';
const DEFAULT_MODEL = 'grok-imagine-image';

function inferMimeTypeFromBase64(base64 = '') {
  const value = String(base64 || '').trim();
  if (value.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (value.startsWith('iVBOR')) {
    return 'image/png';
  }
  if (value.startsWith('R0lGOD')) {
    return 'image/gif';
  }
  if (value.startsWith('UklGR')) {
    return 'image/webp';
  }
  return 'image/png';
}

function extractPrompt(body = {}) {
  let payload = body;
  if (typeof body === 'string') {
    try {
      payload = JSON.parse(body || '{}');
    } catch (error) {
      payload = {};
    }
  }
  return String(payload?.prompt || '').trim();
}

function getApiKey() {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
}

async function requestImageGeneration(apiKey, prompt, extraBody = {}) {
  const upstreamResponse = await fetch(XAI_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt,
      ...extraBody
    })
  });

  const rawText = await upstreamResponse.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (parseError) {
    data = null;
  }

  return { upstreamResponse, data, rawText };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = extractPrompt(req.body);
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROK_API_KEY not configured',
      friendly_message: 'Configure GROK_API_KEY nas variáveis de ambiente da Vercel.'
    });
  }

  try {
    let { upstreamResponse, data, rawText } = await requestImageGeneration(apiKey, prompt);

    if (!upstreamResponse.ok) {
      const details = data?.error?.message || rawText || 'Erro desconhecido na API Grok Image';
      const statusCode = upstreamResponse.status === 429 ? 429 : 500;

      return res.status(statusCode).json({
        error: 'Failed to generate image',
        friendly_message: upstreamResponse.status === 429
          ? 'Muitas solicitações para gerar imagem. Tente novamente em alguns segundos.'
          : 'Não foi possível gerar a imagem com Grok no momento.',
        details
      });
    }

    const imageEntry = Array.isArray(data?.data) ? data.data[0] : null;
    let imageUrl = imageEntry?.url || '';

    if (!imageUrl) {
      ({ upstreamResponse, data, rawText } = await requestImageGeneration(apiKey, prompt, {
        response_format: 'b64_json'
      }));

      if (!upstreamResponse.ok) {
        const details = data?.error?.message || rawText || 'Erro desconhecido na API Grok Image';
        const statusCode = upstreamResponse.status === 429 ? 429 : 500;

        return res.status(statusCode).json({
          error: 'Failed to generate image',
          friendly_message: upstreamResponse.status === 429
            ? 'Muitas solicitações para gerar imagem. Tente novamente em alguns segundos.'
            : 'Não foi possível gerar a imagem com Grok no momento.',
          details
        });
      }

      const base64Entry = Array.isArray(data?.data) ? data.data[0] : null;
      const base64Image = base64Entry?.b64_json || '';
      imageUrl = base64Image
        ? `data:${inferMimeTypeFromBase64(base64Image)};base64,${base64Image}`
        : '';
    }

    if (!imageUrl) {
      return res.status(500).json({
        error: 'No image returned',
        friendly_message: 'A API Grok respondeu, mas não enviou nenhuma imagem.',
        details: rawText || 'Resposta sem data[0].url e sem data[0].b64_json'
      });
    }

    return res.status(200).json({
      success: true,
      imageUrl,
      prompt,
      model: data?.model || DEFAULT_MODEL
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem com Grok.',
      details: error.message
    });
  }
}
