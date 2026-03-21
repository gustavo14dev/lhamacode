export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query || {};
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).json({ error: 'Invalid protocol' });
    }

    const upstreamResponse = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: `${urlObj.origin}/`,
        Origin: urlObj.origin
      }
    });

    if (!upstreamResponse.ok) {
      const details = await upstreamResponse.text().catch(() => '');
      console.error('[IMAGE-PROXY] Upstream error:', {
        url,
        status: upstreamResponse.status,
        details
      });
      return res.status(upstreamResponse.status).json({
        error: 'Failed to fetch image',
        details
      });
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      const details = await upstreamResponse.text().catch(() => '');
      console.error('[IMAGE-PROXY] Upstream did not return an image:', {
        url,
        contentType,
        details
      });
      return res.status(502).json({
        error: 'Upstream did not return an image',
        details,
        contentType
      });
    }

    const imageBuffer = await upstreamResponse.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    return res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('[IMAGE-PROXY] Internal error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
