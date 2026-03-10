import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    try {
        const viewerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'web', 'viewer.html');
        let html = fs.readFileSync(viewerPath, 'utf8');
        const baseTag = '<base href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/web/">';
        if (!/<base\s+/i.test(html)) {
            html = html.replace(/<head>/i, `<head>${baseTag}`);
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
    } catch (error) {
        res.status(500).send(`Erro ao carregar viewer.html: ${error.message}`);
    }
}
