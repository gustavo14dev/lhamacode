// API Unsplash para busca de imagens - Vercel serverless
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  // Verificar se a API Key está configurada
  const unsplashApiKey = process.env.UNSPLASH_API_KEY;
  
  console.log('🖼️ === BUSCA UNSPLASH ===');
  console.log('🖼️ UNSPLASH_API_KEY:', unsplashApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🖼️ Query:', query);
  console.log('==========================');

  if (!unsplashApiKey) {
    console.log('❌ UNSPLASH_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'UNSPLASH_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de busca de imagens não está configurado. Adicione UNSPLASH_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&order_by=relevant`;
    
    console.log('🖼️ Buscando imagens em:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Client-ID ${unsplashApiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API Unsplash:', response.status, errorText);
      
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'Invalid Unsplash API Key',
          friendly_message: 'Chave da API Unsplash inválida. Verifique UNSPLASH_API_KEY no Vercel.'
        });
      }
      
      throw new Error(`Unsplash API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    console.log('✅ Imagens encontradas:', data.results?.length || 0);
    
    // Formatar resposta para manter compatibilidade com o código atual
    const images = data.results?.map(photo => ({
      id: photo.id,
      url: photo.urls?.regular || photo.urls?.full,
      photographer: photo.user?.name,
      photographer_url: photo.user?.links?.html,
      src: {
        large: photo.urls?.regular || photo.urls?.full,
        medium: photo.urls?.small || photo.urls?.regular,
        small: photo.urls?.thumb || photo.urls?.small
      },
      alt: photo.alt_description || photo.description || query,
      unsplash_url: photo.links?.html
    })) || [];

    return res.status(200).json({ 
      success: true,
      photos: images, // Manter compatibilidade com código existente
      total: data.total || 0
    });

  } catch (error) {
    console.error('❌ Erro ao buscar imagens Unsplash:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch images from Unsplash',
      friendly_message: 'Não foi possível buscar imagens no momento. Tente novamente.',
      details: error.message
    });
  }
}
