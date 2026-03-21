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
  return String(body?.prompt || '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = extractPrompt(req.body);
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROK_API_KEY not configured',
      friendly_message: 'Configure GROK_API_KEY nas variáveis de ambiente da Vercel.'
    });
  }

  try {
    const upstreamResponse = await fetch(XAI_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        response_format: 'b64_json'
      })
    });

    const rawText = await upstreamResponse.text();
    let data = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      data = null;
    }

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
    const base64Image = imageEntry?.b64_json || '';
    const imageUrl = base64Image
      ? `data:${inferMimeTypeFromBase64(base64Image)};base64,${base64Image}`
      : imageEntry?.url || '';

    if (!imageUrl) {
      return res.status(500).json({
        error: 'No image returned',
        friendly_message: 'A API Grok respondeu, mas não enviou nenhuma imagem.'
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
