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

function buildPollinationsUrl(prompt = '') {
  const seed = Date.now();
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&private=true&seed=${seed}`;
}

function bufferToDataUrl(arrayBuffer, mimeType = 'image/png') {
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

async function fetchPollinationsImage(url) {
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
    const details = await response.text().catch(() => '');
    return {
      ok: false,
      status: response.status,
      details: details || 'Falha ao buscar imagem no Pollinations'
    };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const details = await response.text().catch(() => '');
    return {
      ok: false,
      status: 502,
      details: details || `Resposta não é imagem (${contentType})`
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    ok: true,
    imageUrl: bufferToDataUrl(arrayBuffer, contentType),
    contentType
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = extractPrompt(req.body);
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  const pollinationsUrl = buildPollinationsUrl(prompt);
  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(pollinationsUrl)}`;

  try {
    const result = await fetchPollinationsImage(pollinationsUrl);

    if (result.ok && result.imageUrl) {
      return res.status(200).json({
        success: true,
        imageUrl: result.imageUrl,
        prompt,
        model: 'pollinations',
        usedFallback: false,
        openUrl: pollinationsUrl
      });
    }

    console.error('[POLLINATIONS-IMAGE] Falha ao gerar imagem diretamente:', {
      prompt,
      status: result.status,
      details: result.details
    });

    return res.status(200).json({
      success: true,
      imageUrl: proxyUrl,
      prompt,
      model: 'pollinations',
      usedFallback: true,
      fallbackCandidates: [pollinationsUrl],
      fallbackReason: result.details || 'Falha ao gerar imagem diretamente',
      openUrl: pollinationsUrl
    });
  } catch (error) {
    console.error('[POLLINATIONS-IMAGE] Erro interno:', error);
    return res.status(200).json({
      success: true,
      imageUrl: proxyUrl,
      prompt,
      model: 'pollinations',
      usedFallback: true,
      fallbackCandidates: [pollinationsUrl],
      fallbackReason: error.message || 'Erro interno ao gerar imagem',
      openUrl: pollinationsUrl
    });
  }
}
