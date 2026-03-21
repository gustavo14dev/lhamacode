const DEFAULT_MODEL = 'stabilityai/stable-diffusion-2';
const SDXL_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const HUGGING_API_BASE = 'https://api-inference.huggingface.co/models';

function extractPrompt(body = {}) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body || '{}');
      return String(parsed?.prompt || '').trim();
    } catch (error) {
      return '';
    }
  }

  return String(body?.prompt || '').trim();
}

function chooseHuggingFaceModel(prompt = '') {
  const normalized = String(prompt || '').toLowerCase();
  if (/\brealist|realista|fotogra|photo|cinematic|cinematograf|ultra detalh/i.test(normalized)) {
    return SDXL_MODEL;
  }
  return DEFAULT_MODEL;
}

function buildPollinationsUrl(prompt = '') {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
}

function bufferToDataUrl(arrayBuffer, mimeType = 'image/png') {
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestHuggingFaceImage(apiKey, model, prompt) {
  const response = await fetch(`${HUGGING_API_BASE}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt
    })
  });

  const contentType = response.headers.get('content-type') || '';

  if (response.ok && contentType.startsWith('image/')) {
    const arrayBuffer = await response.arrayBuffer();
    return {
      ok: true,
      imageUrl: bufferToDataUrl(arrayBuffer, contentType),
      contentType
    };
  }

  const rawText = await response.text().catch(() => '');
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    data = null;
  }

  return {
    ok: false,
    status: response.status,
    details: data?.error || rawText || 'Erro desconhecido na Hugging Face',
    estimatedTime: Number(data?.estimated_time || 0)
  };
}

async function requestPollinationsImage(prompt) {
  const url = buildPollinationsUrl(prompt);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://image.pollinations.ai/',
      Origin: 'https://image.pollinations.ai'
    }
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    return {
      ok: false,
      url,
      status: response.status,
      details: rawText || 'Falha ao buscar imagem no Pollinations'
    };
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();

  return {
    ok: true,
    url,
    imageUrl: bufferToDataUrl(arrayBuffer, contentType),
    contentType
  };
}

async function buildPollinationsFallback(prompt, reason = '') {
  const pollinationsUrl = buildPollinationsUrl(prompt);

  try {
    const result = await requestPollinationsImage(prompt);
    if (result.ok && result.imageUrl) {
      return {
        success: true,
        imageUrl: result.imageUrl,
        prompt,
        model: 'pollinations',
        usedFallback: true,
        fallbackReason: reason || 'Fallback para Pollinations'
      };
    }

    console.error('[HUGGING-IMAGE] Pollinations respondeu sem imagem válida:', result);
    return {
      success: true,
      imageUrl: `/api/image-proxy?url=${encodeURIComponent(pollinationsUrl)}`,
      prompt,
      model: 'pollinations',
      usedFallback: true,
      fallbackReason: reason || result.details || 'Fallback para Pollinations'
    };
  } catch (error) {
    console.error('[HUGGING-IMAGE] Erro ao buscar Pollinations:', error);
    return {
      success: true,
      imageUrl: `/api/image-proxy?url=${encodeURIComponent(pollinationsUrl)}`,
      prompt,
      model: 'pollinations',
      usedFallback: true,
      fallbackReason: reason || error.message || 'Fallback para Pollinations'
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = extractPrompt(req.body);
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  const apiKey = process.env.HUGGING_API_KEY || '';
  const model = chooseHuggingFaceModel(prompt);

  if (!apiKey) {
    console.error('[HUGGING-IMAGE] HUGGING_API_KEY nao configurada. Usando Pollinations.');
    return res.status(200).json(await buildPollinationsFallback(prompt, 'HUGGING_API_KEY nao configurada'));
  }

  try {
    let result = await requestHuggingFaceImage(apiKey, model, prompt);

    if (!result.ok && result.status === 503 && /loading/i.test(String(result.details || ''))) {
      const waitMs = Math.min(Math.max(Math.ceil(result.estimatedTime || 3) * 1000, 2000), 8000);
      console.warn('[HUGGING-IMAGE] Modelo carregando. Tentando novamente em', waitMs, 'ms');
      await wait(waitMs);
      result = await requestHuggingFaceImage(apiKey, model, prompt);
    }

    if (result.ok && result.imageUrl) {
      return res.status(200).json({
        success: true,
        imageUrl: result.imageUrl,
        prompt,
        model,
        usedFallback: false
      });
    }

    console.error('[HUGGING-IMAGE] Falha na Hugging Face. Usando Pollinations.', {
      model,
      status: result.status,
      details: result.details
    });

    return res.status(200).json(await buildPollinationsFallback(prompt, result.details || 'Falha na Hugging Face'));
  } catch (error) {
    console.error('[HUGGING-IMAGE] Erro interno. Usando Pollinations.', error);
    return res.status(200).json(await buildPollinationsFallback(prompt, error.message || 'Erro interno na Hugging Face'));
  }
}
