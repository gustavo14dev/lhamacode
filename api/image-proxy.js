// Proxy para imagens Pexels - resolve CORS e ad-blocker issues
const https = require('https');
const http = require('http');

module.exports = (req, res) => {
    // Habilitar CORS para todos
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Apenas GET permitido
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Obter URL da imagem dos query params
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Verificar se é uma URL válida (apenas Pexels)
    if (!imageUrl.includes('pexels.com')) {
        return res.status(403).json({ error: 'Only Pexels images are allowed' });
    }
    
    console.log('🖼️ [PROXY] Buscando imagem:', imageUrl);
    
    // Fazer a requisição para a imagem
    const protocol = imageUrl.startsWith('https:') ? https : http;
    
    const imageReq = protocol.get(imageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.pexels.com/',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
    }, (imageRes) => {
        
        // Configurar headers da resposta
        res.status(imageRes.statusCode);
        
        // Copiar headers importantes
        if (imageRes.headers['content-type']) {
            res.setHeader('Content-Type', imageRes.headers['content-type']);
        }
        if (imageRes.headers['content-length']) {
            res.setHeader('Content-Length', imageRes.headers['content-length']);
        }
        
        // Cache headers
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Stream da imagem
        imageRes.pipe(res);
        
        console.log('✅ [PROXY] Imagem entregue com sucesso');
    });
    
    imageReq.on('error', (err) => {
        console.error('❌ [PROXY] Erro ao buscar imagem:', err);
        res.status(500).json({ error: 'Failed to fetch image' });
    });
    
    imageReq.setTimeout(10000, () => {
        imageReq.destroy();
        res.status(408).json({ error: 'Request timeout' });
    });
};
