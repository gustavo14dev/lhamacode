// API Gemini para geração de imagens - Vercel serverless
// Modelo: gemini-2.5-flash-image

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const imageApiKey = process.env.IMAGE_API_KEY;
  console.log('🖼️ [GEMINI-IMAGE-DEBUG] IMAGE_API_KEY existe:', !!imageApiKey);
  console.log('🖼️ [GEMINI-IMAGE-DEBUG] IMAGE_API_KEY length:', imageApiKey?.length || 0);
  
  if (!imageApiKey) {
    console.error('❌ [GEMINI-IMAGE-DEBUG] IMAGE_API_KEY não configurada!');
    return res.status(500).json({ error: 'IMAGE_API_KEY not configured' });
  }

  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt parameter is required and must be a non-empty string' });
    }

    console.log('🖼️ [GEMINI-IMAGE-DEBUG] Prompt recebido:', prompt);

    // Payload para geração de imagem com Gemini
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      }
    };

    const model = 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${imageApiKey}`;

    console.log('🖼️ [GEMINI-IMAGE-DEBUG] URL da API:', url);
    console.log('🖼️ [GEMINI-IMAGE-DEBUG] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': imageApiKey
      },
      body: JSON.stringify(payload)
    });

    console.log('🖼️ [GEMINI-IMAGE-DEBUG] Status da resposta:', response.status);
    console.log('🖼️ [GEMINI-IMAGE-DEBUG] Headers da resposta:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [GEMINI-IMAGE-DEBUG] Erro na API Gemini Image:', response.status);
      console.error('❌ [GEMINI-IMAGE-DEBUG] Error response:', errorText);
      
      let errorMessage = 'Erro na API Gemini Image';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('🖼️ [GEMINI-IMAGE-DEBUG] Resposta completa:', JSON.stringify(data, null, 2));

    // Extrair imagem da resposta do Gemini
    let imageUrl = null;
    let imageData = null;
    
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inline_data && part.inline_data.data) {
            imageData = part.inline_data.data;
            const mimeType = part.inline_data.mime_type || 'image/png';
            imageUrl = `data:${mimeType};base64,${imageData}`;
            break;
          }
          // Alguns modelos podem retornar URL direta
          if (part.image_url) {
            imageUrl = part.image_url;
            break;
          }
        }
      }
    }

    if (!imageUrl) {
      console.error('❌ [GEMINI-IMAGE-DEBUG] Nenhuma imagem encontrada na resposta:', data);
      return res.status(500).json({ 
        error: 'Nenhuma imagem foi gerada',
        details: 'A API não retornou dados de imagem válidos',
        debugData: data
      });
    }

    console.log('✅ [GEMINI-IMAGE-DEBUG] Imagem gerada com sucesso!');
    console.log('🖼️ [GEMINI-IMAGE-DEBUG] URL da imagem (truncada):', imageUrl.substring(0, 100) + '...');

    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      model: model,
      provider: 'gemini'
    });

  } catch (error) {
    console.error('❌ [GEMINI-IMAGE-DEBUG] Erro geral:', error);
    console.error('❌ [GEMINI-IMAGE-DEBUG] Stack:', error.stack);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
