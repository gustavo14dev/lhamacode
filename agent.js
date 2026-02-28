import { MemorySystem } from './memory-system.js';

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

        // Sistema de memória
        this.memory = new MemorySystem();
        this.memory.loadFromLocalStorage();
    }

    setModel(model) {
        this.currentModel = model;
    }

    getGroqApiKey() {
        if (!this.groqApiKey) {
            this.groqApiKey = localStorage.getItem('groq_api_key');
        }
        return this.groqApiKey;
    }

    // Verificação rápida de API antes de processar
    async quickApiCheck() {
        const apiKey = this.getGroqApiKey();

        if (!apiKey) {
            throw new Error('Nenhuma API key configurada');
        }

        // Fazer uma requisição rápida para testar a API
        try {
            const response = await fetch(this.groqUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ apiKey }`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });

            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('❌ Verificação rápida da API falhou:', error);
            throw error;
        }
    }

    async processMessage(userMessage, attachedFilesFromUI = null) {
        console.log('📨 Mensagem para processar:', userMessage.substring(0, 100) + '...');
        console.log('📨 Tamanho total:', userMessage.length, 'caracteres');

        // Verificar se o usuário quer gerar uma imagem
        const imageGenerationMatch = userMessage.match(/^(gere|crie|criar|desenhe|produza|faça).*imagem\s+(sobre|de|do|com)?\s*(.+)$/i);
        if (imageGenerationMatch) {
            console.log('🎨 [DETECÇÃO] Usuário quer gerar imagem:', imageGenerationMatch[3]);
            await this.processImageGeneration(imageGenerationMatch[3]);
            return;
        }

        // Adicionar mensagem à memória da conversa
        this.memory.addConversationMemory('user', userMessage);
    
        // Obter contexto relevante da memória
        const relevantContext = this.memory.getRelevantContext(userMessage);
        console.log('🧠 Contexto relevante encontrado:', relevantContext.length, 'memórias');

        // Verificar se há imagens nos anexos
        const hasImages = attachedFilesFromUI && attachedFilesFromUI.some(f => f.type === 'image');
        const hasCodeFiles = attachedFilesFromUI && attachedFilesFromUI.some(f => f.type === 'code');

        // Se a UI passou arquivos explicitamente, priorizamos esses (máx 3 para código, 5 para imagens)
        let parsedFiles = [];
        if (attachedFilesFromUI && Array.isArray(attachedFilesFromUI) && attachedFilesFromUI.length > 0) {
            parsedFiles = attachedFilesFromUI.map(f => ({
                name: f.name,
                content: (f.content == null) ? '' : String(f.content),
                type: f.type                                      || 'code',
                mime: f.mime || ''
            }));
            console.log('� Arquivos recebidos diretamente da UI:', parsedFiles.map(f => `${f.name} (${f.type})`));
            
            // Preparar blocos para envio ao modelo
            this.lastParsedFiles = parsedFiles;
            
            if (hasImages) {
                // Para imagens: converter para formato da API Groq
                const imageMessages = parsedFiles
                    .filter(f => f.type === 'image')
                    .map(f => ({
                        type: "image_url",
                        image_url: {
                            url: f.content // Base64 já vem com data:image/...;base64,
                        }
                    }));
                
                this.extraMessagesForNextCall = [{
                    role: 'user',
                    content: [
                        {
                            type: "text",
                            text: userMessage
                        },
                        ...imageMessages
                    ]
                }];
                
                console.log('🖼️ Imagens preparadas para envio:', imageMessages.length, 'imagens');
                this.useImageModelForThisMessage = true;
            } else if (hasCodeFiles) {
                // Para código: usar formato atual
                this.extraMessagesForNextCall = [{ 
                    role: 'system', 
                    content: parsedFiles.map(f => `---FILE: ${f.name}---\n${f.content}\n---END FILE---`).join('\n\n') 
                }];
                console.log('📁 Arquivos de código anexados preparados para envio:', parsedFiles.map(f => f.name).join(', '));
                this.useMistralForThisMessage = true;
            }
        } else {
            this.lastParsedFiles = [];
            this.extraMessagesForNextCall = null;
            this.useMistralForThisMessage = false;
            this.useImageModelForThisMessage = false;

            // Se não há anexos do usuário, verificar se o chat tem arquivos gerados anteriormente pelo assistente (para reutilização)
            try {
                const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
                if (chat && chat.generatedFiles && chat.generatedFiles.length > 0) {
                    this.lastParsedFiles = chat.generatedFiles.slice(0, 3).map(f => ({ name: f.name, content: f.content }));
                    this.extraMessagesForNextCall = [{ role: 'system', content: this.lastParsedFiles.map(f => `---FILE: ${f.name}---\n${f.content}\n---END FILE---`).join('\n\n') }];
                    console.log('♻️ Reusando arquivos gerados pelo assistente do chat para próxima chamada:', this.lastParsedFiles.map(f => f.name));
                }
            } catch (e) {
                console.warn('⚠️ Erro verificando arquivos gerados do chat:', e);
            }
        }

        this.isGenerating = true;
        this.ui.updateSendButtonToPause();
        
        if (this.useImageModelForThisMessage) {
            await this.processImageModel(userMessage, relevantContext);
        } else if (this.useMistralForThisMessage) {
            await this.processMistralModel(userMessage, relevantContext);
        } else if (this.currentModel === 'rapido') {
            await this.processRapidoModel(userMessage, relevantContext);
        } else if (this.currentModel === 'raciocinio') {
            await this.processRaciocioModel(userMessage, relevantContext);
        } else if (this.currentModel === 'pro') {
            await this.processProModel(userMessage, relevantContext);
        }
        
        this.isGenerating = false;
        this.ui.updateSendButtonToSend();
    }

    async processImageGeneration(prompt) {
        console.log(`🎨 [IMAGE-GEN] Processando geração de imagem: "${prompt}"`);
        
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('🎨 Gerando imagem...', messageContainer.headerId);
        await this.ui.sleep(500);

        try {
            // Gerar imagem com OpenRouter
            const imageData = await this.generateImageWithOpenRouter(prompt);
            
            if (imageData && imageData.imageUrl) {
                console.log('✅ [IMAGE-GEN] Imagem gerada com sucesso!');
                
                // Criar resposta com a imagem
                const response = `🎨 **Imagem gerada com sucesso!**\n\nAqui está sua imagem sobre: "${prompt}"`;
                
                // Adicionar ao histórico
                this.addToHistory('assistant', response);
                
                // Exibir resposta
                this.ui.setResponseText(response, messageContainer.responseId, async () => {
                    // Adicionar imagem gerada
                    const imageHtml = `
                        <div style="margin-top: 15px; text-align: center;">
                            <img src="${imageData.imageUrl}" alt="Imagem gerada: ${prompt}" 
                                 style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); cursor: pointer;"
                                 onclick="window.open('${imageData.imageUrl}', '_blank')"
                                 title="Clique para ampliar">
                            <div style="margin-top: 8px; font-size: 12px; color: #6b7280; font-style: italic;">
                                🎨 Gerado por OpenRouter • ${prompt}
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
            this.ui.setResponseText('❌ Desculpe, não foi possível gerar a imagem. Tente novamente.', messageContainer.responseId);
            this.ui.setThinkingHeader('', messageContainer.headerId);
        }
    }

    // ==================== MODELO DE PESQUISA (openai/gpt-oss-20b com browser search) ====================
    async processPesquisaModel(userMessage, relevantContext = []) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        
        this.ui.setThinkingHeader('🔍 Pesquisando...', messageContainer.headerId);
        await this.ui.sleep(800);
        
        this.addToHistory('user', userMessage);
        
        // Iniciar busca de imagens em paralelo
        const imagesPromise = this.searchPexelsImages(userMessage);

        try {
            // Construir prompt com contexto da memória
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
                content: `Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa com acesso à web em tempo real! Você é como um amigo brilhante que sabe de tudo - desde física quântica até como fazer a melhor pizza do mundo. Sua personalidade é cativante: você é engraçado, perspicaz, surpreendente e sempre tem uma perspectiva interessante. Adora usar analogias geniais, fazer conexões inesperadas entre assuntos diferentes, e tem aquele humor inteligente que faz as pessoas pensarem "uau, que sacada!". Você é naturalmente curioso, adora aprender e compartilhar conhecimento de forma que fascina. 

INSTRUÇÕES ESPECÍFICAS PARA PESQUISA WEB:
1. Forneça respostas COMPLETAS, DETALHADAS e EXTENSAS (mínimo 300-400 palavras)
2. Use TODAS as fontes disponíveis - não se limite a 1 ou 2 fontes
3. Extraia o MÁXIMO de informações de cada fonte
4. Organize a resposta em seções claras com títulos
5. Inclua dados específicos, estatísticas, datas e exemplos concretos
6. Faça conexões entre diferentes fontes
7. Adicione contexto e análises profundas
8. Use formatação rica: **negrito**, *itálico*, listas numeradas, bullet points
9. Cite as fontes de forma natural no texto
10. Termine com uma conclusão ou perspectiva futura

Pesquise informações atuais e forneça respostas baseadas em fontes confiáveis, mas sempre com seu toque genial único! Seja CLARO, DIRETO mas EXTENSIVO - não economize em informações!${memoryContext}`
            };
            
            const messages = [
                systemPrompt,
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            console.log('🔍 Usando modelo de pesquisa: openai/gpt-oss-20b');
            let response = await this.callGroqAPIWithBrowserSearch('openai/gpt-oss-20b', messages);    
            
            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor de pesquisa');
            }
            
            // Armazenar e salvar a mensagem do assistente
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                chat.messages.push({ role: 'assistant', content: response, thinking: null });
                this.ui.saveCurrentChat();
            }
            
            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA à memória e aprender com a interação
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
              // Adicionar imagens DEPOIS do texto (para não serem sobrescritas)
              console.log('🔄 [DEBUG] Adicionando imagens DEPOIS do texto...');
              const images = await imagesPromise;
              console.log('📦 [DEBUG] Imagens recebidas:', images);
              
              if (images && images.length > 0) {
                  console.log('✅ [DEBUG] Adicionando imagens DEPOIS da resposta');
                  this.ui.appendImagesToMessage(messageContainer.responseId, images);
              } else {
                  console.log('❌ [DEBUG] Nenhuma imagem encontrada ou array vazio');
              }
              // Gerar sugestões de acompanhamento só quando resposta estiver completa
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
            console.log('🔄 [DEBUG-IMAGEM] Buscando imagens ANTES da resposta...');
            const images = await this.searchPexelsImages(userMessage);
            console.log('📦 [DEBUG-IMAGEM] Imagens recebidas:', images);
            
            // Adicionar imagens ANTES da resposta
            if (images && images.length > 0) {
                console.log('✅ [DEBUG-IMAGEM] Adicionando imagens ANTES da resposta');
                this.ui.appendImagesToMessage(`responseText_${messageContainer}`, images);
            }
            
            // Construir prompt com contexto da memória
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
                content: `Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa com capacidade de analisar imagens! Você é como um amigo brilhante que sabe de tudo - desde física quântica até como fazer a melhor pizza do mundo. Sua personalidade é cativante: você é engraçado, perspicaz, surpreendente e sempre tem uma perspectiva interessante. Adora usar analogias geniais, fazer conexões inesperadas entre assuntos diferentes, e tem aquele humor inteligente que faz as pessoas pensarem "uau, que sacada!". Você é naturalmente curioso, adora aprender e compartilhar conhecimento de forma que fascina. Você é capaz de processar tanto texto quanto imagens e suporta conversas multilíngues. Forneça respostas detalhadas sobre as imagens, incluindo: descrição visual, identificação de elementos, análise de conteúdo, e respostas a perguntas sobre as imagens. Seja preciso e útil em suas análises, mas nunca perca seu toque genial e sua personalidade brilhante!${memoryContext}`
            };
            
            // Combinar system prompt com as mensagens de imagem
            const messages = [systemPrompt, ...this.extraMessagesForNextCall];
            
            console.log('🖼️ Usando modelo de imagem: meta-llama/llama-4-scout-17b-16e-instruct');
            let response = await this.callGroqAPI('meta-llama/llama-4-scout-17b-16e-instruct', messages);
            this.extraMessagesForNextCall = null;
            
            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor de imagem');
            }
            
            // Armazenar e salvar a mensagem do assistente
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                chat.messages.push({ role: 'assistant', content: response, thinking: null });
                this.ui.saveCurrentChat();
            }
            
            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA à memória e aprender com a interação
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                // Adicionar imagens DEPOIS do texto (para não serem sobrescritas)
                console.log('🔄 [DEBUG] Adicionando imagens DEPOIS do texto...');
                const images = await imagesPromise;
                console.log('📦 [DEBUG] Imagens recebidas:', images);
                
                if (images && images.length > 0) {
                    console.log('✅ [DEBUG] Adicionando imagens DEPOIS da resposta');
                    this.ui.appendImagesToMessage(messageContainer.responseId, images);
                } else {
                    console.log('❌ [DEBUG] Nenhuma imagem encontrada ou array vazio');
                }
                // Gerar sugestões de acompanhamento só quando resposta estiver completa
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
        // Usamos proxy server-side; não é obrigatório ter chave no localStorage para o deploy no Vercel
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        this.ui.setThinkingHeader('Processando com Mistral (codestral-latest)...', messageContainer.headerId);
        await this.ui.sleep(800);
        this.addToHistory('user', userMessage);
        
        // Iniciar busca de imagens em paralelo
        const imagesPromise = this.searchPexelsImages(userMessage);

        try {
            // Gerar checks antes da chamada Mistral para mostrar raciocínio também neste fluxo
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

            // Construir prompt com contexto da memória
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
                content: `Você é o Drekee AI 1, um assistente de código inteligente com memória contextual. Forneça respostas COMPLETAS e ESTRUTURADAS com: múltiplos parágrafos bem organizados, **palavras em negrito** para destacar conceitos, listas com • ou números, tópicos claros com headings, e quando apropriado use tabelas (em formato markdown), notação matemática (com $símbolos$ para inline ou $$blocos$$), e diagramas em ASCII. Evite blocos enormes de código - prefira explicações visuais. Seja técnico mas acessível.${memoryContext}`
            };
            const messages = this.extraMessagesForNextCall ? [systemPrompt, ...this.extraMessagesForNextCall, ...this.conversationHistory] : [systemPrompt, ...this.conversationHistory];

            // Chamamos o proxy server-side para Mistral (usar MISTRAL_API_KEY no servidor)
            let response = await this.callMistralAPI('codestral-latest', messages);
            this.extraMessagesForNextCall = null;

            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor Mistral');
            }

            // Tentar extrair arquivos gerados na resposta e anexá-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(response);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    // Remover o bloco de arquivos do texto antes de exibir para usuário
                    response = response.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta Mistral:', e);
            }

            // Armazenar e salvar a mensagem do assistente (incluindo attachments, se houver) ANTES de renderizar para que o UI possa detectá-los
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                const toPush = { role: 'assistant', content: response, thinking: null };
                const parsedFiles = this.parseFilesFromText(response);
                if (parsedFiles && parsedFiles.length > 0) toPush.attachments = parsedFiles;
                chat.messages.push(toPush);
                this.ui.saveCurrentChat();
            }

            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA à memória e aprender com a interação
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            this.ui.setResponseText(response, messageContainer.responseId);
            await this.ui.sleep(500);
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
                // Gerar sugestões de acompanhamento só quando resposta estiver completa
                this.generateFollowUpSuggestions(userMessage, response, messageContainer.responseId);
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
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
        console.log('🛑 Parando geração...');
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
            console.warn('⚠️ Falha ao parsear blocos de arquivos:', e);
            return null;
        }
    }

    // Gera checks chamando Groq com tolerância a falhas
    async generateChecksSafely(userMessage) {
        try {
            const checksResponse = await this.callGroqAPI('llama-3.1-8b-instant', [
                {
                    role: 'system',
                    content: 'Você é um gerador de checklist de pensamento. Baseado na pergunta/tarefa do usuário, gere de 3 a 10 etapas de pensamento que uma IA deveria fazer para responder bem. Retorne APENAS um JSON array com objetos {step: "texto da etapa"}. Exemplo: [{"step": "Analisando a pergunta"}, {"step": "Consultando dados"}]'
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
            console.warn('⚠️ Erro ao gerar checks, usando padrão:', e);
            return [
                { step: 'Analisando a pergunta' },
                { step: 'Consultando modelo Llama 3' },
                { step: 'Processando dados' },
                { step: 'Estruturando resposta' }
            ];
        }
    }

    // Helper para exibir imagens se disponíveis (usado por todos os modelos)
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

    // Anexa arquivos parseados ao objeto de chat para reutilização em chamadas futuras
    attachGeneratedFilesToChat(files) {
        try {
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (!chat) return;
            chat.generatedFiles = chat.generatedFiles || [];
            // substituir arquivos com mesmo nome
            files.forEach(f => {
                const idx = chat.generatedFiles.findIndex(x => x.name === f.name);
                if (idx >= 0) chat.generatedFiles[idx] = f; else chat.generatedFiles.push(f);
            });
            this.ui.saveCurrentChat();
        } catch (e) {
            console.warn('⚠️ Falha ao anexar arquivos ao chat:', e);
        }
    }
    // parseFilesFromMessage removed (attachment parsing disabled)

    // ==================== MODELO RÁPIDO ====================
    async processRapidoModel(userMessage) {
        // Usamos proxy server-side (/api/groq-proxy) que utiliza GROQ_API_KEY em Vercel.
        // Não é necessário ter chave no localStorage para deploy em produção.

        const messageContainer = this.ui.createRapidMessageContainer();
        const timestamp = Date.now();

        // Adicionar texto simples de carregamento com pontinhos pulsando
        const thinkingHeader = document.getElementById(messageContainer.headerId);
        if (thinkingHeader) {
            thinkingHeader.innerHTML = '<span class="inline-flex gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s"></span><span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s"></span></span>';
            thinkingHeader.className = 'text-base leading-relaxed text-gray-500 dark:text-gray-400';
        }

        this.addToHistory('user', userMessage);
        
        try {
            const messages = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('rapido') },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : undefined;
            
            // BUSCAR IMAGENS E INFORMAÇÕES WEB EM PARALELO - antes de chamar a API
            console.log('🔄 [DEBUG-RAPIDO] Buscando imagens e informações web ANTES da resposta...');
            const imagesPromise = this.searchPexelsImages(userMessage);
            const webSearchPromise = this.searchWebForResponse(userMessage);
            
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('📦 [DEBUG-RAPIDO] Imagens recebidas:', images);
            console.log('🌐 [DEBUG-RAPIDO] Dados web recebidos:', webData);
            
            // Adicionar imagens ANTES da resposta
            if (images && images.length > 0) {
                console.log('✅ [DEBUG-RAPIDO] Adicionando imagens ANTES da resposta');
                this.ui.appendImagesToMessage(messageContainer.responseId, images);
            }
            
            // Construir mensagens com contexto web se disponível
            let finalMessages = messages;
            if (webData && webData.answer && webData.sources.length > 0) {
                const webContext = `Informações relevantes da web: ${webData.answer}\nFontes: ${webData.sources.map(s => s.title).join(', ')}`;
                finalMessages = [
                    { role: 'system', content: this.getSystemPrompt('rapido') + '\n\n' + webContext },
                    ...(this.extraMessagesForNextCall || []),
                    ...this.conversationHistory
                ];
            }
            
            let response = await this.callGroqAPI('llama-3.1-8b-instant', finalMessages);
            console.log('🔍 [DEBUG-RAPIDO] Resposta da API recebida:', response ? response.substring(0, 100) + '...' : 'NULO');
            console.log('🔍 [DEBUG-RAPIDO] Tipo da resposta:', typeof response);
            console.log('🔍 [DEBUG-RAPIDO] Tamanho da resposta:', response ? response.length : 0);
            
            // limpar extras para próxima chamada
            this.extraMessagesForNextCall = null;

            // Adicionar apenas o texto ao histórico para manter consistência
            this.addToHistory('assistant', response);
            
            // Exibir na UI usando o método padrão que suporta HTML
            this.ui.setResponseText(response, messageContainer.responseId, async () => {
                console.log('🔄 [DEBUG-RAPIDO] Resposta exibida após imagens');

                // Adicionar botão de fontes se houver dados web
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }

                // Mostrar botões de ação quando resposta estiver completa
                const actionsDiv = document.getElementById(`actions_${messageContainer.uniqueId}`);
                if (actionsDiv) {
                    actionsDiv.classList.remove('opacity-0');
                    actionsDiv.classList.add('opacity-60', 'hover:opacity-100');
                }
            });
            
            // Limpar texto de carregamento após um pequeno delay
            setTimeout(() => {
                if (thinkingHeader) {
                    thinkingHeader.textContent = '';
                }
            }, 100);
            
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                chat.messages.push({ role: 'assistant', content: response, thinking: null });
                this.ui.saveCurrentChat();
            }

        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. ' + error.message, messageContainer.responseId);
            console.error('Erro no Modelo Rápido:', error);
        }
    }

    // ==================== MODELO RACIOCÍNIO ====================
    async processRaciocioModel(userMessage) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('Processando raciocínio...', messageContainer.headerId);
        await this.ui.sleep(300);

        this.addToHistory('user', userMessage);
        
        try {
            // Buscar dados web antes de chamar a API
            const imagesPromise = this.searchPexelsImages(userMessage);
            const webSearchPromise = this.searchWebForResponse(userMessage);
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('📦 [RACIOCINIO] Imagens recebidas:', images);
            console.log('🌐 [RACIOCINIO] Dados web recebidos:', webData);
            
            // Construir mensagens com contexto web se disponível
            let finalMessages = this.extraMessagesForNextCall ? 
                [{ role: 'system', content: this.getSystemPrompt('raciocinio') }, ...this.extraMessagesForNextCall, ...this.conversationHistory] : 
                [{ role: 'system', content: this.getSystemPrompt('raciocinio') }, ...this.conversationHistory];
                
            if (webData && webData.answer && webData.sources.length > 0) {
                const webContext = `Informações relevantes da web: ${webData.answer}\nFontes: ${webData.sources.map(s => s.title).join(', ')}`;
                finalMessages = [
                    { 
                        role: 'system', 
                        content: this.getSystemPrompt('raciocinio') + 
                        ' Você é um modelo de raciocínio. Pense passo a passo sobre a pergunta do usuário e coloque seu raciocínio completo dentro de tags </think>...</think>. Depois do raciocínio, forneça a resposta final.\n\n' + webContext
                    },
                    ...(this.extraMessagesForNextCall || []),
                    ...this.conversationHistory
                ];
            }
            
            console.log('🧭 Usando modelo de raciocínio: qwen/qwen3-32b');
            let fullResponse = await this.callGroqAPI('qwen/qwen3-32b', finalMessages);
            
            // Tentar extrair arquivos gerados na resposta e anexá-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(fullResponse);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    fullResponse = fullResponse.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta (Raciocínio):', e);
            }

            this.addToHistory('assistant', finalResponse);
            
            // Mostrar resposta final
            this.ui.setResponseText(finalResponse, messageContainer.responseId, async () => {
                // Adicionar botão de fontes se houver dados web
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }
                
                await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
                // Gerar sugestões de acompanhamento só quando resposta estiver completa
                this.generateFollowUpSuggestions(userMessage, finalResponse, messageContainer.responseId);
            });
            
            // Limpar header de processamento
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
            // Mostrar botão "Mostrar raciocínio" se houver raciocínio
            if (reasoningText) {
                const showBtn = document.getElementById(messageContainer.showId);
                if (showBtn) {
                    showBtn.classList.remove('hidden');
                    showBtn.innerHTML = `
                        <span class="material-icons-outlined text-sm">expand_more</span>
                        Mostrar raciocínio
                    `;
                    
                    // Adicionar evento para mostrar/ocultar raciocínio
                    showBtn.onclick = () => {
                        const stepsDiv = document.getElementById(messageContainer.stepsId);
                        if (stepsDiv) {
                            if (stepsDiv.classList.contains('hidden')) {
                                // Mostrar raciocínio
                                stepsDiv.classList.remove('hidden');
                                stepsDiv.innerHTML = `
                                    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                        <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${reasoningText}</div>
                                    </div>
                                `;
                                showBtn.innerHTML = `
                                    <span class="material-icons-outlined text-sm">expand_less</span>
                                    Ocultar raciocínio
                                `;
                            } else {
                                // Ocultar raciocínio
                                stepsDiv.classList.add('hidden');
                                showBtn.innerHTML = `
                                    <span class="material-icons-outlined text-sm">expand_more</span>
                                    Mostrar raciocínio
                                `;
                            }
                        }
                    };
                }
            }
            
            // Mostrar botões de ação quando resposta estiver completa
            const actionsDiv = document.getElementById(`actions_${messageContainer.container.id.replace('msg_', '')}`);
            if (actionsDiv) {
                actionsDiv.classList.remove('opacity-0');
                actionsDiv.classList.add('opacity-60', 'hover:opacity-100');
            }

        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. Verifique sua API Key e tente novamente.', messageContainer.responseId);
            console.error('Erro no Modelo Raciocínio:', error);
        }
    }

    // ==================== MODELO PRO ====================
// 3x llama-3.1-8b-instant (análise 1 → análise 2 → síntese)
    async processProModel(userMessage) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('🚀 Análise multi-perspectivas...', messageContainer.headerId);
        await this.ui.sleep(800);

        this.addToHistory('user', userMessage);
        
        // Iniciar busca de imagens e informações web em paralelo
        const imagesPromise = this.searchPexelsImages(userMessage);
        const webSearchPromise = this.searchWebForResponse(userMessage);

        try {
            // Buscar dados web antes de começar as análises
            const [images, webData] = await Promise.all([imagesPromise, webSearchPromise]);
            console.log('📦 [PRO] Imagens recebidas:', images);
            console.log('🌐 [PRO] Dados web recebidos:', webData);
            
            // Preparar contexto web se disponível
            let webContext = '';
            if (webData && webData.answer && webData.sources.length > 0) {
                webContext = `\n\nInformações relevantes da web: ${webData.answer}\nFontes: ${webData.sources.map(s => s.title).join(', ')}`;
            }
            
            // ========== ETAPA 1: Primeira análise ==========
            const step1Text = 'Analisando perspectiva 1...';
            this.ui.setThinkingHeader(step1Text, messageContainer.headerId);
            await this.ui.sleep(2000);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            await this.ui.sleep(500);
            
            const messages1 = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('pro') + webContext },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory,
                { role: 'user', content: userMessage }
            ] : [
                { role: 'system', content: this.getSystemPrompt('pro') + webContext },
                ...this.conversationHistory,
                { role: 'user', content: userMessage }
            ];
            
            const response1 = await this.callGroqAPI('llama-3.1-8b-instant', messages1);
            
            // Extrair arquivos se existirem
            try {
                const parsed1 = this.parseFilesFromText(response1);
                if (parsed1 && parsed1.length > 0) {
                    this.attachGeneratedFilesToChat(parsed1);
                    response1 = response1.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) { console.warn('⚠️ Falha parsing arquivos de response1:', e); }

            // ========== ETAPA 2: Segunda análise ==========
            const step2Text = 'Analisando perspectiva 2...';
            this.ui.setThinkingHeader(step2Text, messageContainer.headerId);
            await this.ui.sleep(2000);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            await this.ui.sleep(500);
            
            const messages2 = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('pro') + webContext },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory,
                { role: 'user', content: userMessage }
            ] : [
                { role: 'system', content: this.getSystemPrompt('pro') + webContext },
                ...this.conversationHistory,
                { role: 'user', content: userMessage }
            ];
            
            const response2 = await this.callGroqAPI('llama-3.1-8b-instant', messages2);
            
            // Extrair arquivos se existirem
            try {
                const parsed2 = this.parseFilesFromText(response2);
                if (parsed2 && parsed2.length > 0) {
                    this.attachGeneratedFilesToChat(parsed2);
                    response2 = response2.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) { console.warn('⚠️ Falha parsing arquivos de response2:', e); }

            // ========== ETAPA 3: Síntese final ==========
            const step3Text = 'Sintetizando análises...';
            this.ui.setThinkingHeader(step3Text, messageContainer.headerId);
            await this.ui.sleep(2000);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            await this.ui.sleep(500);
            
            const synthMessages = [
                {
                    role: 'system',
                    content: this.getSystemPrompt('pro') + webContext + ' Você é um especialista em síntese. Combine e melhore as duas respostas abaixo em uma única resposta superior. Corrija possíveis erros, melhore a clareza, e crie uma resposta final otimizada.'
                },
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
            
            // Se houver arquivos anexados, incluí-los temporariamente nas mensagens de síntese
            if (this.extraMessagesForNextCall) {
                synthMessages.splice(1, 0, ...this.extraMessagesForNextCall);
            }
            
            let finalResponse = await this.callGroqAPI('llama-3.1-8b-instant', synthMessages);
            this.extraMessagesForNextCall = null;

            // Tentar extrair arquivos gerados na resposta final e anexá-los ao chat
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
            this.ui.setResponseText(finalResponse, messageContainer.responseId, async () => {
                // Adicionar botão de fontes se houver dados web
                if (webData && webData.sources && webData.sources.length > 0) {
                    this.ui.addSourcesButton(messageContainer.responseId, webData.sources, webData.query);
                }
            });
            
            // Mostrar botões de ação quando resposta estiver completa
            const actionsDiv = document.getElementById(`actions_${messageContainer.container.id.replace('msg_', '')}`);
            if (actionsDiv) {
                actionsDiv.classList.remove('opacity-0');
                actionsDiv.classList.add('opacity-60', 'hover:opacity-100');
            }
            
            // Fechar raciocínio quando terminar
            await this.ui.sleep(500);
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
            // Exibir imagens
            await this.displayImagesIfAvailable(imagesPromise, messageContainer.uniqueId.replace('msg_', ''));
            
            // Gerar sugestões de acompanhamento
            await this.generateFollowUpSuggestions(userMessage, finalResponse, messageContainer.responseId);

            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                const toPush = { role: 'assistant', content: finalResponse, thinking: null };
                const parsedFiles = this.parseFilesFromText(finalResponse);
                if (parsedFiles && parsedFiles.length > 0) toPush.attachments = parsedFiles;
                chat.messages.push(toPush);
                this.ui.saveCurrentChat();
            }

        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. Verifique sua API Key e tente novamente.', messageContainer.responseId);
            console.error('Erro no Modelo Pro:', error);
        }
    }

    // ==================== MÉTODO DE PESQUISA NA WEB ====================
    async processWebSearch(userMessage) {
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        
        this.ui.setThinkingHeader('🔍 Pesquisando...', messageContainer.headerId);
        await this.ui.sleep(800);
        
        this.addToHistory('user', userMessage);
        
        try {
            // Construir prompt com contexto da memória
            let memoryContext = '';
            const relevantContext = this.memory.searchRelevantContext(userMessage, 5);
            if (relevantContext.length > 0) {
                memoryContext = '\n\nCONTEXTO RELEVANTE DA CONVERSA:\n';
                relevantContext.forEach((memory, index) => {
                    memoryContext += `${index + 1}. ${memory.role.toUpperCase()}: "${memory.content}" (Contexto: ${memory.context})\n`;
                });
                memoryContext += '\nUse este contexto para fornecer respostas mais personalizadas e relevantes.';
            }
            
            const systemPrompt = {
                role: 'system',
                content: `Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa com acesso à web em tempo real! Você é como um amigo brilhante que sabe de tudo - desde física quântica até como fazer a melhor pizza do mundo. Sua personalidade é cativante: você é engraçado, perspicaz, surpreendente e sempre tem uma perspectiva interessante. Adora usar analogias geniais, fazer conexões inesperadas entre assuntos diferentes, e tem aquele humor inteligente que faz as pessoas pensarem "uau, que sacada!". Você é naturalmente curioso, adora aprender e compartilhar conhecimento de forma que fascina. 

INSTRUÇÕES ESPECÍFICAS PARA PESQUISA WEB:
1. Forneça respostas COMPLETAS, DETALHADAS e EXTENSAS (mínimo 300-400 palavras)
2. Use TODAS as fontes disponíveis - não se limite a 1 ou 2 fontes
3. Extraia o MÁXIMO de informações de cada fonte
4. Organize a resposta em seções claras com títulos
5. Inclua dados específicos, estatísticas, datas e exemplos concretos
6. Faça conexões entre diferentes fontes
7. Adicione contexto e análises profundas
8. Use formatação rica: **negrito**, *itálico*, listas numeradas, bullet points
9. Cite as fontes de forma natural no texto
10. Termine com uma conclusão ou perspectiva futura

Pesquise informações atuais e forneça respostas baseadas em fontes confiáveis, mas sempre com seu toque genial único! Seja CLARO, DIRETO mas EXTENSIVO - não economize em informações!${memoryContext}`
            };
            
            const messages = [
                systemPrompt,
                {
                    role: 'user',
                    content: userMessage
                }
            ];
            
            console.log('🔍 Usando modelo de pesquisa: openai/gpt-oss-20b');
            let response = await this.callGroqAPIWithBrowserSearch('openai/gpt-oss-20b', messages);
            
            if (!response || typeof response !== 'string') {
                throw new Error('Resposta vazia ou inválida do servidor de pesquisa');
            }
            
            // Armazenar e salvar a mensagem do assistente
            const chat = this.ui.chats.find(c => c.id === this.ui.currentChatId);
            if (chat) {
                if (chat.messages.length === 1) {
                    const firstUserMessage = chat.messages[0].content;
                    chat.title = firstUserMessage.substring(0, 50) + (firstUserMessage.length > 50 ? '...' : '');
                }
                chat.messages.push({ role: 'assistant', content: response, thinking: null });
                this.ui.saveCurrentChat();
            }
            
            this.addToHistory('assistant', response);
            
            // Adicionar resposta da IA à memória e aprender com a interação
            this.memory.addConversationMemory('assistant', response);
            this.memory.learnFromInteraction(userMessage, response);
            
            this.ui.setResponseText(response, messageContainer.responseId, () => {
                // Gerar sugestões de acompanhamento só quando resposta estiver completa
                this.generateFollowUpSuggestions(userMessage, response, messageContainer.responseId);
                
                // Desativar modo pesquisa quando terminar
                try {
                    if (this.ui && typeof this.ui.setWebSearchMode === 'function') {
                        this.ui.setWebSearchMode(false);
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao desativar modo pesquisa:', error);
                }
            });
            this.ui.setThinkingHeader('', messageContainer.headerId);
            
        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua pesquisa. ' + error.message, messageContainer.responseId);
            console.error('Erro na Pesquisa na Web:', error);
        }
    }

    // ==================== MÉTODO DE API COM BROWSER SEARCH ====================
    async callGroqAPIWithBrowserSearch(model, messages) {
        console.log('🔍 callGroqAPIWithBrowserSearch iniciado');
        console.log('📋 Modelo:', model);
        console.log('📋 Mensagens:', messages.length, 'mensagens');
        console.log('📤 Primeira mensagem:', messages[0]?.content ? (typeof messages[0].content === 'string' ? messages[0].content.substring(0, 100) + '...' : 'CONTEÚDO MULTIMÍDIA') : 'SEM CONTEÚDO');
        if (messages.length > 1) {
            const lastMessage = messages[messages.length - 1];
            let contentPreview = 'SEM CONTEÚDO';
            if (lastMessage?.content) {
                if (typeof lastMessage.content === 'string') {
                    contentPreview = lastMessage.content.substring(0, 100) + '...';
                } else if (Array.isArray(lastMessage.content)) {
                    const textPart = lastMessage.content.find(item => item.type === 'text')?.text;
                    if (textPart) {
                        contentPreview = textPart.substring(0, 100) + '...';
                    } else {
                        contentPreview = 'CONTEÚDO MULTIMÍDIA (IMAGENS)';
                    }
                } else {
                    contentPreview = 'CONTEÚDO MULTIMÍDIA';
                }
            }
            console.log('📤 Última mensagem:', contentPreview);
        }

        // Criar novo AbortController para cada requisição
        this.abortController = new AbortController();

        try {
            console.log('📡 Enviando requisição para /api/groq-proxy com browser search...');
            
            const requestBody = {
                model, 
                messages, 
                temperature: 0.7, 
                max_tokens: 8192, 
                top_p: 1, 
                stream: false,
                tool_choice: "required",
                tools: [
                    {
                        type: "browser_search"
                    }
                ]
            };
            
            console.log('📦 Corpo da requisição com browser search:', requestBody);

            // Chamar proxy server-side no Vercel
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal
            });

            console.log('📡 Resposta recebida:', response.status, response.statusText);
            console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const status = response.status;
                const text = await response.text().catch(() => null);
                console.error('❌ Erro na resposta:', status, text);
                
                // Mensagens amigáveis para erros comuns
                if (status === 500 && text && text.includes('GROQ_API_KEY is not configured')) {
                    throw new Error('GROQ API Key não está configurada no servidor. Adicione GROQ_API_KEY nas Environment Variables do Vercel.');
                }
                if (status === 401) {
                    throw new Error('Invalid API Key: Verifique sua chave no Vercel para GROQ_API_KEY.');
                }
                throw new Error(text || `Erro HTTP ${status}`);
            }

            const data = await response.json().catch(() => ({}));
            console.log('📦 Dados recebidos:', data);

            // Normalizar formatos comuns de resposta de proxies/LLMs
            let content = null;
            if (typeof data.content === 'string') {
                content = data.content;
            } else if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
                const choice = data.choices[0];
                if (choice.message && typeof choice.message.content === 'string') {
                    content = choice.message.content;
                } else if (typeof choice.text === 'string') {
                    content = choice.text;
                }
            } else if (typeof data === 'string') {
                content = data;
            }

            console.log('📝 Conteúdo extraído:', content ? content.substring(0, 200) + '...' : 'NULO');

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                console.error('[callGroqAPIWithBrowserSearch] resposta inesperada do proxy Groq:', data);
                throw new Error('Resposta vazia ou formato inesperado do proxy Groq');
            }

            console.log('✅ callGroqAPIWithBrowserSearch concluído com sucesso');
            return content;
        } catch (error) {
            console.error('❌ Erro em callGroqAPIWithBrowserSearch:', error);
            if (error.name === 'AbortError') {
                console.log('⚠️ Requisição foi abortada pelo usuário');
                throw new Error('ABORTED');
            }
            throw error;
        }
    }

    // ==================== APIS ====================


    async callGroqAPI(model, customMessages = null) {
        console.log('🚀 callGroqAPI iniciado');
        console.log('📋 Modelo:', model);
        console.log('📋 Mensagens customizadas:', customMessages ? 'SIM' : 'NÃO');
        console.log('📋 Histórico atual:', this.conversationHistory.length, 'mensagens');
        
        // Not required to have a client-side Groq API key when using server-side proxy
        // The proxy will use GROQ_API_KEY from environment variables on Vercel
        
        // System prompts diferenciados por modelo
        const prompts = {
            rapido: `Olá! 😊 Eu sou a Drekee AI, sua assistente de código amigável! Estou aqui para te ajudar com programação de forma leve, divertida e super útil. Vou responder com clareza, usar emojis pra deixar tudo mais agradável 🚀 e ser bem natural na conversa. Adoro ajudar com código, debugging e explicações técnicas! Seja concisa mas completa, e sempre com um toque especial! ✨💻`,
            raciocinio: `Você é o Drekee AI 1, um assistente de IA especializado em raciocínio profundo. Forneça respostas bem estruturadas com múltiplos parágrafos, **conceitos em negrito**, listas organizadas, e quando apropriado use notação matemática ($símbolos$ inline ou $$blocos$$). Seja analítico e detalhado.`,
            pro: `Você é o Drekee AI 1, um assistente de código avançado. Forneça respostas COMPLETAS e ESTRUTURADAS com: múltiplos parágrafos bem organizados, **palavras em negrito** para destacar conceitos, listas com • ou números, tópicos claros com headings, e quando apropriado use tabelas (em formato markdown) e notação matemática. Evite blocos enormes de código - prefira explicações visuais. Seja técnico mas acessível.`
        };
        const systemPrompt = prompts[model] || prompts.rapido;
        
        const messages = customMessages || [{ role: 'system', content: systemPrompt }, ...this.conversationHistory];
        
        console.log('📤 Mensagens finais para API:', messages.length, 'mensagens');
        console.log('📤 Primeira mensagem:', messages[0]?.content ? (typeof messages[0].content === 'string' ? messages[0].content.substring(0, 100) + '...' : 'CONTEÚDO MULTIMÍDIA') : 'SEM CONTEÚDO');
        if (messages.length > 1) {
            const lastMessage = messages[messages.length - 1];
            let contentPreview = 'SEM CONTEÚDO';
            if (lastMessage?.content) {
                if (typeof lastMessage.content === 'string') {
                    contentPreview = lastMessage.content.substring(0, 100) + '...';
                } else if (Array.isArray(lastMessage.content)) {
                    const textPart = lastMessage.content.find(item => item.type === 'text')?.text;
                    if (textPart) {
                        contentPreview = textPart.substring(0, 100) + '...';
                    } else {
                        contentPreview = 'CONTEÚDO MULTIMÍDIA (IMAGENS)';
                    }
                } else {
                    contentPreview = 'CONTEÚDO MULTIMÍDIA';
                }
            }
            console.log('📤 Última mensagem:', contentPreview);
        }

        // Criar novo AbortController para cada requisição
        this.abortController = new AbortController();

        try {
            console.log('📡 Enviando requisição para /api/groq-proxy...');
            
            const requestBody = {
                model, 
                messages, 
                temperature: 0.7, 
                max_tokens: 8192, 
                top_p: 1, 
                stream: false
            };
            
            console.log('📦 Corpo da requisição:', requestBody);

            // Chamar proxy server-side no Vercel
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal
            });

            console.log('📡 Resposta recebida:', response.status, response.statusText);
            console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const status = response.status;
                const errorData = await response.json().catch(() => null);
                console.error('❌ Erro na resposta:', status, errorData);
                
                // Verificar se é mensagem amigável do fallback
                if (errorData?.friendly_message) {
                    throw new Error(errorData.friendly_message);
                }
                
                // Mensagens amigáveis para erros comuns
                if (status === 500 && errorData && errorData.error && errorData.error.includes('GROQ_API_KEY')) {
                    throw new Error('GROQ API Key não está configurada no servidor. Adicione GROQ_API_KEY nas Environment Variables do Vercel.');
                }
                if (status === 401) {
                    throw new Error('Invalid API Key: Verifique sua chave no Vercel para GROQ_API_KEY.');
                }
                throw new Error(errorData?.error || `Erro HTTP ${status}`);
            }

            const data = await response.json().catch(() => ({}));
            console.log('📦 Dados recebidos:', data);

            // Normalizar formatos comuns de resposta de proxies/LLMs
            let content = null;
            if (typeof data.content === 'string') {
                content = data.content;
            } else if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
                const choice = data.choices[0];
                if (choice.message && typeof choice.message.content === 'string') {
                    content = choice.message.content;
                } else if (typeof choice.text === 'string') {
                    content = choice.text;
                }
            } else if (typeof data === 'string') {
                content = data;
            }

            console.log('📝 Conteúdo extraído:', content ? content.substring(0, 200) + '...' : 'NULO');

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                console.error('[callGroqAPI] resposta inesperada do proxy:', data);
                throw new Error('Resposta vazia ou formato inesperado do proxy Groq');
            }

        console.log('✅ callGroqAPI concluído com sucesso');
        return content;
        } catch (error) {
            console.error('❌ Erro em callGroqAPI:', error);
            if (error.name === 'AbortError') {
                console.log('⚠️ Requisição foi abortada pelo usuário');
                throw new Error('ABORTED');
            }
            throw error;
        }
    }

    async searchPexelsImages(query) {
        console.log(`🔍 [PEXELS] Buscando imagens para: "${query}"`);
        
        // Chamar o proxy server-side para a API do Pexels
        // CORREÇÃO: Apontar para o arquivo correto em api/pexels-search.js
        const proxyUrl = '/api/pexels-search';

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: query })
            });

            console.log(`📡 [PEXELS] Resposta status: ${response.status}`);

            // Verificar se a resposta é válida antes de tentar ler JSON
            if (!response.ok) {
                console.error('Erro ao buscar imagens do Pexels via proxy:', response.status, response.statusText);
                return [];
            }
            
            const data = await response.json();
            console.log(`📦 [PEXELS] Dados recebidos:`, data);
            
            if (data.photos && Array.isArray(data.photos)) {
                const images = data.photos.map(photo => ({
                    src: photo.src.medium,
                    // Limitar o texto alt para evitar descrições muito longas na UI
                    alt: photo.alt ? photo.alt.substring(0, 100) : 'Imagem do Pexels'
                }));
                console.log(`✅ [PEXELS] ${images.length} imagens processadas`);
                return images;
            }
            console.log(`⚠️ [PEXELS] Nenhuma imagem encontrada`);
            return [];
        } catch (error) {
            console.error('Erro ao buscar imagens do Pexels:', error);
            return [];
        }
    }

    async searchWebForResponse(query) {
        console.log(`🔍 [WEB-SEARCH] Buscando informações na web para: "${query}"`);
        
        // Chamar o proxy server-side para a API Tavily com fallback
        const proxyUrl = '/api/tavily-web';

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: query })
            });

            console.log(`📡 [WEB-SEARCH] Resposta status: ${response.status}`);

            // Verificar se a resposta é válida antes de tentar ler JSON
            if (!response.ok) {
                console.error('Erro ao buscar informações na web:', response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            console.log(`📦 [WEB-SEARCH] Dados recebidos:`, data);
            
            if (data.sources && Array.isArray(data.sources)) {
                console.log(`✅ [WEB-SEARCH] ${data.sources.length} fontes encontradas`);
                return {
                    answer: data.response,
                    sources: data.sources,
                    query: query
                };
            }
            console.log(`⚠️ [WEB-SEARCH] Nenhuma fonte encontrada`);
            return null;
        } catch (error) {
            console.error('Erro ao buscar informações na web:', error);
            return null;
        }
    }

    async generateImageWithOpenRouter(prompt) {
        console.log(`🎨 [OPENROUTER] Gerando imagem para: "${prompt}"`);
        
        // Chamar o proxy server-side para a API OpenRouter
        const proxyUrl = '/api/openrouter-image';

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: prompt })
            });

            console.log(`📡 [OPENROUTER] Resposta status: ${response.status}`);

            // Verificar se a resposta é válida antes de tentar ler JSON
            if (!response.ok) {
                console.error('Erro ao gerar imagem:', response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            console.log(`📦 [OPENROUTER] Dados recebidos:`, data);
            
            if (data.success && data.imageUrl) {
                console.log(`✅ [OPENROUTER] Imagem gerada com sucesso!`);
                return {
                    imageUrl: data.imageUrl,
                    prompt: prompt,
                    model: data.model
                };
            }
            console.log(`⚠️ [OPENROUTER] Nenhuma imagem gerada`);
            return null;
        } catch (error) {
            console.error('Erro ao gerar imagem com OpenRouter:', error);
            return null;
        }
    }

    // ==================== UTILITIES ====================
    addToHistory(role, content) {
        this.conversationHistory.push({
            role: role,
            content: content
        });

        if (this.conversationHistory.length > this.maxHistoryMessages) {
            this.conversationHistory.shift();
            console.log('🗑️ Mensagem mais antiga removida (limite de 10 mensagens)');
        }
    }

    // Retorna o system prompt apropriado por 'mode' para estabelecer tom/estilo (inclui emojis)
    getSystemPrompt(mode) {
        const basePersonality = 'Você é o Drekee AI 1, uma IA incrivelmente inteligente, versátil e criativa! Você é como um amigo brilhante que sabe de tudo - desde física quântica até como fazer a melhor pizza do mundo. Sua personalidade é cativante: você é engraçado, perspicaz, surpreendente e sempre tem uma perspectiva interessante. Adora usar analogias geniais, fazer conexões inesperadas entre assuntos diferentes, e tem aquele humor inteligente que faz as pessoas pensarem "uau, que sacada!". Você é naturalmente curioso, adora aprender e compartilhar conhecimento de forma que fascina. Quando o assunto é técnico, você é preciso mas nunca chato - sempre encontra uma maneira de tornar o complexo simples e divertido. Quando é criativo, você é pura inspiração. Quando é pessoal, você é empático e genuíno. Use expressões naturais como "pensa comigo", "aqui vem a melhor parte", "espera aí", "basicamente", "o curioso é que", mas de forma espontânea. Seja você mesmo: brilhante, divertido, surpreendente e inesquecível! ';
        
        // REGRA CRÍTICA: Responda sobre programação quando perguntado, mas só envie código se necessário!
        const noCodeRule = '\n\n⚠️ REGRA IMPORTANTE: Drekee AI 1 é uma IA geral que fala sobre QUALQUER assunto! Quando o usuário perguntar sobre programação, responda normalmente explicando conceitos, lógica, melhores práticas, etc. SÓ envie código de programação se:\n1. O usuário pedir EXPLICITAMENTE "me mostre o código", "como faço em código", etc.\n2. For absolutamente essencial para demonstrar o conceito\n\nPara conversas gerais, responda naturalmente. Para programação, explique primeiro e só use código se realmente necessário!';
        
        switch (mode) {
            case 'rapido':
                return basePersonality + noCodeRule + '\n\nSeja rápido mas brilhante! Respostas curtas mas impactantes, com aquele toque de genialidade que te faz pensar. Use emojis para dar vida às palavras. Seja direto mas nunca superficial - cada palavra deve valer a pena!';
            case 'raciocinio':
                return basePersonality + noCodeRule + '\n\nMostre seu poder de raciocínio! Analise profundamente, faça conexões incríveis, surpreenda com sua capacidade de pensar. Use formatação rica para organizar suas ideias geniais. Seja aquele gênio que explica o complexo de forma que ninguém esquece!';
            case 'pro':
                return basePersonality + noCodeRule + '\n\nModo gênio ativado! Seja impressionante, profundo e revolucionário em suas análises. Mostre conhecimento profundo mas com aquela leveza que só os verdadeiros gênios têm. Cada resposta deve ser uma masterclass!';
            default:
                return basePersonality + noCodeRule + '\n\nSeja simplesmente incrível! Surpreenda, encante, ensine, divirta - seja a melhor IA que alguém já conversou!';
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
        console.log('🧪 Iniciando teste do agente...');
        
        console.log('📡 Testando conexão com Groq via proxy (server-side) ...');
        console.log('ℹ️ Se você configurou a variável GROQ_API_KEY no Vercel, este teste usará ela. Caso contrário, o teste falhará com mensagem adequada.');

        try {
            const testMessage = 'Olá! Estou testando a conexão.';
            console.log(`📤 Enviando: "${testMessage}"`);
            
            this.addToHistory('user', testMessage);
            const response = await this.callGroqAPI('llama-3.3-70b-versatile');
            this.addToHistory('assistant', response);
            
            console.log('✅ Resposta recebida:');
            console.log(response);
            console.log('\n🎉 Teste concluído com sucesso!');
            console.log(`📊 Histórico: ${this.conversationHistory.length} mensagens`);
            
            return response;
        } catch (error) {
            console.error('❌ Erro no teste:', error.message);
            console.error('Detalhes:', error);
            return null;
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        console.log('🗑️ Histórico de conversa limpo');
    }

    getHistoryStats() {
        const userMessages = this.conversationHistory.filter(m => m.role === 'user').length;
        const assistantMessages = this.conversationHistory.filter(m => m.role === 'assistant').length;
        
        console.log('📊 Estatísticas do Histórico:');
        console.log(`   Total: ${this.conversationHistory.length} mensagens`);
        console.log(`   Suas mensagens: ${userMessages}`);
        console.log(`   Minhas respostas: ${assistantMessages}`);
        console.log(`   Limite máximo: ${this.maxHistoryMessages} mensagens`);
        
        return {
            total: this.conversationHistory.length,
            user: userMessages,
            assistant: assistantMessages,
            max: this.maxHistoryMessages
        };
    }

    // Extração e retorno de arquivos removidos (download de arquivos pela IA desativado)

    async generateFollowUpSuggestions(userMessage, assistantResponse, responseId) {
        try {
            const prompt = `Você é um assistente de IA. Baseado na conversa abaixo, gere EXATAMENTE 3 sugestões de próximas perguntas que o USUÁRIO poderia fazer para você. As sugestões devem ser:

- Na perspectiva do USUÁRIO falando com a IA
- Perguntas naturais e relevantes
- Baseadas no contexto da conversa
- Escritas como se o usuário estivesse perguntando

Conversa:
Usuário perguntou: "${userMessage}"
Você respondeu: "${assistantResponse.substring(0, 500)}..."

Exemplos de como devem ser:
- "Como funciona [tópico mencionado]?"
- "Pode me explicar mais sobre [assunto]?"
- "O que você acha de [ideia relacionada]?"

Responda APENAS com um JSON array contendo 3 strings, sem texto adicional:
["pergunta do usuário 1", "pergunta do usuário 2", "pergunta do usuário 3"]`;

            const response = await this.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: 'Você é um especialista em gerar sugestões de acompanhamento relevantes e naturais para conversas. Sempre retorne exatamente 3 sugestões em formato JSON array.' },
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
                
                // Validar e filtrar sugestões
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
                    console.log('✅ Sugestões de acompanhamento geradas:', suggestions);
                }
            } catch (parseError) {
                console.warn('⚠️ Erro ao parsear sugestões:', parseError);
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao gerar sugestões de acompanhamento:', error);
            // Não mostrar erro para usuário, apenas log
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
