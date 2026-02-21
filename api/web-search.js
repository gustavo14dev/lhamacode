// API endpoint para pesquisa na web
export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

    console.log('🔍 Recebida requisição de pesquisa:', { 
        message: message?.substring(0, 100) + '...', 
        historyLength: conversationHistory?.length || 0 
    });

    try {
        const response = await callGroqWithBrowserSearch(message, conversationHistory);

        console.log('✅ Resposta da pesquisa gerada');

        return res.status(200).json({
            response: response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro na API de pesquisa:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

async function callGroqWithBrowserSearch(message, conversationHistory) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
        // Fallback quando não há API key
        return `🔍 **Pesquisa Simulada**

Você perguntou: "${message}"

[fonte: Simulação Local]

*Esta é uma resposta simulada porque a API Groq não está configurada. Para testar com pesquisa real, configure a GROQ_API_KEY no ambiente.*

**Como configurar:**
1. Obtenha uma chave em https://console.groq.com
2. Adicione GROQ_API_KEY= sua_chave ao ambiente
3. Reinicie o servidor

[fonte: Documentação Drekee AI]`;
    }

    console.log('🔍 Iniciando chamada para Groq API...');

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
        // Modo de conversação (sem pesquisa)
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
        // Modo de pesquisa web
        systemPrompt = {
            role: 'system',
            content: `Você é o Drekee AI 1, um assistente de pesquisa inteligente brasileiro com acesso à web em tempo real. Sua especialidade é encontrar informações atuais e apresentá-las de forma **visualmente rica** e **interativa** para usuários brasileiros.

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

🎯 **EXEMPLO COMPLETO:**
## Análise de Mercado 2024

[info: O mercado de tecnologia cresceu 23% este ano]

📊 **Comparativo de Crescimento:**
| Setor | 2023 | 2024 |
| :--- | :--- | :--- |
| IA | 45% | 68% |
| Cloud | 32% | 41% |

[data: Investimento Total | R$ 8.5B]
[progress: 68% | Meta de Crescimento]

1. **Inteligência Artificial:** Liderou o crescimento com machine learning avançado
- **Machine Learning:** Processamento de big data em tempo real
- **Automação:** Redução de custos operacionais

[tag: inovação] [badge: tendência] [destaque: alta demanda]

🔥 **USE SEMPRE FORMATAÇÕES RICAS!** Torn sua resposta visualmente impactante e fácil de entender!`
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

    // Tentar com modelo principal
    try {
        console.log('📡 Tentando modelo principal: openai/gpt-oss-120b');
        return await callWithMainModel(message, systemPrompt, messages);
    } catch (error) {
        console.log('⚠️ Modelo principal falhou, tentando fallback:', error.message);
        try {
            console.log('📡 Tentando modelo fallback: llama-3.1-8b-instant');
            return await callWithFallbackModel(message, systemPrompt);
        } catch (fallbackError) {
            console.log('❌ Todos os modelos falharam:', fallbackError.message);
            throw new Error(`Todos os modelos de pesquisa falharam: ${fallbackError.message}`);
        }
    }
}

async function callWithMainModel(message, systemPrompt, messages) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    const requestBody = {
        model: 'openai/gpt-oss-120b',
        messages: messages,
        temperature: 0.3, // Menos criatividade, mais precisão
        max_tokens: 4096,
        top_p: 0.9,
        stream: false,
        tool_choice: "required",
        tools: [
            {
                type: "browser_search"
            }
        ]
    };

    console.log('📡 Enviando requisição para Groq com browser search...');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na API Groq:', response.status, errorText);
        
        // Tentar com modelo menor se o 70B falhar
        if (response.status === 429 || response.status === 502) {
            console.log('🔄 Tentando com modelo menor...');
            return await callWithSmallerModel(message, systemPrompt);
        }
        
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da API Groq');
    }

    const content = data.choices[0].message.content;
    console.log('✅ Resposta recebida do Groq');
    
    return content;
}

async function callWithSmallerModel(message, systemPrompt) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    const requestBody = {
        model: 'llama-3.1-8b-instant',
        messages: [
            systemPrompt,
            { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 2048,
        top_p: 0.9,
        stream: false,
        tool_choice: "required",
        tools: [
            {
                type: "browser_search"
            }
        ]
    };

    console.log('📡 Enviando requisição para Groq com modelo fallback...');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na API Groq (fallback):', response.status, errorText);
        throw new Error(`Groq API error (fallback): ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Resposta inválida da API Groq (fallback)');
    }

    console.log('✅ Resposta recebida do modelo fallback');
    return data.choices[0].message.content;
}
