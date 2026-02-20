// Classe principal para a página de pesquisa na web
class WebSearchUI {
    constructor() {
        this.messages = [];
        this.isGenerating = false;
        this.init();
    }

    init() {
        console.log('🔍 Inicializando página de pesquisa na web...');
        
        // Elementos do DOM
        this.elements = {
            messagesContainer: document.getElementById('messagesContainer'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendButton')
        };

        // Configurar event listeners
        this.setupEventListeners();
        
        // Configurar textarea para auto-resize
        this.setupTextareaAutoResize();
        
        // Focar no input
        this.elements.userInput.focus();
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

        // Auto-resize do textarea
        this.elements.userInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
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

    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-end mb-6 animate-slideIn';
        
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3 max-w-[70%]">
                <div class="flex-1 px-5 py-4 bg-primary text-white rounded-2xl rounded-br-none">
                    <p class="text-base leading-relaxed">${this.escapeHtml(message)}</p>
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAssistantMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex justify-start mb-6 animate-slideIn';
        
        // Processar mensagem para adicionar links das fontes
        const processedMessage = this.processMessageWithSources(message);
        
        messageDiv.innerHTML = `
            <div class="flex items-start gap-3 max-w-[85%]">
                <!-- Ícone do assistente -->
                <div class="flex-shrink-0 mt-1">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span class="material-icons-outlined text-white text-lg">travel_explore</span>
                    </div>
                </div>
                
                <!-- Conteúdo da mensagem -->
                <div class="flex-1 px-5 py-4 bg-white dark:bg-gray-800 rounded-2xl rounded-bl-none border border-gray-200 dark:border-gray-700">
                    <div class="message-content">${processedMessage}</div>
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    processMessageWithSources(message) {
        // Adicionar links para fontes citadas na resposta
        let processedMessage = message;
        
        // Procurar por padrões de citação e adicionar links
        processedMessage = processedMessage.replace(
            /\[fonte:\s*([^\]]+)\]/gi,
            (match, source) => {
                const cleanSource = source.trim();
                const searchQuery = encodeURIComponent(cleanSource);
                return `<div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="material-icons-outlined text-blue-600 text-sm">source</span>
                        <span class="text-sm font-medium text-blue-600">Fonte:</span>
                    </div>
                    <a href="https://www.google.com/search?q=${searchQuery}" target="_blank" class="source-link">${cleanSource}</a>
                </div>`;
            }
        );
        
        // Converter markdown para HTML
        processedMessage = this.markdownToHtml(processedMessage);
        
        return processedMessage;
    }

    markdownToHtml(text) {
        // Conversão simples de markdown para HTML
        return text
            // Negrito
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Itálico
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
            // Headers
            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
            // Listas
            .replace(/^\* (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-6 mb-2">$1</ul>')
            // Parágrafos
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>')
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
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span class="material-icons-outlined text-white text-lg">travel_explore</span>
                    </div>
                </div>
                <div class="flex-1 px-5 py-4 bg-white dark:bg-gray-800 rounded-2xl rounded-bl-none border border-gray-200 dark:border-gray-700">
                    <div class="typing-indicator text-gray-600 dark:text-gray-300">Pesquisando</div>
                </div>
            </div>
        `;

        this.elements.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateSendButton() {
        if (this.isGenerating) {
            this.elements.sendButton.disabled = true;
            this.elements.sendButton.innerHTML = '<span class="material-icons-outlined text-xl">hourglass_empty</span>';
        } else {
            this.elements.sendButton.disabled = false;
            this.elements.sendButton.innerHTML = '<span class="material-icons-outlined text-xl">arrow_upward</span>';
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 100);
    }
}

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new WebSearchUI();
});
