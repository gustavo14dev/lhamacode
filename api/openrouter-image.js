// OpenRouter API para gerar imagens - Vercel serverless
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  // Verificar se a API Key está configurada
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  
  console.log('🎨 === VERIFICAÇÃO OPENROUTER API ===');
  console.log('🎨 OPENROUTER_API_KEY:', openRouterApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🎨 Prompt:', prompt);
  console.log('=====================================');

  if (!openRouterApiKey) {
    console.log('❌ OPENROUTER_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'OPENROUTER_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de geração de imagens não está configurado. Adicione OPENROUTER_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    // Usar modelo de geração de imagens do OpenRouter
    // Opções: flux-1-dev, flux-1-pro, stable-diffusion-3.5-large, etc.
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drekee.vercel.app',
        'X-Title': 'Drekee AI'
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-1.1-pro', // Modelo excelente com limites generosos
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Generate a high-quality, professional image of: ${prompt}. Make it visually appealing and detailed.`
            }
          ]
        }],
        response_format: {
          type: 'image',
          quality: 'high'
        },
        max_tokens: 1000
      })
    });

    console.log('📡 STATUS:', response.status);
    console.log('📡 HEADERS:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ERRO COMPLETO:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          friendly_message: 'Muitas solicitações! Tente novamente em alguns segundos.'
        });
      }
      
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          error: 'Invalid API key',
          friendly_message: 'Chave da OpenRouter inválida ou expirada.'
        });
      }
      
      return res.status(500).json({ 
        error: 'OpenRouter API error',
        message: 'Erro ao gerar imagem',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('✅ RESPOSTA COMPLETA:', JSON.stringify(data, null, 2));

    // Extrair a imagem gerada da resposta
    let imageUrl = null;
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const message = data.choices[0].message;
      
      // Procurar por imagem no content
      if (message.content) {
        for (const content of message.content) {
          if (content.type === 'image' && content.image) {
            // OpenRouter retorna URL direta da imagem
            imageUrl = content.image.url;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      console.error('❌ Nenhuma imagem encontrada na resposta');
      return res.status(500).json({ 
        error: 'No image generated',
        friendly_message: 'Não foi possível gerar a imagem. Tente novamente.'
      });
    }

    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      model: 'black-forest-labs/flux-1.1-pro',
      message: 'Imagem gerada com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro ao gerar imagem com OpenRouter:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem. Tente novamente.',
      details: error.message
    });
  }
}
