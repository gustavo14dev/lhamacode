// Proxy serverless para Groq / SambaNova - Vercel com sistema de fallback
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedProvider = (req.body?.provider || '').toString().toLowerCase();
  const defaultProvider = (process.env.DEFAULT_API_PROVIDER || 'groq').toString().toLowerCase();

  const sambaKey = process.env.SAMBA_API_KEY;
  const groqKeys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].filter(key => key);

  const providerOrder = [];
  if (requestedProvider === 'samba') {
    if (sambaKey) providerOrder.push('samba');
    if (groqKeys.length > 0) providerOrder.push('groq');
  } else if (requestedProvider === 'groq') {
    if (groqKeys.length > 0) providerOrder.push('groq');
    if (sambaKey) providerOrder.push('samba');
  } else {
    if (defaultProvider === 'samba') {
      if (sambaKey) providerOrder.push('samba');
      if (groqKeys.length > 0) providerOrder.push('groq');
    } else {
      if (groqKeys.length > 0) providerOrder.push('groq');
      if (sambaKey) providerOrder.push('samba');
    }
  }

  console.log('🔑 [PROXY] Requested provider:', requestedProvider || '(n/d)');
  console.log('🔑 [PROXY] Default provider from env:', defaultProvider);
  console.log('🔑 [PROXY] Provider execution order:', providerOrder);
  console.log('🔑 [PROXY] GROQ keys:', groqKeys.length);
  console.log('🔑 [PROXY] SAMBA key:', sambaKey ? '✅ Configurada' : '❌ Não configurada');

  if (providerOrder.length === 0) {
    return res.status(500).json({ error: 'Nenhuma API key configurada. Configure GROQ_API_KEY ou SAMBA_API_KEY no ambiente.' });
  }

  const modelFromRequest = req.body?.model || '';
  const bodyTemplate = {
    ...req.body,
    provider: undefined
  };

  const mapSambaModel = (model) => {
    if (!model) return model;
    const normalized = model.toLowerCase();
    if (normalized.includes('llama-3.1-8b')) return 'Meta-Llama-3.1-8B-Instruct';
    if (normalized.includes('llama-3.3-70b')) return 'Meta-Llama-3.3-70B-Instruct';
    if (normalized.includes('llama-4-maverick')) return 'Llama-4-Maverick-17B-128E-Instruct';
    return model;
  };

  for (const provider of providerOrder) {
    try {
      if (provider === 'groq') {
        // fallback Groq: replicate comportamento anterior
        for (let i = 0; i < groqKeys.length; i++) {
          const currentKey = groqKeys[i];
          console.log(`🔄 [GROQ PROXY] Tentando chave ${i + 1}/${groqKeys.length}...`);

          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...bodyTemplate,
              model: modelFromRequest
            })
          });

          const data = await response.json().catch(() => null);

          if (response.ok) {
            console.log(`✅ [GROQ PROXY] Chave ${i + 1} funcionou!`);
            return res.status(200).json(data);
          }

          if (data?.error?.type === 'rate_limit_error' ||
              data?.error?.message?.toLowerCase()?.includes('rate limit') ||
              data?.error?.message?.toLowerCase()?.includes('quota') ||
              response.status === 429) {
            console.log(`⚠️ [GROQ PROXY] Chave ${i + 1} atingiu limite. Tentando próxima...`);
            continue;
          }

          console.log(`❌ [GROQ PROXY] Chave ${i + 1} deu erro:`, data?.error || data);
          return res.status(response.status).json(data || { error: 'Erro Groq desconhecido' });
        }
      } else if (provider === 'samba') {
        if (!sambaKey) {
          console.log('⚠️ [SAMBA PROXY] Samba key não configurada; pulando.');
          continue;
        }

        const sambaEndpoint = process.env.SAMBA_API_URL || 'https://api.sambanova.ai/v1/chat/completions';
        const sambaBody = {
          ...bodyTemplate,
          model: mapSambaModel(modelFromRequest),
          messages: req.body?.messages || [],
          temperature: req.body?.temperature || 0.7,
          max_tokens: req.body?.max_tokens || 8192,
          top_p: req.body?.top_p || 1,
          stream: req.body?.stream || false
        };

        console.log('🔄 [SAMBA PROXY] Enviando para', sambaEndpoint, 'model', sambaBody.model);

        const response = await fetch(sambaEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sambaKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sambaBody)
        });

        const data = await response.json().catch(() => null);

        if (response.ok) {
          console.log('✅ [SAMBA PROXY] Requisição Samba bem sucedida.');
          return res.status(200).json(data);
        }

        if (data?.error?.type === 'rate_limit_error' ||
            data?.error?.message?.toLowerCase()?.includes('rate limit') ||
            data?.error?.message?.toLowerCase()?.includes('quota') ||
            response.status === 429) {
          console.log('⚠️ [SAMBA PROXY] Limite Samba atingido. Tentando próxima provider (se houver)...');
          continue;
        }

        console.log('❌ [SAMBA PROXY] Erro retornado:', data);
        return res.status(response.status).json(data || { error: 'Erro Samba desconhecido' });
      }
    } catch (error) {
      console.log(`❌ [PROXY] Erro no provider ${provider}:`, error.message || error);
      continue;
    }
  }

  console.log('❌ [PROXY] Todas as APIs falharam (Groq + Samba).');
  return res.status(500).json({
    error: 'Todas as APIs estão indisponíveis no momento. Tente novamente em alguns minutos.',
    friendly_message: 'Ops! Aproveite para reduzir o tamanho da requisição e tente novamente em breve. 🚀'
  });
}
