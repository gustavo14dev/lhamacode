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
    // Melhorar a query para busca mais específica e relevante
    let improvedQuery = query;
    
    // Se for um conceito abstrato ou pessoa famosa, adicionar contexto
    if (query.toLowerCase().includes('monalisa') || query.toLowerCase().includes('mona lisa')) {
      improvedQuery = 'mona lisa painting portrait art louvre masterpiece renaissance';
    } else if (query.toLowerCase().includes('einstein')) {
      improvedQuery = 'albert einstein scientist portrait physics nobel genius';
    } else if (query.toLowerCase().includes('picasso')) {
      improvedQuery = 'pablo picasso painting art abstract cubism artist';
    } else if (query.toLowerCase().includes('davinci')) {
      improvedQuery = 'leonardo da vinci painting art renaissance inventor artist';
    } else if (query.toLowerCase().includes('beatles')) {
      improvedQuery = 'beatles band music concert abbey road classic rock';
    } else if (query.toLowerCase().includes('disney')) {
      improvedQuery = 'walt disney castle magic kingdom fantasy movies';
    } else if (query.toLowerCase().includes('natureza')) {
      improvedQuery = 'beautiful nature landscape forest mountains scenic';
    } else if (query.toLowerCase().includes('carro')) {
      improvedQuery = 'luxury sports car automotive speed vehicle';
    } else if (query.toLowerCase().includes('comida')) {
      improvedQuery = 'delicious gourmet food restaurant cuisine meal';
    } else if (query.toLowerCase().includes('gato')) {
      improvedQuery = 'cute cat kitten pet animal feline';
    } else if (query.toLowerCase().includes('cachorro') || query.toLowerCase().includes('dog')) {
      improvedQuery = 'cute dog puppy pet animal canine';
    } else if (query.toLowerCase().includes('cidade')) {
      improvedQuery = 'city skyline urban architecture buildings';
    } else if (query.toLowerCase().includes('mar') || query.toLowerCase().includes('praia')) {
      improvedQuery = 'ocean sea beach waves water coastal';
    } else if (query.length < 4) {
      // Para queries muito curtas, adicionar contexto
      improvedQuery = query + ' professional high quality';
    }
    
    // Fazer requisição para API Pexels com query melhorada
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(improvedQuery)}&per_page=3&orientation=landscape&size=large&quality=high`;
    
    console.log('🔍 Buscando imagem original:', query);
    console.log('🎯 Query melhorada:', improvedQuery);
    console.log('🔗 URL completa:', searchUrl);

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

    // Mapear e retornar as imagens encontradas
    const images = data.photos.map(photo => ({
      url: photo.url,
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      src: {
        large: photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small
      },
      alt: photo.alt || query
    }));

    console.log(`✅ ${images.length} imagens encontradas!`);
    return res.status(200).json({ photos: images });

  } catch (error) {
    console.log('❌ Erro ao buscar imagem:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
