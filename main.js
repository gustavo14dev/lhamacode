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
            createButton: document.getElementById('createButton'),
            createDropdown: document.getElementById('createDropdown'),
            createButtonText: document.getElementById('createButtonText'),
            scrollToBottomBtn: document.getElementById('scrollToBottomBtn')
        };

        // Debug (somente se flag ativada)
        if (DEBUG) {
            console.log('✅ Elementos carregados:', {
                modelButton: !!this.elements.modelButton,
                modelDropdown: !!this.elements.modelDropdown,
                modelButtonText: !!this.elements.modelButtonText,
                createButton: !!this.elements.createButton,
                createDropdown: !!this.elements.createDropdown,
                createButtonText: !!this.elements.createButtonText
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
        
        // Configurar botão de criar com verificação
        const createBtn = document.getElementById('createButton');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (DEBUG) console.log('🖱️ Botão criar clicado!');
                this.toggleCreateDropdown();
            });
        } else if (DEBUG) {
            console.error('❌ Botão de criar não encontrado!');
        }
        
        document.addEventListener('click', (e) => {
            const floatingDropdown = document.getElementById('floatingModelDropdown');
            const floatingCreateDropdown = document.getElementById('floatingCreateDropdown');
            const modelBtn = document.getElementById('modelButton');
            const createBtn = document.getElementById('createButton');
            
            if (floatingDropdown && modelBtn && !floatingDropdown.contains(e.target) && !modelBtn.contains(e.target)) {
                floatingDropdown.classList.add('hidden');
            }
            
            if (floatingCreateDropdown && createBtn && !floatingCreateDropdown.contains(e.target) && !createBtn.contains(e.target)) {
                floatingCreateDropdown.classList.add('hidden');
            }
        });

        this.setupModelSelector();
        this.setupCreateSelector();
        
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

    createFloatingCreateDropdown() {
        // Remover dropdown anterior se existir
        const existing = document.getElementById('floatingCreateDropdown');
        if (existing) existing.remove();

        const dropdownHTML = `
            <div id="floatingCreateDropdown" class="hidden fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[200]" style="min-width: 180px;">
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 first:rounded-t-lg" data-create="slides">
                    <span class="material-icons-outlined text-base text-green-400">slideshow</span>
                    Apresentação
                </button>
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2" data-create="document">
                    <span class="material-icons-outlined text-base text-blue-400">description</span>
                    Documento
                </button>
                <button class="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 last:rounded-b-lg" data-create="table">
                    <span class="material-icons-outlined text-base text-purple-400">table_chart</span>
                    Tabela
                </button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', dropdownHTML);
        
        // Setup dos botões do dropdown
        const buttons = document.querySelectorAll('#floatingCreateDropdown button[data-create]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!btn.disabled) {
                    const createType = btn.dataset.create;
                    this.setCreateType(createType);
                    document.getElementById('floatingCreateDropdown').classList.add('hidden');
                }
            });
        });
    }

    toggleCreateDropdown() {
        const dropdown = document.getElementById('floatingCreateDropdown');
        const createBtn = document.getElementById('createButton');
        
        if (!dropdown || !createBtn) {
            console.error('❌ Elementos do criar não encontrados!');
            return;
        }

        if (dropdown.classList.contains('hidden')) {
            // Mostrar dropdown
            dropdown.classList.remove('hidden');
            
            // Posicionar acima do botão
            const rect = createBtn.getBoundingClientRect();
            const dropdownHeight = dropdown.offsetHeight;
            const topPosition = rect.top - dropdownHeight - 8;
            
            dropdown.style.top = topPosition + 'px';
            dropdown.style.left = rect.left + 'px';
            
            console.log('✅ Dropdown Criar aberto em:', { top: topPosition, left: rect.left });
        } else {
            // Fechar dropdown
            dropdown.classList.add('hidden');
            console.log('✅ Dropdown Criar fechado');
        }
    }

    setupCreateSelector() {
        // Criar dropdown flutuante
        this.createFloatingCreateDropdown();
    }

    setCreateType(createType) {
        this.currentCreateType = createType;
        const createNames = {
            'slides': 'Apresentação',
            'document': 'Documento',
            'table': 'Tabela'
        };
        
        const createIcons = {
            'slides': 'slideshow',
            'document': 'description',
            'table': 'table_chart'
        };
        
        const createColors = {
            'slides': 'text-green-400',
            'document': 'text-blue-400',
            'table': 'text-purple-400'
        };

        // Atualizar botão principal
        const createBtn = document.getElementById('createButton');
        if (createBtn) {
            const icon = createBtn.querySelector('.material-icons-outlined:first-child');
            const text = document.getElementById('createButtonText');
            
            if (icon) {
                icon.textContent = createIcons[createType];
                icon.className = `material-icons-outlined text-base ${createColors[createType]}`;
            }
            if (text) {
                text.textContent = createNames[createType];
            }
        }
        
        // Atualizar indicador visual do dropdown
        const buttons = document.querySelectorAll('#floatingCreateDropdown button[data-create]');
        buttons.forEach(btn => {
            if (btn.dataset.create === createType) {
                btn.classList.add('bg-primary/20', 'dark:bg-primary/20');
                btn.classList.remove('hover:bg-gray-50', 'dark:hover:bg-white/5');
            } else {
                btn.classList.remove('bg-primary/20', 'dark:bg-primary/20');
                btn.classList.add('hover:bg-gray-50', 'dark:hover:bg-white/5');
            }
        });

        console.log('✅ Tipo de criação selecionado:', createType);
    }

    async handleCreateRequest(message) {
        if (!this.isTransitioned) {
            this.createNewChat();
            await this.sleep(300);
        }

        if (!this.currentChatId) {
            this.createNewChat();
        }

        // Adicionar mensagem do usuário ao chat
        this.addUserMessage(message);
        
        // Mostrar mensagem de processamento E OBTER O ID CORRETO
        const processingId = this.addAssistantMessage('Gerando conteúdo...');
        
        // Aguardar um pouco para o DOM ser atualizado
        await this.sleep(100);
        
        // Atualizar mensagem para mostrar processamento LaTeX
        this.updateProcessingMessage(processingId, 'Gerando conteúdo...');
        
        try {
            // Gerar código LaTeX internamente (NUNCA MOSTRAR PARA O USUÁRIO)
            console.log('🚀 Iniciando geração LaTeX para:', this.currentCreateType, '-', message);
            const latexCode = await this.generateLatexContent(message, this.currentCreateType);
            console.log('✅ LaTeX gerado, iniciando compilação...');
            
            // Compilar LaTeX para PDF (usando renderização direta)
            const compiledData = await this.compileLatexToPDF(latexCode, processingId);
            console.log('✅ Compilação concluída, exibindo resultado...');
            
            // Mostrar resultado visual para o usuário
            this.displayCompiledContent(processingId, compiledData, this.currentCreateType, message);
            console.log('✅ Processo concluído com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao gerar conteúdo:', error);
            console.error('❌ Stack trace:', error.stack);
            this.updateProcessingMessage(processingId, `❌ Erro ao gerar ${this.getCreateTypeName()}: ${error.message}`);
        }
        
        // Resetar tipo de criação após uso
        this.currentCreateType = null;
        this.resetCreateButton();
    }

    async generateLatexContent(message, type) {
        // Prompt interno para gerar LaTeX - ISSO FICA SECRETO
        const systemPrompt = {
            role: 'system',
            content: `Você é um especialista acadêmico e profissional em LaTeX. Gere código LaTeX completo e compilável para ${type === 'slides' ? 'apresentação profissional Beamer' : type === 'document' ? 'documento acadêmico' : 'tabela técnica'} sobre: "${message}". 
            
REGRAS CRÍTICAS - OBEDEÇA RIGIDOSAMENTE:
- GERE APENAS O CÓDIGO LATEX PURO, NADA MAIS
- NÃO inclua explicações, introduções ou textos fora do código
- NÃO inclua marcadores como \`\`\`latex ou \`\`\`
- Use pacotes padrão (beamer para slides, article para documentos, tabular para tabelas)
- O código deve ser compilável com pdflatex
- Para slides: use \\documentclass[10pt,aspectratio=169]{beamer}
- Para documentos: use \\documentclass{article}
- Para tabelas: use \\documentclass{article} com tabular environment

SINTAXE BEAMER OBRIGATÓRIA:
- NÃO use \\begin{columns}[T] - EM VEZ use \\begin{columns}
- NÃO use \\begin{column}{0.5\\textwidth} - EM VEZ use \\begin{column}{0.5\\textwidth}
- Para colunas em Beamer: \\begin{columns} \\begin{column}{0.5\\textwidth} ... \\end{column} \\begin{column}{0.5\\textwidth} ... \\end{column} \\end{columns}
- NÃO use pacotes desnecessários como pgfplots para slides simples
- Use apenas pacotes essenciais: inputenc, amsmath, graphicx

CONTEÚDO ESPECÍFICO E DE ALTA QUALIDADE:
- PESQUISE E GERE CONTEÚDO ESPECIALIZADO sobre o tema
- Para slides: MÍNIMO 8 SLIDES, MÁXIMO 50-80 (ideal 15-30) com conteúdo denso e útil, e que faça sentido
- Estrutura FLEXÍVEL para slides: título → introdução → desenvolvimento (3-8 slides) → aplicações → conclusão → agradecimento
- ATENÇÃO: Se o usuário pedir algo específico como "3 slides" ou "apresentação curta", RESPEITE e gere exatamente o solicitado
- Para tabelas: dados reais, específicos e técnicos sobre o tema
- Para documentos: texto acadêmico com introdução, desenvolvimento (3-4 seções) e conclusão
- NUNCA use placeholders genéricos como "Exemplo 1", "Conteúdo da tabela"
- INCLUA dados técnicos, estatísticas, exemplos reais, citações
- SEJA ESPECÍFICO E DENSO - o usuário quer APRENDER de verdade
- ADAPTE-SE AO PEDIDO DO USUÁRIO - se pedir curto, faça curto; se pedir completo, faça completo

IMPORTANTE - TIPO DE CONTEÚDO NOS SLIDES:
- NÃO use apenas tópicos/bullets curtos
- GERE TEXTO CORRIDO EXPLICATIVO em cada slide
- Cada slide deve ter 2-3 parágrafos explicativos completos
- Use bullets APENAS para complementar o texto corrido
- Explique conceitos detalhadamente, como se estivesse ensinando
- Inclua exemplos práticos, dados específicos, números reais
- Cada slide deve ser uma aula completa sobre o tópico

ESTRUTURA OBRIGATÓRIA PARA TODAS APRESENTAÇÕES:
- Slide 1: Título (capa)
- Slide 2: O que é [TEMA] - TEXTO CORRIDO EXPLICATIVO COMPLETO
- Slide 3: Como funciona [TEMA] - TEXTO CORRIDO EXPLICATIVO COMPLETO
- Slide 4+: Desenvolvimento detalhado com mais texto corrido
- Penúltimo: Resumo
- Último: Agradecimento

OBRIGATÓRIO - SLIDE "O QUE É":
- Deve ter 3-4 parágrafos corridos explicando o conceito
- Definição clara e detalhada
- Contexto histórico se aplicável
- Importância e relevância do tema
- NÃO use bullets neste slide - apenas texto corrido
- Seja didático e completo

EXEMPLO DE SLIDE "O QUE É LLM":
3 parágrafos corridos explicando:
- O que são Large Language Models
- Como surgiram e evoluíram
- Por que são importantes hoje

EXEMPLO DE SLIDE DE QUALIDADE:
- Título: "Arquitetura Transformer"
- Conteúdo: 2-3 parágrafos explicando o que é, como funciona, importância
- + bullets com pontos-chave para reforçar
- + dados específicos (ex: "176 bilhões de parâmetros no GPT-3")

EXEMPLOS DE CONTEÚDO DE QUALIDADE:
- Para "LLM": arquitetura, parâmetros, aplicações reais, modelos específicos (GPT-4, Claude, Llama)
- Para "machine learning": algoritmos específicos, métricas, casos de uso reais
- Para "blockchain": protocolos específicos, casos de uso, métricas técnicas

IMPORTANTE: O usuário quer CONTEÚDO REAL para APRENDER, não superficial. 
RETORNE APENAS O CÓDIGO LATEX, SEM NENHUM TEXTO ADICIONAL!`
        };

        const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [systemPrompt, { role: 'user', content: message }]);
        
        // Limpar resposta para obter apenas o código LaTeX
        let latexCode = response.trim();
        
        // Remover marcadores de código se existirem
        latexCode = latexCode.replace(/```latex/gi, '').replace(/```/g, '');
        
        // Remover textos introdutórios antes do código LaTeX
        const latexStart = latexCode.indexOf('\\documentclass');
        if (latexStart > 0) {
            latexCode = latexCode.substring(latexStart);
        }
        
        // Remover textos explicativos após o código LaTeX
        const latexEnd = latexCode.lastIndexOf('\\end{document}');
        if (latexEnd > -1 && latexEnd < latexCode.length - 20) {
            latexCode = latexCode.substring(0, latexEnd + 15);
        }
        
        // Adicionar estrutura básica se faltar
        if (!latexCode.includes('\\documentclass')) {
            if (type === 'slides') {
                latexCode = `\\documentclass[10pt,aspectratio=169]{beamer}
\\usetheme{default}
\\usecolortheme{default}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${message}}
\\author{Drekee AI 1}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

${latexCode}

\\end{document}`;
            } else if (type === 'document') {
                latexCode = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\title{${message}}
\\author{Drekee AI 1}
\\date{\\today}

\\begin{document}

\\maketitle

${latexCode}

\\end{document}`;
            }
        }
    
    console.log('🔒 LaTeX gerado internamente (segredo):', latexCode.substring(0, 200) + '...');
    console.log('🔍 Código LaTeX completo:', latexCode);
    return latexCode;
}

    async compileLatexToPDF(latexCode, messageId) {
        // Usar renderização KaTeX simples
        try {
            console.log('🎯 Usando renderização KaTeX simples...');
            this.renderLatexWithKaTeX(latexCode, messageId, this.currentCreateType);
            return;
            
        } catch (error) {
            console.warn('⚠️ Erro na renderização KaTeX, usando fallback:', error.message);
            const simulatedData = this.createSimulatedContent(latexCode);
            this.displayCompiledContent(messageId, simulatedData, this.currentCreateType, '');
        }
    }

    createSimulatedContent(latexCode) {
        console.log('🎨 Criando conteúdo simulado para fallback...');
        
        const type = this.currentCreateType || 'document';
        const title = 'Conteúdo Gerado';
        const author = 'Drekee AI 1';
        
        let content = '';
        
        if (type === 'slides') {
            // Extrair frames do LaTeX para slides simulados
            const frameMatches = latexCode.match(/\\begin\{frame\}.*?\\end\{frame\}/gs);
            let slidesContent = '';
            
            if (frameMatches && frameMatches.length > 0) {
                frameMatches.forEach((frame, index) => {
                    const titleMatch = frame.match(/\\frametitle\{([^}]+)\}/);
                    const frameTitle = titleMatch ? titleMatch[1] : `Slide ${index + 1}`;
                    let frameContent = frame.replace(/\\frametitle\{[^}]+\}/, '');
                    frameContent = frameContent.replace(/\\begin\{frame\}/, '').replace(/\\end\{frame\}/, '');
                    
                    // Converter comandos LaTeX básicos para HTML
                    frameContent = frameContent.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
                    frameContent = frameContent.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
                    frameContent = frameContent.replace(/\\begin\{itemize\}/g, '<ul>');
                    frameContent = frameContent.replace(/\\end\{itemize\}/g, '</ul>');
                    frameContent = frameContent.replace(/\\item\s+/g, '<li>');
                    frameContent = frameContent.replace(/\n(?=[^<])/g, '</li><li>');
                    frameContent = frameContent.replace(/<\/li>$/, '');
                    
                    slidesContent += `
                        <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                            <h2 style="margin-top: 0; color: #333; font-size: 18px;">${frameTitle}</h2>
                            <div style="line-height: 1.6; color: #666;">
                                ${frameContent || '<p>Conteúdo do slide em desenvolvimento...</p>'}
                            </div>
                        </div>
                    `;
                });
            } else {
                // Slides genéricos se não encontrar frames
                slidesContent = `
                    <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="margin-top: 0; color: #333;">O que é ${title}</h2>
                        <p style="line-height: 1.6;">Conteúdo explicativo sobre o tema...</p>
                    </div>
                    <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="margin-top: 0; color: #333;">Como funciona</h2>
                        <p style="line-height: 1.6;">Explicação do funcionamento...</p>
                    </div>
                `;
            }
            
            content = `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; min-height: 100vh;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="margin: 0; color: #333;">${title}</h1>
                        <p style="margin: 10px 0 0 0; color: #666;">Apresentação Simulada</p>
                    </div>
                    ${slidesContent}
                    <div style="margin-top: 30px; padding: 15px; background: #e8f4f8; border-left: 4px solid #007acc;">
                        <p style="margin: 0; font-weight: bold;">📊 Apresentação LaTeX simulada</p>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
                            Esta é uma visualização simulada. Em produção, o PDF real seria gerado.
                        </p>
                    </div>
                </div>
            `;
        } else {
            // Documento simulado
            const documentContent = `
                <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-left: 4px solid #007acc;">
                    <h2 style="margin-top: 0; color: #333;">Introdução</h2>
                    <p style="line-height: 1.6; margin-bottom: 15px;">
                        <strong>${title}</strong> representa um dos avanços mais significativos da tecnologia moderna, 
                        transformando fundamentalmente a forma como processamos informações e tomamos decisões.
                    </p>
                    <p style="line-height: 1.6;">
                        Este documento explora os conceitos fundamentais, aplicações práticas e 
                        implicações futuras desta tecnologia revolucionária.
                    </p>
                </div>
                
                <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-left: 4px solid #007acc;">
                    <h2 style="margin-top: 0; color: #333;">Desenvolvimento</h2>
                    <p style="line-height: 1.6; margin-bottom: 15px;">
                        <strong>Conceitos Fundamentais:</strong> A tecnologia baseia-se em algoritmos 
                        capazes de aprender padrões e tomar decisões autônomas.
                    </p>
                    <p style="line-height: 1.6; margin-bottom: 15px;">
                        <strong>Aplicações:</strong> Setores como saúde, finanças, transporte e educação 
                        já utilizam ativamente soluções baseadas nesta tecnologia.
                    </p>
                    <p style="line-height: 1.6;">
                        <strong>Impacto Socioeconômico:</strong> Redefinição de modelos de negócio 
                        e criação de novas oportunidades profissionais.
                    </p>
                </div>
            `;
            
            content = `
                <div style="font-family: 'Times New Roman', serif; padding: 40px; background: white; max-width: 800px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <h1 style="margin: 0; font-size: 24px; color: #333;">${title}</h1>
                        <p style="margin: 10px 0 0 0; color: #666; font-style: italic;">por ${author}</p>
                    </div>
                    
                    ${documentContent}
                    
                    <div style="margin-top: 40px; padding: 20px; background: #f5f5f5; border-left: 4px solid #007acc;">
                        <p style="margin: 0; font-weight: bold;">✅ Documento LaTeX gerado com sucesso!</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                            Esta é uma visualização simulada. Em produção, o PDF real seria gerado.
                        </p>
                    </div>
                </div>
            `;
        }

        // SEM SEÇÃO DE CÓDIGO LATEX - O USUÁRIO NÃO DEVE VER O CÓDIGO!
        
        const fullContent = content;
        
        const blob = new Blob([fullContent], { type: 'text/html' });
        return {
            blob: blob,
            url: URL.createObjectURL(blob),
            filename: `generated_${Date.now()}.html`,
            isSimulated: true
        };
    }

    updateProcessingMessage(messageId, text) {
        // Tentar encontrar o elemento várias vezes com diferentes abordagens
        let messageElement = document.getElementById(`responseText_${messageId}`);
        
        // Se não encontrar, tentar encontrar o último elemento de mensagem
        if (!messageElement) {
            const allMessages = document.querySelectorAll('[id^="responseText_"]');
            if (allMessages.length > 0) {
                messageElement = allMessages[allMessages.length - 1];
            }
        }
        
        if (messageElement) {
            messageElement.innerHTML = `
                <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div class="flex gap-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                    <span class="text-sm font-medium">${text}</span>
                </div>
            `;
            console.log('✅ Mensagem de processamento atualizada:', text);
        } else {
            console.warn('❌ Elemento de mensagem não encontrado para atualizar:', messageId);
        }
    }

    displayCompiledContent(messageId, compiledData, type, originalMessage) {
        console.log('🎨 Iniciando displayCompiledContent para:', type, 'com ID:', messageId);
        
        // Encontrar o elemento usando o ID correto
        let messageElement = document.getElementById(`responseText_${messageId}`);
        
        if (!messageElement) {
            console.error('❌ Elemento de mensagem não encontrado para displayCompiledContent:', messageId);
            return;
        }
        const typeName = this.getCreateTypeName();
        
        // Verificar se é PDF REAL (compilação bem-sucedida)
        if (compiledData.isPDF && !compiledData.isSimulated) {
            console.log('🎯 PDF REAL detectado, exibindo visualizador PDF...');
            
            // Para PDF REAL, usar visualizador PDF nativo
            this.updateProcessingMessage(messageId, `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="material-icons-outlined text-${type === 'slides' ? 'green' : type === 'document' ? 'blue' : 'purple'}-400">
                            ${type === 'slides' ? 'slideshow' : type === 'document' ? 'description' : 'table_chart'}
                        </span>
                        <h3 class="font-semibold text-gray-800 dark:text-gray-200">${typeName} gerado com sucesso!</h3>
                    </div>
                    
                    <div class="mb-4">
                        <iframe 
                            src="${compiledData.url}" 
                            style="width: 100%; height: 700px; border: 1px solid #ddd; border-radius: 8px; background: white;"
                            onload="console.log('✅ PDF Iframe carregado com sucesso'); this.style.opacity='1'"
                            onerror="console.error('❌ Erro ao carregar PDF iframe'); this.parentElement.innerHTML='<div class=\\'text-center p-8 text-red-500\\'>❌ Erro ao carregar PDF. Use o botão de download.</div>'">
                        </iframe>
                    </div>
                    
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="window.downloadGeneratedContent('${compiledData.url}', '${compiledData.filename}')" 
                                class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                            <span class="material-icons-outlined text-sm">download</span>
                            Baixar ${typeName} PDF
                        </button>
                        <button onclick="window.open('${compiledData.url}', '_blank')" 
                                class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            <span class="material-icons-outlined text-sm">open_in_new</span>
                            Abrir em Nova Aba
                        </button>
                    </div>
                </div>
            `);
        } else {
            // Fallback HTML simulado
            console.log('🔄 Usando fallback HTML simulado...');
            
            this.updateProcessingMessage(messageId, `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="material-icons-outlined text-${type === 'slides' ? 'green' : type === 'document' ? 'blue' : 'purple'}-400">
                            ${type === 'slides' ? 'slideshow' : type === 'document' ? 'description' : 'table_chart'}
                        </span>
                        <h3 class="font-semibold text-gray-800 dark:text-gray-200">${typeName} gerado com sucesso!</h3>
                    </div>
                    
                    <div class="mb-4">
                        <iframe 
                            src="${compiledData.url}" 
                            style="width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 8px; background: white;"
                            onload="console.log('✅ Iframe carregado com sucesso'); this.style.opacity='1'"
                            onerror="console.error('❌ Erro ao carregar iframe'); this.parentElement.innerHTML='<div class=\\'text-center p-8 text-red-500\\'>❌ Erro ao carregar visualização. Use o botão de download.</div>'">
                        </iframe>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="window.downloadGeneratedContent('${compiledData.url}', '${compiledData.filename}')" 
                                class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                            <span class="material-icons-outlined text-sm">download</span>
                            Baixar ${typeName}
                        </button>
                    </div>
                </div>
            `);
        }

        console.log('✅ Conteúdo compilado exibido para:', typeName);
        this.scrollToBottom();
    }
    getCreateTypeName() {
        const names = {
            'slides': 'Apresentação',
            'document': 'Documento',
            'table': 'Tabela'
        };
        return names[this.currentCreateType] || 'Conteúdo';
    }

    resetCreateButton() {
        const createBtn = document.getElementById('createButton');
        if (createBtn) {
            const icon = createBtn.querySelector('.material-icons-outlined:first-child');
            const text = document.getElementById('createButtonText');
            
            if (icon) {
                icon.textContent = 'add_circle';
                icon.className = 'material-icons-outlined text-base';
            }
            if (text) {
                text.textContent = 'Criar';
            }
        }
    }

    async handleSend() {
        const message = this.elements.userInput.value.trim();
        
        // Remover sugestões de acompanhamento ao enviar nova mensagem
        this.removeFollowUpSuggestions();
        
        // Resetar contador de retry ao enviar nova mensagem
        if (window.apiRetryTimeout) {
            clearTimeout(window.apiRetryTimeout);
            window.apiRetryTimeout = null;
        }
        window.apiRetryCount = 0;
        if (typeof window.hideApiErrorCard === 'function') {
            window.hideApiErrorCard();
        }
        
        // Se modo depuração está ativo e há mensagem, analisar como erro
        if (this.debugModeActive && message) {
            await this.analyzeErrorWithDebug(message);
            this.elements.userInput.value = '';
            return;
        }
        
        if (!message) return;

        // Verificar se usuário selecionou opção "Criar"
        if (this.currentCreateType && message) {
            await this.handleCreateRequest(message);
            this.elements.userInput.value = '';
            return;
        }

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

    // ==================== FUNÇÕES DE RENDERIZAÇÃO LATEX SIMPLES ====================
    renderLatexWithKaTeX(latexCode, messageId, type) {
        console.log('🎨 Renderizando LaTeX com KaTeX simples...');
        
        // Extrair frames do Beamer ou conteúdo do documento
        const frameMatches = latexCode.match(/\\begin\{frame\}.*?\\end\{frame\}/gs);
        let content = '';
        
        if (frameMatches && frameMatches.length > 0) {
            // Slides
            content = '<div class="latex-slides">';
            frameMatches.forEach((frame, index) => {
                const titleMatch = frame.match(/\\frametitle\{([^}]+)\}/);
                const frameTitle = titleMatch ? titleMatch[1] : `Slide ${index + 1}`;
                let frameContent = frame.replace(/\\frametitle\{[^}]+\}/, '');
                frameContent = frameContent.replace(/\\begin\{frame\}/, '').replace(/\\end\{frame\}/, '');
                
                // Limpar conteúdo básico
                frameContent = frameContent.replace(/\\begin\{itemize\}/g, '<ul>');
                frameContent = frameContent.replace(/\\end\{itemize\}/g, '</ul>');
                frameContent = frameContent.replace(/\\item\s+/g, '<li>');
                frameContent = frameContent.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
                frameContent = frameContent.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
                
                content += `
                    <div class="latex-slide" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #333; font-size: 20px; margin-bottom: 15px;">${frameTitle}</h2>
                        <div class="latex-content" style="line-height: 1.5; color: #666;">
                            ${frameContent || '<p>Conteúdo do slide...</p>'}
                        </div>
                    </div>
                `;
            });
            content += '</div>';
        } else {
            // Documento único
            let docContent = latexCode.replace(/\\documentclass.*?\\begin\{document\}/s, '').replace(/\\end\{document\}/, '');
            docContent = docContent.replace(/\\begin\{itemize\}/g, '<ul>');
            docContent = docContent.replace(/\\end\{itemize\}/g, '</ul>');
            docContent = docContent.replace(/\\item\s+/g, '<li>');
            docContent = docContent.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
            docContent = docContent.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
            
            content = `
                <div class="latex-document" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 40px;">
                    <div class="latex-content" style="line-height: 1.6; color: #666;">
                        ${docContent}
                    </div>
                </div>
            `;
        }
        
        const typeName = this.getCreateTypeName();
        this.updateProcessingMessage(messageId, `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-icons-outlined text-${type === 'slides' ? 'green' : 'blue'}-400">
                        ${type === 'slides' ? 'slideshow' : 'description'}
                    </span>
                    <h3 class="font-semibold text-gray-800 dark:text-gray-200">${typeName} renderizado com KaTeX!</h3>
                </div>
                
                <div class="mb-4">
                    ${content}
                </div>
                
                <div class="flex gap-2">
                    <button onclick="window.downloadLatexAsText('${encodeURIComponent(latexCode)}', '${typeName}.tex')" 
                            class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                        <span class="material-icons-outlined text-sm">download</span>
                        Baixar LaTeX
                    </button>
                </div>
            </div>
        `);
        
        // Renderizar matemática KaTeX após inserir no DOM
        setTimeout(() => {
            if (typeof katex !== 'undefined') {
                const mathElements = document.querySelectorAll('.latex-content');
                mathElements.forEach(element => {
                    try {
                        katex.render(element.textContent, element, {
                            throwOnError: false,
                            displayMode: false
                        });
                    } catch (e) {
                        console.warn('Erro KaTeX:', e);
                    }
                });
            }
        }, 100);
    }

    // ==================== FUNÇÕES DE DOWNLOAD ====================
    async downloadGeneratedContent(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('✅ Download iniciado:', filename);
    }
    
    downloadLatexAsText(latexCode, filename) {
        const blob = new Blob([latexCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('✅ Download LaTeX iniciado:', filename);
    }

    // ==================== MODO DEPURAÇÃO ====================
    async toggleDebugMode() {
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
                        messageDiv.insertBefore(attachWrap, responseDiv);
                    }
                }
            } catch (attachErr) {
                console.warn('Erro ao renderizar attachments:', attachErr);
            }

            // Adicionar indicador de thinking se houver
            if (thinking && thinking.trim()) {
                const thinkingDiv = document.createElement('div');
                thinkingDiv.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-600 pt-2';
                thinkingDiv.textContent = thinking;
                responseDiv.appendChild(thinkingDiv);
            }
        }

        // Salvar mensagem no storage
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            const msgObj = { role: 'assistant', content: text };
            if (thinking) msgObj.thinking = thinking;
            chat.messages.push(msgObj);
            this.saveCurrentChat();
        }

        // RETORNAR O ID PARA USO FUTURO
        return uniqueId;
    }

    createAssistantMessageContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        const uniqueId = 'msg_' + Date.now();
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <!-- Vídeo animado ao lado esquerdo da resposta -->
                <div class="flex-shrink-0 mt-1">
                    <video autoplay muted loop playsinline class="w-8 h-8 rounded-full object-cover shadow-sm" style="filter: brightness(1.1) contrast(1.1);">
                        <source src="img/Video Project.mp4" type="video/mp4">
                    </video>
                </div>
                
                <div class="flex-1 max-w-[85%] px-5 py-4">
                    <div class="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-2" id="thinkingHeader_${uniqueId}"></div>
                    <div class="flex items-start mb-4" id="thinkingContainer_${uniqueId}">
                        <div class="flex flex-col gap-2 flex-1" id="thinkingSteps_${uniqueId}"></div>
                    </div>
                    
                    <button class="hidden mt-2 mb-3 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1" id="showThinking_${uniqueId}">
                        <span class="material-icons-outlined text-sm">expand_more</span>
                        Mostrar raciocínio
                    </button>
                    
                    <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 min-h-4" id="responseText_${uniqueId}"></div>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Adicionar flieira invisível com botões de ação
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex gap-2 justify-start mt-4 mb-2 px-2 opacity-0 transition-opacity duration-300';
        actionsDiv.innerHTML = `
            <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" id="copyBtn_${uniqueId}" title="Copiar resposta">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>
            </button>
            <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" id="regenerateBtn_${uniqueId}" title="Gerar novamente">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">refresh</span>
            </button>
        `;
        this.elements.messagesContainer.appendChild(actionsDiv);
        
        this.scrollToBottom();
        
        // Setup dos botões de ação
        const copyBtn = document.getElementById(`copyBtn_${uniqueId}`);
        const regenerateBtn = document.getElementById(`regenerateBtn_${uniqueId}`);
        const showBtn = document.getElementById(`showThinking_${uniqueId}`);
        
        // Setup do botão "Mostrar Raciocínio"
        if (showBtn) {
            showBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const stepsDiv = document.getElementById(messageContainer.stepsId);
                if (stepsDiv) {
                    // Animar aparecimento dos raciocínios
                    stepsDiv.classList.remove('hidden');
                    stepsDiv.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in';
                    stepsDiv.style.opacity = '0';
                    stepsDiv.style.transform = 'translateY(10px)';
                    
                    setTimeout(() => {
                        stepsDiv.style.opacity = '1';
                        stepsDiv.style.transform = 'translateY(0)';
                    }, 50);
                    
                    showBtn.classList.add('hidden');
                    
                    // Resetar após animação
                    setTimeout(() => {
                        stepsDiv.style.transition = '';
                        stepsDiv.style.opacity = '';
                        stepsDiv.style.transform = '';
                    }, 550);
                }
            });
        }
        
        // Setup dos botões de ação
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const responseText = document.getElementById(`responseText_${uniqueId}`);
                if (responseText) {
                    navigator.clipboard.writeText(responseText.textContent).then(() => {
                        copyBtn.innerHTML = '<span class="material-icons-outlined text-sm text-green-600">check</span>';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>';
                        }, 2000);
                    });
                }
            });
        }
        
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                if (window.agent) {
                    window.agent.regenerateLastResponse();
                }
            });
        }
        
        // RETORNAR O ID PARA USO FUTURO
        return {
            container: messageDiv,
            headerId: `thinkingHeader_${uniqueId}`,
            stepsId: `thinkingSteps_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            toggleId: `toggleThinking_${uniqueId}`,
            showId: `showThinking_${uniqueId}`
        };
    }

    createRapidMessageContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        const uniqueId = 'msg_' + Date.now();
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <!-- Vídeo animado ao lado esquerdo da resposta -->
                <div class="flex-shrink-0 mt-1">
                    <video autoplay muted loop playsinline class="w-8 h-8 rounded-full object-cover shadow-sm" style="filter: brightness(1.1) contrast(1.1);">
                        <source src="img/Video Project.mp4" type="video/mp4">
                    </video>
                </div>
                
                <div class="flex-1 max-w-[85%] px-5 py-4">
                    <div class="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-4" id="thinkingHeader_${uniqueId}"></div>
                    <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 min-h-4" id="responseText_${uniqueId}"></div>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Adicionar flieira invisível com botões de ação
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex gap-2 justify-start mt-4 mb-2 px-2 opacity-0 transition-opacity duration-300';
        actionsDiv.innerHTML = `
            <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" id="copyBtn_${uniqueId}" title="Copiar resposta">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>
            </button>
            <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" id="regenerateBtn_${uniqueId}" title="Gerar novamente">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">refresh</span>
            </button>
        `;
        this.elements.messagesContainer.appendChild(actionsDiv);
        
        this.scrollToBottom();
        
        // Setup dos botões de ação
        const copyBtn = document.getElementById(`copyBtn_${uniqueId}`);
        const regenerateBtn = document.getElementById(`regenerateBtn_${uniqueId}`);
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const responseText = document.getElementById(`responseText_${uniqueId}`);
                if (responseText) {
                    navigator.clipboard.writeText(responseText.textContent).then(() => {
                        copyBtn.innerHTML = '<span class="material-icons-outlined text-sm text-green-600">check</span>';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>';
                        }, 2000);
                    });
                }
            });
        }
        
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                if (window.agent) {
                    window.agent.regenerateLastResponse();
                }
            });
        }
        
        // RETORNAR O ID PARA USO FUTURO
        return uniqueId;
    }

    setThinkingHeader(text, headerId) {
        const headerDiv = document.getElementById(headerId);
        if (headerDiv) {
            if (text.trim()) {
                headerDiv.innerHTML = `
                    <div class="flex items-center gap-2 animate-pulse">
                        <span class="text-gray-600 dark:text-gray-400">${this.escapeHtml(text)}</span>
                    </div>
                `;
            } else {
                headerDiv.innerHTML = '';
            }
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
            <div class="flex items-center gap-2 w-full">
                <div class="w-2 h-2 rounded-full bg-primary/80 flex-shrink-0"></div>
                <div class="text-sm text-gray-300 truncate flex-1 min-w-0 typing-animation" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(text)}</div>
            </div>
        `;
        
        // Adicionar animação de digitação
        const textElement = stepDiv.querySelector('.typing-animation');
        if (textElement) {
            textElement.style.animation = 'typing 0.5s steps(40, end) forwards';
        }
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
        
        // ANIMAÇÃO LINHA POR LINHA JÁ FORMATADA
        const lines = text.split('\n');
        let displayedLines = [];
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const currentLine = lines[lineIndex];
            let displayedLine = '';
            
            // Animar caractere por caractere da linha atual
            for (let charIndex = 0; charIndex < currentLine.length; charIndex++) {
                displayedLine += currentLine[charIndex];
                
                // Combinar linhas já formatadas + linha atual sendo digitada
                const allLines = [...displayedLines, displayedLine];
                const partialText = allLines.join('\n');
                
                // Formatar o texto parcial já bonito
                const formattedPartial = this.formatResponse(partialText);
                element.innerHTML = formattedPartial;
                
                if (charIndex % 3 === 0) {
                    this.scrollToBottom();
                }
                await this.sleep(3); // Mais rápido: 3ms por caractere
            }
            
            // Adicionar linha completa ao array de linhas exibidas
            displayedLines.push(currentLine);
            
            // Pequena pausa entre linhas
            await this.sleep(20);
        }
        
        // Garantir formatação final completa
        const finalFormatted = this.formatResponse(text);
        element.innerHTML = finalFormatted;
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
        formatted = formatted.replace(/^#{1,6}\s*(.+)$/gm, (m, title) => `<h3 class="text-base font-bold mb-2 text-gray-900 dark:text-gray-100">${title}</h3>`);

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
        
        // Processar sublinhado
        formatted = formatted.replace(/<u>([^<]+)<\/u>/g, '<u class="underline decoration-2 decoration-blue-500">$1</u>');
        
        // Remover apenas caracteres realmente problemáticos, mantendo formatação HTML e símbolos matemáticos
        formatted = formatted.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Processar expressões matemáticas LaTeX (inline e bloco) com suporte completo
        formatted = formatted.replace(/\$([^$\n]+)\$/g, '<span class="inline-block font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 math-inline">$1</span>');
        formatted = formatted.replace(/\$\$([^$\n]+)\$\$/g, '<div class="block my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"><span class="block font-mono text-base text-center text-gray-900 dark:text-gray-100 math-block">$1</span></div>');
        
        // Processar símbolos matemáticos Unicode com fontes apropriadas
        const mathSymbols = {
            '∑': '∑', '∏': '∏', '∫': '∫', '∂': '∂', '∇': '∇', '∆': '∆',
            '±': '±', '∓': '∓', '×': '×', '÷': '÷', '≈': '≈', '≠': '≠',
            '≤': '≤', '≥': '≥', '∞': '∞', '√': '√', '∛': '∛', '∜': '∜',
            'α': 'α', 'β': 'β', 'γ': 'γ', 'δ': 'δ', 'ε': 'ε', 'θ': 'θ',
            'λ': 'λ', 'μ': 'μ', 'π': 'π', 'σ': 'σ', 'τ': 'τ', 'φ': 'φ',
            'χ': 'χ', 'ψ': 'ψ', 'ω': 'ω', 'Α': 'Α', 'Β': 'Β', 'Γ': 'Γ',
            'Δ': 'Δ', 'Ε': 'Ε', 'Θ': 'Θ', 'Λ': 'Λ', 'Μ': 'Μ', 'Π': 'Π',
            'Σ': 'Σ', 'Τ': 'Τ', 'Φ': 'Φ', 'Χ': 'Χ', 'Ψ': 'Ψ', 'Ω': 'Ω',
            '∈': '∈', '∉': '∉', '⊂': '⊂', '⊃': '⊃', '⊆': '⊆', '⊇': '⊇',
            '∪': '∪', '∩': '∩', '∅': '∅', '∀': '∀', '∃': '∃', '¬': '¬',
            '∧': '∧', '∨': '∨', '→': '→', '←': '←', '↔': '↔', '⇒': '⇒',
            '⇐': '⇐', '⇔': '⇔', '⊕': '⊕', '⊗': '⊗', '⊙': '⊙', '⊥': '⊥',
            '°': '°', '′': '′', '″': '″', '‴': '‴', '⁰': '⁰', '¹': '¹',
            '²': '²', '³': '³', '⁴': '⁴', '⁵': '⁵', '⁶': '⁶', '⁷': '⁷',
            '⁸': '⁸', '⁹': '⁹', '₀': '₀', '₁': '₁', '₂': '₂', '₃': '₃',
            '₄': '₄', '₅': '₅', '₆': '₆', '₇': '₇', '₈': '₈', '₉': '₉'
        };
        
        // Substituir símbolos matemáticos com spans estilizados
        Object.entries(mathSymbols).forEach(([symbol, unicode]) => {
            const regex = new RegExp(`\\${symbol}`, 'g');
            formatted = formatted.replace(regex, `<span class="math-symbol text-purple-600 dark:text-purple-400 font-medium">${unicode}</span>`);
        });
        
        // Processar frações simples (a/b)
        formatted = formatted.replace(/(\d+)\/(\d+)/g, '<span class="inline-block text-center"><span class="block text-xs">$1</span><span class="block border-t border-gray-400 dark:border-gray-600">—</span><span class="block text-xs">$2</span></span>');
        
        // Processar subscritos e sobrescritos
        formatted = formatted.replace(/\^(\w+)/g, '<sup class="text-xs align-super">$1</sup>');
        formatted = formatted.replace(/_(\w+)/g, '<sub class="text-xs align-sub">$1</sub>');
        
        // Processar tabelas markdown simples
        formatted = formatted.replace(/\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
            const headers = header.split('|').map(h => h.trim()).filter(h => h);
            const bodyRows = rows.trim().split('\n').map(row => 
                row.split('|').map(cell => cell.trim()).filter(cell => cell)
            );
            
            let table = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">';
            
            // Header
            table += '<thead><tr class="bg-gray-100 dark:bg-gray-800">';
            headers.forEach(h => {
                table += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">${h}</th>`;
            });
            table += '</tr></thead>';
            
            // Body
            table += '<tbody>';
            bodyRows.forEach((row, i) => {
                table += `<tr class="${i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}">`;
                row.forEach(cell => {
                    table += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-200">${cell}</td>`;
                });
                table += '</tr>';
            });
            table += '</tbody></table></div>';
            
            return table;
        });
        
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
            sendBtn.innerHTML = '<span style="display: inline-block; width: 20px; height: 20px; background: white; border: 2px solid white; border-radius: 4px;"></span>';
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
                <span style="display: inline-block; width: 32px; height: 32px; background: white; border: 2px solid white; border-radius: 50%;"></span>
                <div>
                    <p class="font-semibold text-yellow-900 dark:text-yellow-200">Resposta interrompida</p>
                    <p class="text-sm text-yellow-800 dark:text-yellow-300 mt-1">A geração foi pausada. O conteúdo gerado até agora foi preservado.</p>
                </div>
            </div>
        `;
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    displayFollowUpSuggestions(messageId, suggestions) {
        // Garantir que welcomeScreen fique escondido
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.classList.add('hidden');
        }
        
        // Remover sugestões anteriores se existirem
        const existingContainer = document.getElementById('followUpSuggestionsContainer');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Procurar pelo elemento da mensagem usando diferentes abordagens
        let messageElement = document.getElementById(`message_${messageId}`);
        
        if (!messageElement) {
            // Tentar encontrar pelo ID de resposta
            const responseElement = document.getElementById(`responseText_${messageId.replace('msg_', '')}`);
            if (responseElement) {
                messageElement = responseElement.closest('.mb-6');
            }
        }
        
        if (!messageElement) {
            console.warn('❌ Elemento da mensagem não encontrado para sugestões:', messageId);
            return;
        }

        // Criar container de sugestões integrado à mensagem da IA
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'followUpSuggestionsContainer';
        suggestionsContainer.className = 'mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 opacity-0 transform translate-y-2 transition-all duration-300 ease-out max-w-lg';
        
        suggestionsContainer.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <span class="material-icons-outlined text-sm text-amber-500">lightbulb</span>
                <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400">Sugestões de acompanhamento</h4>
            </div>
            <div class="flex flex-col gap-2">
                ${suggestions.map((suggestion, index) => `
                    <button 
                        class="follow-up-suggestion w-full text-left px-3 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-xs text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-600 transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-sm transform"
                        data-suggestion="${suggestion}"
                        onclick="window.handleFollowUpSuggestion('${suggestion.replace(/'/g, "\\'")}')"
                        style="animation-delay: ${index * 50}ms; opacity: 0; transform: translateY(4px);"
                    >
                        <div class="flex items-center gap-2">
                            <span class="material-icons-outlined text-xs opacity-50">arrow_right</span>
                            <span class="flex-1">${suggestion}</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        `;

        // Adicionar após o elemento da mensagem (fora do card)
        messageElement.parentNode.insertBefore(suggestionsContainer, messageElement.nextSibling);

        // Animar entrada do container
        setTimeout(() => {
            suggestionsContainer.classList.remove('opacity-0', 'translate-y-2');
            suggestionsContainer.classList.add('opacity-100', 'translate-y-0');

            // Animar cada sugestão individualmente
            const suggestionButtons = suggestionsContainer.querySelectorAll('.follow-up-suggestion');
            suggestionButtons.forEach((button, index) => {
                setTimeout(() => {
                    button.style.opacity = '1';
                    button.style.transform = 'translateY(0)';
                    button.style.transition = 'all 0.2s ease-out';
                }, index * 50);
            });
        }, 100);
    }

    removeFollowUpSuggestions() {
        const container = document.getElementById('followUpSuggestionsContainer');
        if (container) {
            // Animar saída
            container.classList.add('opacity-0', 'translate-y-2');
            container.classList.remove('opacity-100', 'translate-y-0');
            
            setTimeout(() => {
                container.remove();
            }, 300);
        }
    }

    handleFollowUpSuggestion(suggestion) {
        // Remover sugestões com animação suave
        this.removeFollowUpSuggestions();
        
        // Preencher o input com a sugestão
        this.elements.userInput.value = suggestion;
        
        // Enviar automaticamente a mensagem
        this.handleSend();
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
                         Gerar novamente
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
window.ui = ui;
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

// Função global para lidar com sugestões de acompanhamento
window.handleFollowUpSuggestion = (suggestion) => {
    if (window.ui) {
        window.ui.handleFollowUpSuggestion(suggestion);
    }
};

console.log('%c🦙 Drekee AI 1', 'font-size: 24px; font-weight: bold; color: #E26543;');
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

// Função global para download de conteúdo gerado
window.downloadGeneratedContent = (url, filename) => {
    try {
        console.log('🔥 Iniciando download:', filename, 'URL:', url);
        
        // Criar uma nova requisição fetch para obter o blob
        fetch(url)
            .then(response => {
                console.log('📡 Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                console.log('✅ Blob obtido, tamanho:', blob.size, 'tipo:', blob.type);
                
                // Criar URL temporária para o blob
                const blobUrl = URL.createObjectURL(blob);
                
                // Criar elemento de download
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.style.display = 'none';
                
                // Adicionar ao DOM, clicar e remover
                document.body.appendChild(a);
                a.click();
                
                // Limpar
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    console.log('✅ Download concluído e limpo');
                }, 100);
            })
            .catch(error => {
                console.error('❌ Erro no download:', error);
                
                // Fallback: tentar download direto
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Mostrar erro para usuário
                alert('Erro no download. Tente novamente ou use o botão direito para salvar.');
            });
    } catch (error) {
        console.error('❌ Erro geral no download:', error);
        alert('Erro no download. Tente novamente.');
    }
};

