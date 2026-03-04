// API Image Proxy para contornar CORS e bloqueios - Vercel serverless
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('🖼️ [IMAGE-PROXY] Proxy request for:', url);

    try {
        // Validar URL para segurança
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return res.status(400).json({ error: 'Invalid protocol' });
        }

        // Fazer requisição para a imagem
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.pexels.com/',
                'Accept': 'image/*'
            }
        });

        if (!response.ok) {
            console.error('❌ [IMAGE-PROXY] Error fetching image:', response.status);
            return res.status(response.status).json({ error: 'Failed to fetch image' });
        }

        // Obter o tipo de conteúdo
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Obter os dados da imagem
        const imageBuffer = await response.arrayBuffer();

        // Configurar headers da resposta
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        console.log('✅ [IMAGE-PROXY] Image proxied successfully:', contentType);
        
        // Enviar a imagem
        return res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        console.error('❌ [IMAGE-PROXY] Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
