export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { latex } = req.body || {};

    if (!latex || typeof latex !== 'string') {
        return res.status(400).json({ error: 'latex is required' });
    }

    try {
        const body = new URLSearchParams({
            formula: latex
        }).toString();

        const response = await fetch('https://quicklatex.com/latex3.f', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        });

        const raw = await response.text();

        if (!response.ok) {
            return res.status(502).json({
                error: 'QuickLaTeX request failed',
                details: raw
            });
        }

        const urlMatch = raw.match(/https?:\/\/\S+\.(?:png|gif)/i);
        const imageUrl = urlMatch ? urlMatch[0] : null;

        if (!raw.trim().startsWith('0') || !imageUrl) {
            return res.status(502).json({
                error: 'QuickLaTeX compilation failed',
                details: raw
            });
        }

        return res.status(200).json({
            success: true,
            imageUrl,
            raw
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
