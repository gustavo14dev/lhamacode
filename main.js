import { Agent } from './agent.js';
import { TimelineSystem } from './timeline-system.js';
import { ProactiveSuggestions } from './proactive-system.js';
import { PreferenceLearning } from './preference-system.js';

// Sistema de Depuração (carregado dinamicamente)
let DebugSystem = null;

// Flag de debug global (desativar em produção)
const DEBUG = false;

class UI {
    constructor() {
        this.isTransitioned = false;
        this.agent = new Agent(this);
        this.attachedFiles = []; // Lista temporária de anexos (máx 3)
        this.chats = this.loadChats();
        this.currentChatId = null;
        this.currentModel = 'raciocinio';
        
        // Inicializar sistemas de melhoria
        this.timeline = new TimelineSystem(this);
        this.suggestions = new ProactiveSuggestions(this.agent, this);
        this.preferences = new PreferenceLearning();
        
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            titleSection: document.getElementById('titleSection'),
            chatArea: document.getElementById('chatArea'),
            messagesContainer: document.getElementById('messagesContainer'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendButton'),
            addCodeButton: document.getElementById('addCodeButton'),
            attachedFilesContainer: document.getElementById('attachedFilesContainer'),
            newChatBtn: document.getElementById('newChatBtn'),
            chatHistoryList: document.getElementById('chatHistoryList'),
            modelButton: document.getElementById('modelButton'),
            modelDropdown: document.getElementById('modelDropdown'),
            modelButtonText: document.getElementById('modelButtonText'),
            scrollToBottomBtn: document.getElementById('scrollToBottomBtn')
        };

        // Debug (somente se flag ativada)
        if (DEBUG) {
            console.log('✅ Elementos carregados:', {
                modelButton: !!this.elements.modelButton,
                modelDropdown: !!this.elements.modelDropdown,
                modelButtonText: !!this.elements.modelButtonText
            });
        }

        this.init();
    }

    loadChats() {
        const saved = localStorage.getItem('lhama_chats');
        if (!saved) return [];
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('lhama_chats corrompido, limpando storage');
            localStorage.removeItem('lhama_chats');
            return [];
        }
    }

    saveChats() {
        localStorage.setItem('lhama_chats', JSON.stringify(this.chats));
    }

    createNewChat() {
        const chatId = Date.now().toString();
        const chat = {
            id: chatId,
            title: 'Nova Conversa',
            messages: [],
            created: new Date().toLocaleString('pt-BR'),
            updated: new Date().toLocaleString('pt-BR')
        };
        this.chats.unshift(chat);
        this.saveChats();
        this.openChat(chatId);
        this.renderChatHistory();

        // Observer: quando uma nova mensagem é adicionada ao container, rolar imediatamente para o final
        try {
            this._messagesObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length > 0) {
                        const last = this.elements.messagesContainer.lastElementChild;
                        if (last) {
                            try { last.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch(e) {}
                            this.scrollToBottom();
                        }
                    }
                }
            });
            this._messagesObserver.observe(this.elements.messagesContainer, { childList: true });
        } catch (e) {
            // Fallback silencioso se MutationObserver não estiver disponível
        }
    }

    deleteChat(chatId) {
        if (!confirm('Tem certeza que quer excluir essa conversa?')) {
            return;
        }
        
        this.chats = this.chats.filter(c => c.id !== chatId);
        this.saveChats();
        
        if (this.currentChatId === chatId) {
            this.elements.messagesContainer.innerHTML = '';
            this.currentChatId = null;
        }
        
        this.renderChatHistory();
    }

    clearAllHistory() {
        if (!confirm('Tem certeza que quer excluir TODO o histórico? Isso não pode ser desfeito.')) {
            return;
        }
        
        this.chats = [];
        this.currentChatId = null;
        this.elements.messagesContainer.innerHTML = '';
        this.saveChats();
        this.renderChatHistory();
    }

    openChat(chatId) {
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.elements.messagesContainer.innerHTML = '';

        if (DEBUG) {
            console.log('📂 Abrindo chat:', chatId);
            console.log('📝 Mensagens do chat:', chat.messages.length);
        }

        chat.messages.forEach((msg, index) => {
            if (DEBUG) console.log(`  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
            if (msg.role === 'user') {
                this.addUserMessage(msg.content);
            } else {
                this.addAssistantMessage(msg.content, msg.thinking);
            }
        });

        if (!this.isTransitioned) {
            this.transitionToChat();
        }

        this.scrollToBottom();
        this.renderChatHistory();
    }

    saveCurrentChat() {
        if (!this.currentChatId) return;
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            chat.updated = new Date().toLocaleString('pt-BR');
            this.saveChats();
            this.renderChatHistory();
        }
    }

    renderChatHistory() {
        this.elements.chatHistoryList.innerHTML = '';
        if (this.chats.length === 0) {
            this.elements.chatHistoryList.innerHTML = '<div class="text-xs text-gray-400 dark:text-gray-500 px-3 py-6 text-center">Nenhuma conversa yet</div>';
            return;
        }

        this.chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = `p-3 rounded-lg cursor-pointer transition-all group flex items-center justify-between ${this.currentChatId === chat.id ? 'bg-primary/20 border border-primary' : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent'}`;
            chatDiv.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-700 dark:text-gray-200 truncate"></div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1"></div>
                </div>
                <button class="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/30 rounded transition-all text-red-600 dark:text-red-400 flex-shrink-0" title="Excluir conversa" data-chat-id="${chat.id}">
                    <span class="material-icons-outlined text-sm">delete</span>
                </button>
            `;

            // preencher texto com textContent para evitar innerHTML inseguro
            const titleEl = chatDiv.querySelector('.font-medium');
            const updatedEl = chatDiv.querySelector('.text-xs');
            if (titleEl) titleEl.textContent = chat.title || 'Sem título';
            if (updatedEl) updatedEl.textContent = chat.updated || '';
            
            // Event listener pra abrir chat
            const chatContent = chatDiv.querySelector('div');
            chatContent.addEventListener('click', () => this.openChat(chat.id));
            
            // Event listener pra deletar
            const deleteBtn = chatDiv.querySelector('button');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });
            
            this.elements.chatHistoryList.appendChild(chatDiv);
        });
        
        // Adicionar botão de limpar tudo em baixo
        if (this.chats.length > 0) {
            const clearAllDiv = document.createElement('div');
            clearAllDiv.className = 'p-3 mt-4 border-t border-gray-200 dark:border-gray-700';
            clearAllDiv.innerHTML = `
                <button class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium transition-all" id="clearAllHistoryBtn">
                    <span class="material-icons-outlined text-base">delete_sweep</span>
                    Limpar histórico
                </button>
            `;
            this.elements.chatHistoryList.appendChild(clearAllDiv);
            
            // Event listener
            const clearBtn = clearAllDiv.querySelector('#clearAllHistoryBtn');
            clearBtn.addEventListener('click', () => this.clearAllHistory());
        }
    }

    init() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        });

        this.elements.sendButton.addEventListener('click', () => this.handleSend());

        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());

        // Anexar arquivo removido nesta versão (funcionalidade deletada a pedido) 
        
        // Botão de Modo Depuração
        const debugBtn = document.getElementById('debugModeButton');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.toggleDebugMode());
        }

        // Botão de anexar arquivo (ícone apenas)
        const attachBtn = document.getElementById('attachFileBtn');
        const chatFileInput = document.getElementById('fileInput');
        if (attachBtn && chatFileInput) {
            attachBtn.addEventListener('click', () => chatFileInput.click());
            chatFileInput.addEventListener('change', (e) => {
                const rawFiles = Array.from(e.target.files || []);
                if (rawFiles.length === 0) return;
                const limited = rawFiles.slice(0, 3);
                let anyAdded = false;
                const MAX_SIZE = 32 * 1024; // 32 KB por arquivo
                limited.forEach(f => {
                    if (f.size > MAX_SIZE) {
                        this.addAssistantMessage(`❗ O arquivo ${f.name} excede o limite de 32 KB e não será anexado.`);
                        return;
                    }
                    if (f.type.startsWith('text') || f.name.match(/\.html?$|\.js$|\.py$|\.css$|\.json$|\.md$|\.txt$/i)) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            this.attachedFiles.push({ name: f.name, content: String(reader.result), mime: f.type });
                            this.renderAttachedFiles();
                            console.log('📎 Arquivo anexado (UI):', f.name, '(', (reader.result||'').length, 'chars)');
                            this.addAssistantMessage(`📎 ${this.attachedFiles.length} arquivo(s) anexado(s). Ao enviar, será usado automaticamente o modelo 'codestral-latest' (Mistral) quando houver anexos.`);
                        };
                        reader.readAsText(f);
                        anyAdded = true;
                    } else {
                        this.addAssistantMessage(`❗ Tipo não suportado para leitura direta: ${f.name}. Apenas arquivos de texto/código são processados.`);
                    }
                });
                if (!anyAdded && rawFiles.length > 0) {
                    this.addAssistantMessage('❗ Nenhum arquivo de texto foi anexado. Use arquivos .txt/.md/.js/.py/.json/.html/.css');
                }
                e.target.value = null;
            });
        }
        
        // Criar dropdown flutuante
        this.createFloatingDropdown();
        
        // Configurar botão de modelo com verificação
        const modelBtn = document.getElementById('modelButton');
        if (modelBtn) {
            modelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (DEBUG) console.log('🖱️ Botão modelo clicado!');
                this.toggleModelDropdown();
            });
        } else if (DEBUG) {
            console.error('❌ Botão de modelo não encontrado!');
        }
        
        document.addEventListener('click', (e) => {
            const floatingDropdown = document.getElementById('floatingModelDropdown');
            const modelBtn = document.getElementById('modelButton');
            if (floatingDropdown && !floatingDropdown.contains(e.target) && !modelBtn.contains(e.target)) {
                floatingDropdown.classList.add('hidden');
            }
        });

        this.setupModelSelector();
        
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Inicializar sistema de scroll automático
        this.initScrollSystem();

        this.renderChatHistory();
    }

    initScrollSystem() {
        // Estado do scroll do usuário
        this.isUserScrolling = false;
        this.scrollTimeout = null;

        // Event listener para detectar quando o usuário está rolando
        this.elements.chatArea.addEventListener('scroll', () => {
            this.handleScroll();
        });

        // Event listener para o botão de scroll para baixo
        this.elements.scrollToBottomBtn.addEventListener('click', () => {
            this.scrollToBottom();
        });
    }

    handleScroll() {
        // Marcar que o usuário está rolando
        this.isUserScrolling = true;

        // Limpar timeout anterior
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Verificar se deve mostrar/esconder o botão
        this.checkScrollButtonVisibility();

        // Resetar flag após 2 segundos sem scroll
        this.scrollTimeout = setTimeout(() => {
            this.isUserScrolling = false;
        }, 2000);
    }

    checkScrollButtonVisibility() {
        const chat = this.elements.chatArea;
        if (!chat) return;

        const scrollTop = chat.scrollTop;
        const scrollHeight = chat.scrollHeight;
        const clientHeight = chat.clientHeight;

        // Calcular quão longe da parte inferior o usuário está
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        // Mostrar botão se estiver mais de 200px do final
        if (distanceFromBottom > 200) {
            this.showScrollButton();
        } else {
            this.hideScrollButton();
        }
    }

    showScrollButton() {
        const btn = this.elements.scrollToBottomBtn;
        if (btn) {
            btn.classList.remove('opacity-0', 'pointer-events-none');
            btn.classList.add('opacity-100', 'pointer-events-auto');
        }
    }

    hideScrollButton() {
        const btn = this.elements.scrollToBottomBtn;
        if (btn) {
            btn.classList.remove('opacity-100', 'pointer-events-auto');
            btn.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    scrollToBottom() {
        const chat = this.elements.chatArea;
        if (!chat) return;
        // delega para implementação consolidada mais abaixo
        try {
            // Se existir implementação consolidada mais abaixo, ela sobrescreverá esta função.
            chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
        } catch (e) {
            try { chat.scrollTop = chat.scrollHeight; } catch (e) {}
        }
    }

    createFloatingDropdown() {
        // Remover dropdown anterior se existir
        const existing = document.getElementById('floatingModelDropdown');
        if (existing) existing.remove();

        const dropdownHTML = `
            <div id="floatingModelDropdown" class="hidden fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[200]" style="min-width: 180px;">
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 first:rounded-t-lg" data-model="rapido">
                    <span class="material-icons-outlined text-base text-blue-400">flash_on</span>
                    Rápido
                </button>
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-primary/20 dark:bg-primary/20 hover:bg-primary/30 dark:hover:bg-primary/30 transition-colors flex items-center gap-2" data-model="raciocinio">
                    <span class="material-icons-outlined text-base text-primary">check_circle</span>
                    Raciocínio (atual)
                </button>
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 last:rounded-b-lg" data-model="pro">
                    <span class="material-icons-outlined text-base text-purple-400">diamond</span>
                    Pro
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dropdownHTML);
        
        // Setup dos botões do dropdown
        const buttons = document.querySelectorAll('#floatingModelDropdown button[data-model]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!btn.disabled) {
                    const model = btn.dataset.model;
                    this.setModel(model);
                    document.getElementById('floatingModelDropdown').classList.add('hidden');
                }
            });
        });
    }

    toggleModelDropdown() {
        const dropdown = document.getElementById('floatingModelDropdown');
        const modelBtn = document.getElementById('modelButton');
        
        if (!dropdown || !modelBtn) {
            console.error('❌ Elementos não encontrados!');
            return;
        }

        if (dropdown.classList.contains('hidden')) {
            // Mostrar dropdown
            dropdown.classList.remove('hidden');
            
            // Posicionar acima do botão
            const rect = modelBtn.getBoundingClientRect();
            const dropdownHeight = dropdown.offsetHeight;
            const topPosition = rect.top - dropdownHeight - 8;
            
            dropdown.style.top = topPosition + 'px';
            dropdown.style.left = rect.left + 'px';
            
            console.log('✅ Dropdown aberto em:', { top: topPosition, left: rect.left });
        } else {
            // Fechar dropdown
            dropdown.classList.add('hidden');
            console.log('✅ Dropdown fechado');
        }
    }

    setupModelSelector() {
        // Já feito no createFloatingDropdown
    }

    setModel(model) {
        this.currentModel = model;
        const modelNames = {
            'rapido': 'Rápido',
            'raciocinio': 'Raciocínio',
            'pro': 'Pro'
        };
        
        const modelIcons = {
            'rapido': 'flash_on',
            'raciocinio': 'psychology',
            'pro': 'diamond'
        };
        
        const modelColors = {
            'rapido': 'text-blue-400',
            'raciocinio': 'text-orange-500',
            'pro': 'text-purple-400'
        };

        // Atualizar botão principal
        const modelBtn = document.getElementById('modelButton');
        if (modelBtn) {
            const icon = modelBtn.querySelector('.material-icons-outlined:first-child');
            const text = document.getElementById('modelButtonText');
            
            if (icon) {
                icon.textContent = modelIcons[model];
                icon.className = `material-icons-outlined text-base ${modelColors[model]}`;
            }
            if (text) {
                text.textContent = modelNames[model];
            }
        }
        
        this.agent.setModel(model);
        
        // Atualizar indicador visual do dropdown
        const buttons = document.querySelectorAll('#floatingModelDropdown button[data-model]');
        buttons.forEach(btn => {
            if (btn.dataset.model === model) {
                btn.classList.add('bg-primary/20', 'dark:bg-primary/20');
                btn.classList.remove('hover:bg-gray-50', 'dark:hover:bg-white/5');
            } else {
                btn.classList.remove('bg-primary/20', 'dark:bg-primary/20');
                btn.classList.add('hover:bg-gray-50', 'dark:hover:bg-white/5');
            }
        });
    }

    async handleSend() {
        const message = this.elements.userInput.value.trim();
        
        // Se modo depuração está ativo e há mensagem, analisar como erro
        if (this.debugModeActive && message) {
            await this.analyzeErrorWithDebug(message);
            this.elements.userInput.value = '';
            return;
        }
        
        if (!message) return;

        if (!this.isTransitioned) {
            this.createNewChat();
            await this.sleep(300);
        }

        if (!this.currentChatId) {
            this.createNewChat();
        }

        let finalMessage = message;

        // Se há anexos, preparar snapshot para render e envio
        let sendFiles = null;
        let attachmentsSnapshot = null;
        if (this.attachedFiles && this.attachedFiles.length > 0) {
            // Garantir máximo 3
            this.attachedFiles = this.attachedFiles.slice(0, 3);
            finalMessage = this.buildMessageWithFiles(message);
            sendFiles = this.attachedFiles.map(f => ({ name: f.name, content: f.content }));
            // Snapshot reduzido para a UI (não incluir conteúdo completo no DOM)
            attachmentsSnapshot = this.attachedFiles.map(f => ({ name: f.name, mime: f.mime }));
            this.addAssistantMessage(`📎 ${this.attachedFiles.length} arquivo(s) anexado(s). A IA irá ler o conteúdo dos arquivos (máx 3).`);
        }

        // Adicionar mensagem do usuário (incluindo visualização dos anexos, se houver)
        this.addUserMessage(message, attachmentsSnapshot);
        this.elements.userInput.value = '';

        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            const msgObj = { role: 'user', content: message };
            if (attachmentsSnapshot) msgObj.attachments = attachmentsSnapshot;
            chat.messages.push(msgObj);
            this.saveCurrentChat();
        }

        await this.agent.processMessage(finalMessage, sendFiles);

        // Limpar anexos após envio
        this.attachedFiles = [];
        this.renderAttachedFiles();
    }

    buildMessageWithFiles(userMessage) {
        const MAX_PER_FILE = 8000;
        const normalized = (this.attachedFiles || []).slice(0, 3).map(f => {
            let content = String(f.content || '');
            let truncated = false;
            if (content.length > MAX_PER_FILE) {
                content = content.slice(0, MAX_PER_FILE);
                truncated = true;
            }
            return { name: f.name, content, truncated };
        });
        const jsonBlock = '\n---FILES-JSON---\n' + JSON.stringify({ files: normalized }) + '\n---END-FILES-JSON---\n';
        return userMessage + jsonBlock;
    }



    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'html': 'code',
            'css': 'style',
            'js': 'javascript',
            'json': 'data_object',
            'py': 'code',
            'java': 'code',
            'cpp': 'code',
            'c': 'code',
            'txt': 'description',
            'md': 'article'
        };
        return iconMap[ext] || 'insert_drive_file';
    }

    renderAttachedFiles() {
        if (!this.elements || !this.elements.attachedFilesContainer) return;
        this.elements.attachedFilesContainer.innerHTML = '';
        if (!this.attachedFiles || this.attachedFiles.length === 0) {
            this.elements.attachedFilesContainer.classList.add('hidden');
            return;
        }
        this.elements.attachedFilesContainer.classList.remove('hidden');
        this.attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'inline-flex items-center gap-2 px-3 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-600 rounded-lg text-sm';
            fileCard.innerHTML = `
                <span class="material-icons-outlined text-primary text-base">${this.getFileIcon(file.name)}</span>
                <span class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[180px]">${this.escapeHtml(file.name)}</span>
                <button class="material-icons-outlined text-gray-500 hover:text-red-500 text-sm" aria-label="Remover" data-index="${index}">close</button>
            `;
            const btn = fileCard.querySelector('button');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.attachedFiles.splice(index, 1);
                this.renderAttachedFiles();
            });
            this.elements.attachedFilesContainer.appendChild(fileCard);
        });
    }

    // ==================== MODO DEPURAÇÃO ====================
    toggleDebugMode() {
        const debugBtn = document.getElementById('debugModeButton');
        this.debugModeActive = !this.debugModeActive;
        
        if (this.debugModeActive) {
            // ATIVAR: Destacar com cor laranja
            debugBtn.classList.remove('border-gray-200', 'dark:border-gray-700', 'text-gray-600', 'dark:text-gray-300');
            debugBtn.classList.add('bg-orange-50', 'dark:bg-orange-950/30', 'border-orange-300', 'dark:border-orange-700', 'text-orange-700', 'dark:text-orange-300');
            debugBtn.innerHTML = '<span class="material-icons-outlined text-base">bug_report</span>Modo Depuração<span class="material-icons-outlined text-sm ml-1">close</span>';
        } else {
            // DESATIVAR: Voltar ao normal
            debugBtn.classList.remove('bg-orange-50', 'dark:bg-orange-950/30', 'border-orange-300', 'dark:border-orange-700', 'text-orange-700', 'dark:text-orange-300');
            debugBtn.classList.add('border-gray-200', 'dark:border-gray-700', 'text-gray-600', 'dark:text-gray-300');
            debugBtn.innerHTML = '<span class="material-icons-outlined text-base">bug_report</span>Modo Depuração';
        }
    }

    async analyzeErrorWithDebug(errorText) {
        try {
            // 1. Mostrar tela de chat
            this.elements.welcomeScreen.classList.add('hidden');
            this.elements.chatArea.classList.remove('hidden');
            
            // 2. Adicionar mensagem do usuário no chat
            this.addUserMessage(errorText);
            
            // 3. Mostrar "está pensando"
            this.showThinkingMessage('Analisando erro e gerando hipóteses...');
            
            // 4. Importar DebugSystem
            const DebugSystem = await import('./debug-system.js').then(m => m.default || Object.values(m)[0]);
            const debugInstance = new DebugSystem(this.agent, this);
            
            // 5. Analisar e renderizar direto no chat
            await debugInstance.analyzeError(errorText);
            
            // 6. Remover pensamento
            this.removeLastThinkingMessage();
            
            // 7. Salvar conversa (SEM DUPLICAR - card já foi renderizado)
            const chat = this.chats.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.messages.push({ 
                    role: 'assistant', 
                    content: '[Depuração Ativa]',
                    isDebugResult: true,
                    timestamp: Date.now()
                });
                this.saveCurrentChat();
            }
            
        } catch (error) {
            console.error('Erro ao inicializar Modo Depuração:', error);
            this.removeLastThinkingMessage();
            this.addAssistantMessage(`❌ Erro ao inicializar Modo Depuração: ${error.message}`);
        }
    }

    showThinkingMessage(text = 'A IA está pensando...') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn thinking-message';
        messageDiv.innerHTML = `
            <div class="w-full max-w-[85%] bg-surface-light dark:bg-surface-dark rounded-2xl px-5 py-4 shadow-soft border border-gray-100 dark:border-gray-700">
                <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div class="flex gap-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                    <span class="text-sm font-medium">${text}</span>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    removeLastThinkingMessage() {
        const thinkingMsg = this.elements.messagesContainer.querySelector('.thinking-message');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
    }




    viewFileModal(file) {
        if (!file) return;
        const lang = (file.name.split('.').pop() || 'txt').toLowerCase();
        const languageMap = { 'html': 'html', 'htm':'html', 'css':'css', 'js':'javascript', 'json':'json', 'py':'python', 'md':'markdown', 'txt':'plaintext' };
        const language = languageMap[lang] || 'plaintext';

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center animate-fadeIn';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const safeContent = this.escapeHtml(file.content || '');
        let highlighted = safeContent;
        try {
            if (window.hljs && language !== 'plaintext') {
                highlighted = hljs.highlight(safeContent, { language: language, ignoreIllegals: true }).value;
            }
        } catch (e) {
            highlighted = safeContent;
        }

        modal.innerHTML = `
            <div class="bg-gray-950 dark:bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[95%] max-w-3xl max-h-[80vh] overflow-hidden animate-scaleIn flex flex-col">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div class="flex items-center gap-3">
                        <span class="material-icons-outlined text-sm text-gray-300">${this.getFileIcon(file.name)}</span>
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-gray-300">${this.escapeHtml(file.name)}</span>
                            <span class="text-xs text-gray-400">${(file.truncated ? 'Conteúdo truncado' : '')}</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200" id="downloadFileBtn">Baixar</button>
                        <button class="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-xs rounded" id="copyFileBtn">Copiar</button>
                        <button onclick="this.closest('[class*=&quot;fixed inset-0&quot;]').remove()" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200">Fechar</button>
                    </div>
                </div>
                <div class="overflow-auto flex-1 p-5 bg-gray-900">
                    <pre class="m-0"><code class="hljs language-${language} text-sm font-mono text-gray-100 leading-relaxed">${highlighted}</code></pre>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Download handler
        const dlBtn = modal.querySelector('#downloadFileBtn');
        dlBtn.addEventListener('click', () => {
            const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        });

        // Copy handler
        const copyBtn = modal.querySelector('#copyFileBtn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(file.content || '');
                copyBtn.textContent = 'Copiado!';
                setTimeout(() => copyBtn.textContent = 'Copiar', 1500);
            } catch (e) {
                console.warn('Falha ao copiar:', e);
                copyBtn.textContent = 'Erro';
                setTimeout(() => copyBtn.textContent = 'Copiar', 1500);
            }
        });
    }



    async transitionToChat() {
        this.isTransitioned = true;

        this.elements.welcomeScreen.style.transition = 'opacity 0.5s ease';
        this.elements.welcomeScreen.style.opacity = '0';
        
        await this.sleep(500);
        
        this.elements.welcomeScreen.classList.add('hidden');
        
        this.elements.chatArea.classList.remove('hidden');
        this.elements.chatArea.style.opacity = '0';
        
        await this.sleep(100);
        
        this.elements.chatArea.style.transition = 'opacity 0.5s ease';
        this.elements.chatArea.style.opacity = '1';
    }

    addUserMessage(text, files = null) {
        // Se houver arquivos, criar um pequeno card de anexos acima da mensagem (visual)
        if (files && Array.isArray(files) && files.length > 0) {
            const filesWrap = document.createElement('div');
            filesWrap.className = 'mb-2 flex justify-end';
            const inner = document.createElement('div');
            inner.className = 'max-w-[80%] flex gap-2 items-center bg-surface-light dark:bg-surface-dark rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700';
            files.forEach((f, idx) => {
                const fileCard = document.createElement('div');
                fileCard.className = 'inline-flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm';
                fileCard.innerHTML = `
                    <span class="material-icons-outlined text-primary text-base">${this.getFileIcon(f.name)}</span>
                    <span class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">${this.escapeHtml(f.name)}</span>
                `;
                // Tornar clicável para visualizar o arquivo
                fileCard.style.cursor = 'pointer';
                fileCard.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try { this.viewFileModal(f); } catch (err) { console.warn('Erro abrindo arquivo:', err); }
                });
                inner.appendChild(fileCard);
            });
            filesWrap.appendChild(inner);
            this.elements.messagesContainer.appendChild(filesWrap);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-end animate-slideIn';
        messageDiv.innerHTML = `
            <div class="max-w-[80%] bg-primary text-white rounded-2xl px-5 py-3 shadow-soft">
                <p class="text-base leading-relaxed whitespace-pre-wrap">${this.escapeHtml(text)}</p>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);

        // Auto-scroll imediato para mensagens do usuário
        this.scrollToBottom();
        // Reforço após a animação
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
    }

    addAssistantMessage(text, thinking = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        const uniqueId = 'msg_' + Date.now();
        messageDiv.innerHTML = `
            <div class="w-full max-w-[85%] bg-surface-light dark:bg-surface-dark rounded-2xl px-5 py-4 shadow-soft border border-gray-100 dark:border-gray-700">
                <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200" id="responseText_${uniqueId}"></div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        // Scroll imediato quando mensagem é adicionada
        this.scrollToBottom();

        const responseDiv = document.getElementById(`responseText_${uniqueId}`);
        if (responseDiv) {
            // Se o texto começa com <div (HTML), renderiza direto. Senão, formata como markdown
            if (text.trim().startsWith('<')) {
                // Texto HTML vindo de fontes internas ou widgets. Sanitizar antes de inserir.
                responseDiv.innerHTML = this.sanitizeHtml(text);
            } else {
                responseDiv.innerHTML = this.formatResponse(text);
            }

            // Se o assistant retornou attachments embutidos no chat, renderizar acima do responseDiv
            try {
                const msgObjIndex = this.elements.messagesContainer.querySelectorAll('.mb-6').length - 1;
                // Tentativa: se a última mensagem do chat (no storage) tiver attachments, renderizar
                const chat = this.chats.find(c => c.id === this.currentChatId);
                if (chat && chat.messages && chat.messages.length > 0) {
                    const lastMsg = chat.messages[chat.messages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.attachments && lastMsg.attachments.length > 0) {
                        // Inserir cards de attachments antes do responseDiv
                        const attachWrap = document.createElement('div');
                        attachWrap.className = 'mb-3';
                        const inner = document.createElement('div');
                        inner.className = 'max-w-[85%] flex gap-2 items-center bg-surface-light dark:bg-surface-dark rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700 ml-0';
                        lastMsg.attachments.forEach((f) => {
                            const fileCard = document.createElement('div');
                            fileCard.className = 'inline-flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm';
                            fileCard.innerHTML = `
                                <span class="material-icons-outlined text-primary text-base">${this.getFileIcon(f.name)}</span>
                                <span class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[160px]">${this.escapeHtml(f.name)}</span>
                            `;
                            // Tornar o card clicável para abrir visualizador de arquivo
                            fileCard.style.cursor = 'pointer';
                            fileCard.addEventListener('click', (e) => {
                                e.stopPropagation();
                                try { this.viewFileModal(f); } catch (err) { console.warn('Erro abrindo arquivo:', err); }
                            });
                            inner.appendChild(fileCard);
                        });
                        attachWrap.appendChild(inner);
                        responseDiv.parentNode.insertBefore(attachWrap, responseDiv);
                    }
                }
            } catch(e) {
                // Falha silenciosa ao renderizar attachments
            }

            // Não aplicar hljs para evitar warnings de XSS - o highlight já foi aplicado em formatResponse()
            // Scroll após render
            this.scrollToBottom();
            // Iniciar scroll contínuo curto para cobrir animações/updates
            try { this.startContinuousScroll(30, 3000); } catch(e) {}
            try {
                const obs = new MutationObserver(() => {
                    // Scroll a cada mudança de conteúdo
                    this.scrollToBottom();
                });
                obs.observe(responseDiv, { childList: true, subtree: true, characterData: true });
                // Desconectar após 3s para cobrir animações/typewriter mais longas
                setTimeout(() => obs.disconnect(), 3000);
            } catch (e) {
                // Observers podem falhar em ambientes restritos — fallback silencioso
            }
        }
    }

    createAssistantMessageContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        const uniqueId = 'msg_' + Date.now();
        messageDiv.innerHTML = `
            <div class="w-full max-w-[85%] bg-surface-light dark:bg-surface-dark rounded-2xl px-5 py-4 shadow-soft border border-gray-100 dark:border-gray-700">
                <div class="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-4" id="thinkingHeader_${uniqueId}"></div>
                <div class="flex items-center justify-between mb-4" id="thinkingContainer_${uniqueId}">
                    <div class="flex flex-col gap-2 flex-1" id="thinkingSteps_${uniqueId}"></div>
                    <button class="ml-3 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors" id="toggleThinking_${uniqueId}" title="Fechar raciocínio">
                        <span class="material-icons-outlined text-sm">expand_less</span>
                    </button>
                </div>
                <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 min-h-4" id="responseText_${uniqueId}"></div>
                
                <!-- Botões de ação -->
                <div class="flex gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" id="copyBtn_${uniqueId}" title="Copiar resposta">
                        <span class="material-icons-outlined text-sm">content_copy</span>
                        Copiar
                    </button>
                    <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-400 rounded transition-colors" id="regenerateBtn_${uniqueId}" title="Gerar novamente">
                        <span class="material-icons-outlined text-sm">refresh</span>
                        Gerar Novamente
                    </button>
                </div>
                
                <button class="hidden mt-3 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1" id="showThinking_${uniqueId}">
                    <span class="material-icons-outlined text-sm">expand_more</span>
                    Mostrar Raciocínio
                </button>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Setup dos botões de toggle
        const toggleBtn = document.getElementById(`toggleThinking_${uniqueId}`);
        const showBtn = document.getElementById(`showThinking_${uniqueId}`);
        const thinkingContainer = document.getElementById(`thinkingContainer_${uniqueId}`);
        const stepsDiv = document.getElementById(`thinkingSteps_${uniqueId}`);
        const copyBtn = document.getElementById(`copyBtn_${uniqueId}`);
        const regenerateBtn = document.getElementById(`regenerateBtn_${uniqueId}`);
        
        if (toggleBtn && showBtn && thinkingContainer) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                stepsDiv.classList.add('hidden');
                thinkingContainer.classList.add('hidden');
                showBtn.classList.remove('hidden');
            });
            
            showBtn.addEventListener('click', (e) => {
                e.preventDefault();
                stepsDiv.classList.remove('hidden');
                thinkingContainer.classList.remove('hidden');
                showBtn.classList.add('hidden');
            });
        }

        // Setup dos botões de copiar e regenerar
        const responseText = document.getElementById(`responseText_${uniqueId}`);
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const text = responseText.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '<span class="material-icons-outlined text-sm">check</span> Copiado!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<span class="material-icons-outlined text-sm">content_copy</span> Copiar';
                    }, 2000);
                });
            });
        }

        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                this.showRegenerateModal();
            });
        }
        
        return {
            container: messageDiv,
            headerId: `thinkingHeader_${uniqueId}`,
            stepsId: `thinkingSteps_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            toggleId: `toggleThinking_${uniqueId}`,
            showId: `showThinking_${uniqueId}`
        };
    }

    setThinkingHeader(text, headerId) {
        const headerDiv = document.getElementById(headerId);
        if (headerDiv) {
            headerDiv.innerHTML = `
                <div class="flex items-center gap-2 animate-pulse">
                    <span class="material-icons-outlined text-primary">psychology</span>
                    <span>${this.escapeHtml(text)}</span>
                </div>
            `;
        }
    }

    addThinkingStep(icon, text, id, stepsId) {
        const stepsContainer = document.getElementById(stepsId);
        if (!stepsContainer) return;

        // Estilizar container como no design solicitado (linha pontilhada à esquerda)
        stepsContainer.style.position = 'relative';
        stepsContainer.style.paddingLeft = '18px';
        stepsContainer.style.borderLeft = '2px dashed rgba(255,255,255,0.04)';

        const stepDiv = document.createElement('div');
        stepDiv.className = 'relative pl-4 mb-3 text-sm text-gray-300';
        stepDiv.id = id;
        stepDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-primary/80 flex-shrink-0"></div>
                <div class="text-sm text-gray-300">${this.escapeHtml(text)}</div>
            </div>
        `;
        stepsContainer.appendChild(stepDiv);

        // Appear transition
        stepDiv.style.opacity = '0';
        stepDiv.style.transform = 'translateY(6px)';
        setTimeout(() => {
            stepDiv.style.transition = 'all 220ms ease-out';
            stepDiv.style.opacity = '1';
            stepDiv.style.transform = 'translateY(0)';
        }, 30);

        this.scrollToBottom();
    }

    updateThinkingStep(id, icon, text) {
        const step = document.getElementById(id);
        if (step) {
            step.innerHTML = `
                <span class="material-icons-outlined text-green-500">${icon}</span>
                <span>${this.escapeHtml(text)}</span>
            `;
            step.classList.remove('animate-pulse');
        }
    }

    setResponseText(text, responseId) {
        const responseDiv = document.getElementById(responseId);
        if (responseDiv) {
            // Limpar e colocar vazio enquanto anima
            responseDiv.innerHTML = '';
            responseDiv.style.minHeight = '20px';
            
            // Forçar texto seguro (string) e mensagem amigável para respostas vazias
            let safeText = (text == null || String(text).trim().length === 0) ? '[Erro: resposta vazia do servidor. Verifique /api/status e suas Environment Variables.]' : String(text);

            // Executar typewriter effect com o texto bruto ANTES de formatar
            this.typewriterEffect(safeText, responseDiv);
        }
        this.scrollToBottom();
    }

    async typewriterEffect(text, element) {
        // Garantir que temos string
        text = (text == null) ? '' : String(text);

        // Ocultar blocos de código durante a digitação, mostrando "Gerando código..."
        const hasCode = /```[\s\S]*?```/.test(text);
        
        let displayText = text;
        if (hasCode) {
            displayText = text.replace(/```[\s\S]*?```/g, '\n📝 Gerando código...\n');
        }

        if (!displayText || displayText.length === 0) {
            // Sem animação; renderizar direto
            const formattedHtml = this.formatResponse(text);
            element.innerHTML = formattedHtml;
            setTimeout(() => this.scrollToBottom(), 100);
            return;
        }
        
        let displayedText = '';
        for (let i = 0; i < displayText.length; i++) {
            displayedText += displayText[i];
            element.textContent = displayedText;
            if (i % 2 === 0) {
                this.scrollToBottom();
            }
            await this.sleep(5); // Acelerado: 5ms
        }
        
        // Após animação terminar, renderizar o HTML formatado com os cards bonitos
        const formattedHtml = this.formatResponse(text);
        element.innerHTML = formattedHtml;
        setTimeout(() => this.scrollToBottom(), 100);
    }

    formatResponse(text) {
        if (!text || text.length === 0) {
            return '<p class="text-gray-600 dark:text-gray-400">Resposta vazia</p>';
        }
        
        // Extrair todos os blocos de código e armazená-los
        const codeBlocks = [];
        let cleanText = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            codeBlocks.push({ lang: lang || 'plaintext', code: code.trim() });
            return '';
        });
        
        // Escapar o texto restante
        let formatted = this.escapeHtml(cleanText);
        
        // HEADINGS: transformar linhas que começam com # em headings (## ou #)
        formatted = formatted.replace(/^#{1,6}\s*(.+)$/gm, (m, title) => `<h3 class="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">${title}</h3>`);

        // LISTAS (unordered) - agrupar linhas iniciadas por - ou * em <ul>
        formatted = formatted.replace(/(^((?:\s*[-*]\s+.+\n?)+))/gm, (m) => {
            const items = m.trim().split(/\r?\n/).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
            return `<ul class="list-disc pl-6 mt-2 mb-2 text-gray-700 dark:text-gray-200">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
        });

        // LISTAS ORDENADAS - agrupar linhas iniciadas por 1., 2., etc
        formatted = formatted.replace(/(^((?:\s*\d+\.\s+.+\n?)+))/gm, (m) => {
            const items = m.trim().split(/\r?\n/).map(l => l.replace(/^\s*\d+\.\s+/, '').trim()).filter(Boolean);
            return `<ol class="list-decimal pl-6 mt-2 mb-2 text-gray-700 dark:text-gray-200">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;
        });

        // Processar inline code (monospace)
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-800 dark:bg-gray-900 px-2.5 py-1 rounded text-sm font-mono text-orange-400 border border-gray-700">$1</code>');
        
        // Processar bold e italic
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-gray-100">$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>');
        
        // Processar quebras de linha (duas quebras iniciam novo parágrafo)
        formatted = formatted.replace(/\n\n+/g, '</p><p class="mt-3 text-gray-700 dark:text-gray-200">');
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Envolver em parágrafos quando não houver <p> (ou headings/lists já presentes)
        if (!formatted.includes('<p>') && !formatted.includes('<h') && !formatted.includes('<ul') && !formatted.includes('<ol')) {
            formatted = '<p class="text-gray-700 dark:text-gray-200">' + formatted + '</p>';
        }
        
        // Adicionar botões para abrir códigos ao final
        if (codeBlocks.length > 0) {
            formatted += '<div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">';
            codeBlocks.forEach((block, index) => {
                const btnId = 'codeBtn_' + Date.now() + '_' + index;
                formatted += `<button onclick="openCodeModal(${index}, '${block.lang}')" class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-sm font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95">
                    <span class="material-icons-outlined" style="font-size:18px;">code</span>
                    Ver Código ${codeBlocks.length > 1 ? index + 1 : ''}
                </button>`;
            });
            formatted += '</div>';
            
            // Armazenar os códigos em uma variável global para acesso posterior
            window._lastCodeBlocks = codeBlocks;
        }
        
        return formatted;
    }

    // (handler global para abertura do modal foi movido para o escopo global logo abaixo da definição da classe)
    // Isso evita erro de sintaxe causado por declarações condicionais fora de métodos dentro de uma classe.
    
    openCodeModal(index, lang) {
        // Função global que será chamada pelos botões (manter compatibilidade)
        window.openCodeModal = window.openCodeModal || function(){};
        window.openCodeModal(index, lang);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sanitizeHtml(html) {
        // Parse HTML and remove dangerous elements/attributes
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Remove script, iframe and style tags
            const blockedTags = ['script', 'iframe', 'style', 'link', 'object', 'embed'];
            blockedTags.forEach(tag => {
                const nodes = doc.getElementsByTagName(tag);
                for (let i = nodes.length - 1; i >= 0; i--) {
                    nodes[i].parentNode.removeChild(nodes[i]);
                }
            });

            // Remove event handler attributes and javascript: URIs
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null, false);
            while (walker.nextNode()) {
                const el = walker.currentNode;
                // clone attributes to avoid live modification issues
                const attrs = Array.from(el.attributes || []);
                attrs.forEach(attr => {
                    const name = attr.name.toLowerCase();
                    const val = attr.value || '';
                    if (name.startsWith('on')) {
                        el.removeAttribute(attr.name);
                    } else if ((name === 'href' || name === 'src') && val.trim().toLowerCase().startsWith('javascript:')) {
                        el.removeAttribute(attr.name);
                    } else if (name === 'style') {
                        // optional: remove style to avoid expression() or url(javascript:...)
                        el.removeAttribute('style');
                    }
                });
            }

            return doc.body.innerHTML;
        } catch (e) {
            // Fallback: escape everything
            const div = document.createElement('div');
            div.textContent = html;
            return div.innerHTML;
        }
    }

    // (old duplicate removed) consolidated implementation below

    startContinuousScroll(intervalMs = 50, durationMs = 1000) {
        // Inicia um intervalo que força a rolagem para o final enquanto está ativo
        try {
            this.stopContinuousScroll();
        } catch (e) { /* ignore */ }

        this._scrollInterval = setInterval(() => {
            try {
                if (this.elements.chatArea) {
                    this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
                }
                if (this.elements.messagesContainer) {
                    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
                }
            } catch (e) { /* silent */ }
        }, intervalMs);

        // Timeout para parar automaticamente
        this._scrollTimeout = setTimeout(() => this.stopContinuousScroll(), durationMs);
    }

    stopContinuousScroll() {
        if (this._scrollInterval) {
            clearInterval(this._scrollInterval);
            this._scrollInterval = null;
        }
        if (this._scrollTimeout) {
            clearTimeout(this._scrollTimeout);
            this._scrollTimeout = null;
        }
    }

    // Compat layer para chamadas antigas
    forceScrollToBottom() {
        try {
            this.scrollToBottom();
        } catch (e) {
            // fallback silencioso
        }
    }

    scrollToBottom() {
        const chat = this.elements.chatArea;
        if (!chat) return;
        // Força scroll absoluto (imediato)
        chat.scrollTop = chat.scrollHeight;
        // Depois tenta smooth (caso suporte)
        try {
            chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
        } catch (e) {}
        // Reforço após 50ms
        setTimeout(() => {
            chat.scrollTop = chat.scrollHeight;
            try { chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' }); } catch (e) {}
        }, 50);
        // Reforço após 300ms
        setTimeout(() => {
            chat.scrollTop = chat.scrollHeight;
            try { chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' }); } catch (e) {}
        }, 300);
    }

    async transitionToChat() {
        this.isTransitioned = true;

        this.elements.welcomeScreen.style.transition = 'opacity 0.5s ease';
        this.elements.welcomeScreen.style.opacity = '0';
        
        await this.sleep(500);
        
        this.elements.welcomeScreen.classList.add('hidden');
        
        this.elements.chatArea.classList.remove('hidden');
        this.elements.chatArea.style.opacity = '0';
        
        await this.sleep(100);
        
        this.elements.chatArea.style.transition = 'opacity 0.5s ease';
        this.elements.chatArea.style.opacity = '1';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== CONTROLE DE PAUSA ====================
    updateSendButtonToPause() {
        const sendBtn = this.elements.sendButton;
        if (sendBtn) {
            sendBtn.id = 'pauseButton';
            sendBtn.innerHTML = '<span class="material-icons-outlined text-xl">pause</span>';
            sendBtn.title = 'Parar geração';
            sendBtn.classList.remove('w-10', 'h-10');
            sendBtn.classList.add('pause-button');
            sendBtn.removeEventListener('click', () => this.handleSend());
            sendBtn.addEventListener('click', () => this.handlePause());
        }
    }

    updateSendButtonToSend() {
        const pauseBtn = document.getElementById('pauseButton');
        if (pauseBtn) {
            pauseBtn.id = 'sendButton';
            this.elements.sendButton = pauseBtn;
            pauseBtn.innerHTML = '<span class="material-icons-outlined text-xl">arrow_upward</span>';
            pauseBtn.title = 'Enviar mensagem';
            pauseBtn.classList.remove('pause-button');
            pauseBtn.classList.add('w-10', 'h-10');
            pauseBtn.removeEventListener('click', () => this.handlePause());
            pauseBtn.addEventListener('click', () => this.handleSend());
        }
    }

    handlePause() {
        console.log('⏸️ Usuário clicou em pausa');
        this.agent.stopGeneration();
    }

    showInterruptedMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        messageDiv.innerHTML = `
            <div class="w-full max-w-[85%] bg-yellow-50 dark:bg-yellow-950/30 rounded-2xl px-5 py-4 shadow-soft border border-yellow-200 dark:border-yellow-800 flex items-center gap-3">
                <span class="material-icons-outlined text-yellow-600 dark:text-yellow-400 text-2xl flex-shrink-0">pause_circle</span>
                <div>
                    <p class="font-semibold text-yellow-900 dark:text-yellow-200">Resposta interrompida</p>
                    <p class="text-sm text-yellow-800 dark:text-yellow-300 mt-1">A geração foi pausada. O conteúdo gerado até agora foi preservado.</p>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    closeThinkingSteps(headerId) {
        const header = document.getElementById(headerId);
        if (header) {
            const messageDiv = header.closest('.bg-surface-light, .dark\\:bg-surface-dark');
            if (messageDiv) {
                const thinkingContainer = messageDiv.querySelector('[id*="thinkingContainer"]');
                const stepsDiv = messageDiv.querySelector('[id*="thinkingSteps"]');
                const showBtn = messageDiv.querySelector('[id*="showThinking"]');
                
                if (thinkingContainer && stepsDiv && showBtn) {
                    stepsDiv.classList.add('hidden');
                    thinkingContainer.classList.add('hidden');
                    showBtn.classList.remove('hidden');
                }
            }
        }
    }

    showRegenerateModal() {
        const modal = document.createElement('div');
        modal.id = 'regenerateModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center animate-fadeIn';
        modal.innerHTML = `
            <div class="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-[95%] max-w-md border border-gray-200 dark:border-gray-700 animate-scaleIn">
                <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span class="material-icons-outlined text-primary">refresh</span>
                        Gerar Novamente
                    </h3>
                    <button id="closeRegenerateModal" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                        <span class="material-icons-outlined">close</span>
                    </button>
                </div>
                
                <div class="p-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Como deseja que a resposta seja diferente?
                    </label>
                    <textarea 
                        id="regenerateInput"
                        class="w-full h-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        placeholder="Ex: mais formal, mais alegre, mais resumido, com mais exemplos, etc."
                    ></textarea>
                </div>
                
                <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                    <button id="cancelRegenerateBtn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors font-medium">
                        Cancelar
                    </button>
                    <button id="confirmRegenerateBtn" class="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium flex items-center gap-2">
                        <span class="material-icons-outlined text-sm">check</span>
                        Gerar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('closeRegenerateModal');
        const cancelBtn = document.getElementById('cancelRegenerateBtn');
        const confirmBtn = document.getElementById('confirmRegenerateBtn');
        const input = document.getElementById('regenerateInput');
        
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        
        confirmBtn?.addEventListener('click', () => {
            const instruction = input.value.trim();
            if (!instruction) {
                alert('Digite como deseja que a resposta seja diferente');
                return;
            }
            
            closeModal();
            
            // Pegar o último comentário do usuário (ou usar a última mensagem)
            const lastChat = this.chats.find(c => c.id === this.currentChatId);
            if (lastChat && lastChat.messages.length > 0) {
                const lastUserMessage = lastChat.messages.filter(m => m.role === 'user').pop();
                if (lastUserMessage) {
                    // Adicionar instrução especial à mensagem
                    const newMessage = `${lastUserMessage.content}\n\n[INSTRUÇÕES ESPECIAIS PARA REGENERAÇÃO: ${instruction}]`;
                    this.addUserMessage(`🔄 ${instruction}`);
                    this.agent.processMessage(newMessage);
                }
            }
        });
    }
}

const session = {
    start: (apiKey) => {
        if (!apiKey || apiKey.trim() === '') {
            console.error('❌ API Key inválida');
            return;
        }
        // Apenas para desenvolvimento local: armazena localmente. Em produção, defina GROQ_API_KEY nas ENV do Vercel.
        localStorage.setItem('groq_api_key', apiKey);
        console.log('✅ API Key Groq salva com sucesso!');
        console.log("Use este comando se sua chave veio da Groq (recomendado para 'codestral-latest' via Groq):\n  session.start('SUA_CHAVE_GROQ')");
        console.log('ℹ️ Em produção (Vercel) prefira configurar GROQ_API_KEY em Environment Variables e fazer um redeploy.');
        console.log("Se você tem uma chave Mistral (ex: da Mistral AI), NÃO cole aqui — use: session.startMistral('SUA_CHAVE_MISTRAL') (opcional, apenas para armazenar sua chave Mistral)");
        console.log("Teste rápido no navegador: anexe até 3 arquivos de texto no chat e envie uma mensagem — quando houver anexos, o sistema tentará usar 'codestral-latest' via Groq.");
        console.log("Teste via Node (recomendado): node code/test_codestral.js SUA_CHAVE_GROQ");
    },
        clear: () => {
        localStorage.removeItem('groq_api_key');
        console.log('🗑️ API Key Groq removida');
    },
    status: async () => {
        // Consultar /api/status para logs internos, mas NÃO exibir banner para usuários finais
        try {
            const res = await fetch('/api/status');
            if (!res.ok) {
                console.error('Falha /api/status:', res.status);
                return;
            }
            const data = await res.json();
            console.log('📊 Status do servidor:');
            console.log(`- Groq (ENV): ${data.groq ? '✅ configurada' : '❌ NÃO configurada'}`);
            console.log(`- Mistral (ENV): ${data.mistral ? '✅ configurada' : '❌ NÃO configurada'}`);
            // Intencional: não mostrar banners/avisos na UI para usuários finais
        } catch (e) {
            console.error('Falha ao consultar /api/status:', e);
        }
    }
};

window.session = session;

// Garantir handler global para abrir modal de código (escopo global)
if (typeof window !== 'undefined' && !window.openCodeModal) {
    window.openCodeModal = function(idx, language) {
        console.log('[DEBUG] openCodeModal called', idx, language);
        const codeBlocks = window._lastCodeBlocks || [];
        if (!codeBlocks[idx]) return;

        const block = codeBlocks[idx];
        const codeId = 'modal_code_' + idx;
        let highlightedCode = block.code;

        try {
            highlightedCode = hljs.highlight(block.code, { language: language, ignoreIllegals: true }).value;
        } catch (e) {
            highlightedCode = block.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        const modal = document.createElement('div');
        modal.id = 'codeModal_' + idx;
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center animate-fadeIn';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        modal.innerHTML = `
            <div class="bg-gray-950 dark:bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-[95%] max-w-3xl max-h-[80vh] overflow-hidden animate-scaleIn flex flex-col">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <span class="text-sm font-bold text-gray-300 uppercase tracking-widest">${language}</span>
                    <button onclick="this.closest('[id^=codeModal]').remove()" class="p-2 hover:bg-gray-800 rounded transition-colors">
                        <span class="material-icons-outlined text-gray-400">close</span>
                    </button>
                </div>
                <div class="overflow-auto flex-1 p-5">
                    <pre class="m-0"><code id="${codeId}" class="hljs language-${language} text-gray-100 text-sm leading-relaxed font-mono">${highlightedCode}</code></pre>
                </div>
                <div class="px-6 py-4 border-t border-gray-700 flex gap-3 justify-end">
                    <button onclick="copyCodeFromModal('${codeId}')" class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-sm font-semibold rounded-lg transition-all">
                        <span class="material-icons-outlined" style="font-size:18px;">content_copy</span>
                        Copiar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };
}

const ui = new UI();
window.agent = ui.agent;
window.timelineSystem = ui.timeline;
window.suggestionSystem = ui.suggestions;
window.preferenceSystem = ui.preferences;

// Helper para testes
window.testDropdown = () => {
    const btn = document.getElementById('modelButton');
    const dropdown = document.getElementById('modelDropdown');
    console.log('🧪 Debug Dropdown:');
    console.log('- Botão existe?', !!btn);
    console.log('- Dropdown existe?', !!dropdown);
    console.log('- Dropdown está hidden?', dropdown ? dropdown.classList.contains('hidden') : 'N/A');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        console.log('✅ Tentei alternar. Agora está:', dropdown.classList.contains('hidden') ? 'hidden' : 'visible');
    }
};

window.copyCode = (codeId) => {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const button = event.target.closest('button');
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="material-icons-outlined" style="font-size: 14px;">check</span> Copiado!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar:', err);
        });
    }
};

window.copyCodeFromModal = (codeId) => {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const button = event.target.closest('button');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="material-icons-outlined" style="font-size:18px;">check</span> Copiado!';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar:', err);
        });
    }
};

window.downloadCode = (codeId, lang) => {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        const text = codeElement.textContent;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code.${lang}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

console.log('%c🦙 Lhama Code 1', 'font-size: 24px; font-weight: bold; color: #E26543;');
console.log('%cPara começar:', 'font-size: 14px; font-weight: bold;');
console.log('1. Configure Groq: session.start("sua_chave_groq")');
console.log('2. Use o chat normalmente!');
console.log('\n%cModelos disponíveis:', 'font-size: 12px; font-weight: bold;');
console.log('- Rápido: Llama 3.1 8B Instant (econômico, resposta rápida)');
console.log('- Raciocínio: Llama 3.3 70B Versatile (análise profunda)');
console.log('- Pro: 3 Modelos Groq em 5 Rounds (análise multifacetada)');
console.log('\n%cComandos extras:', 'font-size: 12px; font-weight: bold;');
console.log('- agent.clearHistory() → Limpa histórico de conversa');
console.log('- agent.getHistoryStats() → Mostra estatísticas do histórico');
console.log('- session.status() → Verifica status das APIs');
window.addEventListener('load', () => { try { session.status(); } catch(e) { console.warn('session.status call failed on load:', e); } });
console.log('- session.clear() → Remove API Key Groq');

// Carregar sistema de depuração dinamicamente
(async () => {
    try {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `import { DebugSystem } from './debug-system.js'; window._debugSystem = DebugSystem;`;
        document.head.appendChild(script);
    } catch (error) {
        console.warn('Debug system não carregado:', error);
    }
})();

