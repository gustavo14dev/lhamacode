import { MemorySystem } from './memory-system.js';
import { buildUserProfilePromptContext } from './user-profile.js';

export class Agent {

    constructor(ui) {
        this.ui = ui;
        this.groqApiKey = null;
        this.currentModel = 'raciocinio';
        this.groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.conversationHistory = [];
        this.maxHistoryMessages = 50;
        this.abortController = null;
        this.isGenerating = false;
        this.activeChatIdForGeneration = null;

        // Sistema de memÃ³ria
        this.memory = new MemorySystem();
        this.memory.loadFromLocalStorage();
    }

    setModel(model) {
        this.currentModel = model;
    }

    addToHistory(role, content) {
        if (!role || content == null) return;

        if (!Array.isArray(this.conversationHistory)) {
            this.conversationHistory = [];
        }

        const message = {
            role: String(role),
            content: typeof content === 'string' ? content : JSON.stringify(content)
        };

        this.conversationHistory.push(message);

        if (this.conversationHistory.length > this.maxHistoryMessages) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryMessages);
        }
    }

    async searchUnsplashImages(query) {
        if (this.ui && typeof this.ui.searchUnsplashImages === 'function') {
            try {
                return await this.ui.searchUnsplashImages(query);
            } catch (e) {
                console.warn('⚠️ searchUnsplashImages falhou na UI:', e);
            }
        }
        return [];
    }

    async searchWebForResponse(query) {
        if (this.ui && typeof this.ui.searchWebForResponse === 'function') {
            try {
                return await this.ui.searchWebForResponse(query);
            } catch (e) {
                console.warn('⚠️ searchWebForResponse falhou na UI:', e);
            }
        }

        // Fallback neutro
        return {
            query,
            sources: [],
            results: []
        };
    }

    getGroqApiKey() {
        if (!this.groqApiKey) {
            this.groqApiKey = localStorage.getItem('groq_api_key');
        }
        return this.groqApiKey;
    }

    getActiveChatId() {
        return this.activeChatIdForGeneration || this.ui.currentChatId || null;
    }

    getApiProvider() {
        if (this.apiProvider) return this.apiProvider;

        let provider = (localStorage.getItem('api_provider') || '').toString().toLowerCase();
        if (!provider) {
            provider = process.env?.DEFAULT_API_PROVIDER?.toString().toLowerCase() || 'groq';
        }

        if (!['groq', 'samba'].includes(provider)) {
            provider = 'groq';
        }

        this.apiProvider = provider;
        return provider;
    }

    setApiProvider(provider) {
        provider = (provider || '').toString().toLowerCase();
        if (['groq', 'samba'].includes(provider)) {
            this.apiProvider = provider;
            localStorage.setItem('api_provider', provider);
        }
    }

    normalizeModelForProvider(model, provider) {
        if (!model || typeof model !== 'string') return model;
        if (provider === 'samba') {
            const normalized = model.toLowerCase();
            if (normalized.includes('llama-3.1-8b') || normalized.includes('llama-3.1-8b-instant')) {
                return 'Meta-Llama-3.1-8B-Instruct';
            }
            if (normalized.includes('llama-3.3-70b') || normalized.includes('llama-3.3-70b-versatile')) {
                return 'Meta-Llama-3.3-70B-Instruct';
            }
            if (normalized.includes('llama-4-maverick-17b-128e') || normalized.includes('llama-4-maverick-17b-128e-instruct')) {
                return 'Llama-4-Maverick-17B-128E-Instruct';
            }
            // Preserve qwen / outros modelos conforme fornecido
            if (normalized.includes('meta-llama') || normalized.includes('qwen') || normalized.includes('gemma') || normalized.includes('openai')) {
                return model;
            }
            // Mapeamento genérico.
            return model;
        }
        return model;
    }

    persistAssistantMessage(content, options = {}) {
        const targetChatId = options.chatId || this.getActiveChatId();
        if (!targetChatId) {
            return null;
        }

        const message = {
            role: 'assistant',
            content: content == null ? '' : String(content)
        };

        if (options.thinking) {
            message.thinking = options.thinking;
        }

        if (Array.isArray(options.sources) && options.sources.length > 0) {
            message.sources = options.sources;
        }

        if (Array.isArray(options.attachments) && options.attachments.length > 0) {
            message.attachments = options.attachments;
        }

        if (Array.isArray(options.videos) && options.videos.length > 0) {
            message.videos = options.videos;
        }

        if (options.mode) {
            message.mode = options.mode;
        }

        if (options.agentContext) {
            message.agentContext = options.agentContext;
        }

        return this.ui.persistMessageToChat(targetChatId, message);
    }

    estimateTokens(text) {
        if (!text || typeof text !== "string") return 0;
        return Math.max(1, Math.round(text.length / 4));
    }

    getModelTokenCapacity(model) {
        const normalized = String(model || "").toLowerCase();
        if (normalized.includes("3.1-8b")) return 6000;
        if (normalized.includes("3.3-70b")) return 12000;
        if (normalized.includes("qwen")) return 6000;
        if (normalized.includes("4-maverick")) return 10000;
        return 6000;
    }

    calculateEffortPercentage({ model, userMessage = "", conversationHistory = [], webData = null, expectedResponseLength = 0 }) {
        const modelCapacity = this.getModelTokenCapacity(model);
        const userTokens = this.estimateTokens(userMessage);
        const historyTokens = conversationHistory.reduce((acc, m) => acc + this.estimateTokens(String(m.content || "")), 0);
        const webTokens = this.estimateTokens(JSON.stringify(webData || ""));
        const responseTokens = this.estimateTokens(String(expectedResponseLength || Math.max(1, userTokens) * 1.2));

        const total = userTokens + historyTokens + webTokens + responseTokens;
        const percentage = Math.min(100, Math.round((total / modelCapacity) * 100));

        return { percentage, total, modelCapacity, userTokens, historyTokens, webTokens, responseTokens };
    }

    updateEffortIndicator(percentage, warning) {
        if (this.ui && typeof this.ui.updateEffortIndicator === "function") {
            this.ui.updateEffortIndicator(percentage, warning);
        }
    }

    async ensureCapacityAndTrack({ model, userMessage, conversationHistory, webData }) {
        const effort = this.calculateEffortPercentage({ model, userMessage, conversationHistory, webData });
        if (effort.percentage >= 100) {
            this.updateEffortIndicator(100, "Desculpe, sou incapaz de realizar essa tarefa. A solicitação foi muito grande.");
            throw new Error("Capacidade excedida");
        }

        this.updateEffortIndicator(effort.percentage);
        return effort;
    }

    formatErrorMessage(error) {
        if (!error) return 'Erro desconhecido';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message || error.toString();

        try {
            return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        } catch (e) {
            return String(error);
        }
    }

    // Verificação rápida de API antes de processar
    async quickApiCheck() {
        const provider = this.getApiProvider();

        // Fazer uma requisição rápida para testar a API via proxy
        try {
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    provider,
                    model: this.normalizeModelForProvider('llama-3.1-8b-instant', provider),
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(`API retornou status ${response.status}: ${this.formatErrorMessage(data)}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Verificação rápida da API falhou:', this.formatErrorMessage(error));
            throw error;
        }
    }

    async callGroqAPI(model, customMessages = [], options = {}) {
        const provider = this.getApiProvider();
        const finalModel = this.normalizeModelForProvider(model, provider);
        const requestBody = {
            provider,
            model: finalModel,
            messages: Array.isArray(customMessages) ? customMessages : [],
            max_tokens: options.max_tokens || 1024,
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 1,
            stream: false,
            ...options.extra
        };

        try {
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            let data = null;
            try {
                data = await response.json();
            } catch (err) {
                throw new Error(`Erro ao decodificar resposta JSON da API: ${err.message}`);
            }

            if (!response.ok) {
                const detail = data?.error?.message || data?.error || data?.message || JSON.stringify(data);
                throw new Error(`API retornou status ${response.status}: ${detail}`);
            }

            if (!data || typeof data !== 'object') {
                throw new Error('Resposta inválida da API (sem dados)');
            }

            let text = '';
            if (Array.isArray(data.choices) && data.choices.length > 0) {
                text = (data.choices[0].message?.content || data.choices[0].text || '').trim();
            }

            if (!text && data?.output && Array.isArray(data.output) && data.output.length > 0) {
                text = String(data.output[0].content || data.output[0] || '').trim();
            }

            if (!text && typeof data?.result === 'string') {
                text = data.result.trim();
            }

            if (!text) {
                const fallbackError = data?.error || data?.choices?.[0]?.message?.content || JSON.stringify(data);
                throw new Error(`Resposta vazia ou inválida da API: ${this.formatErrorMessage(fallbackError)}`);
            }

            return text;
        } catch (error) {
            const message = this.formatErrorMessage(error);
            console.error(`❌ Erro em callGroqAPI (provider=${provider}, model=${finalModel}):`, message);
            throw new Error(message);
        }
    }

    async callGroqAPIWithBrowserSearch(model, messages) {
        return this.callGroqAPI(model, messages, { max_tokens: 1024 });
    }

    async processMessage(userMessage, attachedFilesFromUI = null) {
        this.activeChatIdForGeneration = this.ui.currentChatId;
        console.log('ðŸ“¨ Mensagem para processar:', userMessage.substring(0, 100) + '...');
        console.log('ðŸ“¨ Tamanho total:', userMessage.length, 'caracteres');

        // Verificar se Ã© o modo de investigaÃ§Ã£o
        if (window.isInvestigateMode) {
            // Obter contexto relevante da memÃ³ria primeiro
            const relevantContext = this.memory.getRelevantContext(userMessage);
            try {
                await this.processInvestigateModel(userMessage, attachedFilesFromUI, relevantContext);
            } finally {
                this.activeChatIdForGeneration = null;
            }
            return;
        }

        // Verificar se o usuÃ¡rio quer gerar uma imagem
        const imagePrompt = this.extractImageGenerationPrompt(userMessage);
        if (imagePrompt) {
            console.log('--------------------------------------------------');
            console.log('ðŸ¤– [MODELO UTILIZADO]: POLLINATIONS IMAGE');
            console.log('ðŸŽ¨ MOTIVO: SolicitaÃ§Ã£o de geraÃ§Ã£o de imagem detectada.');
            console.log('--------------------------------------------------');
            console.log('ðŸŽ¨ [DETECÃ‡ÃƒO] UsuÃ¡rio quer gerar imagem:', imagePrompt);
            try {
                await this.processImageGeneration(imagePrompt);
            } finally {
                this.activeChatIdForGeneration = null;
            }
            return;
        }

        // Adicionar mensagem Ã  memÃ³ria da conversa
        this.memory.addConversationMemory('user', userMessage);
    
        // Obter contexto relevante da memÃ³ria
        const relevantContext = this.memory.getRelevantContext(userMessage);
        console.log('ðŸ§  Contexto relevante encontrado:', relevantContext.length, 'memÃ³rias');

        // Verificar se hÃ¡ anexos
        const hasAttachments = (attachedFilesFromUI && attachedFilesFromUI.length > 0) || 
                              (this.lastParsedFiles && this.lastParsedFiles.length > 0) ||
                              (this.ui && this.ui.attachedFiles && this.ui.attachedFiles.length > 0);
        
        if (hasAttachments) {
            console.log('--------------------------------------------------');
            console.log('ðŸ¤– [MODELO UTILIZADO]: GEMINI (Google)');
            console.log('ðŸ“Ž MOTIVO: PresenÃ§a de anexos detectada.');
            console.log('--------------------------------------------------');
            
            // Prioridade de captura de anexos
            let filesToProcess = [];
            if (attachedFilesFromUI && attachedFilesFromUI.length > 0) {
                filesToProcess = attachedFilesFromUI;
            } else if (this.ui && this.ui.attachedFiles && this.ui.attachedFiles.length > 0) {
                filesToProcess = this.ui.attachedFiles;
            } else {
                filesToProcess = this.lastParsedFiles;
            }
            
            console.log('ðŸ“Ž Anexos encontrados:', filesToProcess.map(f => f.name));
            this.lastParsedFiles = filesToProcess;
        } else {
            console.log('--------------------------------------------------');
            console.log('ðŸ¤– [MODELO UTILIZADO]: GROQ (Llama/Mixtral)');
            console.log('ðŸ’¬ MOTIVO: Apenas texto, sem anexos.');
            console.log('--------------------------------------------------');
            // Se nÃ£o hÃ¡ anexos, limpa variÃ¡veis
            this.lastParsedFiles = [];
            this.extraMessagesForNextCall = null;
            this.useMistralForThisMessage = false;
            this.useImageModelForThisMessage = false;
        }

        this.isGenerating = true;
        this.ui.updateSendButtonToPause();
        
        try {
            if (hasAttachments) {
                console.log('ðŸ“Ž COM ANEXO detectado, usando Gemini API');
                await this.processGeminiModel(userMessage, this.lastParsedFiles, relevantContext);
            } else {
                console.log('ðŸ’¬ SEM ANEXO, usando modelo atual (Groq):', this.currentModel);
                
                // Usa o modelo selecionado (Groq)
                if (this.currentModel === 'rapido') {
                    await this.processRapidoModel(userMessage, relevantContext);
                } else if (this.currentModel === 'raciocinio') {
                    await this.processRaciocioModel(userMessage, relevantContext);
                } else if (this.currentModel === 'pro') {
                    await this.processProModel(userMessage, relevantContext);
                } else {
                    // Fallback para rapido se modelo nÃ£o reconhecido
                    await this.processRapidoModel(userMessage, relevantContext);
                }
            }
        } catch (error) {
            console.error('âŒ Erro no processamento da mensagem:', error);
            // Fallback final para Gemini em caso de qualquer erro crÃ­tico se nÃ£o for um cancelamento
            if (error.message !== 'ABORTED') {
                try {
                    await this.processGeminiModel(userMessage, attachedFilesFromUI, relevantContext);
                } catch (geminiError) {
                    this.ui.setResponseText('Desculpe, ocorreu um erro persistente em nossos modelos. Tente novamente mais tarde.', this.ui.createAssistantMessageContainer().responseId);
                }
            }
        }

        this.activeChatIdForGeneration = null;

        this.isGenerating = false;
        this.ui.updateSendButtonToSend();
    }

    async processInvestigateModel(userMessage, attachments = null, relevantContext = []) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const responseChatId = this.getActiveChatId();
        this.ui.setThinkingHeader('Deep Research em andamento...', messageContainer.headerId);
        
        // Texto de feedback inicial conforme solicitado
        this.ui.setResponseText('Trabalhando na sua solicitação ao Drekee Investigate 1.0, aguarde alguns minutos...', messageContainer.responseId);

        try {
            // Incrementar uso no localStorage (limite de 1)
            const currentUsage = parseInt(localStorage.getItem('drekee_investigate_usage') || '0');
            localStorage.setItem('drekee_investigate_usage', (currentUsage + 1).toString());

            const formData = new FormData();
            formData.append('message', userMessage);
            formData.append('context', JSON.stringify(relevantContext));
            formData.append('model', 'gemini-2.5-flash');
            
            if (attachments) {
                attachments.forEach((file, index) => {
                    formData.append(`file_${index}`, file.file || file);
                });
            }

            const response = await fetch('/api/gemini-chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Erro na API Investigate');
            
            const data = await response.json();
            const aiResponse = data.text || data.response;

            this.addToHistory('assistant', aiResponse);
            this.persistAssistantMessage(aiResponse);
            this.ui.setResponseText(aiResponse, messageContainer.responseId, async () => {
                await this.attachYouTubeVideosToResponse({
                    userMessage,
                    assistantResponse: aiResponse,
                    responseId: messageContainer.responseId,
                    chatId: responseChatId
                });
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
            // Desativar modo investigar apÃ³s o uso
            if (window.selectTool) window.selectTool('investigate');

        } catch (error) {
            console.error('Erro Investigate:', error);
            this.ui.setResponseText('❌ Desculpe, ocorreu um erro na investigação profunda. Tente novamente mais tarde.', messageContainer.responseId);
            this.ui.setThinkingHeader('', messageContainer.headerId);
        }
    }

    async processGeminiModel(userMessage, attachments = null, relevantContext = []) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const responseChatId = this.getActiveChatId();
        this.ui.setThinkingHeader('Raciocinando...', messageContainer.headerId);
        
        try {
            const formData = new FormData();
            formData.append('message', userMessage);
            formData.append('context', JSON.stringify(relevantContext));
            
            if (attachments) {
                attachments.forEach((file, index) => {
                    formData.append(`file_${index}`, file.file || file);
                });
            }

            const response = await fetch('/api/gemini-chat', { // Usando novo endpoint para chat e arquivos
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Erro na API Gemini');
            
            const data = await response.json();
            const aiResponse = data.text || data.response;

            this.addToHistory('assistant', aiResponse);
            this.persistAssistantMessage(aiResponse);
            this.ui.setResponseText(aiResponse, messageContainer.responseId, async () => {
                await this.attachYouTubeVideosToResponse({
                    userMessage,
                    assistantResponse: aiResponse,
                    responseId: messageContainer.responseId,
                    chatId: responseChatId
                });
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
        } catch (error) {
            console.error('Erro Gemini:', error);
            throw error;
        }
    }

    extractImageGenerationPrompt(userMessage = '') {
        const text = String(userMessage || '').trim();
        if (!text) {
            return '';
        }

        const patterns = [
            /^(?:gere|gera|crie|cria|criar|desenhe|produza|faÃ§a|faca)\b[\s\S]*?\bimagem\b(?:\s+(?:sobre|de|do|da|com))?\s+(.+)$/i,
            /^(?:imagem|foto|ilustracao|ilustraÃ§Ã£o)\s+(?:sobre|de|do|da|com)\s+(.+)$/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) {
                return match[1].trim();
            }
        }

        return '';
    }

    async processImageGeneration(prompt) {
        console.log(`ðŸŽ¨ [IMAGE-GEN] Processando geraÃ§Ã£o de imagem: "${prompt}"`);
        
        const messageContainer = this.ui.createAssistantMessageContainer();

        this.ui.setThinkingHeader('🎨 Gerando imagem...', messageContainer.headerId);
        await this.ui.sleep(500);

        try {
            const imageData = await this.generateImageWithPollinations(prompt);
            
            if (imageData && imageData.imageUrl) {
                console.log('âœ… [IMAGE-GEN] Imagem gerada com sucesso!');
                
                // Criar resposta com a imagem
                const response = `🎨 **Imagem gerada com sucesso!**

Aqui está sua imagem sobre: "${prompt}"`;
                
                // Adicionar ao histÃ³rico
                this.addToHistory('assistant', response);
                this.persistAssistantMessage(response);
                
                // Exibir resposta
                this.ui.setResponseText(response, messageContainer.responseId, async () => {
                    // Adicionar imagem gerada
                    const fallbackCandidates = Array.isArray(imageData.fallbackCandidates) ? imageData.fallbackCandidates : [];
                    const encodedFallbacks = encodeURIComponent(JSON.stringify(fallbackCandidates));
                    const openUrl = imageData.openUrl || imageData.imageUrl;
                    const imageHtml = `
                        <div style="margin-top: 15px; text-align: center;">
                            <img src="${imageData.imageUrl}" alt="Imagem gerada: ${prompt}" 
                                 data-fallbacks="${encodedFallbacks}"
                                 data-fallback-index="0"
                                 data-open-url="${openUrl}"
                                 referrerpolicy="no-referrer"
                                 crossorigin="anonymous"
                                 onerror="window.handleGeneratedImageFallback && window.handleGeneratedImageFallback(this)"
                                 style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); cursor: pointer;"
                                 onclick="window.open(this.dataset.openUrl || this.src, '_blank')"
                                 title="Clique para ampliar">
                            <div style="margin-top: 8px; font-size: 12px; color: #6b7280; font-style: italic;">
                                🎨 Gerado por Pollinations • ${prompt}
                            </div>
                        </div>
                    `;
                    
                    const responseDiv = document.getElementById(messageContainer.responseId);
                    if (responseDiv) {
                        responseDiv.insertAdjacentHTML('beforeend', imageHtml);
                    }
                });
                
                // Limpar header de processamento
                this.ui.setThinkingHeader('', messageContainer.headerId);
                
            } else {
                throw new Error('Não foi possível gerar a imagem');
            }
            
        } catch (error) {
            console.error('Erro na geração de imagem:', error);
            
            // Tratar mensagem de erro especÃ­fica
            let errorMessage = '❌ Desculpe, não foi possível gerar a imagem. Tente novamente.';
            if (error.message.includes('Muitas solicitações')) {
                errorMessage = '⏳ Muitas solicitações! Tente novamente em alguns segundos.';
            }
            
            this.ui.setResponseText(errorMessage, messageContainer.responseId);
            this.ui.setThinkingHeader('', messageContainer.headerId);
        }
    }

    // ==================== MODELO DE PESQUISA (openai/gpt-oss-20b com browser search) ====================
    async processPesquisaModel(userMessage, relevantContext = []) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const responseChatId = this.getActiveChatId();
        const timestamp = Date.now();
        
        this.ui.setThinkingHeader('🔍 Pesquisando...', messageContainer.headerId);
        await this.ui.sleep(800);
        
        this.addToHistory('user', userMessage);
        
        // Iniciar busca de imagens em paralelo
        const imagesPromise = this.searchUnsplashImages(userMessage);

        try {
            // Construir prompt com contexto da memÃ³ria
            let memoryContext = '';
            if (relevantContext.length > 0) {
                memoryContext = '\n\nCONTEXTO RELEVANTE DA CONVERSA:\n';
                relevantContext.forEach((memory, index) => {
                    memoryContext += `${index + 1}. ${memory.role.toUpperCase()}: "${memory.content}" (Contexto: ${memory.context})\n`;
                });
                memoryContext += '\nUse este contexto para fornecer respostas mais personalizadas e relevantes.';
            }
            
            const systemPrompt = {
                role: 'system',
                content: `Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa com acesso à web em tempo real! Você é como um amigo brilhante que sabe de tudo, desde física quântica até como fazer a melhor pizza do mundo. Sua personalidade é cativante: você é perspicaz, surpreendente e sempre traz uma perspectiva interessante. Adora usar analogias inteligentes, fazer conexões inesperadas entre assuntos diferentes e compartilhar conhecimento de forma fascinante.

INSTRUÇÕES ESPECÍFICAS PARA PESQUISA WEB:
1. Forneça respostas completas, detalhadas e extensas.
2. Use as fontes disponíveis sem depender cegamente de uma única fonte.
3. Extraia o máximo de informações realmente úteis de cada fonte.
4. Organize a resposta em seções claras com títulos quando fizer sentido.
5. Inclua dados específicos, estatísticas, datas e exemplos concretos quando forem relevantes.
6. Faça conexões entre diferentes fontes.
7. Adicione contexto e análises profundas quando agregarem valor.
8. Use formatação rica: **negrito**, *itálico*, listas numeradas e bullet points.
9. Cite as fontes de forma natural no texto.
10. Termine com uma conclusão ou perspectiva futura quando isso ajudar.

Pesquise informações atuais e forneça respostas baseadas em fontes confiáveis, mas sempre com seu toque genial único. Seja claro, direto e completo, sem exagerar nem fugir do pedido principal.${memoryContext}`
            };
            
            const messages = [
                systemPrompt,
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            console.log('ðŸ” Usando modelo de pesquisa: openai/gpt-oss-20b');
            let response = await this.callGroqAPIWithBrowserSearch('openai/gpt-oss-20b', messages);    
            
            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor de pesquisa');
            }
            
            // Armazenar e salvar a mensagem do assistente
            this.persistAssistantMessage(response);
            
            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA Ã  memÃ³ria e aprender com a interaÃ§Ã£o
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
              // Adicionar imagens DEPOIS do texto (para nÃ£o serem sobrescritas)
              console.log('ðŸ”„ [DEBUG] Adicionando imagens DEPOIS do texto...');
              const images = await imagesPromise;
              console.log('ðŸ“¦ [DEBUG] Imagens recebidas:', images);
              
              if (images && images.length > 0) {
                  console.log('âœ… [DEBUG] Adicionando imagens DEPOIS da resposta');
                  this.ui.appendImagesToMessage(messageContainer.responseId, images);
              } else {
                  console.log('âŒ [DEBUG] Nenhuma imagem encontrada ou array vazio');
              }
              // Gerar sugestÃµes de acompanhamento sÃ³ quando resposta estiver completa
                await this.attachYouTubeVideosToResponse({
                    userMessage,
                    assistantResponse: response,
                    responseId: messageContainer.responseId,
                    chatId: responseChatId
                });
                this.generateFollowUpSuggestions(userMessage, response, messageContainer.responseId);
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
          this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua pesquisa. ' + error.message, messageContainer.responseId);
            console.error('Erro no Modelo de Pesquisa:', error);
        }
    }

    // ==================== MODELO DE IMAGEM (meta-llama/llama-4-scout-17b-16e-instruct) ====================
    async processImageModel(userMessage, relevantContext = []) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        
        this.ui.setThinkingHeader('🖼️ Analisando imagem...', messageContainer.headerId);
        await this.ui.sleep(800);
        
        this.addToHistory('user', userMessage);
        
        try {
            // BUSCAR IMAGENS PRIMEIRO - antes de chamar a API
            console.log('ðŸ”„ [DEBUG-IMAGEM] Buscando imagens ANTES da resposta...');
            const images = await this.searchUnsplashImages(userMessage);
            console.log('ðŸ“¦ [DEBUG-IMAGEM] Imagens recebidas:', images);
            
            // Adicionar imagens ANTES da resposta
            if (images && images.length > 0) {
                console.log('âœ… [DEBUG-IMAGEM] Adicionando imagens ANTES da resposta');
                this.ui.appendImagesToMessage(`responseText_${messageContainer}`, images);
            }
            
            // Construir prompt com contexto da memÃ³ria
            let memoryContext = '';
            if (relevantContext.length > 0) {
                memoryContext = '\n\nCONTEXTO RELEVANTE DA CONVERSA:\n';
                relevantContext.forEach((memory, index) => {
                    memoryContext += `${index + 1}. ${memory.role.toUpperCase()}: "${memory.content}" (Contexto: ${memory.context})\n`;
                });
                memoryContext += '\nUse este contexto para fornecer respostas mais personalizadas e relevantes.';
            }
            
            const systemPrompt = {
                role: 'system',
                content: `Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa com capacidade de analisar imagens. Você processa texto e imagens com precisão, descreve elementos visuais, identifica conteúdo relevante e responde de forma clara, útil e detalhada, sem perder naturalidade.${memoryContext}`
            };
            
            // Combinar system prompt com as mensagens de imagem
            const messages = [systemPrompt, ...this.extraMessagesForNextCall];
            
            console.log('ðŸ–¼ï¸ Usando modelo de imagem: meta-llama/llama-4-scout-17b-16e-instruct');
            let response = await this.callGroqAPI('meta-llama/llama-4-scout-17b-16e-instruct', messages);
            this.extraMessagesForNextCall = null;
            
            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor de imagem');
            }
            
            // Armazenar e salvar a mensagem do assistente
            this.persistAssistantMessage(response);
            
            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA Ã  memÃ³ria e aprender com a interaÃ§Ã£o
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            // PRIMEIRO: Adicionar imagens ANTES da resposta
            console.log('ðŸ”„ [DEBUG] Adicionando imagens ANTES da resposta...');
            const imagesData = await imagesPromise;
            console.log('ðŸ“¦ [DEBUG] Imagens recebidas:', imagesData);
            
            if (imagesData && imagesData.length > 0) {
                console.log('âœ… [DEBUG] Adicionando imagens ANTES da resposta');
                this.ui.appendImagesToMessage(messageContainer.responseId, imagesData);
            } else {
                console.log('âŒ [DEBUG] Nenhuma imagem encontrada ou array vazio');
            }
            
            // SEGUNDO: Adicionar resposta
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                // Gerar sugestÃµes de acompanhamento sÃ³ quando resposta estiver completa
                this.generateFollowUpSuggestions(userMessage, response, messageContainer.responseId);
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua imagem. ' + error.message, messageContainer.responseId);
            console.error('Erro no Modelo de Imagem:', error);
        }
    }

    // ==================== MODELO MISTRAL (codestral-latest) ====================
    async processMistralModel(userMessage, relevantContext = []) {
        // Usamos proxy server-side; nÃ£o Ã© obrigatÃ³rio ter chave no localStorage para o deploy no Vercel
        const messageContainer = this.ui.createAssistantMessageContainer();
        const responseChatId = this.getActiveChatId();
        const timestamp = Date.now();
        this.ui.setThinkingHeader('Processando com Mistral (codestral-latest)...', messageContainer.headerId);
        await this.ui.sleep(800);
        this.addToHistory('user', userMessage);
        
        // Iniciar busca de imagens em paralelo
        const imagesPromise = this.searchUnsplashImages(userMessage);

        try {
            // Gerar checks antes da chamada Mistral para mostrar raciocÃ­nio tambÃ©m neste fluxo
            const thinkingChecks = await this.generateChecksSafely(userMessage);
            for (let i = 0; i < thinkingChecks.length; i++) {
                const stepId = `step_${timestamp}_${i}`;
                const checkText = thinkingChecks[i].step;
                this.ui.addThinkingStep('schedule', checkText, stepId, messageContainer.stepsId);
                const delay = 800 + Math.random() * 1200;
                await this.ui.sleep(delay);
                this.ui.updateThinkingStep(stepId, 'check_circle', checkText);
                await this.ui.sleep(200);
            }

            // Construir prompt com contexto da memÃ³ria
            let memoryContext = '';
            if (relevantContext.length > 0) {
                memoryContext = '\n\nCONTEXTO RELEVANTE DA CONVERSA:\n';
                relevantContext.forEach((memory, index) => {
                    memoryContext += `${index + 1}. ${memory.role.toUpperCase()}: "${memory.content}" (Contexto: ${memory.context})\n`;
                });
                memoryContext += '\nUse este contexto para fornecer respostas mais personalizadas e relevantes.';
            }
            
            let systemPrompt = {
                role: 'system',
                content: `Você é o Drekee AI 1, um assistente de código inteligente com memória contextual. Forneça respostas COMPLETAS e ESTRUTURADAS com: múltiplos parágrafos bem organizados, **palavras em negrito** para destacar conceitos, listas com • ou números, tópicos claros com headings, e quando apropriado use tabelas (em formato markdown), notação matemática (com $símbolos$ para inline ou $$blocos$$), e diagramas em ASCII. Evite blocos enormes de código, prefira explicações visuais. Seja técnico, claro e acessível.${memoryContext}`
            };
            const messages = this.extraMessagesForNextCall ? [systemPrompt, ...this.extraMessagesForNextCall, ...this.conversationHistory] : [systemPrompt, ...this.conversationHistory];

            // Chamamos o proxy server-side para Mistral (usar MISTRAL_API_KEY no servidor)
            let response = await this.callMistralAPI('codestral-latest', messages);
            this.extraMessagesForNextCall = null;

            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor Mistral');
            }

            // Tentar extrair arquivos gerados na resposta e anexÃ¡-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(response);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    // Remover o bloco de arquivos do texto antes de exibir para usuÃ¡rio
                    response = response.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta Mistral:', e);
            }

            // Armazenar e salvar a mensagem do assistente (incluindo attachments, se houver) ANTES de renderizar para que o UI possa detectÃ¡-los
            const parsedFiles = this.parseFilesFromText(response);
            this.persistAssistantMessage(response, {
                attachments: parsedFiles && parsedFiles.length > 0 ? parsedFiles : []
            });

            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA Ã  memÃ³ria e aprender com a interaÃ§Ã£o
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            // PRIMEIRO: Adicionar imagens ANTES da resposta
            await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
            
            // SEGUNDO: Adicionar resposta
            this.ui.setResponseText(response, messageContainer.responseId);
            await this.ui.sleep(500);
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                // Gerar sugestÃµes de acompanhamento sÃ³ quando resposta estiver completa
                this.generateFollowUpSuggestions(userMessage, response, messageContainer.responseId);
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('âš ï¸ GeraÃ§Ã£o interrompida pelo usuÃ¡rio');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem na API Mistral. ' + error.message, messageContainer.responseId);
            console.error('Erro no Modelo Mistral:', error);
        }
    }

    async callMistralAPI(model, messages) {
        // Usa unified-proxy server-side /api/unified-proxy
        this.abortController = new AbortController();
        try {
            const response = await fetch('/api/unified-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    service: 'mistral',
                    model: model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2048
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const status = response.status;
                const text = await response.text().catch(() => null);
                if (status === 500 && text && text.includes('MISTRAL_API_KEY is not configured')) {
                    throw new Error('Mistral API Key não está configurada no servidor. Adicione MISTRAL_API_KEY nas Environment Variables do Vercel.');
                }
                if (status === 401) {
                    throw new Error('Invalid API Key Mistral: verifique sua chave no Vercel para MISTRAL_API_KEY');
                }
                throw new Error(text || `Erro HTTP ${status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('ABORTED');
            }
            throw error;
        }
    }

    stopGeneration() {
        console.log('ðŸ›‘ Parando geraÃ§Ã£o...');
        this.isGenerating = false;
        if (this.abortController) {
            this.abortController.abort();
        }
        this.ui.showInterruptedMessage();
        this.ui.updateSendButtonToSend();
    }

    // Tenta extrair bloco ---FILES-JSON--- ... ---END-FILES-JSON--- e retornar array de arquivos
    parseFilesFromText(text) {
        try {
            const m = text.match(/---FILES-JSON---\s*([\s\S]*?)\s*---END-FILES-JSON---/i);
            if (!m) return null;
            const parsed = JSON.parse(m[1]);
            if (parsed && Array.isArray(parsed.files)) return parsed.files;
            return null;
        } catch (e) {
            console.warn('âš ï¸ Falha ao parsear blocos de arquivos:', e);
            return null;
        }
    }

    // Gera checks chamando Groq com tolerÃ¢ncia a falhas
    async generateChecksSafely(userMessage) {
        try {
            const checksResponse = await this.callGroqAPI('llama-3.1-8b-instant', [
                {
                    role: 'system',
                    content: 'VocÃª Ã© um gerador de checklist de pensamento. Baseado na pergunta/tarefa do usuÃ¡rio, gere de 3 a 10 etapas de pensamento que uma IA deveria fazer para responder bem. Retorne APENAS um JSON array com objetos {step: "texto da etapa"}. Exemplo: [{"step": "Analisando a pergunta"}, {"step": "Consultando dados"}]'
                },
                {
                    role: 'user',
                    content: `Gere os passos de pensamento para esta tarefa: "${userMessage.substring(0, 200)}"`
                }
            ]);

            // Tentar parse tolerante
            let jsonText = null;
            const arrayMatch = checksResponse.match(/\[[\s\S]*?\]/);
            const fencedJsonMatch = checksResponse.match(/```json\s*([\s\S]*?)```/i) || checksResponse.match(/```\s*([\s\S]*?)```/);
            if (arrayMatch) {
                jsonText = arrayMatch[0];
            } else if (fencedJsonMatch) {
                jsonText = fencedJsonMatch[1];
            }

            if (jsonText) {
                return JSON.parse(jsonText);
            }

            const lines = checksResponse.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const listItems = lines.filter(l => /^(\-|\*|\d+\.)\s+/.test(l)).map(l => {
                const s = l.replace(/^(\-|\*|\d+\.)\s+/, '');
                return { step: s };
            });
            if (listItems.length > 0) return listItems;

            // fallback
            return [
                { step: 'Analisando a pergunta' },
                { step: 'Consultando modelo Llama 3' },
                { step: 'Processando dados' },
                { step: 'Estruturando resposta' }
            ];
        } catch (e) {
            console.warn('âš ï¸ Erro ao gerar checks, usando padrÃ£o:', e);
            return [
                { step: 'Analisando a pergunta' },
                { step: 'Consultando modelo Llama 3' },
                { step: 'Processando dados' },
                { step: 'Estruturando resposta' }
            ];
        }
    }

    // Helper para exibir imagens se disponÃ­veis (usado por todos os modelos)
    async displayImagesIfAvailable(imagesPromise, messageId) {
        try {
            const images = await imagesPromise;
            if (images && images.length > 0) {
                this.ui.appendImagesToMessage(`responseText_msg_${messageId}`, images);
            }
        } catch (e) {
            console.error('Erro ao carregar imagens:', e);
        }
    }

    // Anexa arquivos parseados ao objeto de chat para reutilizaÃ§Ã£o em chamadas futuras
    attachGeneratedFilesToChat(files) {
        try {
            const targetChatId = this.getActiveChatId();
            const chat = this.ui.chats.find(c => c.id === targetChatId);
            if (!chat) return;
            chat.generatedFiles = chat.generatedFiles || [];
            // substituir arquivos com mesmo nome
            files.forEach(f => {
                const idx = chat.generatedFiles.findIndex(x => x.name === f.name);
                if (idx >= 0) chat.generatedFiles[idx] = f; else chat.generatedFiles.push(f);
            });
            this.ui.saveCurrentChat(targetChatId);
        } catch (e) {
            console.warn('âš ï¸ Falha ao anexar arquivos ao chat:', e);
        }
    }
    // parseFilesFromMessage removed (attachment parsing disabled)

    // ==================== MODELO RÃPIDO ====================
    async processRapidoModel(userMessage) {
        // Usamos proxy server-side (/api/groq-proxy) que utiliza GROQ_API_KEY em Vercel.
        // NÃ£o Ã© necessÃ¡rio ter chave no localStorage para deploy em produÃ§Ã£o.

        const messageContainer = this.ui.createRapidMessageContainer();
        const responseChatId = this.getActiveChatId();
        const timestamp = Date.now();

        // Adicionar texto simples de carregamento com pontinhos pulsando
        const thinkingHeader = document.getElementById(messageContainer.headerId);
        if (thinkingHeader) {
            thinkingHeader.innerHTML = '<span class="inline-flex gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s"></span></span>';
            thinkingHeader.className = 'text-base leading-relaxed text-gray-500 dark:text-gray-400';
        }

        this.addToHistory('user', userMessage);
        
        try {
            // BUSCAR IMAGENS E INFORMAÃ‡Ã•ES WEB EM PARALELO - antes de chamar a API
            console.log('ðŸ”„ [DEBUG-RAPIDO] Buscando imagens e informaÃ§Ãµes web ANTES da resposta...');
            const imagesPromise = this.searchUnsplashImages(userMessage);
            const webSearchPromise = this.searchWebForResponse(userMessage);
            
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('ðŸ“¦ [DEBUG-RAPIDO] Imagens recebidas:', images);
            console.log('ðŸŒ [DEBUG-RAPIDO] Dados web recebidos:', webData);
            
            // Adicionar imagens ANTES da resposta
            if (images && images.length > 0) {
                console.log('âœ… [DEBUG-RAPIDO] Adicionando imagens ANTES da resposta');
                this.ui.appendImagesToMessage(messageContainer.responseId, images);
            }
            
            const finalMessages = [
                { role: 'system', content: this.getSystemPrompt('rapido') + this.buildWebContextBlock(webData) },
                ...(this.extraMessagesForNextCall || []),
                ...this.conversationHistory
            ];

            const model = 'llama-3.1-8b-instant';
            await this.ensureCapacityAndTrack({
                model,
                userMessage,
                conversationHistory: this.conversationHistory,
                webData
            });

            // Forçar SambaNova para modo rápido como solicitado
            this.setApiProvider('samba');
            console.log('ðŸ“‹ [DEBUG-RAPIDO] API provider definido para SambaNova via SAMBA_API_KEY');

            let response = await this.callGroqAPI(model, finalMessages);
            console.log('ðŸ” [DEBUG-RAPIDO] Resposta da API recebida:', response ? response.substring(0, 100) + '...' : 'NULO');
            console.log('ðŸ” [DEBUG-RAPIDO] Tipo da resposta:', typeof response);
            console.log('ðŸ” [DEBUG-RAPIDO] Tamanho da resposta:', response ? response.length : 0);
            
            // limpar extras para prÃ³xima chamada
            this.extraMessagesForNextCall = null;

            // Adicionar apenas o texto ao histÃ³rico para manter consistÃªncia
            this.addToHistory('assistant', response);
            
            // Exibir na UI usando o mÃ©todo padrÃ£o que suporta HTML
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                console.log('ðŸ”„ [DEBUG-RAPIDO] Resposta exibida apÃ³s imagens');

                // Adicionar botÃ£o de fontes se houver dados web
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }

                // Mostrar botÃµes de aÃ§Ã£o quando resposta estiver completa
                await this.attachYouTubeVideosToResponse({
                    userMessage,
                    assistantResponse: response,
                    responseId: messageContainer.responseId,
                    chatId: responseChatId
                });

                const actionsDiv = document.getElementById(messageContainer.actionsId);
                if (actionsDiv) {
                    actionsDiv.classList.remove('opacity-0');
                    actionsDiv.classList.add('opacity-60', 'hover:opacity-100');
                }
            });
            
            // Limpar texto de carregamento apÃ³s um pequeno delay
            setTimeout(() => {
                if (thinkingHeader) {
                    thinkingHeader.textContent = '';
                }
            }, 100);
            
            this.persistAssistantMessage(response);

        } catch (error) {
            const errorMessage = error && typeof error.message === 'string' ? error.message : String(error);
            if (errorMessage === 'ABORTED') {
                console.log('âš ï¸ GeraÃ§Ã£o interrompida pelo usuÃ¡rio');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. ' + errorMessage, messageContainer.responseId);
            console.error('Erro no Modelo Rápido:', error);
        }
    }

    // ==================== MODELO RACIOCÃNIO ====================
    async processRaciocioModel(userMessage) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('Processando raciocÃ­nio...', messageContainer.headerId);
        await this.ui.sleep(300);

        this.addToHistory('user', userMessage);
        
        try {
            // Buscar dados web antes de chamar a API
            const imagesPromise = this.searchUnsplashImages(userMessage);
            const webSearchPromise = this.searchWebForResponse(userMessage);
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('ðŸ“¦ [RACIOCINIO] Imagens recebidas:', images);
            console.log('ðŸŒ [RACIOCINIO] Dados web recebidos:', webData);
            const finalMessages = [
                { role: 'system', content: this.getSystemPrompt('raciocinio') + this.buildWebContextBlock(webData) },
                ...(this.extraMessagesForNextCall || []),
                ...this.conversationHistory
            ];
            
            const primaryModel = 'qwen/qwen3-32b';
            const fallbackModel = 'llama-3.1-8b-instant';

            await this.ensureCapacityAndTrack({
                model: primaryModel,
                userMessage,
                conversationHistory: this.conversationHistory,
                webData
            });

            this.setApiProvider('groq');
            let fullResponse;
            try {
                console.log('ðŸ§ Usando modelo de raciocínio: qwen/qwen3-32b');
                fullResponse = await this.callGroqAPI(primaryModel, finalMessages);
            } catch (e) {
                console.warn('ðŸ– fallback raciocínio para SambaNova 3.1-8B-Instruct:', e);
                this.setApiProvider('samba');
                fullResponse = await this.callGroqAPI(fallbackModel, finalMessages);
            }

            console.log('ðŸ“„ Resposta bruta da API:', fullResponse);
            // Extrair raciocÃ­nio das tags <raciocÃ­nio>
            let reasoningText = '';
            let finalResponse = fullResponse;
            
            // Tentar extrair raciocÃ­nio das tags (mÃºltiplos padrÃµes)
            let reasoningMatch = fullResponse.match(/<raciocÃ­nio>([\s\S]*?)<\/raciocÃ­nio>/i);
            if (!reasoningMatch) {
                // Tentar outros padrÃµes possÃ­veis
                reasoningMatch = fullResponse.match(/<raciocinio>([\s\S]*?)<\/raciocinio>/i);
            }
            if (!reasoningMatch) {
                // Tentar sem acento
                reasoningMatch = fullResponse.match(/<raciocinio>([\s\S]*?)<\/raciocinio>/i);
            }
            if (!reasoningMatch) {
                // Tentar detectar raciocÃ­nio manualmente (comeÃ§a com "RaciocÃ­nio:")
                const manualMatch = fullResponse.match(/^RaciocÃ­nio:[\s\S]*?(?=\n\n|\n[A-Z]|\n#|\n\*|Resposta|Final|$)/im);
                if (manualMatch) {
                    reasoningText = manualMatch[0].replace(/^RaciocÃ­nio:\s*/i, '').trim();
                    finalResponse = fullResponse.replace(/^RaciocÃ­nio:[\s\S]*?(?=\n\n|\n[A-Z]|\n#|\n\*|Resposta|Final|$)/im, '').trim();
                    console.log('ðŸ§  RaciocÃ­nio extraÃ­do manualmente:', reasoningText.substring(0, 100) + '...');
                }
            }
            
            if (reasoningMatch) {
                reasoningText = reasoningMatch[1].trim();
                // Remover as tags de raciocÃ­nio da resposta final
                finalResponse = fullResponse.replace(/<raciocÃ­nio>[\s\S]*?<\/raciocÃ­nio>/gi, '').trim();
                finalResponse = finalResponse.replace(/<raciocinio>[\s\S]*?<\/raciocinio>/gi, '').trim();
                
                // Limpeza AGRESSIVA: remover qualquer texto que pareÃ§a raciocÃ­nio
                finalResponse = finalResponse.replace(/^RaciocÃ­nio:[\s\S]*?(?=\n\n|\n[A-Z]|\n#|\n\*|Resposta|Final|$)/gim, '').trim();
                finalResponse = finalResponse.replace(/^Pensando:[\s\S]*?(?=\n\n|\n[A-Z]|\n#|\n\*|Resposta|Final|$)/gim, '').trim();
                finalResponse = finalResponse.replace(/^AnÃ¡lise:[\s\S]*?(?=\n\n|\n[A-Z]|\n#|\n\*|Resposta|Final|$)/gim, '').trim();
                
                // Remover linhas em branco extras
                finalResponse = finalResponse.replace(/^\n+/gm, '').trim();
                
                console.log('ðŸ§  RaciocÃ­nio extraÃ­do:', reasoningText.substring(0, 100) + '...');
                console.log('ðŸ“ Resposta final limpa:', finalResponse.substring(0, 100) + '...');
            } else {
                console.log('âš ï¸ Nenhuma tag <raciocÃ­nio> encontrada na resposta');
                console.log('ðŸ“ ConteÃºdo da resposta (primeiros 200 chars):', fullResponse.substring(0, 200));
            }
            
            // Tentar extrair arquivos gerados na resposta e anexÃ¡-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(finalResponse);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    finalResponse = finalResponse.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('âš ï¸ Falha parsing arquivos de resposta (RaciocÃ­nio):', e);
            }

            this.addToHistory('assistant', finalResponse);
            const responseAttachments = this.parseFilesFromText(finalResponse);
            this.persistAssistantMessage(finalResponse, {
                attachments: responseAttachments && responseAttachments.length > 0 ? responseAttachments : []
            });
            
            // Mostrar "Pensando..." enquanto processa
            this.ui.setThinkingHeader('Pensando...', messageContainer.headerId);
            
            // Mostrar resposta final com animaÃ§Ã£o letra por letra
            // PRIMEIRO: Adicionar imagens ANTES da resposta
            await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
            
            // SEGUNDO: Mostrar resposta
            this.ui.setResponseText(finalResponse, messageContainer.responseId, async () => {
                // Limpar "Pensando..." quando terminar
                this.ui.setThinkingHeader('', messageContainer.headerId);
                
                // TERCEIRO: Adicionar botÃ£o de fontes se houver dados web
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }
                
                // Gerar sugestÃµes de acompanhamento sÃ³ quando resposta estiver completa
                await this.attachYouTubeVideosToResponse({
                    userMessage,
                    assistantResponse: finalResponse,
                    responseId: messageContainer.responseId,
                    chatId: responseChatId
                });
                this.generateFollowUpSuggestions(userMessage, finalResponse, messageContainer.responseId);
            });
            
            // Mostrar botÃ£o "Mostrar raciocÃ­nio" se houver raciocÃ­nio
            if (reasoningText) {
                const showBtn = document.getElementById(messageContainer.showId);
                if (showBtn) {
                    showBtn.classList.remove('hidden');
                    showBtn.innerHTML = `
                        <span class="material-icons-outlined text-sm">expand_more</span>
                        Mostrar RaciocÃ­nio
                    `;
                    
                    // Adicionar evento para mostrar/ocultar raciocÃ­nio
                    showBtn.onclick = () => {
                        const stepsDiv = document.getElementById(messageContainer.stepsId);
                        if (stepsDiv) {
                            if (stepsDiv.classList.contains('hidden')) {
                                // Mostrar raciocÃ­nio
                                stepsDiv.classList.remove('hidden');
                                stepsDiv.innerHTML = `
                                    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                        <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${reasoningText}</div>
                                    </div>
                                `;
                                showBtn.innerHTML = `
                                    <span class="material-icons-outlined text-sm">expand_less</span>
                                    Ocultar RaciocÃ­nio
                                `;
                            } else {
                                // Ocultar raciocÃ­nio
                                stepsDiv.classList.add('hidden');
                                showBtn.innerHTML = `
                                    <span class="material-icons-outlined text-sm">expand_more</span>
                                    Mostrar RaciocÃ­nio
                                `;
                            }
                        }
                    };
                }
            }
            
            // Mostrar botÃµes de aÃ§Ã£o quando resposta estiver completa
            const actionsDiv = document.getElementById(messageContainer.actionsId);
            if (actionsDiv) {
                actionsDiv.classList.remove('opacity-0');
                actionsDiv.classList.add('opacity-60', 'hover:opacity-100');
            }

        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('âš ï¸ GeraÃ§Ã£o interrompida pelo usuÃ¡rio');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. Verifique sua API Key e tente novamente.', messageContainer.responseId);
            console.error('Erro no Modelo RaciocÃ­nio:', error);
        }
    }

    // ==================== MODELO PRO ====================
// 3x llama-3.1-8b-instant (anÃ¡lise 1 â†’ anÃ¡lise 2 â†’ sÃ­ntese)
    async processProModel(userMessage) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('🔎 Análise multi-perspectivas...', messageContainer.headerId);
        await this.ui.sleep(800);

        this.addToHistory('user', userMessage);

        const imagesPromise = this.searchUnsplashImages(userMessage);
        const webSearchPromise = this.searchWebForResponse(userMessage);

        try {
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('🧩 [PRO] Imagens recebidas:', images);
            console.log('🌐 [PRO] Dados web recebidos:', webData);

            const webContext = this.buildWebContextBlock(webData);
            const primaryModel = 'llama-3.3-70b-versatile';
            const fallbackModel = 'llama-3.1-8b-instant';

            const baseSystem1 = this.getSystemPrompt('pro') + webContext + "\n\nNesta análise, responda diretamente ao pedido do usuário, priorize a solução mais útil e evite floreios.";
            const baseSystem2 = this.getSystemPrompt('pro') + webContext + "\n\nNesta análise, atue como um revisor crítico. Questione suposições, identifique ambiguidades, aponte riscos e proponha alternativas melhores quando existirem.";
            const baseSystemSynth = this.getSystemPrompt('pro') + webContext + "\n\nVocê é responsável pela síntese final. Combine as duas análises, preserve o que houver de melhor, elimine redundâncias, corrija erros e entregue uma resposta superior, clara, inteligente e prática. Use a web apenas como apoio.";

            const messages1 = this.extraMessagesForNextCall ? [
                { role: 'system', content: baseSystem1 },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : [
                { role: 'system', content: baseSystem1 },
                ...this.conversationHistory
            ];

            await this.ensureCapacityAndTrack({ model: primaryModel, userMessage, conversationHistory: this.conversationHistory, webData });
            this.setApiProvider('samba');
            let response1;
            try {
                response1 = await this.callGroqAPI(primaryModel, messages1);
            } catch (error) {
                console.warn('⚠️ [PRO] Fallback etapa 1 para modelo 3.1-8B:', error);
                response1 = await this.callGroqAPI(fallbackModel, messages1);
            }

            try {
                const parsed1 = this.parseFilesFromText(response1);
                if (parsed1 && parsed1.length > 0) {
                    this.attachGeneratedFilesToChat(parsed1);
                    response1 = response1.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de response1:', e);
            }

            const step2Text = 'Analisando perspectiva 2...';
            this.ui.setThinkingHeader(step2Text, messageContainer.headerId);
            await this.ui.sleep(2000);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            await this.ui.sleep(500);

            const messages2 = this.extraMessagesForNextCall ? [
                { role: 'system', content: baseSystem2 },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : [
                { role: 'system', content: baseSystem2 },
                ...this.conversationHistory
            ];

            let response2;
            try {
                response2 = await this.callGroqAPI(primaryModel, messages2);
            } catch (error) {
                console.warn('⚠️ [PRO] Fallback etapa 2 para modelo 3.1-8B:', error);
                response2 = await this.callGroqAPI(fallbackModel, messages2);
            }

            try {
                const parsed2 = this.parseFilesFromText(response2);
                if (parsed2 && parsed2.length > 0) {
                    this.attachGeneratedFilesToChat(parsed2);
                    response2 = response2.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de response2:', e);
            }

            const step3Text = 'Sintetizando análises...';
            this.ui.setThinkingHeader(step3Text, messageContainer.headerId);
            await this.ui.sleep(2000);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            await this.ui.sleep(500);

            const synthMessages = [
                { role: 'system', content: baseSystemSynth },
                {
                    role: 'user',
                    content: `Pergunta original: "${userMessage}"

=== RESPOSTA 1 (Perspectiva 1) ===
${response1}

=== RESPOSTA 2 (Perspectiva 2) ===
${response2}

Combine e melhore as duas respostas em uma única resposta coesa e superior. Corrija possíveis erros, melhore a clareza, e crie uma resposta final otimizada.`
                }
            ];

            if (this.extraMessagesForNextCall) {
                synthMessages.splice(1, 0, ...this.extraMessagesForNextCall);
            }

            await this.ensureCapacityAndTrack({ model: primaryModel, userMessage, conversationHistory: this.conversationHistory, webData });
            let finalResponse;
            try {
                finalResponse = await this.callGroqAPI(primaryModel, synthMessages);
            } catch (error) {
                console.warn('⚠️ [PRO] Fallback síntese para modelo 3.1-8B:', error);
                finalResponse = await this.callGroqAPI(fallbackModel, synthMessages);
            }

            this.extraMessagesForNextCall = null;

            try {
                const parsedFiles = this.parseFilesFromText(finalResponse);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    finalResponse = finalResponse.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta (Pro):', e);
            }

            this.addToHistory('assistant', finalResponse);
            await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
            this.ui.setResponseText(finalResponse, messageContainer.responseId, async () => {
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }
                await this.attachYouTubeVideosToResponse({ userMessage, assistantResponse: finalResponse, responseId: messageContainer.responseId, chatId: responseChatId });
            });

            this.ui.setThinkingHeader('', messageContainer.headerId);
            setTimeout(() => { if (thinkingHeader) thinkingHeader.textContent = ''; }, 100);
            this.persistAssistantMessage(finalResponse);

        } catch (error) {
            const errorMessage = error && typeof error.message === 'string' ? error.message : String(error);
            if (errorMessage === 'ABORTED') {
                console.log('✋ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. ' + errorMessage, messageContainer.responseId);
            console.error('Erro no Modelo Pro:', error);
        }
    }
    getSystemPrompt(mode) {
        const userProfileContext = buildUserProfilePromptContext();
        const basePersonality = `Você é a Drekee AI, uma assistente de IA útil, inteligente, honesta e equilibrada.

Objetivo principal:
- responder exatamente ao que o usuário perguntou;
- ser clara, competente e confiável;
- ajudar de forma prática, sem soar robótica nem exageradamente informal.

Tom e postura:
- natural, cordial e neutra;
- profissional sem rigidez;
- confiante sem arrogância;
- sincera quando houver incerteza;
- opinativa quando isso agregar valor, sempre com justificativa.

Regras essenciais:
- Para saudações simples como "oi", "olá", "bom dia" ou "tudo bem", responda normalmente como uma conversa humana. Nunca trate isso como sigla, entidade, álbum, marca ou termo ambíguo.
- Não force humor, emojis, analogias, gírias ou entusiasmo teatral.
- Não invente fatos. Se algo estiver incerto, diga isso com clareza.
- Se houver contexto da web, trate-o apenas como apoio. Não copie cegamente, não deixe a busca dominar a resposta e ignore resultados tangenciais.
- Responda primeiro ao pedido principal do usuário; contexto extra vem depois, se realmente ajudar.
- Em temas técnicos, explique antes de despejar código. Forneça código quando for útil ou quando o usuário pedir.`;

        const systemBase = basePersonality + userProfileContext;

        switch (mode) {
            case 'rapido':
                return `${systemBase}

Modo Rápido:
- responda com objetividade, mas não seja seco nem telegráfico;
- em geral use 1 a 3 parágrafos curtos;
- para cumprimentos, responda em 1 ou 2 frases e ofereça ajuda de modo natural;
- vá direto ao ponto e mantenha boa densidade de informação.`;
            case 'raciocinio':
                return `${systemBase}

Modo Raciocínio:
- pense com cuidado antes de responder;
- coloque seu raciocínio completo dentro das tags <raciocínio>...</raciocínio>;
- não coloque nenhuma parte do raciocínio fora dessas tags;
- depois das tags, entregue apenas a resposta final ao usuário;
- a resposta final deve ser bem estruturada, clara e útil, sem floreios desnecessários.`;
            case 'pro':
                return `${systemBase}

Modo Pro:
- entregue respostas mais completas, estratégicas e bem organizadas;
- considere trade-offs, riscos, alternativas e próximos passos quando fizer sentido;
- mantenha profundidade sem enrolação;
- priorize clareza, utilidade prática e bom julgamento.`;
            default:
                return `${systemBase}

Responda com clareza, utilidade e bom senso.`;
        }
    }

    showError(message) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        
        const errorStepId = `errorStep_${timestamp}`;
        this.ui.addThinkingStep('error', 'Erro detectado', errorStepId, messageContainer.stepsId);
        
        this.ui.setResponseText(message, messageContainer.responseId);
        
        console.error(message);
    }

    async test() {
        console.log('ðŸ§ª Iniciando teste do agente...');
        
        console.log('ðŸ“¡ Testando conexÃ£o com Groq via proxy (server-side) ...');
        console.log('â„¹ï¸ Se vocÃª configurou a variÃ¡vel GROQ_API_KEY no Vercel, este teste usarÃ¡ ela. Caso contrÃ¡rio, o teste falharÃ¡ com mensagem adequada.');

        try {
            const testMessage = 'OlÃ¡! Estou testando a conexÃ£o.';
            console.log(`ðŸ“¤ Enviando: "${testMessage}"`);
            
            this.addToHistory('user', testMessage);
            const response = await this.callGroqAPI('llama-3.3-70b-versatile');
            this.addToHistory('assistant', response);
            
            console.log('âœ… Resposta recebida:');
            console.log(response);
            console.log('\nðŸŽ‰ Teste concluÃ­do com sucesso!');
            console.log(`ðŸ“Š HistÃ³rico: ${this.conversationHistory.length} mensagens`);
            
            return response;
        } catch (error) {
            console.error('âŒ Erro no teste:', error.message);
            console.error('Detalhes:', error);
            return null;
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        console.log('ðŸ—‘ï¸ HistÃ³rico de conversa limpo');
    }

    getHistoryStats() {
        const userMessages = this.conversationHistory.filter(m => m.role === 'user').length;
        const assistantMessages = this.conversationHistory.filter(m => m.role === 'assistant').length;
        
        console.log('ðŸ“Š EstatÃ­sticas do HistÃ³rico:');
        console.log(`   Total: ${this.conversationHistory.length} mensagens`);
        console.log(`   Suas mensagens: ${userMessages}`);
        console.log(`   Minhas respostas: ${assistantMessages}`);
        console.log(`   Limite mÃ¡ximo: ${this.maxHistoryMessages} mensagens`);
        
        return {
            total: this.conversationHistory.length,
            user: userMessages,
            assistant: assistantMessages,
            max: this.maxHistoryMessages
        };
    }

    // ExtraÃ§Ã£o e retorno de arquivos removidos (download de arquivos pela IA desativado)

    async generateFollowUpSuggestions(userMessage, assistantResponse, responseId) {
        try {
            const prompt = `VocÃª Ã© um assistente de IA. Baseado na conversa abaixo, gere EXATAMENTE 3 sugestÃµes de prÃ³ximas perguntas que o USUÃRIO poderia fazer para vocÃª. As sugestÃµes devem ser:

- Na perspectiva do USUÃRIO falando com a IA
- Perguntas naturais e relevantes
- Baseadas no contexto da conversa
- Escritas como se o usuÃ¡rio estivesse perguntando

Conversa:
UsuÃ¡rio perguntou: "${userMessage}"
VocÃª respondeu: "${assistantResponse.substring(0, 500)}..."

Exemplos de como devem ser:
- "Como funciona [tÃ³pico mencionado]?"
- "Pode me explicar mais sobre [assunto]?"
- "O que vocÃª acha de [ideia relacionada]?"

Responda APENAS com um JSON array contendo 3 strings, sem texto adicional:
["pergunta do usuÃ¡rio 1", "pergunta do usuÃ¡rio 2", "pergunta do usuÃ¡rio 3"]`;

            const response = await this.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: 'VocÃª Ã© um especialista em gerar sugestÃµes de acompanhamento relevantes e naturais para conversas. Sempre retorne exatamente 3 sugestÃµes em formato JSON array.' },
                { role: 'user', content: prompt }
            ]);

            // Extrair JSON da resposta
            let suggestions = [];
            try {
                // Limpar resposta e extrair JSON
                let cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
                const startIdx = cleanResponse.indexOf('[');
                const endIdx = cleanResponse.lastIndexOf(']');
                
                if (startIdx !== -1 && endIdx !== -1) {
                    const jsonStr = cleanResponse.substring(startIdx, endIdx + 1);
                    suggestions = JSON.parse(jsonStr);
                }
                
                // Validar e filtrar sugestÃµes
                if (Array.isArray(suggestions)) {
                    suggestions = suggestions
                        .filter(s => typeof s === 'string' && s.trim().length > 0)
                        .map(s => s.trim())
                        .slice(0, 3);
                }
                
                if (suggestions.length > 0) {
                    // Extrair ID da mensagem a partir do responseId
                    const messageId = responseId.replace('responseText_', 'msg_');
                    this.ui.displayFollowUpSuggestions(messageId, suggestions);
                    console.log('âœ… SugestÃµes de acompanhamento geradas:', suggestions);
                }
            } catch (parseError) {
                console.warn('âš ï¸ Erro ao parsear sugestÃµes:', parseError);
            }
            
        } catch (error) {
            console.warn('âš ï¸ Erro ao gerar sugestÃµes de acompanhamento:', error);
            // NÃ£o mostrar erro para usuÃ¡rio, apenas log
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}