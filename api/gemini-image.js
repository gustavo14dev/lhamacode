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
  console.log('🎨 Endpoint:', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`);
  console.log('=====================================');

  if (!geminiApiKey) {
    console.log('❌ GEMINI_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de geração de imagens não está configurado. Adicione GEMINI_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    // Payload correto para Gemini 2.0
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    };

    console.log('📤 Payload enviado:', JSON.stringify(payload, null, 2));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
    console.log('✅ RESPOSTA COMPLETA:', JSON.stringify(data, null, 2));
    console.log('📊 Estrutura da resposta:', {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length,
      firstCandidate: data.candidates?.[0],
      hasContent: !!data.candidates?.[0]?.content,
      hasParts: !!data.candidates?.[0]?.content?.parts,
      partsLength: data.candidates?.[0]?.content?.parts?.length
    });

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
      model: 'gemini-2.0-flash-exp',
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
