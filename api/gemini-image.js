// API Gemini para gerar imagens - Vercel serverless
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  // Verificar se a API Key está configurada
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  console.log('🎨 === VERIFICAÇÃO GEMINI API ===');
  console.log('🎨 GEMINI_API_KEY:', geminiApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🎨 Prompt:', prompt);
  console.log('=====================================');

  if (!geminiApiKey) {
    console.log('❌ GEMINI_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de geração de imagens não está configurado. Adicione GEMINI_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    // Usar o modelo mais econômico do Gemini para geração de imagens
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a high-quality image of: ${prompt}. Make it visually appealing and professional.`
          }]
        }],
        generationConfig: {
          responseModalities: ["Text", "Image"],
          responseMimeType: "text/plain"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erro na API Gemini:', response.status, response.statusText);
      console.error('❌ Detalhes:', errorData);
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          friendly_message: 'Muitas solicitações! Tente novamente em alguns segundos.'
        });
      }
      
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          error: 'Invalid API key',
          friendly_message: 'Chave da API Gemini inválida ou expirada.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Gemini API error',
        message: 'Erro ao gerar imagem',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('✅ Imagem gerada com sucesso!');
    console.log('📊 Resposta:', data);

    // Extrair a imagem gerada da resposta
    let imageUrl = null;
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const content = data.candidates[0].content;
      
      // Procurar por imagem nos parts
      if (content.parts) {
        for (const part of content.parts) {
          if (part.inline_data && part.inline_data.data) {
            // Converter base64 para URL de dados
            const mimeType = part.inline_data.mime_type || 'image/png';
            const base64Data = part.inline_data.data;
            imageUrl = `data:${mimeType};base64,${base64Data}`;
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
      model: 'gemini-1.5-flash',
      message: 'Imagem gerada com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro ao gerar imagem com Gemini:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem. Tente novamente.',
      details: error.message
    });
  }
}
