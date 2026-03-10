export default async function handler(req, res) {
    try {
        const response = await fetch('https://mozilla.github.io/pdf.js/web/viewer.html');
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            return res.status(502).send(errorText || 'Failed to load viewer.html');
        }
        let html = await response.text();
        const baseTag = '<base href="https://mozilla.github.io/pdf.js/web/">';
        if (!/<base\s+/i.test(html)) {
            html = html.replace(/<head>/i, `<head>${baseTag}`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        res.status(500).send(`Erro ao carregar viewer.html: ${error.message}`);
    }
}
