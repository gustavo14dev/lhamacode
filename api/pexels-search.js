// API Pexels para busca de imagens - Vercel serverless
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
  
  console.log('🖼️ === BUSCA PEXELS ===');
  console.log('🖼️ PEXELS_API_KEY:', pexelsApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🖼️ Query:', query);
  console.log('========================');

  if (!pexelsApiKey) {
    console.log('❌ PEXELS_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'PEXELS_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de busca de imagens não está configurado. Adicione PEXELS_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
    
    console.log('🖼️ Buscando imagens em:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': pexelsApiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API Pexels:', response.status, errorText);
      
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'Invalid Pexels API Key',
          friendly_message: 'Chave da API Pexels inválida. Verifique PEXELS_API_KEY no Vercel.'
        });
      }
      
      throw new Error(`Pexels API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    console.log('✅ Imagens encontradas:', data.photos?.length || 0);
    
    // Formatar resposta
    const images = data.photos?.map(photo => ({
      id: photo.id,
      url: photo.url,
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      src: {
        large: photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small
      },
      alt: photo.alt || query
    })) || [];

    return res.status(200).json({ 
      success: true,
      images: images,
      total: data.total_results || 0
    });

  } catch (error) {
    console.error('❌ Erro ao buscar imagens Pexels:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch images from Pexels',
      friendly_message: 'Não foi possível buscar imagens no momento. Tente novamente.',
      details: error.message
    });
  }
}
