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

    async processMessage(userMessage, attachedFilesFromUI = null) {
        console.log('📨 Mensagem para processar:', userMessage.substring(0, 100) + '...');
        console.log('📨 Tamanho total:', userMessage.length, 'caracteres');

        // Se a UI passou arquivos explicitamente, priorizamos esses (máx 3)
        let parsedFiles = [];
        if (attachedFilesFromUI && Array.isArray(attachedFilesFromUI) && attachedFilesFromUI.length > 0) {
            parsedFiles = attachedFilesFromUI.slice(0, 3).map(f => ({ name: f.name, content: (f.content == null) ? '' : String(f.content) }));
            console.log('📁 Arquivos recebidos diretamente da UI:', parsedFiles.map(f => `${f.name} (${(f.content||'').length} chars)`));
            const emptyFiles = parsedFiles.filter(f => !f.content || f.content.trim().length === 0);
            if (emptyFiles.length > 0) {
                const names = emptyFiles.map(f => f.name).join(', ');
                const warning = `❗ Alguns arquivos anexados estão vazios ou não foram salvos corretamente: ${names}. Por favor, verifique os arquivos.`;
                console.warn(warning);
                this.ui.addAssistantMessage(warning);
                return; // Bloquear processamento
            }
            // Preparar blocos para envio ao modelo
            this.lastParsedFiles = parsedFiles;
            this.extraMessagesForNextCall = [{ role: 'system', content: parsedFiles.map(f => `---FILE: ${f.name}---\n${f.content}\n---END FILE---`).join('\n\n') }];
            console.log('➡️ Arquivos anexados preparados para envio:', parsedFiles.map(f => f.name).join(', '));
            this.useMistralForThisMessage = true;
        } else {
            this.lastParsedFiles = [];
            this.extraMessagesForNextCall = null;
            this.useMistralForThisMessage = false;

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
        
        if (this.currentModel === 'rapido') {
            await this.processRapidoModel(userMessage);
        } else if (this.currentModel === 'raciocinio') {
            if (this.useMistralForThisMessage) {
                await this.processMistralModel(userMessage);
            } else {
                await this.processRaciocioModel(userMessage);
            }
        } else if (this.currentModel === 'pro') {
            await this.processProModel(userMessage);
        }
        
        this.isGenerating = false;
        this.ui.updateSendButtonToSend();
    }
    // ==================== MODELO MISTRAL (codestral-latest) ====================
    async processMistralModel(userMessage) {
        // Usamos proxy server-side; não é obrigatório ter chave no localStorage para o deploy no Vercel
        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();
        this.ui.setThinkingHeader('Processando com Mistral (codestral-latest)...', messageContainer.headerId);
        await this.ui.sleep(800);
        this.addToHistory('user', userMessage);
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

            let systemPrompt = {
                role: 'system',
                content: 'Você é o Lhama Code 1, um assistente de código inteligente. Forneça respostas COMPLETAS e ESTRUTURADAS com: múltiplos parágrafos bem organizados, **palavras em negrito** para destacar conceitos, listas com • ou números, tópicos claros com headings, e quando apropriado use tabelas (em formato markdown), notação matemática (com $símbolos$ para inline ou $$blocos$$), e diagramas em ASCII. Evite blocos enormes de código - prefira explicações visuais. Seja técnico mas acessível.'
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
            this.ui.setResponseText(response, messageContainer.responseId);
            await this.ui.sleep(500);
            this.ui.closeThinkingSteps(messageContainer.headerId);
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

        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('Processando sua solicitação de forma rápida...', messageContainer.headerId);
        await this.ui.sleep(800);

        const stepId = `step_${timestamp}`;
        this.ui.addThinkingStep('flash_on', 'Consultando Groq Llama 3.1 8B Instant', stepId, messageContainer.stepsId);
        await this.ui.sleep(1500);

        this.addToHistory('user', userMessage);

        try {
            const messages = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('rapido') },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : undefined;
            let response = await this.callGroqAPI('llama-3.1-8b-instant', messages);
            // limpar extras para próxima chamada
            this.extraMessagesForNextCall = null;
            this.ui.updateThinkingStep(stepId, 'check_circle', 'Resposta gerada com sucesso');
            await this.ui.sleep(500);

            this.addToHistory('assistant', response);
            this.ui.setResponseText(response, messageContainer.responseId);
            
            // Fechar raciocínio quando terminar
            await this.ui.sleep(500);
            this.ui.closeThinkingSteps(messageContainer.headerId);

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
            this.ui.updateThinkingStep(stepId, 'error', 'Erro ao processar');
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem. ' + error.message, messageContainer.responseId);
            console.error('Erro no Modelo Rápido:', error);
        }
    }

    // ==================== MODELO RACIOCÍNIO ====================
    async processRaciocioModel(userMessage) {
        // Usamos proxy server-side (/api/groq-proxy) que utiliza GROQ_API_KEY em Vercel.
        // Não é necessário ter chave no localStorage para deploy em produção.

        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('Entendi sua solicitação, estou processando...', messageContainer.headerId);
        await this.ui.sleep(1200);

        // PRIMEIRA ETAPA: Gerar checks personalizados via IA econômica
        console.log('🔄 Gerando checks personalizados...');
        
        let thinkingChecks = await this.generateChecksSafely(userMessage);
        
        // Mostrar checks gerados
        for (let i = 0; i < thinkingChecks.length; i++) {
            const stepId = `step_${timestamp}_${i}`;
            const checkText = thinkingChecks[i].step;
            
            this.ui.addThinkingStep('schedule', checkText, stepId, messageContainer.stepsId);
            
            // Delay variável entre checks para parecer mais natural
            const delay = 1500 + Math.random() * 1500;
            await this.ui.sleep(delay);
            
            this.ui.updateThinkingStep(stepId, 'check_circle', checkText);
            await this.ui.sleep(300);
        }

        this.addToHistory('user', userMessage);

        try {
            // SEGUNDA ETAPA: Gerar resposta com modelo principal (Mistral - codestral-latest)
            let systemPrompt;
            systemPrompt = { role: 'system', content: this.getSystemPrompt(this.currentModel) };
            const messages = this.extraMessagesForNextCall ? [systemPrompt, ...this.extraMessagesForNextCall, ...this.conversationHistory] : undefined;
            // Usar um modelo Groq de raciocínio por padrão
            const modelName = 'llama-3.3-70b-versatile';
            console.log('🧭 Usando modelo Groq:', modelName);
            let response = await this.callGroqAPI(modelName, messages);
            this.extraMessagesForNextCall = null;
            
            // Tentar extrair arquivos gerados na resposta e anexá-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(response);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    // Remover o bloco de arquivos do texto antes de exibir para usuário
                    response = response.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta Groq:', e);
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
            this.ui.setResponseText(response, messageContainer.responseId);
            
            // Fechar raciocínio quando terminar
            await this.ui.sleep(500);
            this.ui.closeThinkingSteps(messageContainer.headerId);

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
    // 3 modelos Groq em 5 rounds + sintetizador
    async processProModel(userMessage) {
        // Usamos proxy server-side (/api/groq-proxy) que utiliza GROQ_API_KEY em Vercel.
        // Não é necessário ter chave no localStorage para deploy em produção.

        const messageContainer = this.ui.createAssistantMessageContainer();
        const timestamp = Date.now();

        this.ui.setThinkingHeader('🚀 Analisando com múltiplas perspectivas...', messageContainer.headerId);
        await this.ui.sleep(800);

        this.addToHistory('user', userMessage);

        try {
            // ========== ROUND 1: Análise paralela de 2 perspectivas ==========
            const step1aId = `step1a_${timestamp}`;
            this.ui.addThinkingStep('psychology', 'Perspectiva 1: Análise Rápida', step1aId, messageContainer.stepsId);
            const messages1 = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('rapido') },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : undefined;
            const resp1Promise = this.callGroqAPI('llama-3.1-8b-instant', messages1);

            const step1bId = `step1b_${timestamp}`;
            this.ui.addThinkingStep('psychology', 'Perspectiva 2: Análise Profunda', step1bId, messageContainer.stepsId);
            const messages2 = this.extraMessagesForNextCall ? [
                { role: 'system', content: this.getSystemPrompt('raciocinio') },
                ...this.extraMessagesForNextCall,
                ...this.conversationHistory
            ] : undefined;
            const resp2Promise = this.callGroqAPI('llama-3.3-70b-versatile', messages2);

            // Esperar ambas em paralelo
            let [resp1, resp2] = await Promise.all([resp1Promise, resp2Promise]);
            // Extrair arquivos se existirem e remover do texto para não expor JSON no chat
            try {
                const parsed1 = this.parseFilesFromText(resp1);
                if (parsed1 && parsed1.length > 0) {
                    this.attachGeneratedFilesToChat(parsed1);
                    resp1 = resp1.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) { console.warn('⚠️ Falha parsing arquivos de resp1:', e); }
            try {
                const parsed2 = this.parseFilesFromText(resp2);
                if (parsed2 && parsed2.length > 0) {
                    this.attachGeneratedFilesToChat(parsed2);
                    resp2 = resp2.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) { console.warn('⚠️ Falha parsing arquivos de resp2:', e); }
            
            this.ui.updateThinkingStep(step1aId, 'check_circle', '✅ Perspectiva 1');
            this.ui.updateThinkingStep(step1bId, 'check_circle', '✅ Perspectiva 2');
            await this.ui.sleep(1200);

            // ========== ROUND 2: Cross-review - cada perspectiva valida a outra ==========
            const step2aId = `step2a_${timestamp}`;
            this.ui.addThinkingStep('compare_arrows', 'Review 1→2: Validação Cruzada', step2aId, messageContainer.stepsId);
            
            const review1Promise = this.callGroqAPI('llama-3.1-8b-instant', [
                {
                    role: 'system',
                    content: 'Você é um revisor crítico. Avalie a resposta de outro modelo e identifique: 1) O que está certo, 2) O que poderia melhorar, 3) Detalhes que faltam. Seja breve e direto.'
                },
                {
                    role: 'user',
                    content: `Pergunta original: "${userMessage}"\n\nResposta a revisar:\n${resp2}\n\nFaça uma revisão crítica breve.`
                }
            ]);

            const step2bId = `step2b_${timestamp}`;
            this.ui.addThinkingStep('compare_arrows', 'Review 2→1: Validação Cruzada', step2bId, messageContainer.stepsId);
            
            const review2Promise = this.callGroqAPI('llama-3.3-70b-versatile', [
                {
                    role: 'system',
                    content: 'Você é um revisor crítico. Avalie a resposta de outro modelo e identifique: 1) O que está certo, 2) O que poderia melhorar, 3) Detalhes que faltam. Seja breve e direto.'
                },
                {
                    role: 'user',
                    content: `Pergunta original: "${userMessage}"\n\nResposta a revisar:\n${resp1}\n\nFaça uma revisão crítica breve.`
                }
            ]);

            const [review1, review2] = await Promise.all([review1Promise, review2Promise]);
            
            this.ui.updateThinkingStep(step2aId, 'check_circle', '✅ Review 1→2');
            this.ui.updateThinkingStep(step2bId, 'check_circle', '✅ Review 2→1');
            await this.ui.sleep(1200);

            // ========== SÍNTESE: Consolidar em resposta final ==========
            const stepSynthId = `stepsynth_${timestamp}`;
            this.ui.addThinkingStep('build', 'Consolidação: Síntese Final', stepSynthId, messageContainer.stepsId);
            
            const synthMessages = [
                {
                    role: 'system',
                    content: this.getSystemPrompt('pro') + ' Você é um sintetizador especializado. Sua ÚNICA função é consolidar duas análises completas em UMA ÚNICA resposta final coerente e equilibrada. Inclua os melhores pontos de ambas as perspectivas. NÃO adicione informações novas.'
                },
                {
                    role: 'user',
                    content: `Pergunta original: "${userMessage}"\n\n=== PERSPECTIVA 1 (Rápida) ===\n${resp1}\n\n=== PERSPECTIVA 2 (Profunda) ===\n${resp2}\n\n=== FEEDBACK CRUZADO ===\nReview de 2 sobre 1: ${review1}\nReview de 1 sobre 2: ${review2}\n\nAgora, CONSOLIDE tudo em UMA resposta final única, equilibrada e bem estruturada.`
                }
            ];
            // Se houver arquivos anexados, incluí-los temporariamente nas mensagens de síntese
            if (this.extraMessagesForNextCall) {
                synthMessages.splice(1, 0, ...this.extraMessagesForNextCall);
            }
            let finalResponse = await this.callGroqAPI('llama-3.1-8b-instant', synthMessages);
            this.extraMessagesForNextCall = null;
            this.ui.updateThinkingStep(stepSynthId, 'check_circle', '✅ Síntese Concluída');

            

            // Tentar extrair arquivos gerados na resposta de síntese e anexá-los ao chat
            try {
                const parsedFiles = this.parseFilesFromText(finalResponse);
                if (parsedFiles && parsedFiles.length > 0) {
                    this.attachGeneratedFilesToChat(parsedFiles);
                    // remover bloco do texto para apresentação
                    finalResponse = finalResponse.replace(/---FILES-JSON---[\s\S]*?---END-FILES-JSON---/i, '').trim();
                }
            } catch (e) {
                console.warn('⚠️ Falha parsing arquivos de resposta (Pro):', e);
            }

            this.addToHistory('assistant', finalResponse);
            this.ui.setResponseText(finalResponse, messageContainer.responseId);
            
            // Fechar raciocínio quando terminar
            await this.ui.sleep(500);
            this.ui.closeThinkingSteps(messageContainer.headerId);

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

            console.log('🎉 Modelo Pro concluído com sucesso!');

        } catch (error) {
            if (error.message === 'ABORTED') {
                console.log('⚠️ Geração interrompida pelo usuário');
                return;
            }
            console.error('Erro no Modelo Pro:', error);
            this.ui.setResponseText('Desculpe, ocorreu um erro ao processar sua mensagem no modo Pro. ' + error.message, messageContainer.responseId);
        }
    }

    // ==================== APIS ====================
    // Gemini API methods removed (attachments/Gemini integration disabled)

async callGroqAPI(model, customMessages = null) {
    // Not required to have a client-side Groq API key when using server-side proxy
    // The proxy will use GROQ_API_KEY from environment variables on Vercel
    
    // System prompts diferenciados por modelo
        let systemPrompt;
        if (this.currentModel === 'rapido') {
            systemPrompt = {
                role: 'system',
                content: 'Você é o Lhama Code 1, um assistente de código rápido e direto. Mantenha as respostas BREVES e CONCISAS - máximo 2-3 parágrafos. Evite elaborações desnecessárias. Vá direto ao ponto.'
            };
        } else {
            // Raciocínio e Pro - respostas ricas
            systemPrompt = {
                role: 'system',
                content: 'Você é o Lhama Code 1, um assistente de código inteligente. Forneça respostas COMPLETAS e ESTRUTURADAS com: múltiplos parágrafos bem organizados, **palavras em negrito** para destacar conceitos, listas com • ou números, tópicos claros com headings, e quando apropriado use tabelas (em formato markdown), notação matemática (com $símbolos$ para inline ou $$blocos$$), e diagramas em ASCII. Evite blocos enormes de código - prefira explicações visuais. Seja técnico mas acessível.'
            };
        }

        const messages = customMessages || [systemPrompt, ...this.conversationHistory];

        // Criar novo AbortController para cada requisição
        this.abortController = new AbortController();

        try {
            // Chamar proxy server-side no Vercel
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 8192, top_p: 1, stream: false }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const status = response.status;
                const text = await response.text().catch(() => null);
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

            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                console.error('[callGroqAPI] resposta inesperada do proxy:', data);
                throw new Error('Resposta vazia ou formato inesperado do proxy Groq');
            }

            return content;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('⚠️ Requisição foi abortada pelo usuário');
                throw new Error('ABORTED');
            }
            throw error;
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
        switch (mode) {
            case 'rapido':
                return 'Você é o Lhama Code 1, um assistente gentil, adorável e otimista 😊. Use um tom caloroso e amigável, inclua emojis com leveza para reforçar emoções, e mantenha as respostas BREVES e objetivas (2-3 parágrafos máximo). Seja educado, encorajador e prático.';
            case 'raciocinio':
                return 'Você é o Lhama Code 1, um assistente técnico e claro 🙂. Use emojis de forma moderada para tornar o texto mais acessível. Forneça respostas COMPLETAS e ESTRUTURADAS com exemplos e explicações claras.';
            case 'pro':
                return 'Você é o Lhama Code 1, um assistente profissional e formal 🧑‍💼. Use linguagem precisa e formal; inclua emojis pontualmente para dar tom (com parcimônia). Forneça análises detalhadas, recomendações e justificativas bem fundamentadas.';
            default:
                return 'Você é o Lhama Code 1, um assistente de código. Forneça respostas claras e úteis, com boa estrutura e exemplos quando adequado.';
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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
