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

function buildPollinationsCandidates(prompt = '') {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Date.now();

  const directCandidates = [
    `https://image.pollinations.ai/prompt/${encodedPrompt}`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${seed + 1}`,
    `https://gen.pollinations.ai/image/${encodedPrompt}`,
    `https://gen.pollinations.ai/image/${encodedPrompt}?seed=${seed + 2}`
  ];

  const proxyCandidates = directCandidates.map((url) => `/api/image-proxy?url=${encodeURIComponent(url)}`);

  return {
    directCandidates,
    proxyCandidates
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

  const { directCandidates, proxyCandidates } = buildPollinationsCandidates(prompt);

  console.log('[POLLINATIONS-IMAGE] Gerando candidatos para prompt:', prompt);
  console.log('[POLLINATIONS-IMAGE] Primeira URL direta:', directCandidates[0]);

  return res.status(200).json({
    success: true,
    imageUrl: directCandidates[0],
    prompt,
    model: 'pollinations',
    usedFallback: false,
    openUrl: directCandidates[0],
    fallbackCandidates: [
      ...proxyCandidates,
      ...directCandidates.slice(1)
    ]
  });
}
