// Stability AI API para gerar imagens - Vercel serverless
export default async function handler(req, res) {
  console.log("🔑 [DEBUG] STABILITY_API_KEY:", process.env.STABILITY_API_KEY);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  // Verificar se a API Key está configurada
  const stabilityApiKey = process.env.STABILITY_API_KEY;
  
  console.log('🎨 === VERIFICAÇÃO STABILITY AI ===');
  console.log('🎨 STABILITY_API_KEY:', stabilityApiKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('🎨 Prompt:', prompt);
  console.log('=====================================');

  if (!stabilityApiKey) {
    console.log('❌ STABILITY_API_KEY não configurada!');
    return res.status(500).json({ 
      error: 'STABILITY_API_KEY not configured in server environment',
      friendly_message: 'Ops! Sistema de geração de imagens não está configurado. Adicione STABILITY_API_KEY nas Environment Variables do Vercel.'
    });
  }

  try {
    // Usar Stability AI API (Stable Diffusion 3)
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'sd3',
        mode: 'text-to-image',
        output_format: 'jpeg',
        width: 1024,
        height: 1024,
        samples: 1,
        quality: 0.8,
        cfg_scale: 7,
        steps: 30
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
          friendly_message: 'Chave da Stability AI inválida ou expirada.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Stability AI API error',
        message: 'Erro ao gerar imagem',
        details: errorData
      });
    }

    // Stability AI retorna a imagem como base64
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    console.log('✅ Imagem gerada com sucesso!');
    console.log('📊 Tamanho da imagem:', imageBuffer.byteLength, 'bytes');

    return res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      model: 'sd3',
      message: 'Imagem gerada com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro ao gerar imagem com Stability AI:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      friendly_message: 'Ocorreu um erro ao gerar a imagem. Tente novamente.',
      details: error.message
    });
  }
}
