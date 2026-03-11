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
        const postResponse = await fetch('https://latexonline.cc/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `text=${encoded}`
        });

        if (!postResponse.ok) {
            const postErrorText = await postResponse.text().catch(() => '');
            const getUrl = `https://latexonline.cc/compile?text=${encoded}`;
            const getResponse = await fetch(getUrl);

            if (!getResponse.ok) {
                const getErrorText = await getResponse.text().catch(() => '');
                return res.status(502).json({
                    error: 'LaTeX compilation failed',
                    details: getErrorText || postErrorText || getResponse.statusText
                });
            }

            const arrayBuffer = await getResponse.arrayBuffer();
            res.setHeader('Content-Type', 'application/pdf');
            res.status(200).send(Buffer.from(arrayBuffer));
            return;
        }

        const arrayBuffer = await postResponse.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
