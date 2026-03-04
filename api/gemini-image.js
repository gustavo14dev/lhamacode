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
      if (response.status === 429) {
        console.log(`⏳ Rate limit na ${isFallback ? 'GEMINI_API_KEY_2' : 'GEMINI_API_KEY'}`);
        throw new Error('RATE_LIMIT');
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Erro na ${isFallback ? 'GEMINI_API_KEY_2' : 'GEMINI_API_KEY'}:`, errorData);
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
    
    // Tentar com GEMINI_API_KEY primeiro
    let imageUrl = null;
    let usedFallback = false;
    
    if (process.env.GEMINI_API_KEY) {
      console.log('🎨 Tentando GEMINI_API_KEY...');
      try {
        imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY, false);
        console.log('✅ Sucesso com GEMINI_API_KEY');
      } catch (error) {
        if (error.message === 'RATE_LIMIT' && process.env.GEMINI_API_KEY_2) {
          console.log('🔄 [FALLBACK] GEMINI_API_KEY deu rate limit, tentando GEMINI_API_KEY_2...');
          imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY_2, true);
          console.log('✅ Sucesso com GEMINI_API_KEY_2 (fallback)');
          usedFallback = true;
        } else {
          throw error;
        }
      }
    } else if (process.env.GEMINI_API_KEY_2) {
      console.log('🎨 GEMINI_API_KEY não configurada, usando GEMINI_API_KEY_2...');
      imageUrl = await tryGenerateImage(prompt, process.env.GEMINI_API_KEY_2, true);
      console.log('✅ Sucesso com GEMINI_API_KEY_2');
      usedFallback = true;
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
    console.error(' Erro ao gerar imagem com Gemini:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem. Tente novamente.',
      details: error.message
    });
  }
}
