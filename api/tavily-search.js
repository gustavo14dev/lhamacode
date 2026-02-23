export default async function handler(req, res) {
    console.log('🔍 [TAVILY API] Requisição recebida:', req.method);
    console.log('🔍 [TAVILY API] Body:', req.body);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log('🔍 [TAVILY API] Resposta OPTIONS enviada');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.error('❌ [TAVILY API] Método não permitido:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, conversationHistory = [] } = req.body;
    console.log('🔍 [TAVILY API] Mensagem:', message);
    console.log('🔍 [TAVILY API] Histórico:', conversationHistory.length, 'mensagens');

    // Validações seguras
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    // Validar conversationHistory
    if (!Array.isArray(conversationHistory)) {
        console.warn('⚠️ conversationHistory não é um array, usando array vazio');
        req.body.conversationHistory = [];
    }

    // 🔍 VERIFICAÇÃO DE APIs CONFIGURADAS
    console.log('🔍 === VERIFICAÇÃO DE CONFIGURAÇÃO ===');
    console.log('🔑 TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? '✅ Configurada' : '❌ Não configurada');
    console.log('🔑 GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Configurada' : '❌ Não configurada');
    console.log('🤖 Modelo Principal: openai/gpt-oss-120b');
    console.log('🔄 Modelo Fallback: llama-3.1-8b-instant');
    console.log('🔍 Engine de Pesquisa: Tavily AI');
    console.log('=====================================');

    // Verificar se a API key do Tavily está configurada
    if (!process.env.TAVILY_API_KEY) {
        console.error('❌ TAVILY_API_KEY não configurada');
        return res.status(500).json({ 
            error: 'Tavily API not configured',
            message: 'Configure TAVILY_API_KEY nas variáveis de ambiente'
        });
    }

    // Verificar se a API key do Groq está configurada
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY não configurada');
        return res.status(500).json({ 
            error: 'Groq API not configured',
            message: 'Configure GROQ_API_KEY nas variáveis de ambiente'
        });
    }

    console.log('🔍 Recebida requisição de pesquisa Tavily:', { 
        message: message?.substring(0, 100) + '...', 
        historyLength: conversationHistory?.length || 0 
    });

    try {
        // Fazer pesquisa com Tavily
        console.log('🔍 Iniciando pesquisa com Tavily AI...');
        const tavilyData = await callTavilySearch(message);
        
        // Construir mensagens com histórico e resultados da pesquisa
        const messages = [
            {
                role: 'system',
                content: `Você é um assistente de IA especializado em pesquisas web. Use as informações fornecidas pela Tavily AI para responder à pergunta do usuário de forma precisa e bem fundamentada.

IMPORTANTE:
- Baseie sua resposta PRINCIPALMENTE nos resultados da pesquisa fornecidos
- Cite as fontes quando possível
- Seja objetivo e informativo
- Responda em português

Resultados da pesquisa:
${JSON.stringify(tavilyData.results, null, 2)}`
            },
            ...conversationHistory.slice(-4), // Últimas 4 mensagens para contexto
            {
                role: 'user',
                content: message
            }
        ];

        // MODO PESQUISA WEB: Usar SEMPRE o modelo mais econômico (Llama 3.1 8B)
        console.log('🔍 [MODO PESQUISA] Usando modelo econômico: llama-3.1-8b-instant');
        
        const response = await callWithEconomicModel(messages);
        
        console.log('✅ Resposta da pesquisa Tavily gerada com sucesso');

        return res.status(200).json({
            response: response,
            sources: tavilyData.results || [],
            model: 'llama-3.1-8b-instant (econômico)',
            mode: 'web-search'
        });
        
    } catch (error) {
        console.error('❌ Erro na API Tavily:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

async function callTavilySearch(query) {
    console.log('🔍 === CHAMADA TAVILY AI ===');
    console.log('🔍 Query:', query);
    console.log('🔑 API Key Status:', process.env.TAVILY_API_KEY ? 'Presente' : 'Ausente');
    
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: query,
            search_depth: 'basic',
            include_answer: true,
            include_domains: [],
            exclude_domains: [],
            max_results: 8,
            include_raw_content: false,
            include_images: false
        })
    });

    if (!response.ok) {
        console.error('❌ Erro Tavily API:', response.status, response.statusText);
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Pesquisa Tavily concluída:', data.results?.length || 0, 'resultados');
    console.log('=============================');
    
    return data;
}

async function callWithMainModel(messages) {
    console.log(' === MODELO PRINCIPAL ===');
    console.log(' Modelo: openai/gpt-oss-120b');
    console.log(' Messages:', messages.length, 'items');
    console.log(' API Key Status:', process.env.GROQ_API_KEY ? 'Presente' : 'Ausente');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: messages,
            max_tokens: 4000,
            temperature: 0.7,
            top_p: 0.9,
            stream: false
        })
    });

    if (!response.ok) {
        console.error('❌ Erro modelo principal:', response.status, response.statusText);
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Modelo principal concluído');
    console.log('📄 Tokens usados:', data.usage?.total_tokens || 'N/A');
    console.log('========================');
    return data.choices[0].message.content;
}

async function callWithEconomicModel(messages) {
    console.log('💰 === MODELO ECONÔMICO ===');
    console.log('🤖 Modelo: llama-3.1-8b-instant');
    console.log('📝 Messages:', messages.length, 'items');
    console.log('🔑 API Key Status:', process.env.GROQ_API_KEY ? 'Presente' : 'Ausente');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            stream: false
        })
    });

    if (!response.ok) {
        console.error('❌ Erro modelo econômico:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro modelo econômico: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Modelo econômico funcionou! Tokens usados:', data.usage?.total_tokens || 'N/A');
    return data.choices[0].message.content;
}

async function callWithFallbackModel(messages) {
    console.log('🔄 === MODELO FALLBACK ===');
    console.log('🤖 Modelo: llama-3.1-8b-instant');
    console.log('📝 Messages:', messages.length, 'items');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
            stream: false
        })
    });

    if (!response.ok) {
        console.error('❌ Erro modelo fallback:', response.status, response.statusText);
        throw new Error(`Fallback model also failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Modelo fallback concluído');
    console.log('📄 Tokens usados:', data.usage?.total_tokens || 'N/A');
    console.log('========================');
    return data.choices[0].message.content;
}
