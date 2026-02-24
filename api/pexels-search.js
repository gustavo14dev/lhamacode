// API Pexels para buscar imagens - Vercel serverless
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  // Verificar se a API Key está configurada
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  
  console.log('🖼️ === VERIFICAÇÃO PEXELS API ===');
  console.log('🖼️ PEXELS_API_KEY:', pexelsApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🖼️ Query:', query);
  console.log('=====================================');

  if (!pexelsApiKey) {
    console.log('❌ PEXELS_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'PEXELS_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de imagens não está configurado. Adicione PEXELS_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    // Fazer requisição para API Pexels
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    
    console.log('🔍 Buscando imagem:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': pexelsApiKey
      }
    });

    const data = await response.json();
    console.log('📦 Resposta Pexels:', data);

    if (!response.ok) {
      console.log('❌ Erro na API Pexels:', data);
      return res.status(response.status).json({
        error: 'Pexels API error',
        details: data
      });
    }

    // Verificar se encontrou imagens
    if (!data.photos || data.photos.length === 0) {
      console.log('⚠️ Nenhuma imagem encontrada para:', query);
      return res.status(404).json({ 
        error: 'No images found',
        query: query
      });
    }

    // Retornar a primeira imagem encontrada
    const photo = data.photos[0];
    const imageData = {
      url: photo.url,
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      src: {
        large: photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small
      },
      alt: photo.alt || query
    };

    console.log('✅ Imagem encontrada com sucesso!');
    return res.status(200).json(imageData);

  } catch (error) {
    console.log('❌ Erro ao buscar imagem:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
