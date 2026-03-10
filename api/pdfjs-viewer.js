export default async function handler(req, res) {
    try {
        const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/web/viewer.html');
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return res.status(502).send(errorText || 'Failed to load viewer.html');
        }
        const html = await response.text();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        res.status(500).send(`Erro ao buscar viewer.html: ${error.message}`);
    }
}
