export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message, conversationHistory = [] } = req.body;

    // Validações seguras
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    // Validar conversationHistory
    if (!Array.isArray(conversationHistory)) {
        console.warn('⚠️ conversationHistory não é um array, usando array vazio');
        req.body.conversationHistory = [];
    }

    // Verificar se a API key do Tavily está configurada
    if (!process.env.TAVILY_API_KEY) {
        console.error('❌ TAVILY_API_KEY não configurada');
        return res.status(500).json({ 
            error: 'Tavily API not configured',
            message: 'Configure TAVILY_API_KEY nas variáveis de ambiente'
        });
    }

    console.log('🔍 Recebida requisição de pesquisa Tavily:', { 
        message: message?.substring(0, 100) + '...', 
        historyLength: conversationHistory?.length || 0 
    });

    try {
        // Fazer pesquisa com Tavily
        const searchResponse = await callTavilySearch(message);
        
        // Construir prompt com resultados da pesquisa
        const response = await callGroqWithTavilyResults(message, searchResponse, conversationHistory);

        console.log('✅ Resposta da pesquisa Tavily gerada');

        return res.status(200).json({
            response: response,
            timestamp: new Date().toISOString(),
            sources: searchResponse.sources
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
    console.log('🔍 Fazendo pesquisa com Tavily API...');
    
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
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Pesquisa Tavily concluída:', data.results?.length || 0, 'resultados');
    
    return data;
}

async function callGroqWithTavilyResults(message, searchResults, conversationHistory) {
    console.log('🤖 Enviando resultados para Groq API...');

    // Verificar se é uma pergunta de acompanhamento
    const isFollowUp = conversationHistory?.length > 0 && (
        message?.toLowerCase()?.includes('explique mais') ||
        message?.toLowerCase()?.includes('detalhe') ||
        message?.toLowerCase()?.includes('pode falar mais') ||
        message?.toLowerCase()?.includes('me diga mais') ||
        message?.toLowerCase()?.includes('amplie') ||
        message?.toLowerCase()?.includes('aprofunde')
    );

    let systemPrompt;

    if (isFollowUp) {
        // Modo de conversação (sem pesquisa nova)
        systemPrompt = {
            role: 'system',
            content: `Você é o Drekee AI 1, um assistente inteligente brasileiro. Continue a conversa baseado no contexto anterior.

REGRAS:
1. RESPONDA SEMPRE EM PORTUGUÊS BRASILEIRO
2. Use linguagem natural e informal
3. Seja direto e claro
4. Use formatação simples: **negrito**, *itálico*, listas
5. NÃO pesquise na web - use apenas seu conhecimento
6. Mantenha o contexto da conversa anterior
7. Não adicione fontes (não há pesquisa nova)

CONTEXTO ANTERIOR:
${conversationHistory?.map(msg => `${msg?.role}: ${msg?.content}`)?.filter(Boolean)?.join('\n\n') || 'Nenhum contexto anterior.'}`
        };
    } else {
        // Modo de pesquisa com Tavily
        const searchContext = searchResults.results ? searchResults.results.map(result => 
            `Fonte: ${result.title} - ${result.url}\n${result.content.substring(0, 500)}...`
        ).join('\n\n') : '';

        systemPrompt = {
            role: 'system',
            content: `Você é o Drekee AI 1, um assistente de pesquisa inteligente brasileiro com acesso à web em tempo real através da Tavily AI. Sua especialidade é encontrar informações atuais e apresentá-las de forma **visualmente rica** e **interativa** para usuários brasileiros.

🎨 **FORMATOS AVANÇADOS DISPONÍVEIS:**

📊 **Tabelas Comparativas:**
| Característica | Opção A | Opção B |
| :--- | :--- | :--- |
| Preço | R$ 100 | R$ 200 |
| Qualidade | Alta | Premium |

📋 **Cards de Informação:**
[info: Informação importante para o usuário]
[warning: Alerta ou cuidado necessário]
[success: Resultado positivo ou confirmação]
[error: Erro ou problema a evitar]

📈 **Cards de Dados:**
[data: Crescimento | 85%]
[data: Usuários | 2.5M]

🏷️ **Tags e Badges:**
[tag: tecnologia]
[badge: exclusivo]

📊 **Barras de Progresso:**
[progress: 75% | Adoção no mercado]
[progress: 30% | Conclusão do projeto]

✨ **Listas Interativas:**
1. **Título:** Descrição detalhada do item
- **Conceito:** Explicação clara e objetiva

🎯 **Formatações Tradicionais:**
- **negrito** para palavras importantes
- *itálico* para ênfase
- __sublinhado__ para destaques especiais
- [destaque: palavra-chave] para cards de destaque
- [card: conceito] para cards informativos
- Emojis: :rocket:, :fire:, :star:, :check:, :warning:, :info:, :error:, :success:, :chart:, :trophy:

📋 **ESTRUTURA IDEAL DA RESPOSTA:**
1. **Título principal** usando ##
2. **Cards de informação** para dados importantes
3. **Tabelas** para comparações
4. **Listas interativas** para explicações
5. **Dados destacados** com cards [data:]
6. **Progress bars** para estatísticas
7. **Tags** para categorização
8. **Fontes** no final: Fonte: Site – "Título" (data)

🔍 **RESULTADOS DA PESQUISA TAVILY:**
${searchContext}

🔥 **USE SEMPRE FORMATAÇÕES RICAS!** Torne sua resposta visualmente impactante e fácil de entender!`
        };
    }

    // Construir mensagens com histórico
    const messages = [
        systemPrompt,
        ...conversationHistory.slice(-4), // Últimas 4 mensagens para contexto
        {
            role: 'user',
            content: message
        }
    ];

    // Verificar se a API key do Groq está configurada
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não configurada. Configure a variável de ambiente.');
    }

    // Tentar com modelo principal
    try {
        const response = await callWithMainModel(messages);
        return response;
    } catch (error) {
        console.warn('⚠️ Modelo principal falhou, tentando fallback:', error.message);
        const fallbackResponse = await callWithFallbackModel(messages);
        return fallbackResponse;
    }
}

async function callWithMainModel(messages) {
    console.log('🚀 Tentando modelo principal: openai/gpt-oss-120b');
    
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
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callWithFallbackModel(messages) {
    console.log('🔄 Usando modelo fallback: llama-3.1-8b-instant');
    
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
        throw new Error(`Fallback model also failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}
