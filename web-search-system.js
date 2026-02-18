export class WebSearchSystem {
    constructor(ui, agent) {
        this.ui = ui;
        this.agent = agent;
        this.tavilyApiKey = null;
        this.isWebSearchMode = false;
        this.tavilyUrl = 'https://api.tavily.com/search';
    }

    // ==================== CONTROLE DO MODO ====================
    
    toggleWebSearchMode() {
        this.isWebSearchMode = !this.isWebSearchMode;
        const webButton = document.getElementById('webSearchButton');
        
        if (this.isWebSearchMode) {
            webButton.classList.remove('border-gray-200', 'dark:border-gray-700', 'text-gray-600', 'dark:text-gray-300');
            webButton.classList.add('bg-primary', 'text-white', 'border-primary');
            console.log('🔍 Modo Pesquisa na Web ATIVADO');
        } else {
            webButton.classList.add('border-gray-200', 'dark:border-gray-700', 'text-gray-600', 'dark:text-gray-300');
            webButton.classList.remove('bg-primary', 'text-white', 'border-primary');
            console.log('🔍 Modo Pesquisa na Web DESATIVADO');
        }
        
        return this.isWebSearchMode;
    }

    isWebSearchEnabled() {
        return this.isWebSearchMode;
    }

    // ==================== API TAVILY ====================
    
    getTavilyApiKey() {
        // Em produção (Vercel), usar Environment Variables
        if (typeof window === 'undefined') {
            return process.env.TAVILY_API_KEY;
        }
        
        // Localmente, usar localStorage
        if (!this.tavilyApiKey) {
            this.tavilyApiKey = localStorage.getItem('tavily_api_key');
        }
        return this.tavilyApiKey;
    }

    setTavilyApiKey(apiKey) {
        this.tavilyApiKey = apiKey;
        localStorage.setItem('tavily_api_key', apiKey);
        console.log('✅ API Key Tavily salva com sucesso!');
    }

    async performWebSearch(query) {
        const apiKey = this.getTavilyApiKey();
        
        if (!apiKey) {
            throw new Error('Nenhuma API key Tavily configurada. Use: session.setTavilyKey("sua_chave_tavily")');
        }

        try {
            console.log('🔍 Pesquisando na web:', query);
            
            const response = await fetch(this.tavilyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    query: query,
                    search_depth: "advanced",
                    include_answer: true,
                    include_raw_content: false,
                    max_results: 8,
                    include_domains: [],
                    exclude_domains: [],
                    days: 7,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                throw new Error(`API Tavily retornou status ${response.status}`);
            }

            const data = await response.json();
            console.log('🔍 Resultados da pesquisa:', data);

            return {
                answer: data.answer || '',
                sources: data.results || [],
                query: query,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('❌ Erro na pesquisa web:', error);
            throw error;
        }
    }

    // ==================== PROCESSAMENTO ====================
    
    async processWebSearchQuery(userMessage) {
        try {
            // 1. Realizar pesquisa na web
            const searchResults = await this.performWebSearch(userMessage);
            
            // 2. Gerar resposta baseada nos resultados
            const aiResponse = await this.generateResponseFromSearch(searchResults, userMessage);
            
            // 3. Retornar resultado formatado
            return {
                response: aiResponse,
                sources: searchResults.sources,
                query: searchResults.query
            };

        } catch (error) {
            console.error('❌ Erro ao processar pesquisa web:', error);
            throw error;
        }
    }

    async generateResponseFromSearch(searchResults, originalQuery) {
        // Construir prompt com os resultados da pesquisa
        let promptContext = `Baseado nas seguintes informações da web, responda à pergunta: "${originalQuery}"\n\n`;
        
        if (searchResults.answer) {
            promptContext += `RESPOSTA DIRETA DA PESQUISA:\n${searchResults.answer}\n\n`;
        }
        
        promptContext += `FONTES ENCONTRADAS:\n`;
        searchResults.sources.forEach((source, index) => {
            promptContext += `${index + 1}. ${source.title}\n   ${source.content}\n   URL: ${source.url}\n\n`;
        });
        
        promptContext += `Instruções:\n`;
        promptContext += `- Responda de forma clara e objetiva\n`;
        promptContext += `- Baseie sua resposta nas informações encontradas\n`;
        promptContext += `- Se as informações forem contraditórias, mencione as diferentes perspectivas\n`;
        promptContext += `- Se não houver informação suficiente, diga isso claramente\n`;
        promptContext += `- Use formatação markdown para melhor legibilidade\n`;
        promptContext += `- NÃO invente informações que não estejam nas fontes`;

        // Usar a API existente para gerar resposta
        const response = await this.callAIForWebSearch(promptContext);
        return response;
    }

    async callAIForWebSearch(prompt) {
        // Usar o modelo rápido para processar a pesquisa
        const originalModel = this.agent.currentModel;
        this.agent.currentModel = 'rapido';
        
        try {
            const response = await fetch(this.agent.groqUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.agent.getGroqApiKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um assistente que analisa informações da web e fornece respostas baseadas apenas nas fontes fornecidas. Seja objetivo, claro e sempre cite as fontes quando possível.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } finally {
            // Restaurar modelo original
            this.agent.currentModel = originalModel;
        }
    }

    // ==================== FORMATAÇÃO DE RESULTADOS ====================
    
    formatWebSearchResponse(response, sources, query) {
        let formattedResponse = response;
        
        // Adicionar seção de fontes
        if (sources && sources.length > 0) {
            formattedResponse += '\n\n---\n\n## 🔍 Fontes da Pesquisa\n\n';
            
            sources.forEach((source, index) => {
                const title = source.title || 'Sem título';
                const url = source.url || '#';
                const domain = this.extractDomain(url);
                
                formattedResponse += `${index + 1}. **[${title}](${url})**\n`;
                formattedResponse += `   📁 ${domain}\n`;
                
                if (source.published_date) {
                    formattedResponse += `   📅 ${new Date(source.published_date).toLocaleDateString('pt-BR')}\n`;
                }
                
                formattedResponse += '\n';
            });
        }
        
        return formattedResponse;
    }

    extractDomain(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch (error) {
            return 'Fonte desconhecida';
        }
    }

    // ==================== UTILITÁRIOS ====================
    
    validateApiKey(apiKey) {
        return apiKey && apiKey.length > 20 && apiKey.startsWith('tvly-');
    }

    getSearchStats() {
        return {
            isWebSearchMode: this.isWebSearchMode,
            hasApiKey: !!this.getTavilyApiKey(),
            apiKeyLength: this.getTavilyApiKey()?.length || 0
        };
    }
}
