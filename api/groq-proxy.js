// Proxy serverless para Groq API - Vercel com sistema de fallback
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Array com as 3 chaves API em ordem de prioridade
  const apiKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].filter(key => key); // Remove chaves vazias/nulas

  console.log('🔑 [GROQ PROXY] Chaves disponíveis:', apiKeys.length);
  
  if (apiKeys.length === 0) {
    return res.status(500).json({ 
      error: 'Nenhuma GROQ_API_KEY configurada no ambiente' 
    });
  }

  // Tentar cada chave API em sequência
  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    const keyNumber = i + 1;
    
    console.log(`🔄 [GROQ PROXY] Tentando chave ${keyNumber}/${apiKeys.length}...`);
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body)
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ [GROQ PROXY] Chave ${keyNumber} funcionou!`);
        return res.status(200).json(data);
      } else {
        // Verificar se é erro de limite de taxa
        if (data.error?.type === 'rate_limit_error' || 
            data.error?.message?.includes('rate limit') ||
            data.error?.message?.includes('quota') ||
            response.status === 429) {
          console.log(`⚠️ [GROQ PROXY] Chave ${keyNumber} atingiu limite. Tentando próxima...`);
          continue; // Tentar próxima chave
        } else {
          // Outro tipo de erro, retornar imediatamente
          console.log(`❌ [GROQ PROXY] Chave ${keyNumber} deu erro:`, data.error);
          return res.status(response.status).json(data);
        }
      }
    } catch (error) {
      console.log(`❌ [GROQ PROXY] Erro na chave ${keyNumber}:`, error.message);
      
      // Se não for a última chave, tentar a próxima
      if (i < apiKeys.length - 1) {
        console.log(`🔄 [GROQ PROXY] Tentando próxima chave...`);
        continue;
      }
    }
  }

  // Se chegou aqui, todas as chaves falharam
  console.log('❌ [GROQ PROXY] Todas as chaves falharam!');
  return res.status(500).json({ 
    error: 'Todas as APIs Groq estão indisponíveis no momento. Tente novamente em alguns minutos.',
    friendly_message: 'Ops! Parece que nossos servidores estão muito ocupados agora. Por favor, tente novamente em alguns minutos. 🚀'
  });
}
