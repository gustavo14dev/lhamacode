import { Agent } from './agent.js';

import { TimelineSystem } from './timeline-system.js';

import { ProactiveSuggestions } from './proactive-system.js';

import { PreferenceLearning } from './preference-system.js';



// Configuração do Supabase
const SUPABASE_URL = 'https://vvckoxcmhcaibfgfyqor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7RlWwC4vkk1uIRGN4I5-uQ_2d4cCa5w';

// Inicializar Supabase (disponível globalmente)
window.supabase = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
const supabase = window.supabase;



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

        this.currentModel = 'rapido';

        

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
            attachFileBtn: document.getElementById('attachFileBtn'),
            attachDropdown: document.getElementById('attachDropdown'),
            attachFileOptionBtn: document.getElementById('attachFileOptionBtn'),
            takePhotoOptionBtn: document.getElementById('takePhotoOptionBtn'),
            cameraCard: document.getElementById('cameraCard'),
            cameraVideo: document.getElementById('cameraVideo'),
            cameraCanvas: document.getElementById('cameraCanvas'),
            closeCameraBtn: document.getElementById('closeCameraBtn'),
            takePhotoBtn: document.getElementById('takePhotoBtn'),
            switchCameraBtn: document.getElementById('switchCameraBtn'),
            cameraLoading: document.getElementById('cameraLoading'),
            codeFileInput: document.getElementById('codeFileInput'),
            imageFileInput: document.getElementById('imageFileInput'),
            attachedFilesContainer: document.getElementById('attachedFilesContainer'),
            newChatBtn: document.getElementById('newChatBtn'),
            chatHistoryList: document.getElementById('chatHistoryList'),
            modelButton: document.getElementById('modelButton'),
            modelDropdown: document.getElementById('modelDropdown'),
            modelButtonText: document.getElementById('modelButtonText'),
            scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
            userHeader: document.getElementById('userHeader'),
            userEmail: document.getElementById('userEmail'),
            loginBtn: document.getElementById('loginBtn'),
            loginPrompt: document.getElementById('loginPrompt'),
            logoutBtn: document.getElementById('logoutBtn')
        };

        this.cameraStream = null;
        this.currentFacingMode = 'user';
        this.setupAttachListeners();

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

    // Criar dropdown dinâmico igual ao modelo dropdown
    setupCreateDropdown() {
        const createBtn = document.getElementById('createToggle');
        
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('🔧 [CREATE] Botão criar clicado');
                
                // Remover dropdown anterior se existir
                const existing = document.getElementById('floatingCreateDropdown');
                if (existing) existing.remove();
                
                // Criar dropdown dinâmico
                const dropdownHTML = `
                    <div id="floatingCreateDropdown" class="hidden fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[200]" style="min-width: 200px;">
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 first:rounded-t-lg" onclick="selectTool('investigate')">
                            <span class="material-icons-outlined text-base text-blue-400 mt-0.5">troubleshoot</span>
                            <div class="flex-1">
                                <div class="font-medium">Drekee Investigate 1.0</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Investigação profunda com IA</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="selectTool('re')">
                            <span class="material-icons-outlined text-base text-green-400 mt-0.5">calculate</span>
                            <div class="flex-1">
                                <div class="font-medium">Resolução de Exercícios</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Resolução completa de questões com cálculo detalhado e justificativa técnica</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="toggleCreateSubcard()">
                            <span class="material-icons-outlined text-base text-purple-400 mt-0.5">add_box</span>
                            <div class="flex-1">
                                <div class="font-medium">Criar</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Apresentações, Documentos e Mapas Mentais</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="selectTool('agent')">
                            <span class="material-icons-outlined text-base text-orange-500 mt-0.5">smart_toy</span>
                            <div class="flex-1">
                                <div class="font-medium">Drekee Agent 1.0</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Modo agente inteligente com visão computacional</div>
                            </div>
                        </button>
                        <button id="deactivateFunctionBtn" class="hidden w-full text-left px-2 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-start gap-3 last:rounded-b-lg" onclick="deactivateCurrentFunction()">
                            <span class="material-icons-outlined text-base text-red-500 mt-0.5">close</span>
                            <div class="flex-1">
                                <div class="font-medium">DESATIVAR FUNÇÃO</div>
                                <div class="text-xs text-red-400 dark:text-red-500 mt-0.5">Parar funcionalidade atual</div>
                            </div>
                        </button>
                    </div>
                `;
                
                // Adicionar ao body
                document.body.insertAdjacentHTML('beforeend', dropdownHTML);
                
                const dropdown = document.getElementById('floatingCreateDropdown');
                
                // Posicionar dropdown
                const rect = createBtn.getBoundingClientRect();
                dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                dropdown.style.left = `${rect.left}px`;
                dropdown.classList.remove('hidden');
                
                // Atualizar botão de desativação ao abrir o dropdown
                if (window.updateDeactivateButton) {
                    setTimeout(window.updateDeactivateButton, 50);
                }
                
                console.log('🔧 [CREATE] Dropdown mostrado');
                
                // Fechar ao clicar fora
                document.addEventListener('click', function closeDropdown(e) {
                    if (!createBtn.contains(e.target) && !dropdown.contains(e.target)) {
                        dropdown.classList.add('hidden');
                        document.removeEventListener('click', closeDropdown);
                    }
                });
            });
        }
    }

    // Função para abrir/fechar subcard de criação
    toggleCreateSubcard() {
        console.log('🔧 [CREATE] Subcard Criar clicado');
        
        // Se modo Documento está ativo -> DESATIVA direto
        if (window.isDocumentModeActive) {
            console.log('🔧 [CREATE] Modo Documento ativo, desativando...');
            
            // Chamar função de desativação
            if (window.selectCreateType) {
                window.selectCreateType('document');
            }
            return;
        }

        // Se modo Apresentação está ativo -> DESATIVA direto
        if (window.isSlidesModeActive) {
            console.log('🔧 [CREATE] Modo Apresentação ativo, desativando...');
            
            if (window.selectCreateType) {
                window.selectCreateType('slides');
            }
            return;
        }
        
        // Remover subcard anterior se existir
        const existingSubcard = document.getElementById('floatingCreateSubcard');
        if (existingSubcard) {
            existingSubcard.remove();
            return;
        }
        
        // Criar subcard dinâmico
        const subcardHTML = `
            <div id="floatingCreateSubcard" class="hidden fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[201]" style="min-width: 200px;">
                <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 first:rounded-t-lg" onclick="activateSlidesMode()">
                    <span class="material-icons-outlined text-base text-green-400 mt-0.5">slideshow</span>
                    <div class="flex-1">
                        <div class="font-medium">Apresentação</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Criar apresentação de slides</div>
                    </div>
                    <span id="slidesCloseIcon" class="material-icons-outlined text-base text-gray-500 dark:text-gray-400 mt-0.5 hidden">close</span>
                </button>
                <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="activateDocumentMode()">
                    <span class="material-icons-outlined text-base text-blue-400 mt-0.5">description</span>
                    <div class="flex-1">
                        <div class="font-medium">Documento</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Criar documento acadêmico</div>
                    </div>
                    <span id="documentCloseIcon" class="material-icons-outlined text-base text-gray-500 dark:text-gray-400 mt-0.5 hidden">close</span>
                </button>
                <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed transition-colors flex items-start gap-3 last:rounded-b-lg" disabled>
                    <span class="material-icons-outlined text-base text-gray-400 mt-0.5">psychology</span>
                    <div class="flex-1">
                        <div class="font-medium">Mapa Mental</div>
                        <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Em breve...</div>
                    </div>
                </button>
            </div>
        `;
        
        // Adicionar ao body
        document.body.insertAdjacentHTML('beforeend', subcardHTML);
        
        const subcard = document.getElementById('floatingCreateSubcard');
        const createDropdown = document.getElementById('floatingCreateDropdown');
        
        // Posicionar subcard ao lado do dropdown principal
        if (createDropdown && subcard) {
            const rect = createDropdown.getBoundingClientRect();
            subcard.style.bottom = `${window.innerHeight - rect.top + 8}px`;
            subcard.style.left = `${rect.right + 8}px`;
            subcard.classList.remove('hidden');
        }
        
        console.log('🔧 [CREATE] Subcard Criar mostrado');
        
        // Atualizar botão de desativação ao abrir subcard
        if (window.updateDeactivateButton) {
            setTimeout(window.updateDeactivateButton, 50);
        }
        
        // Fechar ao clicar fora
        setTimeout(() => {
            document.addEventListener('click', function closeSubcard(e) {
                if (!subcard.contains(e.target) && !createDropdown.contains(e.target)) {
                    subcard.remove();
                    document.removeEventListener('click', closeSubcard);
                }
            });
        }, 100);
    }

    // Selecionar ferramenta (investigate, RE, agent)
    selectTool(tool) {
        console.log(`🔧 [TOOL] Ferramenta selecionada: ${tool}`);
        
        // Fechar dropdown
        const dropdown = document.getElementById('floatingCreateDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
        // Resetar todos os modos
        window.isREMode = false;
        window.isInvestigateMode = false;
        window.isAgentMode = false;
        
        // Resetar botões
        this.resetCreateButtons();
        
        switch(tool) {
            case 'investigate':
                window.isInvestigateMode = true;
                this.showNotification('🔍 Modo Investigate ativado - Envie sua dúvida para investigação profunda', 'info');
                break;
                
            case 're':
                window.isREMode = true;
                this.showNotification('🧮 Modo Resolução de Exercícios ativado - Envie o exercício para resolver', 'info');
                break;
                
            case 'agent':
                window.isAgentMode = true;
                this.activateAgentMode();
                // Atualizar botão para mostrar estado ativo
                this.updateCreateButton();
                break;
        }
        
        // Atualizar botão de desativação
        if (window.updateDeactivateButton) {
            window.updateDeactivateButton();
        }
    }

    // Ativar modo agente
    activateAgentMode() {
        console.log('🤖 [AGENT] Ativando Drekee Agent 1.0...');
        
        // Mostrar notificação
        this.showNotification('🤖 Drekee Agent 1.0 ativado - Envie uma mensagem para começar', 'success');
        
        // Adicionar indicador visual do modo agente
        this.addAgentIndicator();
        
        // Iniciar loop do agente (mas sem painel fixo)
        this.startAgentLoop();
        
        // Atualizar UI
        this.updateAgentUI(true);
    }

    // Adicionar indicador visual do modo agente
    addAgentIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'agentIndicator';
        indicator.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-[999] flex items-center gap-2';
        indicator.innerHTML = `
            <span class="material-icons-outlined text-sm">smart_toy</span>
            <span class="text-sm font-medium">Drekee Agent 1.0</span>
            <span class="w-2 h-2 bg-white rounded-full animate-pulse"></span>
        `;
        document.body.appendChild(indicator);
    }

    // Criar painel completo do agente
    createAgentPanel() {
        const panel = document.createElement('div');
        panel.id = 'agentPanel';
        panel.className = 'fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-[998] transition-all duration-300';
        panel.innerHTML = `
            <div class="flex h-96">
                <!-- Coluna Esquerda: Prints Capturados -->
                <div class="w-1/3 border-r border-gray-700 p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-white font-medium flex items-center gap-2">
                            <span class="material-icons-outlined text-orange-400">screenshot</span>
                            Capturas de Tela
                        </h3>
                        <button onclick="window.ui.clearScreenshots()" class="text-gray-400 hover:text-white text-xs">
                            Limpar
                        </button>
                    </div>
                    <div id="screenshotsList" class="space-y-2 overflow-y-auto max-h-80">
                        <!-- Screenshots serão adicionados aqui -->
                    </div>
                </div>
                
                <!-- Coluna Central: Log de Pensamento -->
                <div class="w-1/3 border-r border-gray-700 p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-white font-medium flex items-center gap-2">
                            <span class="material-icons-outlined text-blue-400">psychology</span>
                            Pensamento da IA
                        </h3>
                        <button onclick="window.ui.clearThoughtLog()" class="text-gray-400 hover:text-white text-xs">
                            Limpar
                        </button>
                    </div>
                    <div id="thoughtLog" class="space-y-2 overflow-y-auto max-h-80 text-sm">
                        <!-- Log de pensamento será adicionado aqui -->
                    </div>
                </div>
                
                <!-- Coluna Direita: Ações Executadas -->
                <div class="w-1/3 p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-white font-medium flex items-center gap-2">
                            <span class="material-icons-outlined text-green-400">play_arrow</span>
                            Ações Executadas
                        </h3>
                        <button onclick="window.ui.clearActionLog()" class="text-gray-400 hover:text-white text-xs">
                            Limpar
                        </button>
                    </div>
                    <div id="actionLog" class="space-y-2 overflow-y-auto max-h-80 text-sm">
                        <!-- Log de ações será adicionado aqui -->
                    </div>
                </div>
            </div>
            
            <!-- Barra de Controles -->
            <div class="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button onclick="window.ui.captureScreenForAgent()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <span class="material-icons-outlined text-xs">photo_camera</span>
                        Capturar
                    </button>
                    <button onclick="window.ui.executeNextAction()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <span class="material-icons-outlined text-xs">play_arrow</span>
                        Executar Próxima
                    </button>
                    <button onclick="window.ui.pauseAgent()" class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <span class="material-icons-outlined text-xs">pause</span>
                        Pausar
                    </button>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-xs text-gray-400">
                        Status: <span id="agentStatus" class="text-green-400">Ativo</span>
                    </div>
                    <button onclick="window.ui.toggleAgentPanel()" class="text-gray-400 hover:text-white">
                        <span class="material-icons-outlined">minimize</span>
                    </button>
                    <button onclick="window.ui.deactivateAgentMode()" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                        <span class="material-icons-outlined text-xs">close</span>
                        Desativar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        
        // Adicionar entrada inicial no log
        this.addThoughtLog(' Drekee Agent 1.0 iniciado - Pronto para analisar!');
    }

    // Adicionar screenshot ao painel
    addScreenshot(imageData, timestamp) {
        const screenshotsList = document.getElementById('screenshotsList');
        if (!screenshotsList) return;
        
        const screenshotItem = document.createElement('div');
        screenshotItem.className = 'bg-gray-800 rounded p-2 border border-gray-700';
        screenshotItem.innerHTML = `
            <div class="text-xs text-gray-400 mb-1">${timestamp}</div>
            <img src="${imageData}" class="w-full rounded border border-gray-600" alt="Screenshot">
            <div class="mt-2 flex gap-1">
                <button onclick="window.ui.analyzeScreenshot('${imageData}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">
                    Analisar
                </button>
                <button onclick="window.ui.expandScreenshot('${imageData}')" class="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs">
                    Expandir
                </button>
            </div>
        `;
        
        screenshotsList.insertBefore(screenshotItem, screenshotsList.firstChild);
        
        // Limitar a 5 screenshots
        while (screenshotsList.children.length > 5) {
            screenshotsList.removeChild(screenshotsList.lastChild);
        }
    }

    // Adicionar entrada no log de pensamento
    addThoughtLog(message) {
        const thoughtLog = document.getElementById('thoughtLog');
        if (!thoughtLog) return;
        
        const logItem = document.createElement('div');
        logItem.className = 'bg-gray-800 rounded p-2 border border-gray-700';
        logItem.innerHTML = `
            <div class="text-xs text-gray-400 mb-1">${new Date().toLocaleTimeString()}</div>
            <div class="text-gray-300">${message}</div>
        `;
        
        thoughtLog.insertBefore(logItem, thoughtLog.firstChild);
        
        // Limitar a 20 entradas
        while (thoughtLog.children.length > 20) {
            thoughtLog.removeChild(thoughtLog.lastChild);
        }
    }

    // Adicionar entrada no log de ações
    addActionLog(action, status = 'executed') {
        const actionLog = document.getElementById('actionLog');
        if (!actionLog) return;
        
        const statusIcon = status === 'executed' ? '✅' : status === 'failed' ? '❌' : '⏳';
        const statusColor = status === 'executed' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-yellow-400';
        
        const logItem = document.createElement('div');
        logItem.className = 'bg-gray-800 rounded p-2 border border-gray-700';
        logItem.innerHTML = `
            <div class="text-xs text-gray-400 mb-1">${new Date().toLocaleTimeString()}</div>
            <div class="text-gray-300 flex items-center gap-2">
                <span class="${statusColor}">${statusIcon}</span>
                ${action}
            </div>
        `;
        
        actionLog.insertBefore(logItem, actionLog.firstChild);
        
        // Limitar a 15 entradas
        while (actionLog.children.length > 15) {
            actionLog.removeChild(actionLog.lastChild);
        }
    }

    // Limpar screenshots
    clearScreenshots() {
        const screenshotsList = document.getElementById('screenshotsList');
        if (screenshotsList) {
            screenshotsList.innerHTML = '';
            this.addThoughtLog('🗑️ Screenshots limpos');
        }
    }

    // Limpar log de pensamento
    clearThoughtLog() {
        const thoughtLog = document.getElementById('thoughtLog');
        if (thoughtLog) {
            thoughtLog.innerHTML = '';
            this.addThoughtLog('🗑️ Log de pensamento limpo');
        }
    }

    // Limpar log de ações
    clearActionLog() {
        const actionLog = document.getElementById('actionLog');
        if (actionLog) {
            actionLog.innerHTML = '';
            this.addThoughtLog('🗑️ Log de ações limpo');
        }
    }

    // Iniciar loop do agente (no chat)
    startAgentLoop() {
        this.isAgentPaused = false;
        this.addAgentThoughtLog('🤖 Drekee Agent 1.0 iniciado - Envie uma mensagem para começar');
    }

    // Adicionar pensamento do agente (no chat)
    addAgentThoughtLog(message) {
        this.addAgentTimelineEntry('thought', { message });
    }

    // Iniciar resposta do agente no chat
    startAgentResponse() {
        this.isAgentResponding = true;
        this.agentTimeline = [];
        this.agentTimelineQueue = [];
        this.agentTimelineProcessing = false;
        this.agentTimelineDelayMs = 2000;
        this.agentRunContext = {
            screenshots: 0,
            visitedUrl: null,
            pageTitle: null,
            mode: null,
            blocked: false,
            request: null,
            lastScreenshotData: null,
            navigationTrail: [],
            pageText: [],
            resolvedFromSearch: false,
            resolvedSearchTitle: null,
            resolvedSearchUrl: null
        };
        
        // Criar mensagem inicial do agente
        const agentMessage = `
            <div class="agent-response-container bg-transparent border-0 rounded-none p-0 mb-6 shadow-none" style="background: transparent; border: 0; box-shadow: none;">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-9 h-9 rounded-full bg-orange-500/12 border border-orange-400/20 flex items-center justify-center">
                        <span class="text-orange-300 text-sm">AI</span>
                    </div>
                    <div>
                        <div class="text-orange-300 font-semibold">Drekee Agent 1.0</div>
                        <div class="text-xs text-gray-400">Navegacao assistida em tempo real</div>
                    </div>
                    <span class="w-2 h-2 bg-orange-400 rounded-full animate-pulse ml-auto"></span>
                </div>
                
                <div id="agentResponse-${Date.now()}" class="space-y-4">
                    <div class="text-gray-300">🔍 Analisando ambiente...</div>
                </div>
            </div>
        `;
        
        this.agentResponseElement = document.createElement('div');
        this.agentResponseElement.className = 'bg-transparent border-0 shadow-none p-0 m-0';
        this.agentResponseElement.style.background = 'transparent';
        this.agentResponseElement.style.border = '0';
        this.agentResponseElement.style.boxShadow = 'none';
        this.agentResponseElement.innerHTML = agentMessage;
        
        // Adicionar ao chat
        const chatContainer = this.elements.messagesContainer || document.querySelector('#chatMessages');
        if (chatContainer) {
            chatContainer.appendChild(this.agentResponseElement);
            this.scrollToBottom();
        }
    }

    addAgentTimelineEntry(type, payload = {}, options = {}) {
        const entry = {
            id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            timestamp: new Date().toLocaleTimeString(),
            ...payload
        };

        if (options.immediate) {
            if (!this.agentTimeline) {
                this.agentTimeline = [];
            }
            this.agentTimeline.push(entry);
            if (this.agentResponseElement) {
                this.updateAgentResponse();
            }
            return;
        }

        if (!this.agentTimelineQueue) {
            this.agentTimelineQueue = [];
        }

        this.agentTimelineQueue.push({
            entry,
            delayOverride: options.delayOverride
        });
        this.processAgentTimelineQueue();
    }

    async processAgentTimelineQueue() {
        if (this.agentTimelineProcessing) {
            return;
        }

        this.agentTimelineProcessing = true;

        while (this.agentTimelineQueue && this.agentTimelineQueue.length > 0) {
            const queueItem = this.agentTimelineQueue.shift();
            const entry = queueItem.entry;
            const delay = typeof queueItem.delayOverride === 'number'
                ? queueItem.delayOverride
                : this.getAgentTimelineDelay(entry);

            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }

            if (!this.agentTimeline) {
                this.agentTimeline = [];
            }

            this.agentTimeline.push(entry);

            if (this.agentResponseElement) {
                this.updateAgentResponse();
            }
        }

        this.agentTimelineProcessing = false;
    }

    getAgentTimelineDelay(entry) {
        if (!entry || !entry.type) {
            return 0;
        }

        if (entry.type === 'intro') {
            return 0;
        }

        if (entry.type === 'thought') {
            return this.agentTimelineDelayMs;
        }

        if (entry.type === 'screenshot') {
            return 450;
        }

        if (entry.type === 'summary') {
            return 700;
        }

        if (entry.type === 'status') {
            return 500;
        }

        return 900;
    }

    // Atualizar resposta do agente (em tempo real)
    updateAgentResponse() {
        if (!this.agentResponseElement) return;
        
        const responseContainer = this.agentResponseElement.querySelector('[id^="agentResponse-"]');
        if (!responseContainer) return;
        
        const html = (this.agentTimeline || [])
            .map((entry, index) => this.renderAgentTimelineEntry(entry, index))
            .join('') || '<div class="text-gray-300">🔍 Analisando ambiente...</div>';

        responseContainer.innerHTML = html;
        this.scrollToBottom();
    }

    renderAgentTimelineEntry(entry, index) {
        const time = `<div class="text-[11px] uppercase tracking-wide text-gray-500 mb-1">${entry.timestamp}</div>`;

        if (entry.type === 'intro') {
            return `
                <div class="pb-2">
                    <div class="text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap">${this.escapeHtml(entry.message || '')}</div>
                </div>
            `;
        }

        if (entry.type === 'thought') {
            return `
                <div class="flex items-start gap-3">
                    <div class="mt-1 w-7 h-7 rounded-full bg-orange-500/15 border border-orange-400/25 flex items-center justify-center flex-shrink-0">
                        <span class="text-sm">🧠</span>
                    </div>
                    <div class="flex-1 bg-gray-800/80 rounded-2xl border border-gray-700/80 px-4 py-3">
                        ${time}
                        <div class="text-gray-100 text-sm leading-relaxed">${this.escapeHtml(entry.message || '')}</div>
                    </div>
                </div>
            `;
        }

        if (entry.type === 'action') {
            const statusIcon = entry.status === 'executed' ? '✓' : entry.status === 'failed' ? '×' : '…';
            const statusColor = entry.status === 'executed'
                ? 'border-green-600/40 bg-green-500/10 text-green-200'
                : entry.status === 'failed'
                    ? 'border-red-600/40 bg-red-500/10 text-red-200'
                    : 'border-yellow-600/40 bg-yellow-500/10 text-yellow-100';

            return `
                <div class="flex items-start gap-3">
                    <div class="mt-1 w-7 h-7 rounded-full ${statusColor} flex items-center justify-center flex-shrink-0">
                        <span class="text-sm">${statusIcon}</span>
                    </div>
                    <div class="flex-1">
                        ${time}
                        <div class="inline-flex max-w-full items-center gap-2 rounded-full border ${statusColor} px-4 py-2 text-sm">
                            <span>${this.escapeHtml(entry.description || '')}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if (entry.type === 'screenshot') {
            return `
                <div class="my-4">
                    <img
                        src="${entry.data}"
                        class="block w-full max-w-3xl cursor-zoom-in"
                        alt="Captura do agente"
                        onclick="window.ui.expandScreenshot(this.src)"
                    >
                </div>
            `;
        }

        if (entry.type === 'summary') {
            return `
                <div class="pt-2">
                    <div class="text-sm font-semibold text-gray-100 mb-2">${this.escapeHtml(entry.title || 'Resposta do agente')}</div>
                    <div class="text-[15px] text-gray-100 leading-relaxed whitespace-pre-wrap">${this.escapeHtml(entry.message || '')}</div>
                </div>
            `;
        }

        const toneClass = entry.type === 'error'
            ? 'border-red-700/50 text-red-100 bg-red-500/10'
            : 'border-gray-700 text-gray-200 bg-gray-800/70';

        const icon = entry.type === 'error' ? '!' : '✓';
        const iconBg = entry.type === 'error'
            ? 'bg-red-500/15 border-red-400/25 text-red-200'
            : 'bg-emerald-500/15 border-emerald-400/25 text-emerald-200';

        return `
            <div class="flex items-start gap-3">
                <div class="mt-1 w-7 h-7 rounded-full border ${iconBg} flex items-center justify-center flex-shrink-0">
                    <span class="text-sm">${icon}</span>
                </div>
                <div class="flex-1 rounded-2xl border ${toneClass} px-4 py-3">
                    ${time}
                    <div class="text-sm">${this.escapeHtml(entry.message || '')}</div>
                </div>
            </div>
        `;
    }

    // Adicionar screenshot ao buffer do agente
    addAgentScreenshot(imageData, caption = '') {
        if (this.agentRunContext) {
            this.agentRunContext.screenshots += 1;
            this.agentRunContext.lastScreenshotData = imageData;
        }

        this.addAgentTimelineEntry('screenshot', {
            data: imageData,
            caption
        });
    }

    // Adicionar ação ao buffer do agente
    addAgentAction(description, status = 'executed') {
        this.addAgentTimelineEntry('action', {
            description,
            status
        });
    }

    addAgentSummary(title, message) {
        this.addAgentTimelineEntry('summary', {
            title,
            message
        });
    }

    addAgentIntroMessage(message) {
        this.addAgentTimelineEntry('intro', { message }, { immediate: true });
    }

    // Finalizar resposta do agente
    finishAgentResponse(message = '✅ Análise concluída') {
        this.addAgentTimelineEntry('status', { message });
        this.isAgentResponding = false;
    }

    // Expandir screenshot
    expandScreenshot(imageData) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-[9999] flex items-center justify-center p-4';
        modal.onclick = () => modal.remove();
        modal.innerHTML = `
            <div class="max-w-4xl max-h-full">
                <img src="${imageData}" class="max-w-full max-h-full rounded" alt="Screenshot expandido">
                <div class="text-center mt-4">
                    <button onclick="this.parentElement.parentElement.remove()" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Analisar screenshot específico
    async analyzeScreenshot(imageData) {
        this.addThoughtLog('🔍 Analisando screenshot selecionado...');
        await this.analyzeScreenWithAgent({ dataUrl: imageData });
    }

    // Pausar agente
    pauseAgent() {
        this.isAgentPaused = true;
        document.getElementById('agentStatus').textContent = 'Pausado';
        document.getElementById('agentStatus').className = 'text-yellow-400';
        this.addThoughtLog('⏸️ Agente pausado');
    }

    // Retomar agente
    resumeAgent() {
        this.isAgentPaused = false;
        document.getElementById('agentStatus').textContent = 'Ativo';
        document.getElementById('agentStatus').className = 'text-green-400';
        this.addThoughtLog('▶️ Agente retomado');
    }

    // Executar próxima ação
    async executeNextAction() {
        if (this.lastAgentResponse && this.lastAgentResponse.proximo_passo) {
            await this.executeAgentAction(this.lastAgentResponse.proximo_passo);
        } else {
            this.addThoughtLog('❌ Nenhuma ação pendente para executar');
        }
    }

    // Minimizar/maximizar painel
    toggleAgentPanel() {
        const panel = document.getElementById('agentPanel');
        if (panel) {
            const isMinimized = panel.style.height === '60px';
            panel.style.height = isMinimized ? 'auto' : '60px';
            
            // Esconder/mostrar conteúdo principal
            const mainContent = panel.querySelector('.flex.h-96');
            if (mainContent) {
                mainContent.style.display = isMinimized ? 'flex' : 'none';
            }
        }
    }

    // Capturar tela e analisar
    async captureScreenForAgent() {
        try {
            this.addThoughtLog('📸 Iniciando captura de tela...');
            
            // Usar html2canvas ou método nativo
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Capturar área visível da página
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Capturar screenshot real
            const imageData = await this.takeScreenshot();
            
            // Adicionar screenshot ao painel
            const timestamp = new Date().toLocaleTimeString();
            this.addScreenshot(imageData.dataUrl, timestamp);
            
            this.addThoughtLog('✅ Captura de tela concluída - Enviando para análise...');
            
            // Enviar para análise
            await this.analyzeScreenWithAgent(imageData);
            
        } catch (error) {
            console.error('❌ [AGENT] Erro na captura:', error);
            this.addThoughtLog('❌ Erro na captura de tela: ' + error.message);
            this.showNotification('❌ Erro na captura de tela', 'error');
        }
    }

    // Capturar tela real usando html2canvas
    async takeScreenshot() {
        try {
            this.addThoughtLog('🔧 Usando html2canvas para captura...');
            
            // Esperar um pouco para garantir que a UI está atualizada
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Capturar o body inteiro
            const canvas = await html2canvas(document.body, {
                width: window.innerWidth,
                height: window.innerHeight,
                useCORS: true,
                allowTaint: true,
                scale: 1,
                logging: false,
                removeContainer: false
            });
            
            // Converter para base64
            const imageData = canvas.toDataURL('image/jpeg', 0.78);
            
            this.addThoughtLog(`✅ Captura concluída - Tamanho: ${Math.round(imageData.length/1024)}KB`);
            
            return {
                dataUrl: imageData,
                width: canvas.width,
                height: canvas.height
            };
            
        } catch (error) {
            console.error('❌ [AGENT] Erro na captura de tela:', error);
            this.addThoughtLog('❌ Erro na captura: ' + error.message + ' - Usando fallback...');
            // Fallback para imagem vazia
            return {
                dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                width: window.innerWidth,
                height: window.innerHeight
            };
        }
    }

    // Analisar tela com o agente (no chat)
    async analyzeScreenWithAgent(imageData) {
        try {
            this.addAgentThoughtLog('🧠 Enviando imagem para análise da IA...');
            
            // Preparar prompt para o agente
            const prompt = `Você é o Drekee Agent 1.0, um assistente de IA com visão computacional que pode VER e INTERAGIR com páginas web.

Analise esta captura de tela e me diga:
1. O que você vê na página
2. Quais elementos interativos existem (botões, links, campos)
3. O que eu posso fazer agora
4. O próximo passo recomendado

IMPORTANTE: Você PODE me ajudar a navegar e interagir com sites. Se eu pedir para abrir um site como www.nike.com.br, você pode:
- Analisar a página atual
- Sugerir cliques em botões
- Indicar onde digitar texto
- Ajudar na navegação

Responda em formato JSON:
{
  "pagina_atual": "descrição do que está na tela",
  "elementos_interativos": ["botão Comprar", "campo de busca", "menu Produtos"],
  "acoes_possiveis": ["clicar no botão X", "preencher campo Y", "navegar para seção Z"],
  "proximo_passo": "Clique no botão de busca para pesquisar produtos"
}`;

            // Adicionar screenshot ao chat
            this.addAgentScreenshot(imageData.dataUrl);
            
            // Enviar para API
            const response = await this.callAgentAPI(prompt, imageData.dataUrl);
            
            // Processar resposta
            this.processAgentResponse(response);
            
        } catch (error) {
            console.error('❌ [AGENT] Erro na análise:', error);
            this.addAgentThoughtLog('❌ Erro na análise: ' + error.message);
            this.showNotification('❌ Erro na análise da tela', 'error');
        }
    }

    // Processar mensagem do usuário no modo agente
    async processAgentMessage(userMessage) {
        try {
            const cleanMessage = (userMessage || '').trim();
            if (!cleanMessage) {
                return;
            }

            this.addUserMessage(cleanMessage, null, { preserveCreateMode: true });
            this.startAgentResponse();
            this.agentRunContext.request = cleanMessage;

            const explicitUrl = this.extractAgentUrl(cleanMessage);
            const shouldAnalyzeCurrentScreen = this.shouldAnalyzeCurrentScreen(cleanMessage);
            let normalizedUrl = null;
            let resolvedTarget = null;

            if (explicitUrl) {
                this.addAgentIntroMessage(this.buildAgentIntroMessage(cleanMessage, explicitUrl));
                normalizedUrl = this.normalizeAgentUrl(explicitUrl);

                if (!normalizedUrl) {
                    throw new Error(`Nao consegui entender a URL "${explicitUrl}"`);
                }
            } else if (shouldAnalyzeCurrentScreen) {
                this.addAgentIntroMessage(this.buildAgentIntroMessage(cleanMessage, null));
            } else {
                this.addAgentIntroMessage('Olá! Claro. Vou localizar o site certo, abrir a página correta e seguir a navegação que você pediu.');
                this.addAgentThoughtLog('🔎 Vou localizar o site mais relevante para começar a tarefa.');
                this.addAgentAction('Localizando o site correto', 'pending');

                resolvedTarget = await this.resolveAgentTarget(cleanMessage);
                normalizedUrl = this.normalizeAgentUrl(resolvedTarget?.url);

                if (!normalizedUrl) {
                    throw new Error('Nao consegui localizar um site confiavel para iniciar a tarefa.');
                }

                if (this.agentRunContext) {
                    this.agentRunContext.resolvedFromSearch = true;
                    this.agentRunContext.resolvedSearchTitle = resolvedTarget?.title || null;
                    this.agentRunContext.resolvedSearchUrl = normalizedUrl;
                }

                this.addAgentAction(`Site localizado: ${resolvedTarget?.title || normalizedUrl}`, 'executed');
                this.addAgentThoughtLog(`🔎 Encontrei ${resolvedTarget?.title || normalizedUrl} e vou abrir esse destino agora.`);
            }

            if (normalizedUrl) {
                if (this.agentRunContext) {
                    this.agentRunContext.visitedUrl = normalizedUrl;
                }

                this.addAgentThoughtLog(`🌐 Vou abrir ${normalizedUrl} em um navegador controlado pelo agente.`);
                this.addAgentAction(`Abrindo ${normalizedUrl}`, 'pending');

                const session = await this.openAgentBrowserSession(normalizedUrl, cleanMessage);
                this.agentRunContext.visitedUrl = session.currentUrl || normalizedUrl;
                this.agentRunContext.mode = session.mode || 'live-browser';
                this.agentRunContext.navigationTrail = Array.isArray(session.navigationTrail) ? session.navigationTrail : [];
                this.agentRunContext.pageText = this.coerceAgentList(session?.page?.visibleText);

                this.addAgentAction(`Site carregado: ${session.currentUrl || normalizedUrl}`, 'executed');
                await this.analyzeOpenedSite(session, cleanMessage);
                const finalText = await this.generateAgentFinalResponse({
                    request: cleanMessage,
                    targetUrl: session.currentUrl || normalizedUrl,
                    pageTitle: this.agentRunContext.pageTitle,
                    blocked: this.agentRunContext.blocked,
                    mode: this.agentRunContext.mode,
                    screenshots: this.agentRunContext.screenshots,
                    analysis: this.lastAgentResponse,
                    pageText: this.agentRunContext.pageText,
                    navigationTrail: this.agentRunContext.navigationTrail,
                    screenshotData: this.agentRunContext.lastScreenshotData
                });
                this.addAgentSummary('Resposta do agente', finalText);
                this.finishAgentResponse();
                return;
            }

            this.addAgentThoughtLog('📸 Vou analisar a tela atual do app para responder ao seu pedido.');
            const imageData = await this.takeScreenshot();
            this.addAgentScreenshot(imageData.dataUrl, 'Tela atual capturada pelo agente');

            const prompt = this.buildAgentVisionPrompt(cleanMessage, {
                currentUrl: window.location.href,
                title: document.title,
                description: 'Tela atual do proprio app Drekee'
            }, {
                label: 'Tela atual'
            });

            try {
                const response = await this.callAgentAPI(prompt, imageData.dataUrl);
                this.processAgentResponse(response, { label: 'Tela atual' });
            } catch (error) {
                console.error('❌ [AGENT] Falha na leitura visual da tela atual, usando fallback local:', error);
                this.addAgentThoughtLog('⚠️ A leitura visual falhou; usei a estrutura atual da interface para continuar.');
                const fallback = this.buildAgentFallbackAnalysis(cleanMessage, {
                    currentUrl: window.location.href,
                    title: document.title,
                    description: 'Tela atual do proprio app Drekee',
                    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map((item) => item.textContent?.trim()).filter(Boolean).slice(0, 4),
                    interactiveElements: Array.from(document.querySelectorAll('button, a, input, textarea, select'))
                        .map((item) => item.textContent?.trim() || item.getAttribute('aria-label') || item.placeholder || item.name || item.id)
                        .filter(Boolean)
                        .slice(0, 8)
                }, { label: 'Tela atual' });
                this.processAgentResponse(fallback, { label: 'Tela atual' });
            }

            const finalText = await this.generateAgentFinalResponse({
                request: cleanMessage,
                targetUrl: window.location.href,
                pageTitle: document.title,
                blocked: false,
                mode: 'current-screen',
                screenshots: this.agentRunContext.screenshots,
                analysis: this.lastAgentResponse,
                pageText: [],
                navigationTrail: [],
                screenshotData: this.agentRunContext.lastScreenshotData
            });
            this.addAgentSummary('Resposta do agente', finalText);
            this.finishAgentResponse();
        } catch (error) {
            console.error('❌ [AGENT] Erro no processamento:', error);
            this.addAgentTimelineEntry('error', { message: '❌ Erro: ' + error.message });
            this.finishAgentResponse('❌ Fluxo do agente encerrado com erro');
        }
    }

    extractAgentUrl(text) {
        const match = (text || '').match(/((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
        return match ? match[1] : null;
    }

    normalizeAgentUrl(rawUrl) {
        if (!rawUrl) {
            return null;
        }

        const cleanUrl = rawUrl.trim().replace(/[),.;!?]+$/g, '');
        const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;

        try {
            const parsed = new URL(withProtocol);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return null;
            }
            return parsed.toString();
        } catch {
            return null;
        }
    }

    shouldAnalyzeCurrentScreen(userMessage) {
        const normalized = this.normalizeSearchText(userMessage);
        if (!normalized) {
            return false;
        }

        const screenSignals = [
            'esta tela',
            'essa tela',
            'tela atual',
            'minha tela',
            'nesta tela',
            'nessa tela',
            'aqui no app',
            'neste app',
            'nesse app',
            'analise a tela',
            'analisa a tela'
        ];

        const webSignals = [
            'site',
            'pagina',
            'pagina de',
            'abra',
            'entre',
            'acesse',
            'navegue',
            'pesquise',
            'procure',
            'groq',
            'python',
            'nike'
        ];

        return screenSignals.some((signal) => normalized.includes(signal))
            && !webSignals.some((signal) => normalized.includes(signal));
    }

    async resolveAgentTarget(userMessage) {
        const response = await fetch('/api/agent-browser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'resolve-target',
                task: userMessage
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Falha ao localizar um site para o agente.');
        }

        if (!data?.url) {
            throw new Error('A pesquisa nao retornou uma URL utilizavel para o agente.');
        }

        return data;
    }

    buildAgentIntroMessage(userMessage, detectedUrl = null) {
        if (detectedUrl) {
            return `Olá! Claro. Vou abrir ${detectedUrl}, seguir a navegação que você pediu e te mostrar as capturas junto com a resposta final.`;
        }

        return `Olá! Claro. Vou analisar o que você pediu e te responder passo a passo.`;
    }

    async openAgentBrowserSession(url, task = '') {
        const response = await fetch('/api/agent-browser', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, task })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Falha ao abrir ${url}`);
        }

        if (data.mode === 'hosted-screenshot' || data.mode === 'site-protected-hosted') {
            this.addAgentThoughtLog('📡 Abri uma visualizacao compativel do site para continuar a analise.');
        } else if (data.mode === 'metadata-fallback' || data.mode === 'site-protected-fallback') {
            this.addAgentThoughtLog('📡 Gerei uma visualizacao resumida do site para continuar a analise.');
        } else {
            this.addAgentThoughtLog('✅ O site abriu corretamente no navegador do agente.');
        }

        return data;
    }

    // Analisar site que foi aberto
    async analyzeOpenedSite(session, userMessage) {
        const screenshots = Array.isArray(session?.screenshots) ? session.screenshots : [];
        const pageContext = session?.page || {};
        const rawTitle = session?.title || pageContext.title || session?.currentUrl || session?.requestedUrl;
        const readableTitle = /access denied|forbidden|blocked|captcha|unauthorized/i.test(rawTitle || '')
            ? 'Site com protecao automatizada'
            : rawTitle;
        if (this.agentRunContext) {
            this.agentRunContext.pageTitle = readableTitle;
            this.agentRunContext.blocked = readableTitle === 'Site com protecao automatizada';
        }

        this.addAgentThoughtLog(`🪄 Navegacao concluida. Pagina detectada: ${readableTitle}`);
        if (Array.isArray(session?.navigationTrail)) {
            for (const step of session.navigationTrail) {
                if (step?.success && step?.matchedText) {
                    this.addAgentThoughtLog(`➡️ Naveguei para "${step.matchedText}".`);
                }
            }
        }

        screenshots.forEach((screenshot) => {
            this.addAgentScreenshot(screenshot.dataUrl, screenshot.label || '');
        });

        const targetScreenshot = screenshots[screenshots.length - 1] || null;
        if (!targetScreenshot) {
            return;
        }

        const fallbackAnalysis = this.buildAgentFallbackAnalysis(userMessage, {
            currentUrl: session.currentUrl || session.requestedUrl,
            title: session.title || pageContext.title,
            description: pageContext.description,
            headings: pageContext.headings,
            interactiveElements: pageContext.interactiveElements
        }, targetScreenshot);

        if (session?.mode !== 'live-browser') {
            this.addAgentThoughtLog('🧠 IA pensando...');
            this.processAgentResponse(fallbackAnalysis, { silent: true });
            return;
        }

        try {
            const prompt = this.buildAgentVisionPrompt(userMessage, {
                currentUrl: session.currentUrl || session.requestedUrl,
                title: session.title || pageContext.title,
                description: pageContext.description,
                headings: pageContext.headings,
                interactiveElements: pageContext.interactiveElements
            }, targetScreenshot);

            const response = await this.callAgentAPI(prompt, targetScreenshot.dataUrl);
            this.processAgentResponse(response, { silent: true });
        } catch (error) {
            console.error('❌ [AGENT] Falha na visao do site, usando fallback estrutural:', error);
            this.processAgentResponse(fallbackAnalysis, { silent: true });
        }
    }

    buildAgentVisionPrompt(userMessage, pageContext = {}, screenshot = {}) {
        const headings = this.coerceAgentList(pageContext.headings).slice(0, 6).join(' | ');
        const interactive = this.coerceAgentList(pageContext.interactiveElements).slice(0, 10).join(' | ');

        return `Voce e o Drekee Agent 1.0, um agente visual que precisa responder SOMENTE com JSON valido.

Pedido original do usuario: "${userMessage}"
URL atual: ${pageContext.currentUrl || 'desconhecida'}
Titulo da pagina: ${pageContext.title || 'desconhecido'}
Descricao da pagina: ${pageContext.description || 'sem descricao'}
Captura atual: ${screenshot.label || 'captura sem titulo'}
Headings detectados no DOM: ${headings || 'nenhum'}
Elementos interativos detectados no DOM: ${interactive || 'nenhum'}

Analise a imagem e responda com este formato:
{
  "pagina_atual": "resumo claro do que esta visivel",
  "elementos_interativos": ["item 1", "item 2"],
  "acoes_possiveis": ["acao 1", "acao 2"],
  "proximo_passo": "acao recomendada"
}`;
    }

    async callAgentAPI(prompt, imageData) {
        this.addAgentThoughtLog('🧠 IA pensando...');

        try {
            const geminiResponse = await this.callGeminiVision(prompt, imageData);
            if (geminiResponse) {
                return geminiResponse;
            }

            throw new Error('Gemini retornou resposta vazia');
        } catch (error) {
            console.error('❌ [AGENT] Erro na chamada da API:', error);

            const groqResponse = await this.callGroqVision(prompt, imageData);
            if (groqResponse) {
                return groqResponse;
            }

            throw new Error('Ambas as APIs de visao falharam');
        }
    }

    // Chamar Groq Vision
    async callGroqVision(prompt, imageData) {
        try {
            const response = await fetch('/api/agent-vision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    imageData: imageData,
                    model: 'groq'
                })
            });
            
            const data = await response.json();
            
            if (response.status === 429) {
                throw new Error('RATE_LIMIT');
            }

            if (!response.ok) {
                console.error('❌ [AGENT][GROQ] Backend details:', data?.tried || data);
                throw new Error(data.error || response.statusText);
            }
            
            return this.normalizeAgentAnalysis(data);
            
        } catch (error) {
            console.error('❌ [AGENT] Erro no Groq Vision:', error);
            throw error;
        }
    }

    // Chamar API do Gemini Vision
    async callGeminiVision(prompt, imageData) {
        try {
            const response = await fetch('/api/agent-vision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    imageData: imageData,
                    model: 'gemini'
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ [AGENT][GEMINI] Backend details:', data?.tried || data);
                throw new Error(`Gemini API Error: ${response.status} - ${data.error || response.statusText}`);
            }

            return this.normalizeAgentAnalysis(data);
            
        } catch (error) {
            console.error('❌ [AGENT] Erro no Gemini Vision:', error);
            throw error;
        }
    }

    // Processar resposta do agente
    processAgentResponse(response, meta = {}) {
        try {
            const normalized = this.normalizeAgentAnalysis(response);

            this.lastAgentResponse = normalized;
            this.enableAgentActions(normalized);
            
        } catch (error) {
            console.error('❌ [AGENT] Erro no processamento:', error);
            this.addAgentTimelineEntry('error', {
                message: '❌ Erro no processamento da resposta: ' + error.message
            });
        }
    }

    normalizeAgentAnalysis(response) {
        const candidate = response?.parsed ?? response?.response ?? response?.rawText ?? response;
        let parsed = candidate;

        if (typeof parsed === 'string') {
            parsed = this.tryParseAgentJson(parsed) || {
                pagina_atual: parsed.trim(),
                elementos_interativos: [],
                acoes_possiveis: [],
                proximo_passo: 'Pedir uma nova analise com mais contexto'
            };
        }

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Resposta vazia ou invalida da analise visual');
        }

        return {
            ...parsed,
            _meta: {
                providerUsed: response?.providerUsed || parsed?._meta?.providerUsed || null,
                fallbackUsed: Boolean(response?.fallbackUsed || parsed?._meta?.fallbackUsed)
            }
        };
    }

    tryParseAgentJson(rawText) {
        const cleanText = (rawText || '')
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        try {
            return JSON.parse(cleanText);
        } catch {
            const start = cleanText.indexOf('{');
            const end = cleanText.lastIndexOf('}');
            if (start === -1 || end === -1 || end <= start) {
                return null;
            }

            try {
                return JSON.parse(cleanText.slice(start, end + 1));
            } catch {
                return null;
            }
        }
    }

    buildAgentFallbackAnalysis(userMessage, pageContext = {}, screenshot = {}) {
        const title = pageContext.title || 'Pagina web';
        const description = pageContext.description || 'Sem descricao detalhada disponivel.';
        const headings = this.coerceAgentList(pageContext.headings).slice(0, 4);
        const interactiveElements = this.coerceAgentList(pageContext.interactiveElements).slice(0, 8);
        const combinedText = `${title} ${description} ${headings.join(' ')}`;
        const blockedAccess = /access denied|forbidden|blocked|captcha|unauthorized/i.test(combinedText);

        const resumoPartes = [
            blockedAccess ? 'O site bloqueou a navegacao automatizada nesta tentativa' : title,
            blockedAccess ? 'Vou continuar com uma visualizacao alternativa sempre que possivel.' : description,
            headings.length ? `Secoes visiveis: ${headings.join(', ')}` : '',
            screenshot.label ? `Captura: ${screenshot.label}` : ''
        ].filter(Boolean);

        const acoes = [];
        if (blockedAccess) {
            acoes.push('Tentar uma rota alternativa de visualizacao para entender o site');
            acoes.push('Abrir outra pagina menos protegida do dominio para coletar contexto');
        }
        if (interactiveElements.length) {
            acoes.push(`Explorar estes elementos: ${interactiveElements.slice(0, 3).join(', ')}`);
        }
        if (/comprar|produto|tenis|oferta|colecao/i.test(`${title} ${description} ${userMessage}`)) {
            acoes.push('Buscar produtos ou colecoes relacionadas ao pedido do usuario');
        }
        acoes.push('Continuar navegando para obter mais contexto da pagina');

        return {
            pagina_atual: resumoPartes.join(' | '),
            elementos_interativos: interactiveElements,
            acoes_possiveis: acoes,
            proximo_passo: blockedAccess
                ? 'Tentar uma nova rota de acesso ao site ou uma pagina interna menos protegida'
                : interactiveElements[0]
                ? `Inspecionar "${interactiveElements[0]}" para avancar na tarefa`
                : 'Continuar a navegacao guiada pelo agente'
        };
    }

    async generateAgentFinalResponse(context) {
        const dominantColor = context?.screenshotData
            ? await this.detectDominantColorNameFromDataUrl(context.screenshotData)
            : null;

        const navigationTrail = Array.isArray(context?.navigationTrail)
            ? context.navigationTrail.filter((step) => step && step.success)
            : [];

        const pageText = this.coerceAgentList(context?.pageText).slice(0, 220);
        const analysis = context?.analysis || {};
        const relevantItems = this.extractRelevantItemsFromPageText(context?.request, pageText)
            .slice(0, this.extractRequestedItemCount(context?.request));

        const groundedResult = await this.extractGroundedAgentResult({
            ...context,
            dominantColor,
            navigationTrail,
            pageText,
            analysis,
            relevantItems
        });

        return this.buildAgentFallbackNarrative({
            ...context,
            dominantColor,
            navigationTrail,
            pageText,
            analysis,
            relevantItems,
            groundedResult
        });
    }

    async extractGroundedAgentResult(context) {
        if (/modelo|modelos|models|lista|todos|itens/i.test(context?.request || '')) {
            const localListResult = this.buildLocalGroundedAgentResult(context);
            if (this.coerceAgentList(localListResult?.itens_encontrados).length) {
                return localListResult;
            }
        }

        const pageText = this.coerceAgentList(context?.pageText).slice(0, 160);
        const relevantItems = this.coerceAgentList(context?.relevantItems).slice(0, 12);
        const navigationText = this.coerceAgentList(context?.navigationTrail)
            .filter((step) => step?.success)
            .map((step) => step.matchedText || step.targetHint || step.currentUrl)
            .filter(Boolean)
            .join(' -> ');

        const prompt = `Você vai extrair uma resposta ESTRITAMENTE fundamentada no conteúdo coletado pelo agente.

Pedido do usuário:
${context?.request || ''}

Dados reais coletados:
- URL final: ${context?.targetUrl || 'nao informada'}
- Título final: ${context?.pageTitle || 'desconhecido'}
- Navegação: ${navigationText || 'sem navegacao adicional'}
- Cor predominante detectada: ${context?.dominantColor || 'nao detectada'}
- Resumo estrutural: ${context?.analysis?.pagina_atual || 'nao informado'}
- Itens heurísticos: ${relevantItems.length ? relevantItems.join(' | ') : 'nenhum'}
- Texto visível da página:
${pageText.length ? pageText.join('\n') : 'sem texto extraido'}

Responda SOMENTE em JSON válido com este formato:
{
  "resposta_direta": "resposta objetiva ao pedido",
  "itens_encontrados": ["item exato 1", "item exato 2"],
  "evidencias": ["trecho curto 1", "trecho curto 2"],
  "observacao": "limitação importante ou vazio"
}

Regras:
- use apenas fatos presentes nos dados acima;
- não invente título, URL, itens ou páginas;
- quando listar itens, copie nomes que realmente apareçam no texto visível;
- se a tarefa pedir uma lista, priorize a lista;
- se a tarefa pedir cor, cite a cor predominante detectada;
- se não houver base suficiente, diga isso em "observacao";
- não escreva markdown, explicações, saudações nem blocos de código.`;

        try {
            const groqText = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                {
                    role: 'system',
                    content: 'Extraia respostas fundamentadas em JSON estrito.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            const parsedGroq = this.tryParseAgentJson(groqText);
            const validatedGroq = this.validateGroundedAgentResult(parsedGroq, context);
            if (validatedGroq) {
                return validatedGroq;
            }
        } catch (error) {
            console.error('❌ [AGENT] Erro ao extrair resposta fundamentada com Groq:', error);
        }

        try {
            const geminiText = await this.callAgentTextSummaryGemini(prompt);
            const parsedGemini = this.tryParseAgentJson(geminiText);
            const validatedGemini = this.validateGroundedAgentResult(parsedGemini, context);
            if (validatedGemini) {
                return validatedGemini;
            }
        } catch (error) {
            console.error('❌ [AGENT] Erro ao extrair resposta fundamentada com Gemini:', error);
        }

        return this.buildLocalGroundedAgentResult(context);
    }

    async callAgentTextSummaryGemini(prompt) {
        const formData = new FormData();
        formData.append('message', prompt);
        formData.append('context', JSON.stringify([]));
        formData.append('model', 'gemini-2.5-flash');

        const response = await fetch('/api/gemini-chat', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Falha no resumo via Gemini');
        }

        return data.text || '';
    }

    validateGroundedAgentResult(result, context = {}) {
        if (!result || typeof result !== 'object') {
            return null;
        }

        const pagePool = [
            context?.pageTitle || '',
            context?.targetUrl || '',
            ...(context?.pageText || []),
            ...this.coerceAgentList(context?.relevantItems || [])
        ]
            .map((item) => String(item || '').trim())
            .filter(Boolean);

        const normalizedPool = pagePool.map((item) => this.normalizeSearchText(item));
        const validateList = (items) => this.coerceAgentList(items)
            .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .filter((item, index, array) => array.indexOf(item) === index)
            .filter((item) => {
                const normalizedItem = this.normalizeSearchText(item);
                return normalizedItem
                    && normalizedPool.some((source) => source.includes(normalizedItem) || normalizedItem.includes(source));
            });

        const respostaDireta = String(result?.resposta_direta || result?.answer || '').trim();
        const itensEncontrados = validateList(result?.itens_encontrados || result?.items || []);
        const evidencias = validateList(result?.evidencias || result?.evidence || []).slice(0, 5);
        const observacao = String(result?.observacao || result?.observation || '').trim();

        if (!respostaDireta && !itensEncontrados.length && !evidencias.length && !observacao) {
            return null;
        }

        return {
            resposta_direta: respostaDireta,
            itens_encontrados: itensEncontrados,
            evidencias,
            observacao
        };
    }

    buildLocalGroundedAgentResult(context = {}) {
        const request = String(context?.request || '').trim();
        const requestedCount = this.extractRequestedItemCount(request);
        const relevantItems = this.extractRelevantItemsFromPageText(request, context?.pageText || []).slice(0, requestedCount);
        const pageTitle = context?.pageTitle || 'Página não identificada';
        const directParts = [];
        const isListRequest = /modelo|modelos|models|lista|todos|itens/i.test(request);

        if (/cor|color/i.test(request) && context?.dominantColor) {
            directParts.push(`A cor predominante da página é ${context.dominantColor}.`);
        }

        if (isListRequest) {
            if (relevantItems.length) {
                directParts.push(`Encontrei ${relevantItems.length} modelo${relevantItems.length > 1 ? 's' : ''} de IA explicitamente listado${relevantItems.length > 1 ? 's' : ''} em "${pageTitle}".`);
            } else {
                directParts.push('Não encontrei uma lista confiável de modelos visíveis suficiente para responder com segurança.');
            }
        }

        if (!directParts.length) {
            directParts.push(`A página final aberta pelo agente foi "${pageTitle}".`);
        }

        return {
            resposta_direta: directParts.join(' '),
            itens_encontrados: relevantItems,
            evidencias: isListRequest
                ? this.coerceAgentList(context?.pageText || [])
                    .filter((item) => /model|modelo|groqcloud|llama|gpt|whisper|qwen|gemma|mistral|moonshot|deepseek|compound/i.test(item))
                    .slice(0, 4)
                : relevantItems.length
                    ? relevantItems.slice(0, 4)
                    : this.coerceAgentList(context?.pageText || []).slice(0, 4),
            observacao: context?.blocked
                ? 'O site limitou parte da navegação automática nesta tentativa.'
                : ''
        };
    }

    buildAgentFallbackNarrative({ request, targetUrl, pageTitle, blocked, mode, screenshots, analysis, dominantColor, navigationTrail, pageText, relevantItems = [], groundedResult = null }) {
        const sections = [];
        const safeRequest = (request || '').trim();
        const siteLabel = this.getReadableSiteLabel(targetUrl);
        const navigationText = Array.isArray(navigationTrail) && navigationTrail.length
            ? navigationTrail.map((step) => step.matchedText || step.targetHint || step.currentUrl).filter(Boolean).join(' -> ')
            : '';
        const requestedColor = /cor|color/i.test(safeRequest);
        const requestedList = /modelo|modelos|models|lista|todos|quais|itens/i.test(safeRequest);
        const directAnswer = String(groundedResult?.resposta_direta || '').trim();
        const extractedItems = this.coerceAgentList(groundedResult?.itens_encontrados || relevantItems)
            .slice(0, this.extractRequestedItemCount(safeRequest));
        const evidences = this.coerceAgentList(groundedResult?.evidencias || [])
            .filter((item) => !extractedItems.includes(item))
            .slice(0, 4);
        const observation = String(groundedResult?.observacao || '').trim();

        let intro = targetUrl
            ? requestedList
                ? `Olá! Abri ${pageTitle ? `"${pageTitle}"` : siteLabel} e extraí os itens diretamente dessa página.`
                : `Olá! Já fui até ${siteLabel}`
            : 'Olá! Já analisei a tela que você pediu';

        if (navigationText && !requestedList) {
            intro += ` e naveguei por ${navigationText}`;
        }
        if (!/[.!?]$/.test(intro)) {
            intro += '.';
        }
        sections.push(intro);

        const resultLines = [];
        if (pageTitle) {
            resultLines.push(`A página final aberta pelo agente foi "${pageTitle}"${targetUrl ? ` (${targetUrl})` : ''}.`);
        }

        if (requestedColor && dominantColor) {
            resultLines.push(`Pela captura final, a cor predominante da página é ${dominantColor}.`);
        }

        if (directAnswer) {
            resultLines.push(directAnswer);
        } else if (analysis?.pagina_atual) {
            resultLines.push(`O conteúdo principal que consegui identificar foi: ${analysis.pagina_atual}.`);
        }

        if (blocked) {
            resultLines.push(
                mode === 'site-protected-hosted'
                    ? 'Esse site limitou a navegação automática nesta tentativa, então usei uma visualização compatível para continuar a análise.'
                    : 'Esse site limitou a navegação automática nesta tentativa, então trabalhei com o que consegui coletar da página.'
            );
        } else {
            resultLines.push('Consegui abrir a página e acompanhar o conteúdo visual sem travar o fluxo do agente.');
        }

        sections.push(resultLines.join(' '));

        if (extractedItems.length) {
            const listTitle = /modelo|modelos|models/i.test(safeRequest)
                ? `Os ${extractedItems.length} modelos de IA que aparecem nessa página são:`
                : requestedList
                    ? `Os ${extractedItems.length} itens mais relevantes que encontrei nessa página foram:`
                : 'Os principais textos e elementos que consegui identificar foram:';
            sections.push(`${listTitle}\n- ${extractedItems.join('\n- ')}`);
        } else if (pageText && pageText.length) {
            sections.push(`Os textos visíveis mais importantes que consegui extrair foram: ${pageText.slice(0, 6).join(', ')}.`);
        }

        if (evidences.length) {
            sections.push(`Trechos da própria página que sustentam essa resposta:\n- ${evidences.join('\n- ')}`);
        }

        const closing = [];
        if (screenshots) {
            closing.push(`Gerei ${screenshots} captura${screenshots > 1 ? 's' : ''} durante a execução, uma para cada etapa relevante da navegação.`);
        }

        if (observation) {
            closing.push(observation);
        }

        if (!requestedColor && !requestedList && analysis?.proximo_passo && !blocked) {
            closing.push(`Se você quiser, eu também posso continuar a navegação a partir daqui em "${analysis.proximo_passo}".`);
        }

        if (closing.length) {
            sections.push(closing.join(' '));
        }

        return sections.filter(Boolean).join('\n\n').trim();
    }

    extractRelevantItemsFromPageText(request, pageText = []) {
        const cleanItems = this.coerceAgentList(pageText)
            .map((item) => item.replace(/\s+/g, ' ').trim())
            .filter((item) => item.length > 1)
            .filter((item, index, array) => array.indexOf(item) === index);

        const genericNavItems = new Set([
            'python',
            'docs',
            'documentation',
            'community',
            'jobs',
            'downloads',
            'download',
            'about',
            'blog',
            'home',
            'search'
        ]);

        if (/modelo|modelos|models|lista|todos|itens/i.test(request || '')) {
            const extractedModelItems = this.extractModelItemsFromPageText(cleanItems);
            if (extractedModelItems.length) {
                return extractedModelItems;
            }

            const preferredModelItems = cleanItems.filter((item) => /llama|gpt|whisper|qwen|gemma|mistral|moonshot|deepseek|compound|claude|kimi|openai\/|meta-llama\/|groq\//i.test(item));
            const remainingItems = cleanItems.filter((item) => !preferredModelItems.includes(item));

            return [...preferredModelItems, ...remainingItems]
                .filter((item) => !genericNavItems.has(this.normalizeSearchText(item)))
                .filter((item) => item.length >= 2 && item.length <= 80)
                .slice(0, 12);
        }

        if (/download|downloads|release|versao|versoes|version|versions/i.test(request || '')) {
            return cleanItems
                .filter((item) => /\d|download|release|source|windows|mac|linux/i.test(item))
                .slice(0, 12);
        }

        return cleanItems.slice(0, 6);
    }

    extractModelItemsFromPageText(pageText = []) {
        const lines = this.coerceAgentList(pageText)
            .map((item) => item.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const displayPattern = /llama|gpt|whisper|qwen|gemma|mistral|moonshot|deepseek|compound|claude|kimi/i;
        const modelIdPattern = /^(?:[a-z0-9-]+\/)?[a-z0-9][a-z0-9./-]*$/i;
        const ignoredModelLabels = /browser search|agentic ai|modalities|capabilities|token speed|documentation|getting started|core features|tools integrations|overview|quickstart/i;
        const pairedItems = [];
        const standaloneItems = [];

        for (let index = 0; index < lines.length; index += 1) {
            const current = lines[index];
            const previous = lines[index - 1] || '';
            const next = lines[index + 1] || '';
            const currentLooksLikeDisplay = displayPattern.test(current) && current.length <= 60 && !/[.!?]/.test(current);
            const currentLooksLikeId = modelIdPattern.test(current)
                && current.length <= 80
                && !current.includes(' ')
                && (current.includes('/') || /\d/.test(current) || displayPattern.test(current));
            const nextLooksLikeId = modelIdPattern.test(next)
                && next.length <= 80
                && !next.includes(' ')
                && (next.includes('/') || /\d/.test(next) || displayPattern.test(next));

            if (currentLooksLikeDisplay && nextLooksLikeId) {
                pairedItems.push(`${current} (${next})`);
                continue;
            }

            if (currentLooksLikeId && displayPattern.test(previous) && previous.length <= 60 && !/[.!?]/.test(previous)) {
                pairedItems.push(`${previous} (${current})`);
                continue;
            }

            if (currentLooksLikeId) {
                standaloneItems.push(current);
                continue;
            }

            if (currentLooksLikeDisplay && !ignoredModelLabels.test(current) && !/[()]/.test(current)) {
                standaloneItems.push(current);
            }
        }

        return [...pairedItems, ...standaloneItems]
            .filter((item, index, array) => array.indexOf(item) === index)
            .filter((item) => item.length >= 3 && item.length <= 90)
            .slice(0, 15);
    }

    extractRequestedItemCount(request) {
        const explicitCount = String(request || '').match(/\b(\d{1,2})\b/);
        if (explicitCount) {
            const parsed = Number(explicitCount[1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                return Math.min(parsed, 15);
            }
        }

        if (/alguns|algumas|varios|varias/i.test(request || '')) {
            return 8;
        }

        return 5;
    }

    getReadableSiteLabel(targetUrl) {
        if (!targetUrl) {
            return 'o destino solicitado';
        }

        try {
            const parsed = new URL(targetUrl);
            const host = parsed.hostname.replace(/^www\./i, '');
            return `o site ${host}`;
        } catch {
            return targetUrl;
        }
    }

    normalizeSearchText(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    cleanAgentFinalText(text) {
        let cleaned = String(text || '')
            .replace(/^```[a-z]*\s*/gim, '')
            .replace(/\s*```$/gim, '')
            .replace(/segue aqui a analise estruturada da pagina que coletamos:\s*/gi, '')
            .replace(/^\s*resposta do agente\s*/gi, '')
            .replace(/qual e o proximo passo\??/gi, '')
            .replace(/qual é o proximo passo\??/gi, '')
            .trim();

        cleaned = cleaned.replace(/\{[\s\S]*?"pagina_atual"[\s\S]*?\}/gi, '').trim();
        cleaned = cleaned.replace(/ol[aá]!\s*eu sou o drekee agent 1\.0\.?\s*/gi, 'Olá! ').trim();

        cleaned = cleaned
            .split('\n')
            .filter((line) => !/"?(pagina_atual|elementos_interativos|acoes_possiveis|proximo_passo)"?\s*:/.test(line))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return cleaned;
    }

    isUsefulAgentFinalText(text, request, relevantItems = [], dominantColor = null) {
        if (!text || text.length < 120) {
            return false;
        }

        if (/"pagina_atual"|"elementos_interativos"|"acoes_possiveis"|"proximo_passo"/i.test(text)) {
            return false;
        }

        if (/^\s*[\[{]/.test(text)) {
            return false;
        }

        if (/cor|color/i.test(request || '') && dominantColor) {
            const normalizedText = this.normalizeSearchText(text);
            const normalizedColor = this.normalizeSearchText(dominantColor);
            if (!normalizedText.includes(normalizedColor) && !normalizedText.includes('cor predominante')) {
                return false;
            }
        }

        if (/modelo|modelos|models|lista|todos|itens/i.test(request || '') && relevantItems.length) {
            const matchesAnyRelevantItem = relevantItems.some((item) => text.includes(item));
            if (!matchesAnyRelevantItem) {
                return false;
            }
        }

        return true;
    }

    async detectDominantColorNameFromDataUrl(dataUrl) {
        try {
            const image = new Image();
            image.src = dataUrl;

            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            const sampleSize = 48;
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            context.drawImage(image, 0, 0, sampleSize, sampleSize);

            const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
            let totalR = 0;
            let totalG = 0;
            let totalB = 0;
            let total = 0;

            for (let index = 0; index < data.length; index += 4) {
                const alpha = data[index + 3];
                if (alpha < 100) {
                    continue;
                }

                totalR += data[index];
                totalG += data[index + 1];
                totalB += data[index + 2];
                total += 1;
            }

            if (!total) {
                return null;
            }

            const average = {
                r: Math.round(totalR / total),
                g: Math.round(totalG / total),
                b: Math.round(totalB / total)
            };

            return this.mapRgbToColorName(average);
        } catch (error) {
            console.error('❌ [AGENT] Nao consegui detectar a cor predominante:', error);
            return null;
        }
    }

    mapRgbToColorName({ r, g, b }) {
        const palette = [
            { name: 'preto', r: 20, g: 20, b: 20 },
            { name: 'branco', r: 235, g: 235, b: 235 },
            { name: 'cinza escuro', r: 55, g: 65, b: 81 },
            { name: 'cinza', r: 140, g: 140, b: 140 },
            { name: 'azul escuro', r: 30, g: 58, b: 138 },
            { name: 'azul', r: 59, g: 130, b: 246 },
            { name: 'verde', r: 34, g: 197, b: 94 },
            { name: 'vermelho', r: 239, g: 68, b: 68 },
            { name: 'laranja', r: 249, g: 115, b: 22 },
            { name: 'amarelo', r: 250, g: 204, b: 21 },
            { name: 'roxo', r: 168, g: 85, b: 247 },
            { name: 'rosa', r: 236, g: 72, b: 153 },
            { name: 'marrom', r: 146, g: 94, b: 52 }
        ];

        let closest = palette[0];
        let smallestDistance = Number.POSITIVE_INFINITY;

        for (const color of palette) {
            const distance = Math.sqrt(
                ((r - color.r) ** 2) +
                ((g - color.g) ** 2) +
                ((b - color.b) ** 2)
            );

            if (distance < smallestDistance) {
                smallestDistance = distance;
                closest = color;
            }
        }

        return closest.name;
    }

    coerceAgentList(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => {
                    if (typeof item === 'string') {
                        return item.trim();
                    }

                    if (item && typeof item === 'object') {
                        return item.text || item.label || item.name || item.tag || '';
                    }

                    return String(item || '').trim();
                })
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }

        return [];
    }

    // Habilitar ações do agente
    enableAgentActions(analysis) {
        this.availableAgentActions = {
            acoes: this.coerceAgentList(analysis.acoes_sugeridas || analysis.acoes_possiveis).slice(0, 3),
            proximo_passo: analysis.proximo_passo || ''
        };
    }

    // Executar ação do agente
    async executeAgentAction(action) {
        try {
            this.addThoughtLog('⚡ Executando ação: ' + action);
            this.addActionLog('Executando: ' + action, 'pending');
            
            this.showNotification(`⚡ Executando: ${action}`, 'info');
            
            // Analisar a ação e executar comandos reais
            const actionLower = action.toLowerCase();
            
            if (actionLower.includes('clique') || actionLower.includes('click')) {
                // Procurar e clicar em elementos
                await this.performClick(action);
            } else if (actionLower.includes('digite') || actionLower.includes('preencher') || actionLower.includes('escrever')) {
                // Preencher campos de texto
                await this.performType(action);
            } else if (actionLower.includes('navegar') || actionLower.includes('ir para') || actionLower.includes('abrir')) {
                // Navegar para outra página
                await this.performNavigate(action);
            } else {
                // Ação genérica - mostrar sugestão
                this.addThoughtLog('💡 Sugestão: ' + action);
                this.addActionLog('Sugestão: ' + action, 'executed');
            }
            
            this.addThoughtLog('✅ Ação executada com sucesso');
            this.showNotification('✅ Ação executada com sucesso', 'success');
            
            // Recapturar tela para ver resultado
            if (!this.isAgentPaused) {
                setTimeout(() => {
                    this.addThoughtLog('🔄 Capturando resultado da ação...');
                    this.captureScreenForAgent();
                }, 1000);
            }
            
        } catch (error) {
            console.error('❌ [AGENT] Erro na execução:', error);
            this.addThoughtLog('❌ Erro na execução da ação: ' + error.message);
            this.addActionLog('Falha: ' + action, 'failed');
            this.showNotification('❌ Erro na execução da ação', 'error');
        }
    }

    // Realizar clique em elemento
    async performClick(action) {
        try {
            // Procurar botões, links e elementos clicáveis
            const selectors = [
                'button', 'a[href]', '[role="button"]', 
                '.btn', '.button', 'input[type="button"]',
                '[onclick]', '[data-action]'
            ];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    // Tentar clicar no primeiro elemento visível
                    for (const element of elements) {
                        if (this.isElementVisible(element)) {
                            this.addThoughtLog(`🖱️ Clicando em: ${element.tagName} - "${element.textContent?.trim() || element.title || element.id}"`);
                            element.click();
                            this.addActionLog(`Clicado: ${element.tagName}`, 'executed');
                            return;
                        }
                    }
                }
            }
            
            this.addThoughtLog('❌ Nenhum elemento clicável encontrado');
            this.addActionLog('Nenhum elemento clicável encontrado', 'failed');
            
        } catch (error) {
            this.addThoughtLog('❌ Erro ao clicar: ' + error.message);
            throw error;
        }
    }

    // Preencher campo de texto
    async performType(action) {
        try {
            // Procurar campos de entrada
            const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], textarea');
            
            if (inputs.length > 0) {
                const input = inputs[0]; // Preencher o primeiro campo encontrado
                this.addThoughtLog(`⌨️ Preenchendo campo: ${input.type || input.tagName}`);
                
                // Extrair texto para digitar da ação
                const textToType = this.extractTextFromAction(action) || 'texto';
                
                input.focus();
                input.value = textToType;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                this.addActionLog(`Preenchido: ${input.type}`, 'executed');
            } else {
                this.addThoughtLog('❌ Nenhum campo de texto encontrado');
                this.addActionLog('Nenhum campo de texto encontrado', 'failed');
            }
            
        } catch (error) {
            this.addThoughtLog('❌ Erro ao preencher: ' + error.message);
            throw error;
        }
    }

    // Navegar para URL
    async performNavigate(action) {
        try {
            // Extrair URL da ação
            const urlMatch = action.match(/https?:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : null;
            
            if (url) {
                this.addThoughtLog(`🌐 Navegando para: ${url}`);
                window.open(url, '_blank');
                this.addActionLog(`Navegado para: ${url}`, 'executed');
            } else {
                // Procurar links na página
                const links = document.querySelectorAll('a[href]');
                if (links.length > 0) {
                    const link = links[0];
                    this.addThoughtLog(`🔗 Clicando no link: ${link.textContent?.trim() || link.href}`);
                    link.click();
                    this.addActionLog(`Link clicado: ${link.textContent?.trim()}`, 'executed');
                } else {
                    this.addThoughtLog('❌ Nenhuma URL ou link encontrado');
                    this.addActionLog('Nenhuma URL ou link encontrado', 'failed');
                }
            }
            
        } catch (error) {
            this.addThoughtLog('❌ Erro ao navegar: ' + error.message);
            throw error;
        }
    }

    // Verificar se elemento está visível
    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }

    // Extrair texto da ação
    extractTextFromAction(action) {
        // Procurar por texto entre aspas ou após dois pontos
        const match = action.match(/["']([^"']+)["']/) || action.match(/:\s*([^,.]+)/);
        return match ? match[1].trim() : null;
    }

    // Desativar modo agente
    deactivateAgentMode() {
        console.log('🛑 [AGENT] Desativando Drekee Agent 1.0...');
        
        // Remover indicador
        const indicator = document.getElementById('agentIndicator');
        if (indicator) indicator.remove();
        
        // Remover painel completo
        const panel = document.getElementById('agentPanel');
        if (panel) panel.remove();
        
        // Remover painéis antigos (se existirem)
        const analysis = document.getElementById('agentAnalysis');
        if (analysis) analysis.remove();
        
        const actions = document.getElementById('agentActions');
        if (actions) actions.remove();
        
        // Resetar variáveis
        window.isAgentMode = false;
        this.isAgentPaused = false;
        this.lastAgentResponse = null;
        
        // Notificação
        this.showNotification('🛑 Drekee Agent 1.0 desativado', 'info');
        
        // Atualizar UI
        this.updateAgentUI(false);
    }

    // Atualizar UI do modo agente
    updateAgentUI(active) {
        const createBtn = document.getElementById('createToggle');
        if (createBtn) {
            if (active) {
                createBtn.classList.add('bg-orange-500', 'text-white', 'ring-2', 'ring-orange-300');
                createBtn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
                createBtn.innerHTML = `
                    <span class="material-icons-outlined">smart_toy</span>
                    <span class="text-xs font-medium">Drekee Agent Ativo</span>
                `;
            } else {
                createBtn.classList.remove('bg-orange-500', 'text-white', 'ring-2', 'ring-orange-300');
                createBtn.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
                createBtn.innerHTML = `
                    <span class="material-icons-outlined">add_box</span>
                    <span class="text-xs font-medium">Criar</span>
                `;
            }
        }
    }

    // Resetar botões de criação
    resetCreateButtons() {
        const dropdown = document.getElementById('floatingCreateDropdown');
        if (dropdown) {
            // Resetar texto do botão principal
            const button = dropdown.querySelector('button');
            if (button) {
                button.innerHTML = `
                    <span class="material-icons-outlined">add</span>
                    <span>Criar</span>
                    <span class="material-icons-outlined">expand_more</span>
                `;
            }
        }
    }

    // Atualizar botão de criação para mostrar modo ativo
    updateCreateButton() {
        const dropdown = document.getElementById('floatingCreateDropdown');
        if (dropdown) {
            // Atualizar texto do botão principal
            const button = dropdown.querySelector('button');
            if (button) {
                if (window.isAgentMode) {
                    button.innerHTML = `
                        <span class="material-icons-outlined text-orange-400">smart_toy</span>
                        <span class="text-orange-400">Drekee Agent Ativo</span>
                        <span class="material-icons-outlined text-orange-400">expand_more</span>
                    `;
                    button.classList.add('border-orange-500', 'text-orange-400');
                } else if (window.isInvestigateMode) {
                    button.innerHTML = `
                        <span class="material-icons-outlined text-blue-400">search</span>
                        <span class="text-blue-400">Investigate Ativo</span>
                        <span class="material-icons-outlined text-blue-400">expand_more</span>
                    `;
                    button.classList.add('border-blue-500', 'text-blue-400');
                } else if (window.isREMode) {
                    button.innerHTML = `
                        <span class="material-icons-outlined text-green-400">calculate</span>
                        <span class="text-green-400">RE Ativo</span>
                        <span class="material-icons-outlined text-green-400">expand_more</span>
                    `;
                    button.classList.add('border-green-500', 'text-green-400');
                } else {
                    this.resetCreateButtons();
                }
            }
        }
    }

    // Mostrar notificação (função que estava faltando)
    showNotification(message, type = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        
        // Definir cores baseadas no tipo
        const colors = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500'
        };
        
        notification.className = `fixed top-20 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg z-[9999] transform translate-x-full transition-transform duration-300`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animar entrada
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
        }, 100);
        
        // Remover após 3 segundos
        setTimeout(() => {
            notification.classList.remove('translate-x-0');
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    setupAttachListeners() {
        console.log('🔧 [ATTACH] attachFileBtn:', !!this.elements.attachFileBtn);
        console.log('🔧 [ATTACH] attachDropdown:', !!this.elements.attachDropdown);
        console.log('🔧 [ATTACH] attachFileOptionBtn:', !!this.elements.attachFileOptionBtn);
        console.log('🔧 [ATTACH] imageFileInput:', !!this.elements.imageFileInput);
        
        // Toggle dropdown - COMPORTAMENTO DIFERENTE NO MODO RE
        if (this.elements.attachFileBtn) {
            console.log('✅ [ATTACH] Adicionando listener no botão de anexo');
            this.elements.attachFileBtn.addEventListener('click', (e) => {
                console.log('🖱️ [ATTACH] Botão de anexo clicado!');
                e.stopPropagation();
                
                // VERIFICAR SE ESTÁ NO MODO RE
                if (window.isREMode) {
                    console.log('🧮 [RE] Abrindo card de opções de anexo...');
                    this.showREAttachCard();
                } else {
                    console.log('💬 [NORMAL] Abrindo seletor de arquivos...');
                    // Abre diretamente o seletor de arquivos (modo normal)
                    if (this.elements.imageFileInput) {
                        this.elements.imageFileInput.click();
                    } else {
                        console.error('❌ [ATTACH] imageFileInput não encontrado!');
                    }
                }
            });
        } else {
            console.error('❌ [ATTACH] Botão de anexo não encontrado!');
        }

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', () => {
            if (this.elements.attachDropdown) this.elements.attachDropdown.classList.add('hidden');
        });

        // Opção Selecionar Arquivo
        if (this.elements.attachFileOptionBtn) {
            this.elements.attachFileOptionBtn.addEventListener('click', () => {
                this.elements.imageFileInput.click();
            });
        }

        // Opção Tirar Foto
        if (this.elements.takePhotoOptionBtn) {
            this.elements.takePhotoOptionBtn.addEventListener('click', () => {
                this.openCamera();
            });
        }

        // Listeners da Câmera
        if (this.elements.closeCameraBtn) {
            this.elements.closeCameraBtn.addEventListener('click', () => this.closeCamera());
        }

        if (this.elements.takePhotoBtn) {
            this.elements.takePhotoBtn.addEventListener('click', () => this.takePhoto());
        }

        if (this.elements.switchCameraBtn) {
            this.elements.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        }

        // Input de arquivo
        if (this.elements.imageFileInput) {
            this.elements.imageFileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => this.addAttachment(file));
                this.elements.imageFileInput.value = '';
            });
        }
    }

    async openCamera() {
        if (!this.elements.cameraCard) return;
        this.elements.cameraCard.classList.remove('hidden');
        this.elements.cameraLoading.classList.remove('hidden');
        
        try {
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
            }
            
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.currentFacingMode },
                audio: false
            });
            
            this.elements.cameraVideo.srcObject = this.cameraStream;
            this.elements.cameraLoading.classList.add('hidden');
        } catch (err) {
            console.error("Erro ao acessar câmera:", err);
            alert("Não foi possível acessar a câmera. Verifique as permissões.");
            this.closeCamera();
        }
    }

    closeCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        if (this.elements.cameraCard) this.elements.cameraCard.classList.add('hidden');
    }

    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        await this.openCamera();
    }

    takePhoto() {
        if (!this.cameraStream) return;
        
        const video = this.elements.cameraVideo;
        const canvas = this.elements.cameraCanvas;
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            this.addAttachment(file);
            this.closeCamera();
        }, 'image/jpeg', 0.8);
    }

    addAttachment(file) {
        if (this.attachedFiles.length >= 5) {
            alert('Máximo de 5 anexos permitidos.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const attachment = {
                id: Date.now().toString(),
                file: file,
                preview: e.target.result,
                name: file.name,
                mime: file.type,
                type: 'image',
                content: e.target.result
            };
            
            this.attachedFiles.push(attachment);
            this.renderAttachments();
        };
        reader.readAsDataURL(file);
    }

    removeAttachment(id) {
        this.attachedFiles = this.attachedFiles.filter(a => a.id !== id);
        this.renderAttachments();
    }

    renderAttachments() {
        const container = this.elements.attachedFilesContainer;
        if (!container) return;
        
        if (this.attachedFiles.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        
        container.classList.remove('hidden');
        container.innerHTML = this.attachedFiles.map(a => `
            <div class="relative inline-block mr-2 mb-2 group">
                <img src="${a.preview}" class="w-16 h-16 object-cover rounded-lg border border-white/10">
                <button onclick="window.ui.removeAttachment('${a.id}')" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-icons-outlined" style="font-size:14px">close</span>
                </button>
            </div>
        `).join('');
    }

    // MODO RE - Card especial de anexos
    showREAttachCard() {
        // Remover card anterior se existir
        const existing = document.getElementById('reAttachCard');
        if (existing) existing.remove();
        
        // Criar card de opções
        const cardHTML = `
            <div id="reAttachCard" class="fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[200]" style="min-width: 280px; bottom: 80px; right: 20px;">
                <div class="p-2">
                    <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 first:rounded-t-lg" onclick="window.ui.selectREFile()">
                        <span class="material-icons-outlined text-base text-blue-400 mt-0.5">attach_file</span>
                        <div class="flex-1">
                            <div class="font-medium">Selecionar Arquivo</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Escolher imagem ou documento</div>
                        </div>
                    </button>
                    <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 last:rounded-b-lg" onclick="window.ui.openRECamera()">
                        <span class="material-icons-outlined text-base text-green-400 mt-0.5">photo_camera</span>
                        <div class="flex-1">
                            <div class="font-medium">Tirar Foto</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Usar câmera do dispositivo</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar ao body
        document.body.insertAdjacentHTML('beforeend', cardHTML);
        
        // Fechar ao clicar fora
        setTimeout(() => {
            document.addEventListener('click', this.closeREAttachCard.bind(this), { once: true });
        }, 100);
    }
    
    closeREAttachCard(e) {
        if (e) {
            const card = document.getElementById('reAttachCard');
            const attachBtn = this.elements.attachFileBtn;
            
            if (!card || !attachBtn) return;
            
            // Não fechar se clicou no card ou no botão
            if (card.contains(e.target) || attachBtn.contains(e.target)) {
                // Re-adicionar listener
                setTimeout(() => {
                    document.addEventListener('click', this.closeREAttachCard.bind(this), { once: true });
                }, 100);
                return;
            }
        }
        
        const card = document.getElementById('reAttachCard');
        if (card) card.remove();
    }
    
    // MODO RE - Selecionar arquivo
    selectREFile() {
        console.log(' [RE] Selecionando arquivo...');
        const card = document.getElementById('reAttachCard');
        if (card) card.remove();
        
        // Abrir seletor de arquivos
        if (this.elements.imageFileInput) {
            this.elements.imageFileInput.click();
        }
    }
    
    // MODO RE - Abrir câmera
    openRECamera() {
        console.log(' [RE] Abrindo câmera...');
        const card = document.getElementById('reAttachCard');
        if (card) card.remove();
        
        // Abrir câmera
        this.openCamera();
    }

    loadChats() {
        // Não carregar mais do localStorage - apenas do Supabase
        // Se estiver logado, os chats serão carregados do Supabase em loadUserChats()
        // Se não estiver logado, começar com array vazio
        return [];
    }

    saveChats() {
        // Não salvar mais no localStorage - apenas no Supabase
        // Mantido apenas para compatibilidade, mas não faz nada
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
        
        // Abrir o chat (vai mover input para cima pois não tem mensagens)
        this.openChat(chatId);
        
        // Mostrar tela inicial (welcome screen)
        this.showWelcomeScreen();
        
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
        
        // Verificar se o chat tem mensagens
        const chat = this.chats.find(c => c.id === chatId);
        const hasMessages = chat && chat.messages && chat.messages.length > 0;
        
        // Mover input para baixo se tiver mensagens, senão para cima
        if (hasMessages) {
            this.moveInputDown();
            this.hideWelcomeScreen(); // Esconder tela inicial se tiver mensagens
        } else {
            this.moveInputUp();
            this.showWelcomeScreen(); // Mostrar tela inicial se não tiver mensagens
        }

        if (!chat) return;

        this.elements.messagesContainer.innerHTML = '';

        if (DEBUG) {
            console.log('📂 Abrindo chat:', chatId);
            console.log('📝 Mensagens do chat:', chat.messages.length);
        }

        // Só mostrar mensagens se tiver
        if (hasMessages) {
            chat.messages.forEach((msg, index) => {
                if (DEBUG) console.log(`  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);

                if (msg.role === 'user') {
                    this.addUserMessage(msg.content);
                } else {
                    this.addAssistantMessage(msg.content, msg.thinking);
                }
            });
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

                </div>

                <button class="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/30 rounded transition-all text-red-600 dark:text-red-400 flex-shrink-0" title="Excluir conversa" data-chat-id="${chat.id}">

                    <span class="material-icons-outlined text-sm">delete</span>

                </button>

            `;



            // preencher texto com textContent para evitar innerHTML inseguro

            const titleEl = chatDiv.querySelector('.font-medium');

            if (titleEl) titleEl.textContent = chat.title || 'Sem título';

            

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

        

        // Botão de limpar histórico agora está no userHeader no HTML

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
        
        // Configurar dropdown do botão Criar
        this.setupCreateDropdown();
        
        // Botão de Modo Depuração
        const debugBtn = document.getElementById('debugModeButton');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.toggleDebugMode());
        }



        // Botão de anexar arquivo
        this.setupAttachListeners();
        
        // Processar arquivos de código
        const codeFileInput = document.getElementById('codeFileInput');
        if (codeFileInput) {

            codeFileInput.addEventListener('change', (e) => {

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

                            this.attachedFiles.push({ 

                                name: f.name, 

                                content: String(reader.result), 

                                mime: f.type,

                                type: 'code'

                            });

                            this.renderAttachedFiles();

                            console.log('📎 Código anexado:', f.name, '(', (reader.result||'').length, 'chars)');

                            this.addAssistantMessage(`📎 ${this.attachedFiles.length} arquivo(s) de código anexado(s). Ao enviar, será usado o modelo 'codestral-latest' (Mistral).`);

                        };

                        reader.readAsText(f);

                        anyAdded = true;

                    } else {

                        this.addAssistantMessage(`❗ Tipo não suportado para código: ${f.name}. Use arquivos .txt/.md/.js/.py/.json/.html/.css`);

                    }

                });

                if (!anyAdded && rawFiles.length > 0) {

                    this.addAssistantMessage('❗ Nenhum arquivo de código foi anexado.');

                }

                e.target.value = null;

            });

        }

        

        // Processar arquivos de imagem
        const imageFileInput = document.getElementById('imageFileInput');
        if (imageFileInput) {

            imageFileInput.addEventListener('change', (e) => {

                const rawFiles = Array.from(e.target.files || []);

                if (rawFiles.length === 0) return;

                const limited = rawFiles.slice(0, 5); // Máximo 5 imagens

                

                limited.forEach(f => {

                    if (!f.type.startsWith('image/')) {

                        this.addAssistantMessage(`❗ ${f.name} não é uma imagem válida.`);

                        return;

                    }

                    

                    // Verificar tamanho (máximo 4MB para base64)

                    const MAX_SIZE = 4 * 1024 * 1024; // 4MB

                    if (f.size > MAX_SIZE) {

                        this.addAssistantMessage(`❗ A imagem ${f.name} excede o limite de 4MB e não será anexada.`);

                        return;

                    }

                    

                    const reader = new FileReader();

                    reader.onload = () => {

                        const base64 = String(reader.result);

                        this.attachedFiles.push({ 

                            name: f.name, 

                            content: base64,

                            mime: f.type,

                            type: 'image',

                            size: f.size

                        });

                        this.renderAttachedFiles();

                        console.log('🖼️ Imagem anexada:', f.name, '(', f.size, 'bytes)');

                        this.addAssistantMessage(`🖼️ ${this.attachedFiles.length} imagem(ns) anexada(s). Ao enviar, será usado o modelo 'meta-llama/llama-4-scout-17b-16e-instruct'.`);

                    };

                    reader.readAsDataURL(f);

                });

                

                if (limited.length === 0) {

                    this.addAssistantMessage('❗ Nenhuma imagem foi anexada.');

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
        
        // Inicializar o botão de modelo com o padrão "Rápido"
        this.setModel(this.currentModel);
        
        // Fechar dropdowns ao clicar fora
        document.addEventListener('click', (e) => {
            const floatingDropdown = document.getElementById('floatingModelDropdown');
            const floatingCreateDropdown = document.getElementById('floatingCreateDropdown');
            const modelBtn = document.getElementById('modelButton');
            const createBtn = document.getElementById('createToggle');
            
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

        

        // Auto-resize da caixa de mensagem
        this.setupAutoResize();

        

        // Inicializar sistema de autenticação
        this.initAuthSystem();

        

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

            <div id="floatingModelDropdown" class="hidden fixed bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[200]" style="min-width: 280px;">

                <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 first:rounded-t-lg" data-model="rapido">

                    <span class="material-icons-outlined text-base text-blue-400 mt-0.5">flash_on</span>

                    <div class="flex-1">
                        <div class="font-medium">Rápido</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drekee AI 1.0 Flash</div>
                    </div>

                </button>

                <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" data-model="raciocinio">

                    <span class="material-icons-outlined text-base text-orange-500 mt-0.5">psychology</span>

                    <div class="flex-1">
                        <div class="font-medium">Raciocínio</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drekee AI 1.0 Mini</div>
                    </div>

                </button>

                <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" data-model="pro">

                    <span class="material-icons-outlined text-base text-purple-500 mt-0.5">workspace_premium</span>

                    <div class="flex-1">
                        <div class="font-medium">Pro</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drekee AI 1.0 Pro</div>
                    </div>

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
                text.textContent = createLabels[createType];
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
            if (!this.currentChatId) {
                this.createNewChat();
            }
        }

        // MODO RE - Resolução de Exercícios
        if (window.isREMode) {
            await this.handleREMode(message);
            this.elements.userInput.value = '';
            return;
        }

        // Adicionar mensagem do usuário ao chat
        this.addUserMessage(message, null, { preserveCreateMode: true });
        
        // Mostrar mensagem de processamento E OBTER O ID CORRETO
        const processingId = this.addAssistantMessage('Gerando conteúdo...');

        // Continuar com o fluxo normal de criação (slides, documentos, etc.)
        const type = this.currentCreateType;
        if (type === 'document') {
            const attachments = this.attachedFiles && this.attachedFiles.length > 0 ? [...this.attachedFiles] : [];
            if (attachments.length > 0) {
                await this.generateLatexDocumentWithGemini(message, processingId, attachments, { skipUserMessage: true });
            } else {
                await this.generateLatexDocument(message, processingId, { skipUserMessage: true });
            }
            this.attachedFiles = [];
            this.renderAttachments();
            this.currentCreateType = null;
            return;
        }
        const systemPrompt = {
            role: 'system',
            content: `Você é um especialista acadêmico e profissional em LaTeX. Gere código LaTeX completo e compilável para ${type === 'slides' ? 'apresentação profissional Beamer' : 'tabela técnica'} sobre: "${message}". 

            

REGRAS CRÍTICAS - OBEDEÇA RIGIDOSAMENTE:

- GERE APENAS O CÓDIGO LATEX PURO, NADA MAIS

- NÃO inclua explicações, introduções ou textos fora do código

- NÃO inclua marcadores como \`\`\`latex ou \`\`\`

- Use pacotes padrão (beamer para slides, article para documentos)

- O código deve ser compilável com pdflatex

- Para slides: use \\documentclass[10pt,aspectratio=169]{beamer}

- Para tabelas: use \\documentclass{article} com ambiente tabular



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
        latexCode = this.sanitizeLatexInput(latexCode);

        // Renderizar o documento IMEDIATAMENTE
        await this.renderDocumentOutput(latexCode, processingId, message);
        
        // Resetar o modo de criação após concluir
        this.currentCreateType = null;

        return latexCode;

    }

    async compileLatexToPDF(latexCode) {
        try {
            const response = await fetch('/api/latex-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ latex: latexCode })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || `Falha ao compilar PDF: ${response.status}`);
            }

            const buffer = await response.arrayBuffer();
            const blob = new Blob([buffer], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            const dataUrl = await this.blobToDataUrl(blob);
            return { blobUrl, dataUrl };
        } catch (error) {
            console.warn('⚠️ [LATEX] Falha ao compilar PDF:', error.message);
            return null;
        }
    }

    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Falha ao converter PDF para data URL'));
            reader.readAsDataURL(blob);
        });
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
            // Se o texto contém HTML completo (como documentos renderizados), usar diretamente
            if (text.includes('<div') && text.includes('</div>')) {
                messageElement.innerHTML = text;
            } else {
                // Para mensagens de processamento simples, mostrar com animação
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
            }

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

                icon.textContent = 'edit';

                icon.className = 'material-icons-outlined text-base';

            }

            if (text) {

                text.textContent = 'Ferramentas';

            }

        }

    }



    async handleSend() {

        const message = this.elements.userInput.value.trim();

        // Permitir envio se estiver logado OU em modo visitante
        const isGuest = localStorage.getItem('isGuest') === 'true';
        const isLoggedIn = window.supabase && localStorage.getItem('userSession');
        
        if (!isGuest && !isLoggedIn) {
            // Redirecionar para login apenas se não for visitante e não estiver logado
            window.location.href = 'login.html';
            return;
        }

        // Se modo agente está ativo, processar mensagem com o agente
        if (window.isAgentMode) {
            this.elements.userInput.value = '';
            await this.processAgentMessage(message);
            return;
        }

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

        // Verificar se modo Apresentação está ativo
        if (window.isSlidesModeActive && message) {
            this.currentCreateType = 'slides';
            await this.handleCreateRequest(message);
            this.elements.userInput.value = '';
            return;
        }
        
        // Verificar se modo Documento está ativo
        if (window.isDocumentModeActive && message) {
            await this.generateDocument(message);
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

            const dataUrlToFile = (dataUrl, filename, mimeFallback = 'application/octet-stream') => {
                const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
                if (!m) {
                    // Não é base64; tenta como texto
                    return new File([String(dataUrl || '')], filename, { type: mimeFallback });
                }
                const mime = m[1] || mimeFallback;
                const b64 = m[2] || '';
                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return new File([bytes], filename, { type: mime });
            };

            // Garantir máximo 3 para código, 5 para imagens

            const codeFiles = this.attachedFiles.filter(f => f.type === 'code').slice(0, 3);

            const imageFiles = this.attachedFiles.filter(f => f.type === 'image').slice(0, 5);

            this.attachedFiles = [...codeFiles, ...imageFiles];

            

            // IMPORTANT: para Gemini, precisamos enviar File real no FormData
            sendFiles = this.attachedFiles.map(f => {
                // Já é File (caso do addAttachment)
                if (f && f.file instanceof File) {
                    return { name: f.name, file: f.file, type: f.type, mime: f.mime };
                }

                // Código anexado (conteúdo texto)
                if (f && f.type === 'code') {
                    const mime = f.mime || 'text/plain';
                    const fileObj = new File([String(f.content || '')], f.name || `file_${Date.now()}.txt`, { type: mime });
                    return { name: f.name, file: fileObj, type: f.type, mime };
                }

                // Imagem anexada como dataURL/base64
                if (f && f.type === 'image') {
                    const fileObj = dataUrlToFile(f.content, f.name || `image_${Date.now()}.png`, f.mime || 'image/png');
                    return { name: f.name, file: fileObj, type: f.type, mime: f.mime };
                }

                // Fallback
                const fallbackName = (f && f.name) ? f.name : `file_${Date.now()}.txt`;
                const fallbackMime = (f && f.mime) ? f.mime : 'text/plain';
                const fallbackFile = new File([String((f && f.content) || '')], fallbackName, { type: fallbackMime });
                return { name: fallbackName, file: fallbackFile, type: (f && f.type) || 'code', mime: fallbackMime };
            });

            console.log('📎 [DEBUG] Anexos prontos para envio:', sendFiles);
            
            // Snapshot para a UI (não incluir conteúdo completo no DOM para imagens)

            attachmentsSnapshot = this.attachedFiles.map(f => ({ 

                name: f.name, 

                mime: f.mime,

                type: f.type

            }));

            

            const fileTypes = this.attachedFiles.map(f => f.type === 'image' ? 'imagem' : 'código').join(' e ');

            this.addAssistantMessage(`📎 ${this.attachedFiles.length} arquivo(s) de ${fileTypes} anexado(s). A IA irá processar os arquivos.`);

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



        // Verificar se está em modo de pesquisa web e chamar API Tavily
        if (window.isWebSearchMode && !sendFiles) {
            console.log('🔍 [DEBUG] Modo pesquisa web ATIVADO! Chamando API Tavily...');
            console.log('🔍 [DEBUG] window.isWebSearchMode:', window.isWebSearchMode);
            console.log('🔍 [DEBUG] sendFiles:', sendFiles);
            console.log('🔍 [DEBUG] message:', message);
            await this.callTavilySearch(message);
        } else {
            console.log('🔍 [DEBUG] Modo NORMAL. Chamando agent.processMessage...');
            console.log('🔍 [DEBUG] window.isWebSearchMode:', window.isWebSearchMode);
            console.log('📎 [DEBUG] Enviando para Agent - sendFiles:', sendFiles);
            // Modo normal - chamar agent.processMessage
            await this.agent.processMessage(finalMessage, sendFiles);
        }



        // Limpar anexos após envio

        this.attachedFiles = [];

        this.renderAttachedFiles();







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

            

            if (file.type === 'image') {

                // Renderizar imagem visualmente

                fileCard.className = 'inline-flex items-center gap-2 px-3 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-600 rounded-lg text-sm relative group';

                fileCard.innerHTML = `

                    <div class="w-8 h-8 rounded overflow-hidden flex-shrink-0">

                        <img src="${file.content}" alt="${this.escapeHtml(file.name)}" class="w-full h-full object-cover" />

                    </div>

                    <span class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">${this.escapeHtml(file.name)}</span>

                    <button class="material-icons-outlined text-gray-500 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remover" data-index="${index}">close</button>

                `;

            } else {

                // Renderizar arquivo de código

                fileCard.className = 'inline-flex items-center gap-2 px-3 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-600 rounded-lg text-sm relative group';

                fileCard.innerHTML = `

                    <span class="material-icons-outlined text-primary text-base">${this.getFileIcon(file.name)}</span>

                    <span class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[180px]">${this.escapeHtml(file.name)}</span>

                    <button class="material-icons-outlined text-gray-500 hover:text-red-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remover" data-index="${index}">close</button>

                `;

            }

            

            const btn = fileCard.querySelector('button');

            btn.addEventListener('click', (e) => {

                e.stopPropagation();

                this.attachedFiles.splice(index, 1);

                this.renderAttachedFiles();

            });

            this.elements.attachedFilesContainer.appendChild(fileCard);

        });

    }



    // ==================== FUNÇÃO DE GERAÇÃO DE DOCUMENTOS (NOVA) ====================
    
    async generateDocument(message) {
        console.log('📄 [DOCUMENTO] Gerando documento:', message);
        
        // Adicionar mensagem do usuário
        this.addUserMessage(message, null, { preserveCreateMode: true });
        
        // Mostrar processamento
        const processingId = this.addAssistantMessage('📄 Gerando documento acadêmico...');
        
        const attachments = this.attachedFiles && this.attachedFiles.length > 0 ? [...this.attachedFiles] : [];
        if (attachments.length > 0) {
            await this.generateLatexDocumentWithGemini(message, processingId, attachments, { skipUserMessage: true });
        } else {
            await this.generateLatexDocument(message, processingId, { skipUserMessage: true });
        }
        this.attachedFiles = [];
        this.renderAttachments();
    }

    async generateLatexDocument(message, processingId, { skipUserMessage = false } = {}) {
        try {
            if (!skipUserMessage) {
                this.addUserMessage(message);
            }

            const topic = this.normalizeDocumentTopic(message);
            this.updateProcessingMessage(processingId, '🔎 Pesquisando fontes na web...');
            const webResearch = await this.fetchDocumentWebResearch(topic);
            const webContext = this.buildDocumentWebContext(webResearch);
            const referencesLatex = this.buildLatexBibliography(webResearch.sources || []);

            this.updateProcessingMessage(processingId, '🧠 Gerando documento em LaTeX...');
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um especialista acadêmico em LaTeX. Gere um documento LaTeX COMPLETO sobre: "' + topic + '".' +

'IMPORTANTE: Retorne APENAS o código LaTeX, sem explicações, sem markdown.' +
'Use as fontes da pesquisa web para embasar o conteúdo. Não invente fontes.' +

'REGRAS OBRIGATORIAS:' +
'- Use \\documentclass[12pt,a4paper]{article}.' +
'- Inclua \\usepackage[utf8]{inputenc}, \\usepackage[T1]{fontenc}, \\usepackage{amsmath,amssymb}, \\usepackage{graphicx}, \\usepackage{hyperref}, \\usepackage[a4paper,margin=1.5cm]{geometry}.' +
'- Comece com \\title{...} e \\maketitle.' +
'- Inclua obrigatoriamente as seções: Introdução, Desenvolvimento, Conclusão.' +
'- No Desenvolvimento, crie pelo menos 3 subseções.' +
'- Use \\textbf{}, \\textit{}, \\underline{} e listas (itemize) quando fizer sentido.' +
'- Se houver matemática, use $$E = mc^2$$.' +
'- Escreva parágrafos completos (não apenas tópicos).' +
'- NÃO use ambiente beamer.' +
'- NÃO escreva referências no corpo do texto. Use apenas o ambiente thebibliography fornecido abaixo.' +

'\n\nREFERENCIAS (use exatamente estas, sem alterar):\n' + referencesLatex +

'\n\nCONTEXTO DE PESQUISA WEB:\n' + webContext
                        },
                        {
                            role: 'user',
                            content: 'Tema do documento: ' + topic + '\n\nGere em LaTeX e use as referências fornecidas.'
                        }
                    ],
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.7
                })
            });

            const data = await response.json();
            let latexCode = (data.choices?.[0]?.message?.content || '').trim();
            latexCode = latexCode.replace(/```latex/gi, '').replace(/```/g, '').trim();

            const latexStart = latexCode.indexOf('\\documentclass');
            if (latexStart > 0) {
                latexCode = latexCode.substring(latexStart);
            }

            const latexEnd = latexCode.lastIndexOf('\\end{document}');
            if (latexEnd > -1 && latexEnd < latexCode.length - 20) {
                latexCode = latexCode.substring(0, latexEnd + 15);
            }

            latexCode = this.normalizeDocumentLatex(latexCode, topic);
            latexCode = this.stripLatexReferenceSections(latexCode);
            latexCode = this.injectLatexBibliography(latexCode, referencesLatex);
            latexCode = this.sanitizeLatexInput(latexCode);

            await this.renderDocumentOutput(latexCode, processingId, topic);
        } catch (error) {
            console.error('📄 [LATEX] Erro:', error);
            const errorHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                        <div class="flex items-center gap-3">
                            <span class="material-icons-outlined text-2xl">error</span>
                            <div>
                                <h1 class="text-xl font-bold">Erro na Geração</h1>
                                <p class="text-red-100 text-sm">Não foi possível gerar o documento LaTeX</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalhes do Erro:</h3>
                            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <p class="text-sm text-red-700 dark:text-red-300">${this.escapeHtml(error.message)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.updateProcessingMessage(processingId, errorHTML);
        }
    }

    async generateLatexDocumentWithGemini(message, processingId, attachments = [], { skipUserMessage = false } = {}) {
        try {
            if (!skipUserMessage) {
                this.addUserMessage(message);
            }

            const topic = this.normalizeDocumentTopic(message);
            this.updateProcessingMessage(processingId, '🧠 Gerando documento em LaTeX (Gemini)...');

            const systemPrompt = [
                'Você é um especialista acadêmico em LaTeX.',
                `Gere um documento LaTeX COMPLETO sobre: "${topic}".`,
                'Use estritamente o conteúdo dos arquivos anexados como base.',
                'Retorne APENAS o código LaTeX, sem explicações e sem markdown.',
                'Use \\documentclass[12pt,a4paper]{article}.',
                'Inclua \\usepackage[utf8]{inputenc}, \\usepackage[T1]{fontenc}, \\usepackage{amsmath,amssymb}, \\usepackage{graphicx}, \\usepackage{hyperref}, \\usepackage[a4paper,margin=1.5cm]{geometry}.',
                'Comece com \\title{...} e \\maketitle.',
                'Inclua as seções: Introdução, Desenvolvimento, Conclusão.',
                'No Desenvolvimento, crie pelo menos 3 subseções.',
                'Use \\textbf{}, \\textit{}, \\underline{} e listas (itemize) quando fizer sentido.',
                'Se houver matemática, use $$E = mc^2$$.',
                'NÃO escreva referências no corpo do texto.',
                'NÃO use \\includegraphics ou imagens externas.',
                'O documento deve ter entre 3 e 5 páginas (aprox. 1500-2000 palavras).'
            ].join(' ');

            const formData = new FormData();
            formData.append('message', `${systemPrompt}\n\nTema: ${topic}`);
            formData.append('context', JSON.stringify([]));

            attachments.forEach((file, index) => {
                formData.append(`file_${index}`, file.file || file);
            });

            const response = await fetch('/api/gemini-chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(errorText || 'Erro na API Gemini');
            }

            const data = await response.json();
            let latexCode = (data.text || data.response || '').trim();
            latexCode = latexCode.replace(/```latex/gi, '').replace(/```/g, '').trim();

            const latexStart = latexCode.indexOf('\\documentclass');
            if (latexStart > 0) {
                latexCode = latexCode.substring(latexStart);
            }

            const latexEnd = latexCode.lastIndexOf('\\end{document}');
            if (latexEnd > -1 && latexEnd < latexCode.length - 20) {
                latexCode = latexCode.substring(0, latexEnd + 15);
            }

            latexCode = this.normalizeDocumentLatex(latexCode, topic);
            latexCode = this.stripLatexReferenceSections(latexCode);
            latexCode = this.sanitizeLatexInput(latexCode);

            await this.renderDocumentOutput(latexCode, processingId, topic);
        } catch (error) {
            console.error('📄 [LATEX/GEMINI] Erro:', error);
            const errorHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                        <div class="flex items-center gap-3">
                            <span class="material-icons-outlined text-2xl">error</span>
                            <div>
                                <h1 class="text-xl font-bold">Erro na Geração</h1>
                                <p class="text-red-100 text-sm">Não foi possível gerar o documento com Gemini</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalhes do Erro:</h3>
                            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <p class="text-sm text-red-700 dark:text-red-300">${this.escapeHtml(error.message)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.updateProcessingMessage(processingId, errorHTML);
        }
    }

    async generateTypstDocument(message, processingId, { skipUserMessage = false } = {}) {
        try {
            if (!skipUserMessage) {
                this.addUserMessage(message);
            }

            this.updateProcessingMessage(processingId, '🔎 Pesquisando fontes na web...');
            const webResearch = await this.fetchDocumentWebResearch(message);
            const webContext = this.buildDocumentWebContext(webResearch);
            const referencesTypst = this.buildTypstReferences(webResearch.sources || []);

            this.updateProcessingMessage(processingId, '🧠 Gerando documento em Typst...');
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um especialista em Typst e documentos acadêmicos. Gere um documento Typst COMPLETO sobre: "' + message + '".' +

'IMPORTANTE: Retorne APENAS o código Typst, sem explicações, sem markdown.' +
'Use as fontes da pesquisa web para embasar o conteúdo. Não invente fontes.' +

'REGRAS OBRIGATORIAS:' +
'- Use Typst puro (sem LaTeX).' +
'- Comece com um titulo: "= Titulo do Documento".' +
'- Inclua obrigatoriamente as seções: "== Introducao", "== Desenvolvimento", "== Conclusao", "== Referencias".' +
'- Dentro de Desenvolvimento, crie pelo menos 3 subsecoes: "=== ..." com texto corrido.' +
'- Use listas quando fizer sentido: "- item".' +
'- Se houver matematica, use $E = mc^2$.' +
'- Referencias: lista de links no final.' +
'- Escreva paragrafos completos (nao apenas topicos).' +

'\n\nCONTEXTO DE PESQUISA WEB:\n' + webContext +
'\n\nREFERENCIAS DISPONIVEIS (use na seção final):\n' + referencesTypst
                        },
                        {
                            role: 'user',
                            content: 'Tema do documento: ' + message + '\n\nGere em Typst e use as referências fornecidas.'
                        }
                    ],
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.7
                })
            });

            const data = await response.json();
            let typstSource = (data.choices?.[0]?.message?.content || '').trim();
            typstSource = typstSource.replace(/```typst/gi, '').replace(/```/g, '').trim();

            if (!this.isTypstContentSufficient(typstSource)) {
                typstSource = this.buildTypstFallbackDocument(message, webResearch);
            }

            typstSource = this.injectTypstReferences(typstSource, webResearch.sources || []);
            typstSource = this.normalizeTypstDocument(typstSource, message);

            this.updateProcessingMessage(processingId, '📄 Compilando PDF Typst...');
            const pdfUrl = await this.compileTypstToPdf(typstSource);

            if (!pdfUrl) {
                throw new Error('Falha ao compilar Typst no navegador');
            }

            if (window.documentRenderer?.renderTypstPdf) {
                window.documentRenderer.renderTypstPdf(pdfUrl, message, processingId);
            } else {
                throw new Error('Renderizador Typst não disponível');
            }
        } catch (error) {
            console.error('📄 [TYPST] Erro:', error);
            const errorHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                        <div class="flex items-center gap-3">
                            <span class="material-icons-outlined text-2xl">error</span>
                            <div>
                                <h1 class="text-xl font-bold">Erro na Geração</h1>
                                <p class="text-red-100 text-sm">Não foi possível gerar o documento Typst</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalhes do Erro:</h3>
                            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <p class="text-sm text-red-700 dark:text-red-300">${this.escapeHtml(error.message)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.updateProcessingMessage(processingId, errorHTML);
        }
    }

    async generateMarkdownDocument(message, processingId, { skipUserMessage = false } = {}) {
        try {
            if (!skipUserMessage) {
                this.addUserMessage(message);
            }

            const topic = this.normalizeDocumentTopic(message);
            this.updateProcessingMessage(processingId, '🔎 Pesquisando fontes na web...');
            const webResearch = await this.fetchDocumentWebResearch(topic);
            const webContext = this.buildDocumentWebContext(webResearch);
            const referencesMarkdown = this.buildMarkdownReferences(webResearch.sources || []);

            this.updateProcessingMessage(processingId, '🧠 Gerando documento em Markdown...');
            const response = await fetch('/api/groq-proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: 'Você é um especialista em documentos acadêmicos. Gere um documento COMPLETO em Markdown sobre: "' + topic + '".' +

'IMPORTANTE: Retorne APENAS o Markdown, sem explicações, sem markdown extra.' +
'Use as fontes da pesquisa web para embasar o conteúdo. Não invente fontes.' +

'REGRAS OBRIGATORIAS:' +
'- Use Markdown puro (sem LaTeX/Typst).' +
'- Comece com um titulo: "# Titulo do Documento".' +
'- Inclua obrigatoriamente as seções: "## Introducao", "## Desenvolvimento", "## Conclusao", "## Referencias".' +
'- Dentro de Desenvolvimento, crie pelo menos 3 subsecoes: "### ..." com texto corrido.' +
'- Use listas quando fizer sentido: "- item".' +
'- Se houver matematica, use $$E = mc^2$$.' +
'- Referencias: lista de links no final.' +
'- Escreva paragrafos completos (nao apenas topicos).' +
'- Destaque termos importantes com **negrito** e *italico*.' +
'- Use pelo menos 1 bloco de cita ("> ...") e 1 tabela simples.' +
'- Use sublinhado em pelo menos 1 termo com <u>texto</u>.' +

'\n\nCONTEXTO DE PESQUISA WEB:\n' + webContext +
'\n\nREFERENCIAS DISPONIVEIS (use na seção final):\n' + referencesMarkdown
                        },
                        {
                            role: 'user',
                            content: 'Tema do documento: ' + topic + '\n\nGere em Markdown e use as referências fornecidas.'
                        }
                    ],
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.7
                })
            });

            const data = await response.json();
            let markdownSource = (data.choices?.[0]?.message?.content || '').trim();
            markdownSource = markdownSource.replace(/```markdown/gi, '').replace(/```/g, '').trim();

            if (!this.isMarkdownContentSufficient(markdownSource)) {
                markdownSource = this.buildMarkdownFallbackDocument(topic, webResearch);
            }

            markdownSource = this.replaceMarkdownReferences(markdownSource, referencesMarkdown);
            markdownSource = this.normalizeMarkdownDocument(markdownSource, topic);

            const marked = await this.loadMarkdownRenderer();
            const html = marked.parse(markdownSource);

            this.updateProcessingMessage(processingId, '📄 Gerando PDF...');
            const pdfUrl = await this.generatePdfFromMarkdown(html, topic, processingId);

            if (pdfUrl && window.documentRenderer?.renderPdfJsViewer) {
                window.documentRenderer.renderPdfJsViewer(pdfUrl, topic, processingId);
            } else if (window.documentRenderer?.renderMarkdownDocument) {
                window.documentRenderer.renderMarkdownDocument(html, topic, processingId);
                await this.renderMathInElement(`markdown-doc-${processingId}`);
            } else {
                throw new Error('Renderizador Markdown não disponível');
            }
        } catch (error) {
            console.error('📄 [MARKDOWN] Erro:', error);
            const errorHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div class="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
                        <div class="flex items-center gap-3">
                            <span class="material-icons-outlined text-2xl">error</span>
                            <div>
                                <h1 class="text-xl font-bold">Erro na Geração</h1>
                                <p class="text-red-100 text-sm">Não foi possível gerar o documento em Markdown</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Detalhes do Erro:</h3>
                            <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <p class="text-sm text-red-700 dark:text-red-300">${this.escapeHtml(error.message)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.updateProcessingMessage(processingId, errorHTML);
        }
    }

    async loadTypstCompiler() {
        if (!this._typstCompilerPromise) {
            this._typstCompilerPromise = (async () => {
                const moduleCandidates = [
                    'https://esm.sh/@myriaddreamin/typst.ts@0.6.0?bundle&target=es2020&conditions=browser&external=fs&external=node:fs',
                    'https://esm.sh/@myriaddreamin/typst.ts@0.6.0?bundle&target=es2020&conditions=browser',
                    'https://esm.sh/@myriaddreamin/typst.ts@0.6.0?bundle&target=browser',
                    'https://unpkg.com/@myriaddreamin/typst.ts@0.6.0/dist/typst.web.mjs',
                    'https://unpkg.com/@myriaddreamin/typst.ts@0.6.0/dist/typst.web.js?module',
                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.6.0/dist/typst.web.mjs'
                ];
                const scriptCandidates = [
                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.6.0/dist/typst.web.js',
                    'https://unpkg.com/@myriaddreamin/typst.ts@0.6.0/dist/typst.web.js',
                    'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.6.0/dist/typst.js',
                    'https://unpkg.com/@myriaddreamin/typst.ts@0.6.0/dist/typst.js'
                ];

                let mod = null;
                let lastError = null;

                for (const url of moduleCandidates) {
                    try {
                        mod = await import(url);
                        if (mod) {
                            break;
                        }
                    } catch (err) {
                        lastError = err;
                    }
                }

                if (!mod) {
                    for (const url of scriptCandidates) {
                        try {
                            await this.loadExternalScript(url);
                            mod = window.Typst || window.typst || window.typstTs || window.typstCompiler;
                            if (mod) {
                                break;
                            }
                        } catch (err) {
                            lastError = err;
                        }
                    }
                }

                if (!mod) {
                    throw lastError || new Error('Falha ao carregar typst.ts');
                }

                const candidate =
                    mod.TypstCompiler ||
                    mod.Compiler ||
                    mod.createTypstCompiler ||
                    mod.createCompiler ||
                    mod.typstCompiler ||
                    mod.default?.TypstCompiler ||
                    mod.default;

                let compiler = null;

                if (typeof candidate === 'function') {
                    const maybeInstance = candidate();
                    compiler = maybeInstance?.compile ? maybeInstance : new candidate();
                } else if (candidate && typeof candidate.compile === 'function') {
                    compiler = candidate;
                }

                if (!compiler) {
                    const exportsList = Object.values(mod);
                    compiler = exportsList.find((val) => val && typeof val.compile === 'function') || null;
                }

                if (!compiler) {
                    throw new Error('TypstCompiler não encontrado no módulo typst.ts');
                }

                if (typeof mod.init === 'function') {
                    await mod.init();
                }

                if (typeof compiler.init === 'function') {
                    await compiler.init();
                }

                return compiler;
            })();
        }
        return this._typstCompilerPromise;
    }

    async loadExternalScript(url) {
        if (!this._typstScriptPromises) {
            this._typstScriptPromises = new Map();
        }
        if (this._typstScriptPromises.has(url)) {
            return this._typstScriptPromises.get(url);
        }
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar script: ${url}`));
            document.head.appendChild(script);
        });
        this._typstScriptPromises.set(url, promise);
        return promise;
    }

    async compileTypstToPdf(typstSource) {
        try {
            const compiler = await this.loadTypstCompiler();
            const pdf = await compiler.compile(typstSource);
            const pdfBytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            return URL.createObjectURL(blob);
        } catch (error) {
            console.warn('⚠️ [TYPST] Falha na compilação:', error.message);
            return null;
        }
    }

    async loadMarkdownRenderer() {
        if (!this._markedPromise) {
            this._markedPromise = import('https://esm.sh/marked@9.1.6?bundle&target=es2020').then((mod) => {
                const marked = mod.marked || mod.default || mod;
                if (marked?.setOptions) {
                    marked.setOptions({ mangle: false, headerIds: true });
                }
                return marked;
            });
        }
        return this._markedPromise;
    }

    async loadKatexRenderer() {
        if (!this._katexPromise) {
            this._katexPromise = (async () => {
                this.loadExternalCss('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css');
                const katexModule = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.mjs');
                const autoRenderModule = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
                return {
                    katex: katexModule.default || katexModule,
                    renderMathInElement: autoRenderModule.renderMathInElement || autoRenderModule.default
                };
            })();
        }
        return this._katexPromise;
    }

    async renderMathInElement(elementId) {
        const container = document.getElementById(elementId);
        if (!container) {
            return;
        }
        try {
            const { renderMathInElement } = await this.loadKatexRenderer();
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            }
        } catch (error) {
            console.warn('⚠️ [KATEX] Falha ao renderizar matemática:', error.message);
        }
    }

    async loadHtml2Pdf() {
        if (!this._html2pdfPromise) {
            this._html2pdfPromise = (async () => {
                await this.loadExternalScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
                return window.html2pdf;
            })();
        }
        return this._html2pdfPromise;
    }

    async generatePdfFromMarkdown(htmlContent, title, messageId) {
        try {
            const html2pdf = await this.loadHtml2Pdf();
            if (!html2pdf) {
                throw new Error('html2pdf não carregou');
            }

            const container = document.createElement('div');
            container.id = `markdown-pdf-${messageId}`;
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '794px'; // A4 @ 96dpi
            container.style.padding = '48px 48px 56px';
            container.style.background = '#ffffff';
            container.style.color = '#0f172a';
            container.innerHTML = `
                <style>
                    #markdown-pdf-${messageId} { font-family: "Times New Roman", serif; line-height: 1.6; }
                    #markdown-pdf-${messageId} h1 { text-align: center; margin: 0 0 16px; }
                    #markdown-pdf-${messageId} h2 { margin: 20px 0 8px; }
                    #markdown-pdf-${messageId} h3 { margin: 16px 0 6px; }
                    #markdown-pdf-${messageId} ul { margin: 8px 0 8px 18px; }
                    #markdown-pdf-${messageId} ol { margin: 8px 0 8px 18px; }
                    #markdown-pdf-${messageId} blockquote { border-left: 4px solid #94a3b8; padding-left: 12px; color: #334155; background: #f8fafc; margin: 12px 0; }
                    #markdown-pdf-${messageId} table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                    #markdown-pdf-${messageId} th, #markdown-pdf-${messageId} td { border: 1px solid #e2e8f0; padding: 6px 8px; }
                    #markdown-pdf-${messageId} th { background: #f1f5f9; text-align: left; }
                </style>
                <h1>${this.escapeHtml(title)}</h1>
                <div>${htmlContent}</div>
            `;
            document.body.appendChild(container);

            await this.renderMathInElement(container.id);

            const opt = {
                margin: [10, 10, 12, 10],
                filename: `${title || 'documento'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().from(container).set(opt).output('blob');
            const url = URL.createObjectURL(pdfBlob);
            container.remove();
            return url;
        } catch (error) {
            console.warn('⚠️ [PDF] Falha ao gerar PDF:', error.message);
            return null;
        }
    }

    loadExternalCss(url) {
        if (!this._loadedCss) {
            this._loadedCss = new Set();
        }
        if (this._loadedCss.has(url)) {
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
        this._loadedCss.add(url);
    }

    async loadExternalScriptOnce(url) {
        if (!this._loadedScripts) {
            this._loadedScripts = new Map();
        }
        if (this._loadedScripts.has(url)) {
            return this._loadedScripts.get(url);
        }
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Falha ao carregar script: ${url}`));
            document.head.appendChild(script);
        });
        this._loadedScripts.set(url, promise);
        return promise;
    }

    buildMarkdownReferences(sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return '- Nenhuma fonte disponível.';
        }
        const unique = [];
        for (const source of sources) {
            if (source?.url && !unique.find((item) => item.url === source.url)) {
                unique.push(source);
            }
        }
        return unique.slice(0, 6).map((source, index) => {
            const title = (source.title || `Fonte ${index + 1}`).replace(/\s+/g, ' ').trim();
            const url = source.url || '';
            const snippet = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            return `- [${title}](${url})${snippet ? ` - ${snippet}` : ''}`.trim();
        }).join('\n');
    }

    replaceMarkdownReferences(markdownSource, referencesMarkdown) {
        if (!referencesMarkdown || !referencesMarkdown.trim()) {
            return markdownSource;
        }
        if (/^##\s*Referencias/m.test(markdownSource)) {
            return markdownSource.replace(/##\s*Referencias[\s\S]*$/m, `## Referencias\n${referencesMarkdown}`);
        }
        return `${markdownSource}\n\n## Referencias\n${referencesMarkdown}`;
    }

    normalizeMarkdownDocument(markdownSource, title) {
        let normalized = markdownSource.trim();
        if (!/^# /m.test(normalized)) {
            normalized = `# ${title}\n\n${normalized}`;
        }
        return normalized;
    }

    normalizeDocumentTopic(message) {
        const raw = String(message || '').trim();
        if (!raw) {
            return 'Documento';
        }
        const cleaned = raw
            .replace(/^(gere|gera|crie|criar|faça|faca|produza|escreva)\s+(um|uma)\s+documento\s+sobre\s+/i, '')
            .replace(/^documento\s+sobre\s+/i, '')
            .replace(/^sobre\s+/i, '')
            .replace(/^["']|["']$/g, '')
            .trim();
        const normalized = cleaned || raw;
        if (/^ia$/i.test(normalized)) {
            return 'Inteligência Artificial';
        }
        return normalized;
    }

    isMarkdownContentSufficient(markdownSource) {
        if (!markdownSource || markdownSource.length < 200) {
            return false;
        }
        const hasTitle = /^# /m.test(markdownSource);
        const sections = (markdownSource.match(/^## /gm) || []).length;
        const hasReferencesOnly = /^##\s*Referencias\b/m.test(markdownSource) && sections <= 1;
        return hasTitle && sections >= 2 && !hasReferencesOnly && markdownSource.length >= 500;
    }

    buildMarkdownFallbackDocument(message, webResearch) {
        const summary = webResearch?.response
            ? webResearch.response.replace(/\s+/g, ' ').trim()
            : '';
        const sources = (webResearch?.sources || []).slice(0, 6).map((source, index) => {
            const title = (source.title || `Fonte ${index + 1}`).replace(/\s+/g, ' ').trim();
            const snippet = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            return `- **${title}**: ${snippet}`;
        }).join('\n');

        return `
# ${message}

## Introducao
${summary || 'Este documento apresenta uma visao geral do tema solicitado, com base nas fontes consultadas.'}

## Desenvolvimento
${summary || 'As secoes seguintes detalham conceitos, contexto historico e aplicacoes praticas.'}

### Contexto
${summary || 'Contextualizacao do tema com base nas fontes mais relevantes.'}

### Conceitos principais
${summary || 'Resumo dos conceitos-chave e definicoes mais aceitas.'}

### Impactos e aplicacoes
${summary || 'Aplicacoes praticas e impactos observados no tema.'}

## Conclusao
Este texto sintetiza os pontos principais discutidos ao longo do documento.

## Referencias
${sources || '- Nenhuma fonte disponivel.'}
        `.trim();
    }

    buildTypstReferences(sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return 'Nenhuma fonte disponível.';
        }
        return sources.slice(0, 6).map((source, index) => {
            const title = (source.title || `Fonte ${index + 1}`).replace(/\s+/g, ' ').trim();
            const url = source.url || '';
            const snippet = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            return `- [${title}](${url}) ${snippet ? '- ' + snippet : ''}`.trim();
        }).join('\n');
    }

    injectTypstReferences(typstSource, sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return typstSource;
        }
        if (/^==\s*Referencias/m.test(typstSource)) {
            return typstSource;
        }
        const references = this.buildTypstReferences(sources);
        return `${typstSource}\n\n== Referencias\n${references}`;
    }

    normalizeTypstDocument(typstSource, title) {
        let normalized = typstSource.trim();
        if (!/^= /m.test(normalized)) {
            normalized = `= ${title}\n\n${normalized}`;
        }
        if (!/^#set page/m.test(normalized)) {
            normalized = `#set page(size: \"a4\", margin: 1.5cm)\n#set text(size: 14pt, leading: 1.3em)\n\n${normalized}`;
        }
        return normalized;
    }

    isTypstContentSufficient(typstSource) {
        if (!typstSource || typstSource.length < 200) {
            return false;
        }
        const hasTitle = /^= /m.test(typstSource);
        const sections = (typstSource.match(/^== /gm) || []).length;
        const hasReferencesOnly = /^==\s*Referencias\b/m.test(typstSource) && sections <= 1;
        return hasTitle && sections >= 2 && !hasReferencesOnly && typstSource.length >= 500;
    }

    buildTypstFallbackDocument(message, webResearch) {
        const summary = webResearch?.response
            ? webResearch.response.replace(/\s+/g, ' ').trim()
            : '';
        const sources = (webResearch?.sources || []).slice(0, 6).map((source, index) => {
            const title = (source.title || `Fonte ${index + 1}`).replace(/\s+/g, ' ').trim();
            const snippet = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            return `- *${title}*: ${snippet}`;
        }).join('\n');

        return `
= ${message}

== Introducao
${summary || 'Este documento apresenta uma visao geral do tema solicitado, com base nas fontes consultadas.'}

== Desenvolvimento
${summary || 'As secoes seguintes detalham conceitos, contexto historico e aplicacoes praticas.'}

== Conclusao
Este texto sintetiza os pontos principais discutidos ao longo do documento.

== Referencias
${sources || '- Nenhuma fonte disponivel.'}
        `.trim();
    }

    async fetchDocumentWebResearch(message) {
        try {
            const response = await fetch('/api/tavily-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    conversationHistory: []
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Falha na pesquisa web: ${response.status}`);
            }

            const data = await response.json();
            return {
                response: data.response || data.answer || '',
                sources: Array.isArray(data.sources)
                    ? data.sources.slice(0, 6)
                    : Array.isArray(data.results)
                        ? data.results.slice(0, 6)
                        : []
            };
        } catch (error) {
            console.warn('⚠️ [DOCUMENTO] Falha ao buscar fontes web:', error.message);
            return {
                response: '',
                sources: []
            };
        }
    }

    buildDocumentWebContext(webResearch) {
        if (!webResearch || (!webResearch.response && (!webResearch.sources || webResearch.sources.length === 0))) {
            return 'Nenhuma fonte web confiável foi encontrada.';
        }

        const sourceLines = (webResearch.sources || []).map((source, index) => {
            const title = source.title || `Fonte ${index + 1}`;
            const url = source.url || 'URL não informada';
            const content = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 500);
            return `[${index + 1}] ${title}\nURL: ${url}\nResumo: ${content}`;
        });

        return [
            webResearch.response ? `Resumo consolidado da pesquisa:\n${webResearch.response}` : '',
            sourceLines.length ? `Fontes encontradas:\n${sourceLines.join('\n\n')}` : ''
        ].filter(Boolean).join('\n\n');
    }

    injectWebReferencesIntoLatex(latexCode, sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return latexCode;
        }

        const bibliographyItems = sources.slice(0, 6).map((source, index) => {
            const title = this.escapeLatexText(source.title || `Fonte ${index + 1}`);
            const url = this.escapeLatexText(source.url || '');
            const snippet = this.escapeLatexText((source.content || source.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 240));
            const accessDate = '9 de março de 2026';
            const parts = [title];

            if (snippet) parts.push(snippet);
            if (url) parts.push(`Disponível em: \\url{${url}}. Acesso em: ${accessDate}.`);

            return `\\bibitem{web${index + 1}} ${parts.join(' ')}`;
        }).join('\n');

        if (!bibliographyItems.trim()) {
            return latexCode;
        }

        const bibliographyBlock = `\n\\begin{thebibliography}{99}\n${bibliographyItems}\n\\end{thebibliography}\n`;

        if (/\\begin\{thebibliography\}/.test(latexCode)) {
            return latexCode.replace(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/, bibliographyBlock.trim());
        }

        if (/\\end\{document\}/.test(latexCode)) {
            return latexCode.replace(/\\end\{document\}/, `${bibliographyBlock}\\end{document}`);
        }

        return `${latexCode}${bibliographyBlock}`;
    }

    buildLatexBibliography(sources) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return '\\begin{thebibliography}{99}\n\\bibitem{web1} Fonte não disponível.\n\\end{thebibliography}';
        }

        const unique = [];
        for (const source of sources) {
            if (source?.url && !unique.find((item) => item.url === source.url)) {
                unique.push(source);
            }
        }

        const items = unique.slice(0, 6).map((source, index) => {
            const title = this.escapeLatexText(source.title || `Fonte ${index + 1}`);
            const url = this.escapeLatexText(source.url || '');
            const snippetRaw = (source.content || source.snippet || '').replace(/\s+/g, ' ').trim();
            const snippet = this.escapeLatexText(snippetRaw.slice(0, 180));
            const accessDate = '9 de março de 2026';
            const parts = [title];
            if (snippet) parts.push(snippet);
            if (url) parts.push(`Disponível em: \\url{${url}}. Acesso em: ${accessDate}.`);
            return `\\bibitem{web${index + 1}} ${parts.join(' ')}`;
        }).join('\n');

        return `\\begin{thebibliography}{99}\n${items}\n\\end{thebibliography}`;
    }

    injectLatexBibliography(latexCode, bibliographyBlock) {
        if (!bibliographyBlock || !bibliographyBlock.trim()) {
            return latexCode;
        }
        if (/\\begin\{thebibliography\}/.test(latexCode)) {
            return latexCode.replace(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/, bibliographyBlock.trim());
        }
        if (/\\end\{document\}/.test(latexCode)) {
            return latexCode.replace(/\\end\{document\}/, `${bibliographyBlock}\n\\end{document}`);
        }
        return `${latexCode}\n${bibliographyBlock}`;
    }

    stripLatexReferenceSections(latexCode) {
        let stripped = latexCode;
        stripped = stripped.replace(/\\section\*?\{Refer[eê]ncias\}[\s\S]*?(?=\\section\*?\{|\\end\{document\})/gi, '');
        stripped = stripped.replace(/\\subsection\*?\{Refer[eê]ncias\}[\s\S]*?(?=\\section\*?\{|\\subsection\*?\{|\\end\{document\})/gi, '');
        stripped = stripped.replace(/(^|\n)\s*Refer[eê]ncias\s*:?[^\n]*\n\s*\\begin\{(enumerate|itemize)\}[\s\S]*?\\end\{\2\}/gi, '$1');
        stripped = stripped.replace(/(^|\n)\s*Refer[eê]ncias\s*:?[^\n]*\n[\s\S]*?(?=\\section\*?\{|\\end\{document\})/gi, '$1');
        stripped = stripped.replace(/(^|\n)\s*Refer[eê]ncias\s*:?[^\n]*\n/gi, '$1');
        return stripped;
    }

    async renderDocumentOutput(latexCode, messageId, title) {
        const isArticle = /\\documentclass(?:\[[^\]]*\])?\{article\}/i.test(latexCode);
        const isBeamer = /\\documentclass(?:\[[^\]]*\])?\{beamer\}/i.test(latexCode);
        if (isArticle || isBeamer) {
            const pdfData = await this.compileLatexToPDF(latexCode);
            if (pdfData && window.documentRenderer) {
                if (isBeamer && window.documentRenderer.renderPdfJsSlides) {
                    window.documentRenderer.renderPdfJsSlides(
                        pdfData,
                        title || 'Apresentação Gerada',
                        messageId
                    );
                    return;
                }
                if (window.documentRenderer.renderPdfJsViewer) {
                    window.documentRenderer.renderPdfJsViewer(
                        pdfData,
                        title || 'Documento Gerado',
                        messageId
                    );
                    return;
                }
            }
            if (window.documentRenderer?.showLatexFallback) {
                window.documentRenderer.showLatexFallback(latexCode, messageId, 'Falha ao compilar PDF para PDF.js.');
                return;
            }
            window.documentRenderer.renderDocument(latexCode, messageId);
            return;
        }

        const imageUrls = await this.compileDocumentWithQuickLatex(latexCode, title);

        if (Array.isArray(imageUrls) && imageUrls.length > 0 && window.documentRenderer?.renderDocumentImages) {
            window.documentRenderer.renderDocumentImages(imageUrls, title || 'Documento Gerado', messageId, latexCode);
            return;
        }

        window.documentRenderer.renderDocument(latexCode, messageId);
    }

    async compileDocumentWithQuickLatex(latexCode, title) {
        try {
            const pageLatexList = this.splitLatexIntoQuickLatexPages(latexCode, title);
            const imageUrls = [];

            for (const pageLatex of pageLatexList) {
                const response = await fetch('/api/quicklatex-render', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ latex: pageLatex })
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.imageUrl) {
                    console.warn('⚠️ [QUICKLATEX] Falha na compilação remota:', data.details || data.message || response.status);
                    return null;
                }

                imageUrls.push(data.imageUrl);
            }

            return imageUrls;
        } catch (error) {
            console.warn('⚠️ [QUICKLATEX] Erro ao compilar documento:', error.message);
            return null;
        }
    }

    splitLatexIntoQuickLatexPages(latexCode, title) {
        const preambleMatch = latexCode.match(/^[\s\S]*?\\begin\{document\}/);
        const preamble = (preambleMatch ? preambleMatch[0].replace(/\\begin\{document\}/, '') : '')
            .replace(/\\title\{[^}]*\}\s*/g, '')
            .replace(/\\author\{[^}]*\}\s*/g, '')
            .replace(/\\date\{[^}]*\}\s*/g, '');
        const body = latexCode
            .replace(/^[\s\S]*?\\begin\{document\}/, '')
            .replace(/\\end\{document\}\s*$/, '')
            .trim();
        const cleanedBody = body
            .replace(/\\pagestyle\{[^}]*\}\s*/g, '')
            .replace(/\\fontsize\{[^}]+\}\{[^}]+\}\\selectfont\s*/g, '')
            .trim();
        const bibliographyMatch = body.match(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/);
        const bibliography = bibliographyMatch ? bibliographyMatch[0] : '';
        const bodyWithoutBibliography = bibliography ? cleanedBody.replace(bibliography, '').trim() : cleanedBody;

        const blocks = [];
        let cursor = bodyWithoutBibliography;
        const envRegex = /\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/;

        while (cursor.length > 0) {
            const envMatch = cursor.match(envRegex);
            if (!envMatch) {
                const remainder = cursor.trim();
                if (remainder) blocks.push(remainder);
                break;
            }

            const before = cursor.slice(0, envMatch.index).trim();
            if (before) {
                const splitBefore = before.split(/(?=\\section\{)|(?=\\subsection\{)/g).map(s => s.trim()).filter(Boolean);
                blocks.push(...splitBefore);
            }

            blocks.push(envMatch[0].trim());
            cursor = cursor.slice(envMatch.index + envMatch[0].length);
        }

        const chunks = [];
        let current = '';
        const targetSize = 1400;

        for (const block of blocks) {
            if ((current + '\n\n' + block).length > targetSize && current.trim()) {
                chunks.push(current.trim());
                current = block;
            } else {
                current = current ? `${current}\n\n${block}` : block;
            }
        }
        if (current.trim()) {
            chunks.push(current.trim());
        }

        if (chunks.length === 0) {
            return [latexCode];
        }

        return chunks.map((chunk, index) => {
            const titleBlock = index === 0
                ? `\\title{${this.escapeLatexText(title || 'Documento Gerado')}}\n\\author{IA}\n\\date{\\today}\n`
                : '';
            const bibliographyBlock = index === chunks.length - 1 && bibliography ? `\n\n${bibliography}` : '';

            return `${preamble}
${titleBlock}\\begin{document}
\\pagestyle{empty}
\\fontsize{14}{18}\\selectfont
${index === 0 ? '\\maketitle\n\n' : ''}
${chunk}${bibliographyBlock}

\\end{document}`.trim();
        });
    }

    normalizeDocumentLatex(latexCode, title) {
        let normalized = String(latexCode || '').trim();

        normalized = normalized
            .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/g, '\\documentclass[12pt,a4paper]{article}')
            .replace(/\\frame\{\\titlepage\}/g, '\\maketitle')
            .replace(/\\titlepage/g, '\\maketitle')
            .replace(/\\frametitle\{([^}]+)\}/g, '\\section{$1}')
            .replace(/\\framesubtitle\{[^}]+\}/g, '')
            .replace(/\\begin\{frame\}(?:\[[^\]]*\])?/g, '')
            .replace(/\\end\{frame\}/g, '')
            .replace(/\\begin\{columns\}/g, '')
            .replace(/\\end\{columns\}/g, '')
            .replace(/\\begin\{column\}\{[^}]+\}/g, '')
            .replace(/\\end\{column\}/g, '')
            .replace(/\\pause/g, '')
            .replace(/\\tableofcontents/g, '')
            .replace(/\\vfill/g, '')
            .replace(/\\vspace\*?\{[^}]*\}/g, '')
            .replace(/\\hspace\*?\{[^}]*\}/g, '')
            .replace(/\\centering/g, '');

        if (!/\\documentclass/.test(normalized)) {
            normalized = '\\documentclass[12pt,a4paper]{article}\n' + normalized;
        }

        if (!/\\usepackage\[utf8\]\{inputenc\}/.test(normalized)) {
                normalized = normalized.replace(
                    /\\documentclass(?:\[[^\]]*\])?\{article\}/,
                '\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\usepackage[a4paper,margin=1.5cm]{geometry}'
            );
        }

        if (!/\\title\{/.test(normalized)) {
            normalized = `\\title{${this.escapeLatexText(title)}}\n\\author{IA}\n\\date{\\today}\n${normalized}`;
        }

        normalized = normalized.replace(/\\author\{\s*\}/g, '\\author{Drekee AI}');

        if (!/\\begin\{document\}/.test(normalized)) {
            if (/\\date\{[^}]*\}/.test(normalized)) {
                normalized = normalized.replace(/\\date\{[^}]*\}/, '$&\n\\begin{document}\n\\maketitle\n');
            } else if (/\\title\{[^}]*\}/.test(normalized)) {
                normalized = normalized.replace(/\\title\{[^}]*\}/, '$&\n\\author{IA}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n');
            } else {
                normalized = `\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\usepackage[a4paper,margin=1.5cm]{geometry}\n\\title{${this.escapeLatexText(title)}}\n\\author{IA}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n\n${normalized}`;
            }
        }

        if (!/\\maketitle/.test(normalized) && /\\begin\{document\}/.test(normalized)) {
            normalized = normalized.replace(/\\begin\{document\}/, '\\begin{document}\n\\maketitle\n');
        }

        if (!/\\usepackage(?:\[[^\]]*\])?\{geometry\}/.test(normalized)) {
            normalized = normalized.replace(/\\usepackage\{hyperref\}/, '\\usepackage{hyperref}\n\\usepackage[a4paper,margin=1.5cm]{geometry}');
        }

        normalized = normalized
            .replace(/\\usepackage\{tabular\}\s*/g, '')
            .replace(/\\begin\{document\}/, '\\begin{document}\n\\pagestyle{empty}\n\\fontsize{14}{18}\\selectfont\n');

        if (!/\\end\{document\}/.test(normalized)) {
            normalized = `${normalized}\n\\end{document}`;
        }

        normalized = normalized
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\\section\{([^}]+)\}\s*\\section\{\1\}/g, '\\section{$1}')
            .replace(/^\s+/, '')
            .trim();

        if (!/\\begin\{document\}/.test(normalized)) {
            const preamble = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[a4paper,margin=1.5cm]{geometry}
\\title{${this.escapeLatexText(title)}}
\\author{IA}
\\date{\\today}
\\begin{document}
\\maketitle
`;
            normalized = `${preamble}\n${normalized}`;
        }

        if (!/\\end\{document\}/.test(normalized)) {
            normalized = `${normalized}\n\\end{document}`;
        }

        return normalized;
    }

    escapeLatexText(text) {
        return String(text || '')
            .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
            .replace(/✓|✔/g, 'OK')
            .replace(/✗|✘/g, 'X')
            .replace(/•/g, '-')
            .replace(/[–—]/g, '-')
            .replace(/…/g, '...')
            .replace(/\s+/g, ' ')
            .replace(/\\/g, '/')
            .replace(/([#$%&_{}])/g, '\\$1')
            .replace(/\^/g, '')
            .replace(/~/g, '');
    }

    sanitizeLatexInput(latexCode) {
        return String(latexCode || '')
            .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
            .replace(/✓|✔/g, 'OK')
            .replace(/✗|✘/g, 'X')
            .replace(/•/g, '-')
            .replace(/[–—]/g, '-')
            .replace(/…/g, '...')
            .replace(/\\usepackage\{tabular\}\s*/g, '')
            .replace(/\r/g, '');
    }
    
    validateAndFixLatex(latexCode) {
        console.log('🔧 [LATEX] Validando e corrigindo código...');
        
        let fixedCode = latexCode;
        
        // Garantir estrutura básica
        if (!fixedCode.includes('\\documentclass')) {
            fixedCode = '\\documentclass[12pt,a4paper]{article}\n' + fixedCode;
        }
        
        if (!fixedCode.includes('\\usepackage[utf8]{inputenc}')) {
            fixedCode = fixedCode.replace('\\documentclass', '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\documentclass');
        }
        
        // Remover pacote tabular se estiver presente (inexistente em alguns compiladores)
        fixedCode = fixedCode.replace(/\\usepackage\{tabular\}\s*/g, '');
        
        if (!fixedCode.includes('\\begin{document}')) {
            fixedCode += '\n\n\\begin{document}\n\\maketitle\n\n[Conteúdo do documento]\n\n\\end{document}';
        }
        
        // Adicionar título se não existir
        if (!fixedCode.includes('\\title{')) {
            fixedCode = fixedCode.replace('\\begin{document}', '\\title{Documento Gerado}\n\\author{IA}\n\\date{\\today}\n\\begin{document}');
        }
        
        // Corrigir erros comuns
        fixedCode = fixedCode.replace(/\\maketitle/g, '\\maketitle\n\n');
        
        // Remover quebras de linha extras
        fixedCode = fixedCode.replace(/\n{3,}/g, '\n\n');
        
        // Garantir que \\end{document} esteja no final
        if (fixedCode.includes('\\end{document}')) {
            fixedCode = fixedCode.replace(/\\end{document}[\s\S]*$/, '\\end{document}');
        } else {
            fixedCode += '\n\\end{document}';
        }
        
        // Verificar seções estão bem formadas
        fixedCode = fixedCode.replace(/\\section\{([^}]*)\}/g, '\\section{$1}\n');
        fixedCode = fixedCode.replace(/\\subsection\{([^}]*)\}/g, '\\subsection{$1}\n');
        
        // Corrigir listas
        fixedCode = fixedCode.replace(/\\begin\{itemize\}\s*\\item/g, '\\begin{itemize}\n\\item');
        fixedCode = fixedCode.replace(/\\item\s*\\end\{itemize\}/g, '\\item\n\\end{itemize}');
        
        // Escapar caracteres especiais problemáticos
        fixedCode = fixedCode.replace(/#/g, '\\#');
        fixedCode = fixedCode.replace(/&(?![a-zA-Z])/g, '\\&');
        fixedCode = fixedCode.replace(/%/g, '\\%');
        fixedCode = fixedCode.replace(/_/g, '\\_');
        fixedCode = fixedCode.replace(/{/g, '\\{');
        fixedCode = fixedCode.replace(/}/g, '\\}');
        fixedCode = fixedCode.replace(/~/g, '\\~');
        fixedCode = fixedCode.replace(/\\/g, '\\backslash');
        
        console.log('🔧 [LATEX] Código validado e corrigido');
        return fixedCode.trim();
    }
    
    processLatexTables(htmlContent) {
        // Processar tabelas LaTeX
        return htmlContent.replace(/\\begin\{table\}\[h\]\s*\\centering\s*\\begin\{tabular\}\{([^}]+)\}([\s\S]*?)\\end\{tabular\}\s*\\caption\{([^}]+)\}\s*\\end\{table\}/g, (match, columns, tableContent, caption) => {
            // Limpar o conteúdo da tabela
            const rows = tableContent
                .replace(/\\\\hline/g, '')
                .replace(/\\\\/g, '')
                .split('\\\\')
                .map(row => row.trim())
                .filter(row => row && !row.includes('\\hline'));
            
            // Processar cada linha
            const tableRows = rows.map(row => {
                const cells = row.split('&').map(cell => cell.trim());
                const cellHtml = cells.map(cell => `<td class="border border-gray-300 px-4 py-2 text-sm">${cell}</td>`).join('');
                return `<tr>${cellHtml}</tr>`;
            }).join('');
            
            return `
                <div class="my-6 overflow-x-auto">
                    <table class="min-w-full border-collapse border border-gray-300 bg-white dark:bg-gray-800">
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 italic text-center">${caption}</p>
                </div>
            `;
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

                        // Salvar o conteúdo original
                        let originalContent = element.innerHTML;
                        
                        // Primeiro, renderizar expressões entre $$ (display mode)
                        originalContent = originalContent.replace(/\$\$([^$]+)\$\$/g, (match, math) => {
                            try {
                                return katex.renderToString(math.trim(), {
                                    throwOnError: false,
                                    displayMode: true,
                                    output: 'html'
                                });
                            } catch (e) {
                                console.warn('Erro KaTeX display:', e);
                                return match;
                            }
                        });
                        
                        // Depois, renderizar expressões entre $ (inline mode)
                        originalContent = originalContent.replace(/\$([^$]+)\$/g, (match, math) => {
                            try {
                                return katex.renderToString(math.trim(), {
                                    throwOnError: false,
                                    displayMode: false,
                                    output: 'html'
                                });
                            } catch (e) {
                                console.warn('Erro KaTeX inline:', e);
                                return match;
                            }
                        });
                        
                        // Renderizar expressões entre \[ \] (display mode)
                        originalContent = originalContent.replace(/\\\[([^\\]+)\\\]/g, (match, math) => {
                            try {
                                return katex.renderToString(math.trim(), {
                                    throwOnError: false,
                                    displayMode: true,
                                    output: 'html'
                                });
                            } catch (e) {
                                console.warn('Erro KaTeX display brackets:', e);
                                return match;
                            }
                        });
                        
                        // Renderizar expressões entre \( \) (inline mode)
                        originalContent = originalContent.replace(/\\\(([^\\]+)\\\)/g, (match, math) => {
                            try {
                                return katex.renderToString(math.trim(), {
                                    throwOnError: false,
                                    displayMode: false,
                                    output: 'html'
                                });
                            } catch (e) {
                                console.warn('Erro KaTeX inline brackets:', e);
                                return match;
                            }
                        });
                        
                        // Atualizar apenas uma vez
                        element.innerHTML = originalContent;

                    } catch (e) {

                        console.warn('Erro KaTeX:', e);

                    }

                });

            } else {

                console.warn('KaTeX não carregado');

            }

        }, 200);

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
        URL.revokeObjectURL(url);
        console.log('✅ Download LaTeX iniciado:', filename);
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

            <div class="w-full max-w-[85%] px-5 py-4">

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
        
        // Usar o método hideWelcomeScreen que já tem a transição suave
        this.hideWelcomeScreen();
        
        // Mover input para baixo quando transicionar para chat
        this.moveInputDown();
    }



    addUserMessage(text, files = null, opts = {}) {

        // Se o modo Documento está ativo, desativar ao enviar mensagem
        if (window.isDocumentModeActive && !opts.preserveCreateMode) {
            console.log('🔧 [CREATE] Desativando modo Documento ao enviar mensagem');
            window.isDocumentModeActive = false;
            
            // Resetar botão principal
            const createToggle = document.getElementById('createToggle');
            if (createToggle) {
                createToggle.classList.remove('active');
                createToggle.innerHTML = '<span class="material-icons-outlined" style="font-size:1rem">edit</span><span>Ferramentas</span>';
            }
            
            // Resetar placeholder
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.placeholder = 'Como posso ajudar com seu código hoje?';
            }
            
            // Resetar na UI
            if (this.setCreateType) {
                this.setCreateType(null);
            }
        }

        // Se o modo Apresentação está ativo, desativar ao enviar mensagem
        if (window.isSlidesModeActive && !opts.preserveCreateMode) {
            console.log('🔧 [CREATE] Desativando modo Apresentação ao enviar mensagem');
            window.isSlidesModeActive = false;

            const createToggle = document.getElementById('createToggle');
            if (createToggle) {
                createToggle.classList.remove('active');
                createToggle.innerHTML = '<span class="material-icons-outlined" style="font-size:1rem">edit</span><span>Ferramentas</span>';
            }

            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.placeholder = 'Como posso ajudar com seu código hoje?';
            }

            if (this.setCreateType) {
                this.setCreateType(null);
            }
        }

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

                <p class="text-base leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">${this.escapeHtml(text)}</p>

            </div>

        `;

        this.elements.messagesContainer.appendChild(messageDiv);

        // Se for o primeiro mensagem do chat, fazer transição
        if (!this.isTransitioned) {
            this.transitionToChat();
        }

        // Auto-scroll imediato para mensagens do usuário
        this.scrollToBottom();

        // Reforço após a animação
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);

    }



    addErrorMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';
        
        const uniqueId = 'msg_' + Date.now();
        messageDiv.id = uniqueId;
        
        messageDiv.innerHTML = `
            <div class="max-w-3xl">
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 shadow-sm">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-outlined text-red-600 dark:text-red-400 text-sm">error</span>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Erro</div>
                            <div class="text-red-700 dark:text-red-300 text-sm">${text}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const messagesContainer = this.elements.messagesContainer;
        if (messagesContainer) {
            messagesContainer.appendChild(messageDiv);
            this.scrollToBottom();
        }
    }

    addAssistantMessage(text, sources = null, thinking = null) {

        const messageDiv = document.createElement('div');

        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';

        const uniqueId = 'msg_' + Date.now();

        let sourcesHtml = '';
        
        // Adicionar fontes se existirem
        if (sources && sources.length > 0) {
            sourcesHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fontes</div>
                    <div class="space-y-2">
                        ${sources.map((source, index) => `
                            <a href="https://www.google.com/search?q=${encodeURIComponent(source.title || source)}" target="_blank" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                                <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <span class="material-icons-outlined text-blue-600 dark:text-blue-400 text-sm">link</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        ${source.title || source}
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        ${source.url || 'Fonte ' + (index + 1)}
                                    </div>
                                </div>
                                <div class="flex-shrink-0">
                                    <span class="material-icons-outlined text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-sm transition-colors">open_in_new</span>
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        messageDiv.innerHTML = `

            <div class="w-full max-w-[85%] px-5 py-4 overflow-hidden">

                <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words overflow-wrap-anywhere" id="responseText_${uniqueId}"></div>
                
                ${sourcesHtml}
            </div>

        `;

        this.elements.messagesContainer.appendChild(messageDiv);

        // Se for o primeiro mensagem do chat, fazer transição
        if (!this.isTransitioned) {
            this.transitionToChat();
        }

        // Scroll imediato quando mensagem é adicionada
        this.scrollToBottom();



        const responseDiv = document.getElementById(`responseText_${uniqueId}`);

        if (responseDiv) {

            // Se o texto começa com <div (HTML), renderiza direto. Senão, formata como markdown

            if (text.trim().startsWith('<')) {

                // Texto HTML vindo de fontes internas ou widgets. Sanitizar antes de inserir.
                let processedText = this.sanitizeHtml(text);
                
                // Verificar se é uma resposta RE e precisa de destaque amarelo
                if (processedText.includes('Raciocínio Lógico:') || 
                    processedText.includes('Passo a Passo') ||
                    processedText.includes('Resultado Final:') ||
                    processedText.includes('Justificativa:')) {
                    
                    // Se não tem destaque amarelo, adicionar automaticamente
                    if (!processedText.includes('re-final-answer')) {
                        const lines = processedText.split('\n');
                        let finalAnswerLine = -1;
                        
                        // Procurar por linha que parece ser resposta final
                        for (let i = lines.length - 1; i >= 0; i--) {
                            const line = lines[i].trim();
                            if (line.includes('Resultado Final:') || 
                                line.includes('RESPOSTA FINAL:') ||
                                line.includes('Resposta:') ||
                                (line.match(/^\d+[\.\)]/) && line.includes('='))) {
                                finalAnswerLine = i;
                                break;
                            }
                        }
                        
                        if (finalAnswerLine >= 0) {
                            // Adicionar destaque amarelo à resposta final
                            const cleanLine = lines[finalAnswerLine].replace(/^.*?[:\)]\s*/, '').replace(/<[^>]*>/g, '');
                            lines[finalAnswerLine] = `<div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> ${cleanLine}</div>`;
                            processedText = lines.join('\n');
                        } else {
                            // Se não encontrou linha clara, adicionar no final
                            processedText += `\n\n<div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> Verificar resposta acima</div>`;
                        }
                    }
                }
                
                responseDiv.innerHTML = processedText;

            } else {

                // Texto normal - formatar

                responseDiv.innerHTML = this.formatResponse(text);

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

                }

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
                    <div class="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-4" id="thinkingHeader_${uniqueId}"></div>
                    <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 min-h-4" id="responseText_${uniqueId}"></div>
                </div>
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Adicionar barra invisível com botões de ação
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
        
        // Retornar objeto com IDs esperados pelos modelos
        return {
            uniqueId: uniqueId,
            headerId: `thinkingHeader_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            stepsId: null // Para compatibilidade com modelos que usam steps
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

        

        // RETORNAR O OBJETO COM IDs ESPERADOS PELOS MODELOS
        return {
            uniqueId: uniqueId,
            headerId: `thinkingHeader_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            stepsId: null // Para compatibilidade com modelos que usam steps
        };

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



    setResponseText(text, responseId, callback) {
        console.log('🔍 [SET-TEXT] Iniciando setResponseText');
        console.log('🔍 [SET-TEXT] Text:', text ? text.substring(0, 100) + '...' : 'NULO');
        console.log('🔍 [SET-TEXT] ResponseId:', responseId);
        console.log('🔍 [SET-TEXT] Callback:', typeof callback);
        
        const responseDiv = document.getElementById(responseId);
        console.log('🔍 [SET-TEXT] Elemento encontrado:', !!responseDiv);

        if (responseDiv) {
            // NÃO LIMPAR innerHTML NUNCA! Apenas adicionar texto após imagens existentes
            responseDiv.style.minHeight = '20px';

            // Forçar texto seguro (string) - NÃO mostrar erro na animação
            let safeText = (text == null || String(text).trim().length === 0) ? '' : String(text);

            console.log('🔍 [SET-TEXT] SafeText:', safeText.substring(0, 100) + '...');

            // Verificar se já existem imagens no elemento
            const hasImages = responseDiv.querySelectorAll('div[style*="flex: 1"], div[id*="shadow-"], div[id*="carousel_"]').length > 0;
            console.log('🔍 [SET] Já existem imagens no elemento:', hasImages);

            if (hasImages) {
                // APENAS ADICIONAR TEXTO APÓS AS IMAGENS - NÃO SOBRESCREVER!
                const responseTextDiv = document.createElement('div');
                responseTextDiv.id = `response-text-${responseId}`;
                responseTextDiv.style.marginTop = '15px';
                responseDiv.appendChild(responseTextDiv);

                console.log('🔍 [SET] Adicionando texto após imagens existentes');
                this.typewriterEffect(safeText, responseTextDiv, callback, '');
            } else {
                // Sem imagens, usar o método normal
                console.log('🔍 [SET] Sem imagens, usando método normal');
                this.typewriterEffect(safeText, responseDiv, callback, '');
            }
        }

        this.scrollToBottom();
    }



    async typewriterEffect(text, element, callback, imagesHtml = '') {

        // Garantir que temos string
        console.log('🔍 [TYPE] Iniciando typewriterEffect');
        console.log('🔍 [TYPE] Text length:', text ? text.length : 0);
        console.log('🔍 [TYPE] Element:', !!element);
        console.log('🔍 [TYPE] Callback:', typeof callback);
        
        text = (text == null) ? '' : String(text);

        console.log('🔍 [TYPE] Iniciando typewriter com imagesHtml length:', imagesHtml.length);
        console.log('🔍 [TYPE] ImagesHtml preview:', imagesHtml.substring(0, 100));



        if (!text || text.length === 0) {

            // Sem animação; renderizar direto com imagens

            const formattedHtml = this.formatResponse(text);
            
            // Combinar imagens + texto
            element.innerHTML = imagesHtml + formattedHtml;
            
            console.log('🔍 [TYPE] Renderizado direto com imagens + texto');

            setTimeout(() => this.scrollToBottom(), 100);

            if (callback) callback();

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

                // Combinar imagens + texto durante animação
                element.innerHTML = imagesHtml + formattedPartial;
                
                // Log a cada 10 caracteres para não poluir muito
                if (charIndex % 10 === 0) {
                    console.log('🔍 [TYPE] Animando char', charIndex, 'com imagesHtml length:', imagesHtml.length);
                }

                

                if (charIndex % 10 === 0) { // Scroll menos frequente para melhor performance

                    this.scrollToBottom();

                }

                await this.sleep(0); // MUITO mais rápido: 0ms por caractere

            }

            

            // Adicionar linha completa ao array de linhas exibidas

            displayedLines.push(currentLine);

            

            // Pequena pausa entre linhas

            await this.sleep(0); // Pausa instantânea entre linhas

        }

        

        // Garantir formatação final completa

        const finalFormatted = this.formatResponse(text);

        // Combinar imagens + texto final
        element.innerHTML = imagesHtml + finalFormatted;
        
        console.log('🔍 [TYPE] Renderizado final com imagesHtml length:', imagesHtml.length);
        console.log('🔍 [TYPE] Final HTML preview:', (imagesHtml + finalFormatted).substring(0, 200));

        setTimeout(() => this.scrollToBottom(), 100);

        

        // Executar callback no final da animação

        if (callback) callback();

    }



    formatResponse(text) {

        if (!text || text.length === 0) {

            return '<p class="text-gray-600 dark:text-gray-400">Resposta vazia</p>';

        }

        // Heurística: quando a IA envia LaTeX cru (ex: \frac{3}{5}, \times, \div) sem delimitadores,
        // envelopar em $...$ para permitir renderização KaTeX.
        // (Evita exibir o código literal no chat.)
        if (typeof text === 'string') {
            const wrapIfRawLatex = (input) => {
                // Não tentar mexer em blocos com ``` (serão removidos/extraídos depois)
                // e evitar duplicar $ quando já existe.
                // 1) Frações
                input = input.replace(/(^|[^\\$])\\frac\{[^\n{}]+\}\{[^\n{}]+\}/g, (m, prefix) => {
                    const expr = m.slice(prefix.length);
                    return `${prefix}$${expr}$`;
                });

                // 2) Comandos comuns sem argumentos
                input = input.replace(/(^|[^\\$])\\(times|div|cdot|pm|mp|leq|geq|neq|approx|infty|sum|int|lim|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|tau|phi|chi|psi|omega)(?![a-zA-Z])/g, (m, prefix, cmd) => {
                    const expr = `\\${cmd}`;
                    return `${prefix}$${expr}$`;
                });

                // 3) Comandos com um argumento {...}
                input = input.replace(/(^|[^\\$])\\(sqrt|text|cancel)\{[^\n{}]+\}/g, (m, prefix) => {
                    const expr = m.slice(prefix.length);
                    return `${prefix}$${expr}$`;
                });

                return input;
            };

            text = wrapIfRawLatex(text);
        }

        

        // Extrair blocos matemáticos ANTES do escapeHtml, renderizando com KaTeX.
        // Isso evita que entidades HTML (ex: &#x27;) e HTML escapado entrem no parser do KaTeX.
        const mathRenders = [];
        const mathPlaceholder = (i) => `___MATH_RENDER_${i}___`;
        const renderMathToHtml = (math, displayMode) => {
            try {
                if (typeof katex !== 'undefined' && katex && typeof katex.renderToString === 'function') {
                    return katex.renderToString(String(math).trim(), { throwOnError: false, displayMode });
                }
            } catch (e) {
                // fallback abaixo
            }
            const safe = this.escapeHtml(String(math));
            return displayMode
                ? `<div class="block my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"><span class="block font-mono text-base text-center text-gray-900 dark:text-gray-100">${safe}</span></div>`
                : `<span class="inline-block font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600">${safe}</span>`;
        };

        let textWithMathPlaceholders = String(text);
        // $$...$$ (display) primeiro
        textWithMathPlaceholders = textWithMathPlaceholders.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
            const idx = mathRenders.length;
            mathRenders.push(renderMathToHtml(math, true));
            return mathPlaceholder(idx);
        });
        // $...$ (inline)
        textWithMathPlaceholders = textWithMathPlaceholders.replace(/\$([^$\n]+)\$/g, (match, math) => {
            const idx = mathRenders.length;
            mathRenders.push(renderMathToHtml(math, false));
            return mathPlaceholder(idx);
        });

        // Extrair todos os blocos de código e armazená-los

        const codeBlocks = [];

        let cleanText = textWithMathPlaceholders.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {

            codeBlocks.push({ lang: lang || 'plaintext', code: code.trim() });

            return '';

        });

        

        // REINSERIR MATEMÁTICA ANTES DO escapeHtml - para que os placeholders não sejam escapados
        if (mathRenders.length > 0) {
            mathRenders.forEach((html, i) => {
                cleanText = cleanText.replaceAll(mathPlaceholder(i), html);
            });
        }

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



        // Remover completamente blocos de código

        formatted = formatted.replace(/```[\s\S]*?```/g, '');

        

        // Remover código inline

        formatted = formatted.replace(/`([^`]+)`/g, '$1');

        

        // Processar bold e italic

        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-gray-100">$1</strong>');

        formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>');

        

        // Processar sublinhado

        formatted = formatted.replace(/<u>([^<]+)<\/u>/g, '<u class="underline decoration-2 decoration-blue-500">$1</u>');

        

        // Remover apenas caracteres realmente problemáticos, mantendo formatação HTML e símbolos matemáticos

        formatted = formatted.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        

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

    // Método para adicionar carrossel de imagens (efeito vidro fosco, antes da resposta)
    appendImagesToMessage(responseId, images) {
        console.log('🎯 [APPEND] Método chamado com responseId:', responseId);
        console.log('🎯 [APPEND] Images:', images);
        
        const responseDiv = document.getElementById(responseId);
        console.log('🎯 [APPEND] Elemento encontrado:', responseDiv);
        
        if (!responseDiv || !images || images.length === 0) {
            console.log('❌ [APPEND] Saindo - responseDiv ou images inválidos');
            return;
        }
        
        console.log(`🖼️ [CARROSSEL] Adicionando ${images.length} imagens ANTES da resposta ${responseId}`);
        
        // Criar layout de 3 imagens grandes que preenchem a largura
        const carouselId = `carousel_${Date.now()}`;
        const carouselClass = `fixed-carousel-${Date.now()}`;
        const carouselHtml = `
            <div id="${carouselId}" class="${carouselClass}" style="margin-bottom: 20px; display: flex !important; flex-direction: row !important; gap: 8px; width: 100%; justify-content: space-between; align-items: stretch;">
                ${images.slice(0, 3).map((img, index) => `
                    <div class="carousel-img-${index}" style="flex: 1 !important; min-width: 0; height: 200px; border-radius: 12px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); display: block !important;"
                         onclick="window.open('${img.src}', '_blank')">
                        <img src="${img.src}" alt="${img.alt || ''}" 
                             style="width: 100% !important; height: 100% !important; object-fit: cover; display: block !important; max-width: none !important;"
                             crossorigin="anonymous"
                             referrerpolicy="no-referrer"
                             onerror="
                                 var img = this;
                                 var proxyUrl = '/api/image-proxy?url=' + encodeURIComponent('${img.src}');
                                 console.log('🔄 [IMG] Tentando proxy:', proxyUrl);
                                 
                                 // Tentar carregar via proxy
                                 var proxyImg = new Image();
                                 proxyImg.onload = function() {
                                     img.src = proxyUrl;
                                     img.style.display = 'block';
                                 };
                                 proxyImg.onerror = function() {
                                     img.style.display = 'none';
                                     img.parentElement.innerHTML = '<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px; background: #f5f5f5; text-align: center; padding: 10px;\\'>🖼️ Imagem bloqueada<br><small>Desative ad-blocker<br>ou recarregue a página</small></div>';
                                 };
                                 proxyImg.src = proxyUrl;
                             " />
                    </div>
                `).join('')}
            </div>
            <style>
                #${carouselId}.${carouselClass} { 
                    display: flex !important; 
                    flex-direction: row !important; 
                    flex-wrap: nowrap !important;
                    align-items: stretch !important;
                    justify-content: space-between !important;
                    gap: 8px !important;
                    width: 100% !important;
                    margin-bottom: 20px !important;
                }
                #${carouselId}.${carouselClass} > div { 
                    flex: 1 !important; 
                    display: block !important; 
                    min-width: 0 !important;
                    max-width: none !important;
                    width: auto !important;
                    height: 200px !important;
                    transition: none !important; 
                    animation: none !important;
                    transform: none !important;
                    position: static !important;
                    float: none !important;
                    clear: none !important;
                    vertical-align: top !important;
                }
                #${carouselId}.${carouselClass} > div > img { 
                    width: 100% !important; 
                    height: 100% !important; 
                    display: block !important; 
                    transition: none !important; 
                    animation: none !important;
                    transform: none !important;
                    position: static !important;
                    float: none !important;
                    clear: none !important;
                }
                #${carouselId}.${carouselClass} > div:hover { 
                    transform: none !important; 
                    transition: none !important;
                }
                /* Super específico para bloquear qualquer coisa */
                div[id*="carousel_"][class*="fixed-carousel"] {
                    display: flex !important;
                    flex-direction: row !important;
                }
                div[id*="carousel_"][class*="fixed-carousel"] > div {
                    flex: 1 !important;
                    display: block !important;
                }
                /* Bloquear classes do Tailwind que possam interferir */
                #${carouselId} .flex-col { flex-direction: row !important; }
                #${carouselId} .block { display: block !important; }
                #${carouselId} .w-full { width: auto !important; flex: 1 !important; }
            </style>
        `;
        
        console.log('🎨 [APPEND] HTML gerado:', carouselHtml);
        
        // TENTAR SHADOW DOM PARA ISOLAR COMPLETAMENTE
        try {
            const shadowContainer = document.createElement('div');
            shadowContainer.id = `shadow-${carouselId}`;
            
            // Criar Shadow Root
            const shadowRoot = shadowContainer.attachShadow({ mode: 'open' });
            
            // CSS isolado no Shadow DOM
            const shadowStyle = document.createElement('style');
            shadowStyle.textContent = `
                .carousel-container {
                    display: flex !important;
                    flex-direction: row !important;
                    flex-wrap: nowrap !important;
                    align-items: stretch !important;
                    justify-content: space-between !important;
                    gap: 8px !important;
                    width: 100% !important;
                    margin-bottom: 20px !important;
                    box-sizing: border-box !important;
                }
                .carousel-item {
                    flex: 1 !important;
                    display: block !important;
                    min-width: 0 !important;
                    max-width: none !important;
                    width: auto !important;
                    height: 200px !important;
                    border-radius: 12px !important;
                    overflow: hidden !important;
                    cursor: pointer !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
                    transition: none !important;
                    animation: none !important;
                    transform: none !important;
                    position: static !important;
                    float: none !important;
                    clear: none !important;
                    vertical-align: top !important;
                    box-sizing: border-box !important;
                }
                .carousel-img {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    display: block !important;
                    transition: none !important;
                    animation: none !important;
                    transform: none !important;
                    position: static !important;
                    float: none !important;
                    clear: none !important;
                    box-sizing: border-box !important;
                }
            `;
            
            // HTML do carousel no Shadow DOM
            const carouselContent = `
                <div class="carousel-container">
                    ${images.slice(0, 3).map((img, index) => `
                        <div class="carousel-item" onclick="window.open('${img.src}', '_blank')">
                            <img class="carousel-img" src="${img.src}" alt="${img.alt || ''}" 
                                 crossorigin="anonymous"
                                 referrerpolicy="no-referrer"
                                 onerror="
                                     var img = this;
                                     var proxyUrl = '/api/image-proxy?url=' + encodeURIComponent('${img.src}');
                                     console.log('🔄 [IMG] Tentando proxy:', proxyUrl);
                                     var proxyImg = new Image();
                                     proxyImg.onload = function() {
                                         img.src = proxyUrl;
                                         img.style.display = 'block';
                                     };
                                     proxyImg.onerror = function() {
                                         img.style.display = 'none';
                                         img.parentElement.innerHTML = '<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 14px; background: #f5f5f5; text-align: center; padding: 10px;\\'>🖼️ Imagem bloqueada<br><small>Desative ad-blocker<br>ou recarregue a página</small></div>';
                                     };
                                     proxyImg.src = proxyUrl;
                                 " />
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Adicionar ao Shadow DOM
            shadowRoot.appendChild(shadowStyle);
            shadowRoot.innerHTML += carouselContent;
            
            // Inserir o container Shadow ANTES do conteúdo existente
            responseDiv.insertAdjacentElement('afterbegin', shadowContainer);
            
            console.log('🎭 [SHADOW] Carousel isolado criado com Shadow DOM!');
            
        } catch (shadowError) {
            console.warn('🎭 [SHADOW] Shadow DOM falhou, usando método normal:', shadowError);
            
            // FALLBACK: Método normal com JavaScript forçado
            responseDiv.insertAdjacentHTML('afterbegin', carouselHtml);
            
            // JAVASCRIPT FORÇADO PARA CORRIGIR LAYOUT A CADA 1 SEGUNDO
            const fixLayout = () => {
                const carousel = document.getElementById(carouselId);
                if (carousel) {
                    carousel.style.display = 'flex';
                    carousel.style.flexDirection = 'row';
                    carousel.style.flexWrap = 'nowrap';
                    carousel.style.justifyContent = 'space-between';
                    carousel.style.gap = '8px';
                    carousel.style.width = '100%';
                    
                    const images = carousel.querySelectorAll('div');
                    images.forEach(imgDiv => {
                        imgDiv.style.flex = '1';
                        imgDiv.style.display = 'block';
                        imgDiv.style.minWidth = '0';
                        imgDiv.style.height = '200px';
                        imgDiv.style.transition = 'none';
                        imgDiv.style.animation = 'none';
                        imgDiv.style.transform = 'none';
                        imgDiv.style.position = 'static';
                        imgDiv.style.float = 'none';
                        imgDiv.style.clear = 'none';
                        
                        const img = imgDiv.querySelector('img');
                        if (img) {
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.display = 'block';
                            img.style.transition = 'none';
                            img.style.animation = 'none';
                            img.style.transform = 'none';
                            img.style.position = 'static';
                            img.style.float = 'none';
                            img.style.clear = 'none';
                        }
                    });
                    
                    console.log('🔧 [FIX] Layout forçado aplicado');
                }
            };
            
            // Aplicar imediatamente
            fixLayout();
            
            // Aplicar a cada 1 segundo por 10 segundos
            let fixCount = 0;
            const fixInterval = setInterval(() => {
                fixLayout();
                fixCount++;
                if (fixCount >= 10) {
                    clearInterval(fixInterval);
                    console.log('🔧 [FIX] Correção automática parada');
                }
            }, 1000);
        }
        
        console.log('✅ [CARROSSEL] Carrossel adicionado com isolamento máximo!');
    }

    // Método para adicionar botão de fontes personalizado
    addSourcesButton(responseId, sources, query) {
        console.log('🔗 [SOURCES] Adicionando botão de fontes para:', responseId);
        console.log('🔗 [SOURCES] Fontes:', sources.length);
        
        const responseDiv = document.getElementById(responseId);
        if (!responseDiv) {
            console.error('❌ [SOURCES] Elemento responseDiv não encontrado');
            return;
        }

        // Criar ID único para o botão e container
        const sourcesId = `sources_${Date.now()}`;
        const buttonId = `sourcesBtn_${Date.now()}`;

        // Criar botão de fontes com design personalizado
        const sourcesButtonHtml = `
            <div style="margin-top: 15px; margin-bottom: 10px;">
                <button id="${buttonId}" class="sources-button" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: transparent;
                    border: 1px solid #3b82f6;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #3b82f6;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                " onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'" onmouseout="this.style.background='transparent'">
                    <!-- Ícones sobrepostos -->
                    <div style="position: relative; width: 16px; height: 16px;">
                        <!-- Círculo azul com nuvens -->
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 16px;
                            height: 16px;
                            background: #3b82f6;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <div style="
                                width: 10px;
                                height: 10px;
                                background: white;
                                border-radius: 50%;
                                opacity: 0.8;
                            "></div>
                        </div>
                        <!-- Nuvem escura com raio -->
                        <div style="
                            position: absolute;
                            top: 2px;
                            left: 2px;
                            width: 12px;
                            height: 12px;
                            background: #1f2937;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <div style="
                                width: 0;
                                height: 0;
                                border-left: 3px solid transparent;
                                border-right: 3px solid transparent;
                                border-top: 5px solid #fbbf24;
                                transform: translateY(-1px);
                            "></div>
                        </div>
                    </div>
                    <span style="font-weight: 500;">Fontes</span>
                    <span style="
                        width: 16px;
                        height: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.2s ease;
                    ">▼</span>
                </button>
            </div>
        `;

        // Criar container das fontes (inicialmente oculto)
        const sourcesContainerHtml = `
            <div id="${sourcesId}" style="
                display: none;
                margin-top: 10px;
                padding: 15px;
                background: transparent;
                border: 1px solid #3b82f6;
                border-radius: 12px;
                animation: slideDown 0.3s ease;
                backdrop-filter: blur(10px);
            ">
                <div style="font-weight: 600; color: white; margin-bottom: 10px; font-size: 14px;">
                    ${query}
                </div>
                ${sources.map((source, index) => `
                    <div style="
                        margin-bottom: 12px;
                        padding: 10px;
                        background: transparent;
                        border-radius: 8px;
                        border: 1px solid rgba(59, 130, 246, 0.3);
                    ">
                        <div style="display: flex; align-items: start; gap: 10px;">
                            <span style="
                                background: #3b82f6;
                                color: white;
                                width: 20px;
                                height: 20px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 12px;
                                font-weight: bold;
                                flex-shrink: 0;
                            ">${index + 1}</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: white; margin-bottom: 4px; font-size: 13px;">
                                    ${source.title || 'Fonte sem título'}
                                </div>
                                <div style="color: #6b7280; font-size: 12px; margin-bottom: 6px;">
                                    ${source.url || ''}
                                </div>
                                ${source.snippet ? `
                                    <div style="color: #4b5563; font-size: 12px; line-height: 1.4;">
                                        "${source.snippet.substring(0, 200)}${source.snippet.length > 200 ? '...' : ''}"
                                    </div>
                                ` : ''}
                            </div>
                            <a href="${source.url || '#'}" target="_blank" style="
                                color: #3b82f6;
                                text-decoration: none;
                                font-size: 12px;
                                font-weight: 500;
                                flex-shrink: 0;
                            ">Ver →</a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Adicionar CSS para animação
        const styleHtml = `
            <style>
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .sources-button:hover span:last-child {
                    transform: rotate(180deg);
                }
            </style>
        `;

        // Inserir elementos no DOM
        responseDiv.insertAdjacentHTML('beforeend', styleHtml + sourcesButtonHtml + sourcesContainerHtml);

        // Adicionar evento de clique ao botão
        const button = document.getElementById(buttonId);
        const container = document.getElementById(sourcesId);
        
        if (button && container) {
            button.addEventListener('click', () => {
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
                
                // Atualizar texto do botão
                const arrow = button.querySelector('span:last-child');
                if (arrow) {
                    arrow.textContent = isHidden ? '▲' : '▼';
                }
            });
        }

        console.log('✅ [SOURCES] Botão de fontes adicionado com sucesso!');
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
        
        // Usar o método hideWelcomeScreen que já tem a transição suave
        this.hideWelcomeScreen();
        
        // Mover input para baixo quando transicionar para chat
        this.moveInputDown();
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

        

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        

        if (confirmBtn) confirmBtn.addEventListener('click', () => {

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

    // Método para chamada da API Tavily Search
    async callTavilySearch(message) {
        try {
            console.log('🚀 [CALL TAVILY] FUNÇÃO callTavilySearch EXECUTADA!');
            console.log('🔍 [TAVILY DEBUG] Iniciando chamada API Tavily Search...');
            console.log('🔍 [TAVILY DEBUG] Mensagem:', message);
            console.log('🔍 [TAVILY DEBUG] isWebSearchMode:', typeof isWebSearchMode !== 'undefined' ? isWebSearchMode : 'UNDEFINED');

            // Criar container com texto "Pesquisando..."
            const messageContainer = this.createRapidMessageContainer();
            this.setThinkingHeader('🔍 Pesquisando...', messageContainer.headerId);
                
            // Iniciar busca de imagens em paralelo
            const imagesPromise = this.agent.searchUnsplashImages(message);
                
            // Obter histórico da conversa atual
            const currentChat = this.chats.find(c => c.id === this.currentChatId);
            const conversationHistory = currentChat ? currentChat.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })) : [];
            
            console.log('🔍 [TAVILY DEBUG] Histórico da conversa:', conversationHistory.length, 'mensagens');
            console.log('🔍 [TAVILY DEBUG] Enviando requisição para /api/tavily-search...');

            const response = await fetch('/api/tavily-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    conversationHistory
                }),
            });

            if (!response.ok) {
                console.error('❌ [TAVILY DEBUG] Erro na resposta:', response.status, response.statusText);
                const errorData = await response.json();
                console.error('❌ [TAVILY DEBUG] Dados do erro:', errorData);
                throw new Error(`Erro HTTP ${response.status}: ${errorData.message || errorData.error || 'Erro desconhecido'}`);
            }

            console.log('✅ [TAVILY DEBUG] Resposta recebida com sucesso');
            const data = await response.json();
            console.log('✅ [TAVILY DEBUG] Dados da resposta:', data);
            console.log('✅ [TAVILY DEBUG] Fontes encontradas:', (data && data.sources && data.sources.length) ? data.sources.length : 0);
            
            // Limpar texto "Pesquisando..."
            this.setThinkingHeader('', messageContainer.headerId);
            
            // Adicionar resposta da IA primeiro
            this.setResponseText(data.response, messageContainer.responseId, async () => {
                // Adicionar fontes DEPOIS do texto
                if (data.sources && data.sources.length > 0) {
                    const responseDiv = document.getElementById(messageContainer.responseId);
                    if (responseDiv) {
                        const sourcesHtml = `
                            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fontes</div>
                                <div class="space-y-2">
                                    ${data.sources.map((source, index) => `
                                        <a href="https://www.google.com/search?q=${encodeURIComponent(source.title || source)}" target="_blank" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                                            <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                                <span class="material-icons-outlined text-blue-600 dark:text-blue-400 text-sm">link</span>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    ${source.title || source}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    ${source.url || 'Fonte ' + (index + 1)}
                                                </div>
                                            </div>
                                            <div class="flex-shrink-0">
                                                <span class="material-icons-outlined text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-sm transition-colors">open_in_new</span>
                                            </div>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                        responseDiv.insertAdjacentHTML('beforeend', sourcesHtml);
                    }
                }
                
                // Adicionar imagens DEPOIS das fontes
                const images = await imagesPromise;
                if (images && images.length > 0) {
                    this.appendImagesToMessage(messageContainer.responseId, images);
                }
            });

            console.log('✅ [TAVILY DEBUG] Pesquisa Tavily concluída com sucesso');

        } catch (error) {
            console.error('❌ [TAVILY DEBUG] Erro geral na pesquisa Tavily:', error);
            console.error('❌ [TAVILY DEBUG] Stack trace:', error.stack);
            this.addErrorMessage(`Erro na pesquisa: ${error.message}`);
        }
    }

    // Configurar auto-resize da caixa de mensagem
    setupAutoResize() {
        const textarea = this.elements.userInput;
        if (!textarea) return;

        // Configurações iniciais
        const MIN_HEIGHT = 48; // h-12 = 48px
        const MAX_HEIGHT = 200; // altura máxima razoável
        const LINE_HEIGHT = 24; // altura aproximada por linha

        // Função para ajustar a altura
        const adjustHeight = () => {
            // Resetar altura para calcular corretamente
            textarea.style.height = 'auto';
            
            // Calcular nova altura baseada no conteúdo
            const scrollHeight = textarea.scrollHeight;
            
            // Aplicar altura com limites e transição suave
            if (scrollHeight > MIN_HEIGHT) {
                const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
                textarea.style.height = newHeight + 'px';
            } else {
                textarea.style.height = MIN_HEIGHT + 'px';
            }
        };

        // Adicionar transição suave
        textarea.style.transition = 'height 0.2s ease-in-out';

        // Event listeners
        textarea.addEventListener('input', adjustHeight);
        textarea.addEventListener('paste', () => {
            // Pequeno delay para o conteúdo ser colado
            setTimeout(adjustHeight, 10);
        });

        // Ajustar inicialmente
        adjustHeight();

        // Resetar altura quando enviar mensagem
        const originalHandleSend = this.handleSend.bind(this);
        this.handleSend = () => {
            originalHandleSend();
            textarea.style.height = MIN_HEIGHT + 'px';
        };
    }

    // Sistema de Autenticação com Supabase
    async initAuthSystem() {
        if (!window.supabase) {
            console.warn('Supabase não disponível');
            this.showGuestMode();
            return;
        }

        // Limpar TUDO ao carregar para sincronização correta
        this.chats = [];
        this.currentChatId = null;
        localStorage.removeItem('lhama_chats'); // Forçar limpeza
        
        // Limpar também o container de mensagens
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }

        // Verificar sessão atual
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error) {
            console.error('❌ Erro ao verificar sessão:', error);
            this.showGuestMode();
            return;
        }
        
        if (session) {
            console.log('✅ Sessão encontrada:', session.user.email);
            await this.showLoggedInUser(session.user);
            await this.loadUserChats();
            // Iniciar heartbeat para usuários logados
            this.startHeartbeat(session.user.id);
        } else {
            console.log('🔒 Nenhuma sessão encontrada');
            this.showGuestMode();
        }

        // Configurar event listeners
        this.setupAuthListeners();

        // Escutar mudanças na autenticação com delay para UI atualizar
        window.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔄 Auth state changed:', event, (session && session.user) ? session.user.email : null);
            
            // Adicionar delay para UI atualizar corretamente
            setTimeout(async () => {
                if (event === 'SIGNED_IN' && session) {
                    console.log('✅ Usuário fez login:', session.user.email);
                    
                    // Limpar tudo e forçar reload
                    this.chats = [];
                    this.currentChatId = null;
                    localStorage.removeItem('lhama_chats');
                    
                    await this.showLoggedInUser(session.user);
                    await this.loadUserChats();
                    this.startHeartbeat(session.user.id);
                    
                    // Forçar refresh da UI
                    this.renderChatHistory();
                    
                } else if (event === 'SIGNED_OUT') {
                    console.log('👤 Usuário fez logout');
                    this.showGuestMode();
                    this.clearUserChats();
                    this.stopHeartbeat();
                }
            }, 500); // 500ms delay
        });
    }

    // Sistema de Heartbeat para usuários ativos
    startHeartbeat(userId) {
        // Parar heartbeat anterior se existir
        this.stopHeartbeat();
        
        // Registrar sessão inicial
        this.updateUserSession(userId);
        
        // Configurar heartbeat a cada 30 segundos
        this.heartbeatInterval = setInterval(() => {
            this.updateUserSession(userId);
        }, 30000); // 30 segundos
        
        console.log('🫀 Heartbeat iniciado para usuário:', userId);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('🫀 Heartbeat parado');
        }
    }

    async updateUserSession(userId) {
        try {
            if (!window.supabase || !userId) return;

            // Verificar se já existe sessão para este usuário
            const { data: existingSession } = await window.supabase
                .from('user_sessions')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (existingSession) {
                // Atualizar sessão existente
                await window.supabase
                    .from('user_sessions')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('user_id', userId);
            } else {
                // Criar nova sessão
                await window.supabase
                    .from('user_sessions')
                    .insert({
                        user_id: userId,
                        last_seen: new Date().toISOString()
                    });
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar sessão do usuário:', error);
        }
    }

    setupAuthListeners() {
        // Botão de login
        if (this.elements.loginBtn) this.elements.loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });

        // Botão de logout
        if (this.elements.logoutBtn) this.elements.logoutBtn.addEventListener('click', async () => {
            await this.logout();
        });

        // Botão de configurações
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.location.href = 'configuracoes.html';
            });
        }

        // Botão de limpar histórico
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.clearAllHistory();
            });
        }

        // Botão de sincronização (se existir)
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<span class="material-icons-outlined animate-spin">sync</span>';
                
                await this.forceSyncChats();
                
                setTimeout(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = '<span class="material-icons-outlined">sync</span>';
                }, 2000);
            });
        }
    }

    showLoggedInUser(user) {
        const email = user.email;
        
        // Salvar sessão do usuário
        localStorage.setItem('userSession', JSON.stringify({
            email: email,
            id: user.id
        }));
        
        // Limpar histórico local ao fazer login
        localStorage.removeItem('lhama_chats');
        
        // Forçar atualização da UI
        this.elements.userHeader.classList.remove('hidden');
        this.elements.loginPrompt.classList.add('hidden');
        
        // Atualizar texto do email com delay
        setTimeout(() => {
            if (this.elements.userEmail) {
                this.elements.userEmail.textContent = email;
            }
        }, 100);
        
        console.log('✅ Usuário logado:', email);
        
        // Forçar refresh completo da interface
        setTimeout(() => {
            this.renderChatHistory();
        }, 200);
    }

    showGuestMode() {
        this.elements.userHeader.classList.add('hidden');
        this.elements.loginPrompt.classList.remove('hidden');
        
        // Verificar se é visitante
        if (localStorage.getItem('isGuest') === 'true') {
            console.log('👤 Modo visitante');
        } else {
            console.log('🔒 Usuário não logado');
        }
    }

    async logout() {
        if (!window.supabase) return;

        try {
            await window.supabase.auth.signOut();
            localStorage.removeItem('userSession');
            localStorage.setItem('isGuest', 'true');
            
            // Limpar chats do usuário
            this.clearUserChats();
            
            // Mostrar modo visitante
            this.showGuestMode();
            
            console.log('✅ Logout realizado');
        } catch (error) {
            console.error('❌ Erro no logout:', error);
        }
    }

    async loadUserChats() {
        if (!window.supabase) return;

        try {
            const { data: { user }, error: userError } = await window.supabase.auth.getUser();
            if (userError || !user) {
                console.error('❌ Erro ao obter usuário:', userError);
                return;
            }

            console.log('🔄 Carregando chats do usuário:', user.email);

            // Forçar reload completo do Supabase
            const { data: chats, error } = await window.supabase
                .from('chats')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('❌ Erro ao carregar chats:', error);
                return;
            }

            // Limpar completamente antes de carregar
            this.chats = [];
            this.currentChatId = null;

            // Converter chats do Supabase para o formato local
            if (chats && chats.length > 0) {
                this.chats = chats.map(chat => ({
                    id: chat.id,
                    title: chat.title,
                    messages: chat.messages || [],
                    updated: chat.updated_at
                }));
                
                // Não selecionar nenhum chat automaticamente
                // Apenas mostrar no sidebar
                this.renderChatHistory();
                
                console.log(`✅ ${chats.length} chats carregados do servidor`);
            } else {
                console.log('📝 Nenhum chat encontrado, criando lista vazia');
                this.renderChatHistory();
            }

        } catch (error) {
            console.error('❌ Erro ao carregar chats do usuário:', error);
            // Fallback para lista vazia
            this.chats = [];
            this.currentChatId = null;
            this.renderChatHistory();
        }
    }

    async saveChatToSupabase(chatId) {
        if (!window.supabase) return;

        try {
            const { data: { user }, error: userError } = await window.supabase.auth.getUser();
            if (userError || !user) {
                console.error('❌ Erro ao obter usuário para salvar chat:', userError);
                return;
            }

            const chat = this.chats.find(c => c.id === chatId);
            if (!chat) {
                console.error('❌ Chat não encontrado:', chatId);
                return;
            }

            const chatData = {
                id: chatId,
                user_id: user.id,
                title: chat.title,
                messages: chat.messages,
                updated_at: new Date().toISOString()
            };

            console.log('💾 Salvando chat no Supabase:', chatId);

            // Upsert (insert ou update)
            const { data, error } = await window.supabase
                .from('chats')
                .upsert(chatData, { onConflict: 'id' })
                .select();

            if (error) {
                console.error('❌ Erro ao salvar chat:', error);
                return;
            }

            console.log('✅ Chat salvo no Supabase:', chatId);

        } catch (error) {
            console.error('❌ Erro ao salvar chat no Supabase:', error);
        }
    }

    clearUserChats() {
        this.chats = [];
        this.currentChatId = null;
        
        // Limpar o container de mensagens
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }
        
        this.renderChatHistory();
    }

    // Sobrescrever saveCurrentChat para usar apenas Supabase
    saveCurrentChat() {
        // Não salvar mais localmente - apenas no Supabase
        if (!this.currentChatId) return;
        
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            chat.updated = new Date().toLocaleString('pt-BR');
        }

        // Salvar APENAS no Supabase se estiver logado (não for visitante)
        const isGuest = localStorage.getItem('isGuest') === 'true';
        if (!isGuest && window.supabase && localStorage.getItem('userSession')) {
            console.log('💾 Salvando chat atual no Supabase:', this.currentChatId);
            this.saveChatToSupabase(this.currentChatId);
        } else {
            console.log('📝 Chat não salvo (visitante ou sem sessão)');
        }
        
        // Não salvar mais no localStorage
        // this.saveChats(); // Removido
    }

    // Forçar sincronização completa dos chats
    async forceSyncChats() {
        if (!window.supabase) {
            console.error('❌ Supabase não disponível');
            return;
        }

        try {
            console.log('🔄 Forçando sincronização completa...');
            
            // Limpar tudo
            this.chats = [];
            this.currentChatId = null;
            localStorage.removeItem('lhama_chats');
            
            // Recarregar do Supabase
            await this.loadUserChats();
            
            console.log('✅ Sincronização completa concluída');
            
        } catch (error) {
            console.error('❌ Erro na sincronização forçada:', error);
        }
    }

    // Métodos para controlar posição do input
    moveInputDown() {
        const inputWrapper = document.getElementById('inputWrapper');
        if (inputWrapper) {
            inputWrapper.classList.remove('input-wrapper-center');
            inputWrapper.classList.add('input-wrapper-bottom');
        }
    }

    moveInputUp() {
        const inputWrapper = document.getElementById('inputWrapper');
        if (inputWrapper) {
            inputWrapper.classList.remove('input-wrapper-bottom');
            inputWrapper.classList.add('input-wrapper-center');
        }
    }

    showWelcomeScreen() {
        // Mostrar tela inicial com vídeo e texto
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.opacity = '1';
            this.elements.welcomeScreen.style.visibility = 'visible';
        }
        if (this.elements.titleSection) {
            this.elements.titleSection.style.opacity = '1';
        }
        if (this.elements.chatArea) {
            this.elements.chatArea.classList.add('hidden');
        }
        this.isTransitioned = false;
    }

    hideWelcomeScreen() {
        // Esconder tela inicial suavemente sem movimento
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.opacity = '0';
            setTimeout(() => {
                this.elements.welcomeScreen.style.visibility = 'hidden';
            }, 300);
        }
        if (this.elements.titleSection) {
            this.elements.titleSection.style.opacity = '0';
        }
        if (this.elements.chatArea) {
            this.elements.chatArea.classList.remove('hidden');
        }
        this.isTransitioned = true;
    }

    // MODO RE - Resolução de Exercícios
    async handleREMode(message) {
        console.log('🚀 Modo RE ativado para:', message);
        
        // Verificar se há anexos no modo RE
        let sendFiles = null;
        let attachmentsSnapshot = null;
        
        if (this.attachedFiles && this.attachedFiles.length > 0) {
            console.log('📎 [RE] Processando anexos no modo RE...');
            
            // Preparar arquivos para envio
            sendFiles = this.attachedFiles.map(f => {
                if (f && f.file instanceof File) {
                    return { name: f.name, file: f.file, type: f.type, mime: f.mime };
                }
                if (f && f.type === 'code') {
                    const mime = f.mime || 'text/plain';
                    const fileObj = new File([String(f.content || '')], f.name || `file_${Date.now()}.txt`, { type: mime });
                    return { name: f.name, file: fileObj, type: f.type, mime: f.mime };
                }
                if (f && f.type === 'image') {
                    const dataUrlToFile = (dataUrl, filename, mimeFallback = 'application/octet-stream') => {
                        const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
                        if (!m) {
                            return new File([String(dataUrl || '')], filename, { type: mimeFallback });
                        }
                        const mime = m[1] || mimeFallback;
                        const b64 = m[2] || '';
                        const binary = atob(b64);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        return new File([bytes], filename, { type: mime });
                    };
                    const fileObj = dataUrlToFile(f.content, f.name || `image_${Date.now()}.png`, f.mime || 'image/png');
                    return { name: f.name, file: fileObj, type: f.type, mime: f.mime };
                }
                return { name: f.name, file: new File([String(f.content || '')], f.name), type: f.type, mime: f.mime };
            });
            
            attachmentsSnapshot = this.attachedFiles.map(f => ({ 
                name: f.name, 
                mime: f.mime,
                type: f.type
            }));
        }
        
        // Adicionar mensagem do usuário
        this.addUserMessage(message, attachmentsSnapshot);
        
        // Mostrar processamento
        const processingId = this.addAssistantMessage('🧮 Resolvendo exercício...');
        
        try {
            // Gerar resposta com sistema especializado
            let response = await this.generateREResponse(message, sendFiles);
            
            // GARANTIR que TODAS as respostas RE tenham destaque amarelo
            if (!response.includes('re-final-answer')) {
                // Se a IA não incluiu o destaque, adicionar automaticamente
                const lines = response.split('\n');
                let finalAnswerLine = -1;
                
                // Procurar por linha que parece ser resposta final
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.includes('Resultado Final:') || 
                        line.includes('RESPOSTA FINAL:') ||
                        line.includes('Resposta:') ||
                        (line.match(/^\d+[\.\)]/) && line.includes('='))) {
                        finalAnswerLine = i;
                        break;
                    }
                }
                
                if (finalAnswerLine >= 0) {
                    // Adicionar destaque amarelo à resposta final
                    lines[finalAnswerLine] = `<div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> ${lines[finalAnswerLine].replace(/^.*?[:\)]\s*/, '')}</div>`;
                    response = lines.join('\n');
                } else {
                    // Se não encontrou linha clara, adicionar no final
                    response += `\n\n<div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> Verificar resposta acima</div>`;
                }
            }
            
            // Montar HTML final do RE:
            // - O corpo passa por formatResponse (para formatação + KaTeX)
            // - O card amarelo é HTML real (não pode passar pelo escape do formatResponse)
            const responseBodyHtml = this.formatResponse(response);

            let finalAnswerText = null;
            const rawLines = String(response || '').split(/\r?\n/);
            for (let i = rawLines.length - 1; i >= 0; i--) {
                const line = rawLines[i].trim();
                if (!line) continue;
                if (line.includes('Resultado Final:') || line.includes('RESPOSTA FINAL:')) {
                    finalAnswerText = line.replace(/^.*?:\s*/, '').trim();
                    break;
                }
            }
            if (!finalAnswerText) {
                // fallback simples: pega a última linha não vazia
                for (let i = rawLines.length - 1; i >= 0; i--) {
                    const line = rawLines[i].trim();
                    if (line) {
                        finalAnswerText = line;
                        break;
                    }
                }
            }

            const finalAnswerHtml = `<div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> ${this.escapeHtml(finalAnswerText || 'Verificar resposta acima')}</div>`;
            const finalHtml = `<div>${responseBodyHtml}${finalAnswerHtml}</div>`;

            // Atualizar com a resposta completa (como HTML)
            this.updateProcessingMessage(processingId, finalHtml);
            
        } catch (error) {
            console.error('❌ Erro no modo RE:', error);
            this.updateProcessingMessage(processingId, `❌ Erro ao processar exercício: ${error.message}`);
        }
        
        // Limpar anexos após envio
        this.attachedFiles = [];
        this.renderAttachedFiles();
    }
    
    // Gerar resposta no formato RE
    async generateREResponse(exercise, sendFiles = null) {
        const systemPrompt = `Você é um especialista acadêmico em resolução de exercícios com abordagem puramente técnica e objetiva.

REGRAS ESTRITAS PARA O MODO RE (RESOLUÇÃO DE EXERCÍCIOS):

1. ESTRUTURA OBRIGATÓRIA - USE EXATAMENTE ESTAS SEÇÕES:
   **Raciocínio Lógico:** [Explicação técnica direta da estratégia de resolução]
   
   **Passo a Passo (Memória de Cálculo):** [Todas as etapas detalhadas com cálculos explícitos]
   
   **Resultado Final:** [A resposta final destacada]
   
   **Justificativa:** [O fundamento técnico do resultado]

2. TOM E ESTILO:
   - Puramente utilitário e objetivo
   - Sem saudações, cumprimentos ou frases motivacionais
   - Foco exclusivo na resolução técnica

3. CÁLCULOS DETALHADOS:
   - Mostre as contas passo a passo (ex: 2+2=4, não apenas "o resultado é 4")
   - Use LaTeX extensivamente: $$\frac{a}{b}$$, $$\sqrt{x}$$, $$\int f(x)dx$$
   - Use \[ \] para blocos matemáticos e \( \) para inline

4. RESULTADO FINAL:
   - Coloque a resposta final dentro de um card amarelo destacado
   - Use HTML: <div class="re-final-answer"><strong>RESPOSTA FINAL:</strong> [valor]</div>
   - Esta é a resposta para "colocar no livro"

5. LATEX AVANÇADO:
   - Frações: \frac{numerador}{denominador}
   - Raízes: \sqrt{n} ou \sqrt[n]{x}
   - Integrais: \int_{a}^{b} f(x)dx
   - Somatórios: \sum_{i=1}^{n}
   - Limites: \lim_{x \to \infty}
   - Matrizes: \begin{pmatrix} a & b \\ c & d \end{pmatrix}

Exercício: ${exercise}`;

        // Escolher API baseado na presença de anexos
        if (sendFiles && sendFiles.length > 0) {
            console.log('📎 [RE] Usando Gemini com anexos...');
            const response = await this.agent.processMessage(exercise, sendFiles, systemPrompt);
            return response;
        } else {
            console.log('🧮 [RE] Usando Groq sem anexos...');
            const response = await this.callAPI(systemPrompt, exercise);
            return response;
        }
    }

    // Método auxiliar para chamadas de API
    async callAPI(systemPrompt, userMessage) {
        try {
            const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]);
            return response;
        } catch (error) {
            console.error('❌ Erro na chamada da API:', error);
            throw error;
        }
    }
}

console.log("Teste rápido no navegador: anexe até 3 arquivos de texto no chat e envie uma mensagem — quando houver anexos, o sistema tentará usar 'codestral-latest' via Groq.");
console.log("Teste via Node (recomendado): node code/test_codestral.js SUA_CHAVE_GROQ");

// Funções globais para o modo agente
window.selectTool = function(tool) {
    if (window.ui) {
        window.ui.selectTool(tool);
    }
};

window.deactivateCurrentFunction = function() {
    if (window.ui) {
        if (window.isAgentMode) {
            window.ui.deactivateAgentMode();
        } else if (window.isREMode) {
            // Desativar modo RE
            window.isREMode = false;
            window.ui.showNotification('🛑 Modo Resolução de Exercícios desativado', 'info');
            window.ui.resetCreateButtons();
        } else if (window.isInvestigateMode) {
            // Desativar modo Investigate
            window.isInvestigateMode = false;
            window.ui.showNotification('🛑 Modo Investigate desativado', 'info');
            window.ui.resetCreateButtons();
        } else if (window.isDocumentModeActive) {
            window.ui.selectCreateType('document');
        } else if (window.isSlidesModeActive) {
            window.ui.selectCreateType('slides');
        }
        
        // Esconder botão de desativação
        const btn = document.getElementById('deactivateFunctionBtn');
        if (btn) btn.classList.add('hidden');
        
        // Atualizar botão principal
        window.ui.updateCreateButton();
    }
};

window.updateDeactivateButton = function() {
    const btn = document.getElementById('deactivateFunctionBtn');
    if (btn) {
        let shouldShow = false;
        let buttonText = 'DESATIVAR FUNÇÃO';
        let buttonDesc = 'Parar funcionalidade atual';
        
        if (window.isAgentMode) {
            shouldShow = true;
            buttonText = 'DESATIVAR AGENTE';
            buttonDesc = 'Parar Drekee Agent 1.0';
        } else if (window.isREMode) {
            shouldShow = true;
            buttonText = 'DESATIVAR RE';
            buttonDesc = 'Parar Resolução de Exercícios';
        } else if (window.isInvestigateMode) {
            shouldShow = true;
            buttonText = 'DESATIVAR INVESTIGATE';
            buttonDesc = 'Parar investigação profunda';
        } else if (window.isDocumentModeActive || window.isSlidesModeActive) {
            shouldShow = true;
            buttonText = 'DESATIVAR CRIAÇÃO';
            buttonDesc = 'Parar criação de conteúdo';
        }
        
        if (shouldShow) {
            btn.classList.remove('hidden');
            btn.querySelector('.font-medium').textContent = buttonText;
            btn.querySelector('.text-xs').textContent = buttonDesc;
        } else {
            btn.classList.add('hidden');
        }
    }
};

// Inicialização do app
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});



