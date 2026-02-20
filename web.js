// Classe principal para a página de pesquisa na web
class WebSearchUI {
    constructor() {
        this.chats = [];
        this.currentChatId = null;
        this.isGenerating = false;
        this.agent = null;
        this.init();
    }

    init() {
        console.log('🔍 Inicializando página de pesquisa na web...');
        
        // Elementos do DOM
        this.elements = {
            messagesContainer: document.getElementById('messagesContainer'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendButton'),
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatHistoryList: document.getElementById('chatHistoryList'),
            newChatBtn: document.getElementById('newChatBtn'),
            sidebar: document.getElementById('sidebar'),
            sidebarToggle: document.getElementById('sidebarToggle')
        };

        // Inicializar agente
        this.initializeAgent();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Configurar textarea para auto-resize
        this.setupTextareaAutoResize();
        
        // Carregar chats salvos
        this.loadChats();
        
        // Focar no input
        this.elements.userInput.focus();
    }

    initializeAgent() {
        // Importar o agente do main.js
        if (typeof Agent !== 'undefined') {
            this.agent = new Agent(this);
        } else {
            console.warn('⚠️ Classe Agent não encontrada, usando API direta');
        }
    }

    setupEventListeners() {
        // Event listener para o botão de envio
        this.elements.sendButton.addEventListener('click', () => {
            this.handleSend();
        });

        // Event listener para o input (Enter para enviar, Shift+Enter para nova linha)
        this.elements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Event listener para o botão Nova Pesquisa
        if (this.elements.newChatBtn) {
            this.elements.newChatBtn.addEventListener('click', () => {
                this.createNewChat();
            });
        }

        // Auto-resize do textarea
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });

        // Toggle do sidebar em mobile
        if (this.elements.sidebarToggle) {
            this.elements.sidebarToggle.addEventListener('click', () => {
                this.elements.sidebar.classList.toggle('hidden');
            });
        }
    }

    setupTextareaAutoResize() {
        this.elements.userInput.style.height = 'auto';
        this.elements.userInput.style.height = this.elements.userInput.scrollHeight + 'px';
    }

    autoResizeTextarea() {
        this.elements.userInput.style.height = 'auto';
        this.elements.userInput.style.height = Math.min(this.elements.userInput.scrollHeight, 120) + 'px';
    }

    async handleSend() {
        const message = this.elements.userInput.value.trim();
        
        if (!message) {
            return;
        }

        if (this.isGenerating) {
            return;
        }

        console.log('🔍 Enviando pesquisa:', message);

        // Criar novo chat se necessário
        if (!this.currentChatId) {
            this.createNewChat();
        }

        // Adicionar mensagem do usuário
        this.addUserMessage(message);
        
        // Limpar input
        this.elements.userInput.value = '';
        this.autoResizeTextarea();
        
        // Mostrar indicador de digitação
        this.showTypingIndicator();
        
        try {
            this.isGenerating = true;
            this.updateSendButton();
            
            // Fazer requisição para a API de pesquisa
            const response = await this.callWebSearchAPI(message);
            
            // Remover indicador de digitação
            this.hideTypingIndicator();
            
            // Adicionar resposta do assistente
            this.addAssistantMessage(response);
            
            // Salvar chat
            this.saveCurrentChat();
            
        } catch (error) {
            console.error('❌ Erro na pesquisa:', error);
            this.hideTypingIndicator();
            this.addAssistantMessage('Desculpe, ocorreu um erro ao processar sua pesquisa. Tente novamente.');
        } finally {
            this.isGenerating = false;
            this.updateSendButton();
            this.elements.userInput.focus();
        }
    }

    async callWebSearchAPI(message) {
        console.log('📡 Chamando API de pesquisa na web...');
        
        const response = await fetch('/api/web-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message
            })
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.response) {
            throw new Error('Resposta vazia da API');
        }

        console.log('✅ Resposta recebida:', data.response);
        return data.response;
    }

    createNewChat() {
        const chatId = 'chat_' + Date.now();
        const chat = {
            id: chatId,
            title: 'Nova pesquisa',
            messages: [],
            createdAt: new Date().toISOString()
        };
        
        this.chats.unshift(chat);
        this.currentChatId = chatId;
        
        // Esconder welcome screen
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }
        
        // Limpar mensagens
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }
        
        // Mover input para baixo
        this.moveInputToBottom();
        
        this.updateChatHistory();
        this.saveChats();
    }

    moveInputToBottom() {
        const inputWrapper = document.getElementById('inputWrapper');
        if (inputWrapper) {
            inputWrapper.classList.remove('input-wrapper-center');
            inputWrapper.classList.add('input-wrapper-bottom');
        }
    }

    moveInputToCenter() {
        const inputWrapper = document.getElementById('inputWrapper');
        if (inputWrapper) {
            inputWrapper.classList.remove('input-wrapper-bottom');
            inputWrapper.classList.add('input-wrapper-center');
        }
    }

    loadChats() {
        const saved = localStorage.getItem('webSearchChats');
        if (saved) {
            try {
                this.chats = JSON.parse(saved);
                this.updateChatHistory();
            } catch (error) {
                console.error('❌ Erro ao carregar chats:', error);
                this.chats = [];
            }
        }
    }

    saveChats() {
        try {
            localStorage.setItem('webSearchChats', JSON.stringify(this.chats));
        } catch (error) {
            console.error('❌ Erro ao salvar chats:', error);
        }
    }

    saveCurrentChat() {
        if (!this.currentChatId) return;
        
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            // Atualizar título com a primeira mensagem
            if (chat.messages.length > 0 && chat.title === 'Nova pesquisa') {
                const firstMessage = chat.messages[0].content;
                chat.title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
            }
            this.saveChats();
            this.updateChatHistory();
        }
    }

    updateChatHistory() {
        if (!this.elements.chatHistoryList) return;
        
        this.elements.chatHistoryList.innerHTML = this.chats.map(chat => `
            <div class="p-3 rounded-lg cursor-pointer transition-colors ${
                chat.id === this.currentChatId 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }" onclick="window.webSearchUI.loadChat('${chat.id}')">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-medium text-sm text-text-main-light dark:text-text-main-dark truncate">${chat.title}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${this.formatDate(chat.createdAt)}</p>
                    </div>
                    <button onclick="event.stopPropagation(); window.webSearchUI.deleteChat('${chat.id}')" class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                        <span class="material-icons-outlined text-sm text-red-500">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    loadChat(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;
        
        this.currentChatId = chatId;
        
        // Esconder welcome screen
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }
        
        // Limpar mensagens
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }
        
        // Carregar mensagens
        chat.messages.forEach(msg => {
            if (msg.role === 'user') {
                this.addUserMessage(msg.content, false);
            } else {
                this.addAssistantMessage(msg.content, false);
            }
        });
        
        // Mover input para baixo
        this.moveInputToBottom();
        
        this.updateChatHistory();
    }

    deleteChat(chatId) {
        if (!confirm('Tem certeza que deseja excluir esta pesquisa?')) return;
        
        this.chats = this.chats.filter(c => c.id !== chatId);
        
        if (this.currentChatId === chatId) {
            this.currentChatId = null;
            if (this.elements.welcomeScreen) {
                this.elements.welcomeScreen.style.display = 'flex';
            }
            if (this.elements.messagesContainer) {
                this.elements.messagesContainer.innerHTML = '';
            }
            // Voltar input para o centro
            this.moveInputToCenter();
        }
        
        this.saveChats();
        this.updateChatHistory();
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins} min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays} dias atrás`;
        
        return date.toLocaleDateString('pt-BR');
    }

    addUserMessage(message, save = true) {
        if (save && this.currentChatId) {
            const chat = this.chats.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.messages.push({ role: 'user', content: message });
            }
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-end mb-6 animate-slideIn';
        
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3 max-w-[70%]">
                <div class="flex-1 px-5 py-4 bg-primary text-white rounded-2xl rounded-br-none shadow-lg">
                    <p class="text-base leading-relaxed">${this.escapeHtml(message)}</p>
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAssistantMessage(message, save = true) {
        if (save && this.currentChatId) {
            const chat = this.chats.find(c => c.id === this.currentChatId);
            if (chat) {
                chat.messages.push({ role: 'assistant', content: message });
            }
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-start mb-6 animate-slideIn';
        
        // Processar mensagem para extrair fontes
        const { content, sources } = this.processMessageWithSources(message);
        
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3 max-w-[85%]">
                <!-- Ícone do assistente -->
                <div class="flex-shrink-0 mt-1">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
                        <span class="material-icons-outlined text-white text-lg">travel_explore</span>
                    </div>
                </div>
                
                <!-- Conteúdo da mensagem -->
                <div class="flex-1">
                    <div class="px-5 py-4 bg-surface-light dark:bg-surface-dark rounded-2xl rounded-bl-none border border-gray-200 dark:border-gray-700 shadow-lg">
                        <div class="message-content text-text-main-light dark:text-text-main-dark">${content}</div>
                    </div>
                    
                    <!-- Fontes organizadas em cards -->
                    ${sources.length > 0 ? `
                        <div class="sources-container">
                            <div class="sources-header">
                                <span class="material-icons-outlined text-sm">source</span>
                                <span>Fontes da Pesquisa</span>
                            </div>
                            <div class="space-y-3">
                                ${sources.map((source, index) => `
                                    <div class="source-card">
                                        <a href="https://www.google.com/search?q=${encodeURIComponent(source)}" target="_blank" class="source-link">
                                            <div class="source-icon">
                                                <span class="material-icons-outlined">open_in_new</span>
                                            </div>
                                            <div class="source-content">
                                                <div class="source-title">${source}</div>
                                                <div class="source-description">Clique para verificar a informação original</div>
                                            </div>
                                        </a>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    processMessageWithSources(message) {
        let content = message;
        const sources = [];
        
        // Extrair fontes no formato: Fonte: G1 – "Título" (data)【1†L10-L18】
        const sourceRegex = /Fonte:\s*([^–]+)\s*–\s*"([^"]+)"/g;
        let match;
        
        while ((match = sourceRegex.exec(message)) !== null) {
            const sourceName = match[1].trim();
            const title = match[2].trim();
            
            sources.push(sourceName);
            
            // Remover a linha inteira da fonte do conteúdo
            const fullSourceLine = match[0];
            const fullLineRegex = new RegExp(fullSourceLine + '[^\\n]*', 'g');
            content = content.replace(fullLineRegex, '');
        }
        
        // Remover todas as citações estranhas 【1†L30-L38】【1†L48-L52】
        content = content.replace(/【\d+†[L\d0-9-]+】/g, '');
        
        // Remover linhas vazias extras
        content = content.replace(/\n\s*\n/g, '\n');
        
        // Limpar espaços extras
        content = content.trim();
        
        // Converter markdown para HTML
        content = this.markdownToHtml(content);
        
        return { content, sources };
    }

    markdownToHtml(text) {
        return text
            // Títulos (H1, H2, H3)
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 text-primary">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-3 text-primary">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mb-2 text-primary">$1</h3>')
            
            // Cards de destaque
            .replace(/\[destaque:\s*([^\]]+)\]/gi, '<span class="inline-block bg-gradient-to-r from-primary to-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">$1</span>')
            .replace(/\[card:\s*([^\]]+)\]/gi, '<div class="inline-block bg-surface-light dark:bg-surface-dark border border-primary/20 rounded-lg px-4 py-2 m-1 shadow-md"><span class="text-primary font-semibold">$1</span></div>')
            
            // Negrito
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>')
            
            // Itálico
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
            
            // Sublinhado
            .replace(/__(.*?)__/g, '<u class="underline">$1</u>')
            
            // Listas numeradas
            .replace(/^\d+\.\s+(.*$)/gim, '<li class="ml-4 mb-2 list-decimal">$1</li>')
            
            // Listas com marcadores
            .replace(/^[-*]\s+(.*$)/gim, '<li class="ml-4 mb-2 list-disc">$1</li>')
            
            // Parágrafos (quebras de linha)
            .replace(/\n\n/g, '</p><p class="mb-4 leading-relaxed">')
            
            // Quebras de linha simples
            .replace(/\n/g, '<br class="mb-2">')
            
            // Emojis (simples)
            .replace(/:rocket:/g, '🚀')
            .replace(/:fire:/g, '🔥')
            .replace(/:star:/g, '⭐')
            .replace(/:check:/g, '✅')
            .replace(/:warning:/g, '⚠️')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary hover:text-blue-700 underline transition-colors">$1</a>')
            
            // Código inline
            .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">$1</code>')
            
            // Linhas horizontais
            .replace(/^---$/gim, '<hr class="my-4 border-gray-300 dark:border-gray-600">');
            .replace(/^/, '<p class="mb-3">')
            .replace(/$/, '</p>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'flex justify-start mb-6 animate-slideIn';
        
        typingDiv.innerHTML = `
            <div class="flex items-start gap-3 max-w-[85%]">
                <div class="flex-shrink-0 mt-1">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
                        <span class="material-icons-outlined text-white text-lg">travel_explore</span>
                    </div>
                </div>
                <div class="px-5 py-4 bg-surface-light dark:bg-surface-dark rounded-2xl rounded-bl-none border border-gray-200 dark:border-gray-700 shadow-lg">
                    <div class="typing-indicator text-text-main-light dark:text-text-main-dark flex items-center">
                        Pesquisando
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(typingDiv);
        
        // Adicionar tempo estimado
        this.showEstimatedTime();
        
        this.scrollToBottom();
    }

    showEstimatedTime() {
        const existingTime = document.querySelector('.estimated-time');
        if (existingTime) {
            existingTime.remove();
        }
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'estimated-time';
        timeDiv.textContent = 'Tempo estimado: 30 segundos';
        document.body.appendChild(timeDiv);
    }

    hideEstimatedTime() {
        const timeDiv = document.querySelector('.estimated-time');
        if (timeDiv) {
            timeDiv.remove();
        }
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        // Esconder tempo estimado
        this.hideEstimatedTime();
    }

    updateSendButton() {
        if (this.isGenerating) {
            this.elements.sendButton.disabled = true;
            this.elements.sendButton.innerHTML = '<span class="material-icons-outlined text-sm">hourglass_empty</span>';
        } else {
            this.elements.sendButton.disabled = false;
            this.elements.sendButton.innerHTML = '<span class="material-icons-outlined text-sm">arrow_upward</span>';
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            if (this.elements.messagesContainer) {
                this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
            }
        }, 100);
    }
}

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.webSearchUI = new WebSearchUI();
});
