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

function bufferToDataUrl(arrayBuffer, mimeType = 'image/png') {
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function buildPollinationsCandidates(prompt = '') {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Date.now();
  return [
    {
      label: 'gen-flux',
      url: `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`
    },
    {
      label: 'gen-turbo',
      url: `https://gen.pollinations.ai/image/${encodedPrompt}?model=turbo&width=1024&height=1024&nologo=true&enhance=true&seed=${seed + 1}`
    },
    {
      label: 'legacy-flux',
      url: `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=1024&height=1024&nologo=true&seed=${seed + 2}`
    }
  ];
}

async function fetchPollinationsCandidate(candidate) {
  const response = await fetch(candidate.url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://pollinations.ai/',
      Origin: 'https://pollinations.ai'
    }
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return {
      ok: false,
      label: candidate.label,
      url: candidate.url,
      status: response.status,
      details: details || 'Falha ao buscar imagem no Pollinations'
    };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const details = await response.text().catch(() => '');
    return {
      ok: false,
      label: candidate.label,
      url: candidate.url,
      status: 502,
      details: details || `Resposta não é imagem (${contentType})`
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    ok: true,
    label: candidate.label,
    url: candidate.url,
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

  const candidates = buildPollinationsCandidates(prompt);
  const errors = [];

  for (const candidate of candidates) {
    try {
      const result = await fetchPollinationsCandidate(candidate);
      if (result.ok && result.imageUrl) {
        return res.status(200).json({
          success: true,
          imageUrl: result.imageUrl,
          prompt,
          model: `pollinations:${result.label}`,
          usedFallback: false,
          openUrl: result.url
        });
      }

      errors.push({
        label: candidate.label,
        status: result.status,
        details: result.details
      });
      console.error('[POLLINATIONS-IMAGE] Candidate failed:', result);
    } catch (error) {
      errors.push({
        label: candidate.label,
        status: 500,
        details: error.message
      });
      console.error('[POLLINATIONS-IMAGE] Candidate threw:', candidate.label, error);
    }
  }

  return res.status(500).json({
    error: 'Failed to generate image',
    friendly_message: 'Nao foi possivel gerar a imagem com Pollinations no momento.',
    details: errors
  });
}
