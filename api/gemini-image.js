// API Gemini para gerar imagens - Vercel serverless
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  // Função para tentar gerar imagem com fallback automático
  async function tryGenerateImage(prompt, apiKey, isFallback = false) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na ${isFallback ? 'GEMINI_API_KEY_2' : 'GEMINI_API_KEY'}:`, response.status);
      console.error(`❌ Error response:`, errorText);
      
      if (response.status === 429) {
        console.log(`⏳ Rate limit na ${isFallback ? 'GEMINI_API_KEY_2' : 'GEMINI_API_KEY'}`);
        throw new Error('RATE_LIMIT');
      }
      
      throw new Error('API_ERROR');
    }

    const data = await response.json();
    
    // Extrair imagem
    let imageUrl = null;
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inline_data?.data) {
          const mimeType = part.inline_data.mime_type || 'image/png';
          const base64Data = part.inline_data.data;
          imageUrl = `data:${mimeType};base64,${base64Data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error('NO_IMAGE');
    }

    return imageUrl;
  }

  try {
    console.log('🎨 === VERIFICAÇÃO GEMINI API ===');
    console.log('🎨 Prompt:', prompt);
    console.log('🎨 GEMINI_API_KEY existe:', !!process.env.GEMINI_API_KEY);
    console.log('🎨 GEMINI_API_KEY_2 existe:', !!process.env.GEMINI_API_KEY_2);
    
    // Tentar com GEMINI_API_KEY primeiro
    let imageUrl = null;
    let usedFallback = false;
    let lastError = null;
    
    if (process.env.GEMINI_API_KEY) {
      console.log('🎨 Tentando GEMINI_API_KEY...');
      try {
        imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY, false);
        console.log('✅ Sucesso com GEMINI_API_KEY');
      } catch (error) {
        lastError = error;
        console.error('❌ Erro com GEMINI_API_KEY:', error.message);
        if (error.message === 'RATE_LIMIT' && process.env.GEMINI_API_KEY_2) {
          console.log('🔄 [FALLBACK] GEMINI_API_KEY deu rate limit, tentando GEMINI_API_KEY_2...');
          try {
            imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY_2, true);
            console.log('✅ Sucesso com GEMINI_API_KEY_2 (fallback)');
            usedFallback = true;
          } catch (fallbackError) {
            console.error('❌ Erro com GEMINI_API_KEY_2:', fallbackError.message);
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }
    } else if (process.env.GEMINI_API_KEY_2) {
      console.log('🎨 GEMINI_API_KEY não configurada, usando GEMINI_API_KEY_2...');
      try {
        imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY_2, true);
        console.log('✅ Sucesso com GEMINI_API_KEY_2');
        usedFallback = true;
      } catch (error) {
        console.error('❌ Erro com GEMINI_API_KEY_2:', error.message);
        throw error;
      }
    } else {
      console.error('❌ Nenhuma GEMINI_API_KEY configurada!');
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY not configured',
        friendly_message: 'Ops! Configure GEMINI_API_KEY ou GEMINI_API_KEY_2 na Vercel.'
      });
    }

    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      model: 'gemini-2.0-flash-exp-image-generation',
      message: 'Imagem gerada com sucesso!',
      usingFallback: usedFallback
    });

  } catch (error) {
    console.error('❌ Erro geral ao gerar imagem:', error);
    console.error('❌ Stack completo:', error.stack);
    
    // Mensagem amigável para rate limit
    if (error.message === 'RATE_LIMIT') {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        friendly_message: '⏳ Muitas solicitações! Tente novamente em alguns segundos.',
        details: 'Rate limit da API Gemini'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem. Tente novamente.',
      details: error.message,
      stack: error.stack
    });
  }
}
