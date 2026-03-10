export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { latex } = req.body || {};
        if (!latex || typeof latex !== 'string') {
            return res.status(400).json({ error: 'latex is required' });
        }

        const encoded = encodeURIComponent(latex);
        const url = `https://latexonline.cc/compile?text=${encoded}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return res.status(502).json({ error: 'LaTeX compilation failed', details: errorText || response.statusText });
        }

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
