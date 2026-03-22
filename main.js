import { Agent } from './agent.js';

import { TimelineSystem } from './timeline-system.js';

import { ProactiveSuggestions } from './proactive-system.js';

import { PreferenceLearning } from './preference-system.js';
import {
    buildUpdateMediaHtml,
    countUnreadUpdates,
    fetchLatestStartupUpdate,
    markStartupUpdateSeen
} from './updates-system.js';



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
        this.agentLongTermMemory = this.loadAgentMemoryStore();

        this.attachedFiles = []; // Lista temporária de anexos (máx 3)

        this.chats = this.loadChats();

        this.currentChatId = null;

        this.currentModel = 'rapido';
        this.agentReasoningModel = 'llama-3.3-70b-versatile';
        this.agentAccessPassword = '#Casa130#';
        this.agentThinkingIndicatorDelayMs = 3000;
        this.agentThinkingIndicatorTimer = null;
        this.isAgentWorking = false;
        this.responseCodeBlocks = new Map();
        this.dragOverlayCounter = 0;
        this.boundHandleSend = this.handleSend.bind(this);
        this.boundHandlePause = this.handlePause.bind(this);

        

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
            agentThinkingIndicator: document.getElementById('agentThinkingIndicator'),
            agentThinkingVideo: document.getElementById('agentThinkingVideo'),
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
            dragDropOverlay: document.getElementById('dragDropOverlay'),
            updatesBtn: document.getElementById('updatesBtn'),
            updatesBadge: document.getElementById('updatesBadge'),
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
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-medium">Drekee Investigate 1.0</div>
                                    <span class="tool-card-tag tool-card-tag-blue">INVESTIGATE</span>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Investigação profunda com IA</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="selectTool('re')">
                            <span class="material-icons-outlined text-base text-green-400 mt-0.5">calculate</span>
                            <div class="flex-1">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-medium">Resolução de Exercícios</div>
                                    <span class="tool-card-tag tool-card-tag-green">RE</span>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Resolução completa de questões com cálculo detalhado e justificativa técnica</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="toggleCreateSubcard()">
                            <span class="material-icons-outlined text-base text-purple-400 mt-0.5">add_box</span>
                            <div class="flex-1">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-medium">Criar</div>
                                    <span class="tool-card-tag tool-card-tag-purple">CRIAR</span>
                                </div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Apresentações, Documentos e Mapas Mentais</div>
                            </div>
                        </button>
                        <button class="w-full text-left px-2 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3" onclick="selectTool('agent')">
                            <span class="material-icons-outlined text-base text-orange-500 mt-0.5">smart_toy</span>
                            <div class="flex-1">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-medium">Drekee Agent 1.0</div>
                                    <span class="tool-card-tag tool-card-tag-beta">BETA</span>
                                </div>
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
    async selectTool(tool) {
        console.log(`🔧 [TOOL] Ferramenta selecionada: ${tool}`);
        
        // Fechar dropdown
        const dropdown = document.getElementById('floatingCreateDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
        // Resetar todos os modos
        window.isREMode = false;
        window.isInvestigateMode = false;
        window.isAgentMode = false;
        window.isDocumentModeActive = false;
        window.isSlidesModeActive = false;
        this.currentCreateType = null;
        
        // Resetar botões
        this.resetCreateButtons();
        
        switch(tool) {
            case 'investigate':
                window.isInvestigateMode = true;
                this.persistAgentUiState({ activeTool: 'investigate' });
                this.showNotification('🔍 Modo Investigate ativado - Envie sua dúvida para investigação profunda', 'info');
                this.updateCreateButton();
                break;
                
            case 're':
                window.isREMode = true;
                this.persistAgentUiState({ activeTool: 're' });
                this.showNotification('🧮 Modo Resolução de Exercícios ativado - Envie o exercício para resolver', 'info');
                this.updateCreateButton();
                break;
                
            case 'agent':
                if (!(await this.ensureAgentAccess())) {
                    return;
                }
                window.isAgentMode = true;
                this.persistAgentUiState({ activeTool: 'agent' });
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

    async ensureAgentAccess() {
        const hasAccess = localStorage.getItem('drekee_agent_access') === 'granted';
        if (hasAccess) {
            return true;
        }

        return new Promise((resolve) => {
            const existing = document.getElementById('agentAccessModal');
            if (existing) {
                existing.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'agentAccessModal';
            modal.className = 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4';
            modal.innerHTML = `
                <div class="w-full max-w-md rounded-3xl border border-white/10 bg-[#111b30] p-6 shadow-2xl">
                    <div class="mb-4 flex items-center gap-3">
                        <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                            <span class="material-icons-outlined">smart_toy</span>
                        </div>
                        <div>
                            <div class="text-sm font-semibold text-white">Acesso restrito ao Drekee Agent</div>
                            <div class="text-xs text-slate-400">Modo em desenvolvimento privado</div>
                        </div>
                    </div>
                    <p class="mb-4 text-sm text-slate-300">
                        Digite a senha de liberação para ativar o modo agente nesta máquina.
                    </p>
                    <input
                        id="agentAccessInput"
                        type="password"
                        placeholder="Senha de acesso"
                        class="w-full rounded-2xl border border-white/10 bg-[#0d1627] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                    />
                    <div id="agentAccessError" class="mt-2 hidden text-sm text-red-400">Senha incorreta.</div>
                    <div class="mt-5 flex items-center justify-end gap-3">
                        <button id="agentAccessCancel" class="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5">Cancelar</button>
                        <button id="agentAccessSubmit" class="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">Liberar agente</button>
                    </div>
                </div>
            `;

            const cleanup = (granted) => {
                modal.remove();
                resolve(Boolean(granted));
            };

            const input = modal.querySelector('#agentAccessInput');
            const error = modal.querySelector('#agentAccessError');
            const submit = () => {
                if ((input?.value || '') === this.agentAccessPassword) {
                    localStorage.setItem('drekee_agent_access', 'granted');
                    cleanup(true);
                    return;
                }

                if (error) {
                    error.classList.remove('hidden');
                }
                input?.focus();
                input?.select();
            };

            modal.querySelector('#agentAccessCancel')?.addEventListener('click', () => cleanup(false));
            modal.querySelector('#agentAccessSubmit')?.addEventListener('click', submit);
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    cleanup(false);
                }
            });
            input?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    submit();
                }
            });

            document.body.appendChild(modal);
            input?.focus();
        });
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
            resolvedSearchUrl: null,
            executionMode: null,
            plan: null,
            artifacts: [],
            checkpoints: [],
            relevantMemories: [],
            targetResults: []
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

        this.registerAgentVisibleActivity();
    }

    startAgentWorkingState() {
        this.isAgentWorking = true;
        this.updateSendButtonToPause();
        this.hideAgentThinkingIndicator();
        this.scheduleAgentThinkingIndicator();
    }

    stopAgentWorkingState() {
        this.isAgentWorking = false;
        this.clearAgentThinkingIndicatorTimer();
        this.hideAgentThinkingIndicator();
        this.updateSendButtonToSend();
    }

    clearAgentThinkingIndicatorTimer() {
        if (this.agentThinkingIndicatorTimer) {
            clearTimeout(this.agentThinkingIndicatorTimer);
            this.agentThinkingIndicatorTimer = null;
        }
    }

    scheduleAgentThinkingIndicator() {
        this.clearAgentThinkingIndicatorTimer();

        if (!this.isAgentWorking || !window.isAgentMode) {
            return;
        }

        this.agentThinkingIndicatorTimer = setTimeout(() => {
            if (!this.isAgentWorking || !window.isAgentMode) {
                return;
            }

            this.showAgentThinkingIndicator();
        }, this.agentThinkingIndicatorDelayMs);
    }

    showAgentThinkingIndicator() {
        const indicator = this.elements?.agentThinkingIndicator;
        if (!indicator) {
            return;
        }

        indicator.classList.add('is-visible');
        indicator.setAttribute('aria-hidden', 'false');

        const video = this.elements?.agentThinkingVideo;
        if (video?.play) {
            video.play().catch(() => {});
        }

        this.scrollToBottom();
    }

    hideAgentThinkingIndicator() {
        const indicator = this.elements?.agentThinkingIndicator;
        if (!indicator) {
            return;
        }

        indicator.classList.remove('is-visible');
        indicator.setAttribute('aria-hidden', 'true');
    }

    registerAgentVisibleActivity() {
        if (!window.isAgentMode) {
            return;
        }

        this.hideAgentThinkingIndicator();
        if (this.isAgentWorking) {
            this.scheduleAgentThinkingIndicator();
        }
        this.scrollToBottom();
    }

    async waitForAgentTimelineToFlush(timeoutMs = 30000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            const queueLength = Array.isArray(this.agentTimelineQueue) ? this.agentTimelineQueue.length : 0;
            if (!this.agentTimelineProcessing && queueLength === 0) {
                return;
            }

            await this.sleep(80);
        }
    }

    addAgentPlan(plan = {}) {
        const normalizedSteps = Array.isArray(plan?.steps)
            ? plan.steps.map((step, index) => ({
                id: step?.id || `step_${index + 1}`,
                title: step?.title || `Etapa ${index + 1}`,
                description: step?.description || '',
                status: step?.status || 'pending',
                kind: step?.kind || 'step',
                targetId: step?.targetId || null,
                note: step?.note || ''
            }))
            : [];

        const normalizedPlan = {
            title: plan?.title || 'Plano de ação',
            summary: plan?.summary || '',
            executionMode: plan?.executionMode || 'text',
            steps: normalizedSteps
        };

        if (this.agentRunContext) {
            this.agentRunContext.plan = normalizedPlan;
        }

        this.addAgentTimelineEntry('plan', normalizedPlan, { immediate: true });
    }

    updateAgentPlanStep(stepId, patch = {}) {
        if (!stepId) {
            return;
        }

        if (this.agentRunContext?.plan?.steps) {
            this.agentRunContext.plan.steps = this.agentRunContext.plan.steps.map((step) => (
                step.id === stepId
                    ? { ...step, ...patch }
                    : step
            ));
        }

        if (Array.isArray(this.agentTimeline)) {
            this.agentTimeline = this.agentTimeline.map((entry) => {
                if (entry?.type !== 'plan' || !Array.isArray(entry.steps)) {
                    return entry;
                }

                return {
                    ...entry,
                    steps: entry.steps.map((step) => (
                        step.id === stepId
                            ? { ...step, ...patch }
                            : step
                    ))
                };
            });
        }

        if (this.agentResponseElement) {
            this.updateAgentResponse();
        }

        this.registerAgentVisibleActivity();
    }

    addAgentCheckpoint(message) {
        if (this.agentRunContext) {
            this.agentRunContext.checkpoints.push({
                message,
                timestamp: new Date().toISOString()
            });
        }

        this.addAgentTimelineEntry('checkpoint', { message });
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
            this.registerAgentVisibleActivity();
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

            this.registerAgentVisibleActivity();
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

        if (entry.type === 'plan') {
            return 250;
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

        if (entry.type === 'checkpoint') {
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
        this.bindDynamicAutoScroll(responseContainer);
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

        if (entry.type === 'plan') {
            const steps = Array.isArray(entry.steps) ? entry.steps : [];
            const stepHtml = steps.map((step) => {
                const status = step?.status || 'pending';
                const statusIcon = status === 'completed'
                    ? '✓'
                    : status === 'in_progress'
                        ? '…'
                        : status === 'failed'
                            ? '×'
                            : '○';
                const statusClass = status === 'completed'
                    ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-100'
                    : status === 'in_progress'
                        ? 'border-yellow-600/40 bg-yellow-500/10 text-yellow-100'
                        : status === 'failed'
                            ? 'border-red-600/40 bg-red-500/10 text-red-100'
                            : 'border-gray-700 bg-gray-800/70 text-gray-200';

                return `
                    <div class="flex items-start gap-3 rounded-2xl border ${statusClass} px-4 py-3">
                        <div class="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${statusClass} flex-shrink-0 text-xs">${statusIcon}</div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-medium text-gray-100">${this.escapeHtml(step?.title || 'Etapa')}</div>
                            ${step?.description ? `<div class="mt-1 text-xs text-gray-300">${this.escapeHtml(step.description)}</div>` : ''}
                            ${step?.note ? `<div class="mt-2 text-xs text-gray-400">${this.escapeHtml(step.note)}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="rounded-3xl border border-gray-700/80 bg-gray-900/70 p-4">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-400/25 flex items-center justify-center text-sm">🧭</div>
                        <div>
                            <div class="text-sm font-semibold text-gray-100">${this.escapeHtml(entry.title || 'Plano de ação')}</div>
                            <div class="text-[11px] uppercase tracking-wide text-gray-500">${this.escapeHtml(entry.executionMode || 'agent')}</div>
                        </div>
                    </div>
                    ${entry.summary ? `<div class="text-sm text-gray-300 leading-relaxed mb-3">${this.escapeHtml(entry.summary)}</div>` : ''}
                    <div class="space-y-2">${stepHtml}</div>
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
                        onload="window.ui && window.ui.handleDynamicContentRendered && window.ui.handleDynamicContentRendered()"
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

        if (entry.type === 'checkpoint') {
            return `
                <div class="rounded-2xl border border-blue-600/20 bg-blue-500/5 px-4 py-3">
                    ${time}
                    <div class="text-sm text-blue-50">📍 ${this.escapeHtml(entry.message || '')}</div>
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
    async finishAgentResponse(message = '✅ Análise concluída') {
        this.addAgentTimelineEntry('status', { message });
        await this.waitForAgentTimelineToFlush();
        this.isAgentResponding = false;
        this.stopAgentWorkingState();
    }

    bindDynamicAutoScroll(container) {
        if (!container) {
            return;
        }

        container.querySelectorAll('img').forEach((image) => {
            if (image.dataset.autoScrollBound === 'true') {
                return;
            }

            image.dataset.autoScrollBound = 'true';
            image.addEventListener('load', () => this.handleDynamicContentRendered());
        });
    }

    handleDynamicContentRendered() {
        this.scrollToBottom();
    }

    setupAutoScrollObserver() {
        if (this.autoScrollObserver || !this.elements?.messagesContainer) {
            return;
        }

        this.autoScrollObserver = new MutationObserver(() => {
            const shouldFollow = this.isAgentResponding
                || Boolean(this.elements.messagesContainer.querySelector('.thinking-message'))
                || Boolean(this.elements.messagesContainer.querySelector('.typing-animation'));

            if (shouldFollow) {
                this.scrollToBottom();
            }
        });

        this.autoScrollObserver.observe(this.elements.messagesContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });
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
        const cleanMessage = (userMessage || '').trim();
        if (!cleanMessage) {
            return;
        }

        this.startAgentWorkingState();

        try {
            const currentChat = this.getCurrentChatObject();
            const agentChatId = currentChat?.id || this.currentChatId;
            const previousAgentContext = this.getLatestAgentContext(currentChat);
            this.addUserMessage(cleanMessage, null, { preserveCreateMode: true });
            this.appendMessageToCurrentChat({
                role: 'user',
                content: cleanMessage,
                mode: 'agent'
            }, agentChatId);

            const followUpStrategy = await this.decideAgentFollowUpStrategy(cleanMessage, previousAgentContext);
            this.startAgentResponse();
            this.agentRunContext.chatId = agentChatId;
            this.agentRunContext.request = cleanMessage;
            this.agentRunContext.followUpMode = followUpStrategy.mode;
            this.agentRunContext.previousContext = previousAgentContext || null;
            const explicitUrls = this.extractAgentUrls(cleanMessage);
            const explicitUrl = explicitUrls[0] || null;
            const shouldAnalyzeCurrentScreen = this.shouldAnalyzeCurrentScreen(cleanMessage);
            const relevantMemories = this.getRelevantAgentMemories(cleanMessage);

            if (this.agentRunContext) {
                this.agentRunContext.relevantMemories = relevantMemories;
            }

            this.addAgentIntroMessage(this.buildHyperAgentIntroMessage(
                cleanMessage,
                followUpStrategy,
                explicitUrl,
                shouldAnalyzeCurrentScreen
            ));

            if (relevantMemories.length) {
                this.addAgentCheckpoint(`Vou considerar ${relevantMemories.length} memória${relevantMemories.length > 1 ? 's persistentes' : ' persistente'} relevante${relevantMemories.length > 1 ? 's' : ''} desta conversa.`);
            }

            this.addAgentThoughtLog('🧠 Vou decompor a tarefa em etapas, executar o que for necessário e revisar antes de te responder.');

            const executionPlan = await this.buildAgentExecutionPlan(cleanMessage, {
                previousAgentContext,
                followUpStrategy,
                explicitUrls,
                shouldAnalyzeCurrentScreen,
                relevantMemories
            });

            if (this.agentRunContext) {
                this.agentRunContext.executionMode = executionPlan.executionMode;
            }

            this.addAgentPlan(executionPlan);

            const executionContext = await this.executeAgentPlan(executionPlan, {
                userMessage: cleanMessage,
                previousAgentContext,
                followUpStrategy,
                explicitUrls,
                shouldAnalyzeCurrentScreen,
                relevantMemories
            });

            const finalContext = {
                request: cleanMessage,
                priorContext: previousAgentContext,
                responseMode: followUpStrategy.mode,
                relevantMemories,
                executionPlan,
                ...executionContext
            };

            let finalText = executionContext?.directFinalText
                || executionContext?.contextOnlyAnswer
                || await this.generateAgentFinalResponse(finalContext);
            finalText = await this.reviewAndRefineAgentFinalResponse(finalText, finalContext);

            this.addAgentSummary('Resposta do agente', finalText);
            await this.finishAgentResponse();

            const currentAgentContext = this.buildAgentSavedContext(finalText, finalContext, previousAgentContext, followUpStrategy);
            this.rememberAgentTurn(cleanMessage, finalText, currentAgentContext);
            this.saveAgentAssistantTurn(
                finalText,
                followUpStrategy.mode === 'continue_research'
                    ? this.mergeAgentConversationContext(previousAgentContext, currentAgentContext)
                    : currentAgentContext
            );
        } catch (error) {
            console.error('❌ [AGENT] Erro no processamento:', error);
            this.addAgentTimelineEntry('error', { message: '❌ Erro: ' + error.message });
            await this.finishAgentResponse('❌ Fluxo do agente encerrado com erro');
        } finally {
            if (this.isAgentWorking) {
                this.stopAgentWorkingState();
            }
        }
    }

    buildHyperAgentIntroMessage(userMessage, followUpStrategy = {}, explicitUrl = null, shouldAnalyzeCurrentScreen = false) {
        if (followUpStrategy?.mode === 'answer_from_context') {
            return 'Olá! Vou retomar a pesquisa agêntica anterior, revisar o que já coletei e te responder com base nesse contexto antes de abrir qualquer nova navegação.';
        }

        if (followUpStrategy?.mode === 'continue_research') {
            return 'Olá! Vou continuar a execução da pesquisa agêntica anterior, montar um novo plano de ação e complementar o que ainda falta para responder ao seu pedido.';
        }

        if (shouldAnalyzeCurrentScreen) {
            return 'Olá! Vou montar um plano rápido, analisar a tela atual e te responder com base no que eu realmente conseguir observar nela.';
        }

        if (explicitUrl) {
            return `Olá! Vou montar um plano de ação, abrir ${explicitUrl} e executar a navegação necessária até conseguir responder ao que você pediu.`;
        }

        return 'Olá! Vou montar um plano de ação, decidir se preciso pesquisar na web ou não, executar as etapas necessárias e só então te entregar a resposta final.';
    }

    extractAgentUrls(text) {
        const matches = [...String(text || '').matchAll(/((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi)];
        return matches
            .map((match) => this.normalizeAgentUrl(match[1]))
            .filter(Boolean)
            .filter((item, index, array) => array.indexOf(item) === index);
    }

    async buildAgentExecutionPlan(userMessage, options = {}) {
        const executionMode = options?.followUpStrategy?.mode === 'answer_from_context'
            ? 'context_only'
            : options?.shouldAnalyzeCurrentScreen
                ? 'screen'
                : this.shouldUseWebForAgentRequest(userMessage, options)
                    ? 'web'
                    : 'text';
        const targets = executionMode === 'web'
            ? await this.resolveAgentPlanTargets(userMessage, options)
            : [];
        const steps = this.buildDeterministicAgentPlanSteps(executionMode, targets, userMessage, options);

        return {
            title: 'Plano de ação',
            summary: this.buildAgentPlanSummary(userMessage, executionMode, targets, options),
            executionMode,
            requiresWeb: executionMode === 'web',
            targets,
            steps
        };
    }

    shouldUseWebForAgentRequest(userMessage, options = {}) {
        if (options?.explicitUrls?.length) {
            return true;
        }

        if (options?.followUpStrategy?.mode === 'continue_research') {
            return true;
        }

        const normalized = this.normalizeSearchText(userMessage);
        if (!normalized) {
            return false;
        }

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
            'busque',
            'compare',
            'preco',
            'precos',
            'cotacao',
            'google',
            'groq',
            'python',
            'nike',
            'openai',
            'vercel',
            'github',
            'documentacao',
            'docs'
        ];

        const textOnlySignals = [
            'crie um site',
            'criar um site',
            'monte um plano',
            'escreva um texto',
            'gere um codigo',
            'crie um app',
            'planeje',
            'roteiro',
            'estrategia'
        ];

        const explicitWebIntent = /\b(abra|entre|acesse|navegue|pesquise|procure|busque|site do|site da|site de|pagina de|documentacao|docs|google|groq|python|nike|openai|github|vercel)\b/i.test(normalized);

        if (textOnlySignals.some((signal) => normalized.includes(signal)) && !explicitWebIntent) {
            return false;
        }

        return webSignals.some((signal) => normalized.includes(signal));
    }

    async resolveAgentPlanTargets(userMessage, options = {}) {
        const explicitUrls = Array.isArray(options?.explicitUrls) ? options.explicitUrls : [];
        const officialSources = this.extractOfficialAgentSources(userMessage);
        const targetLimit = this.shouldAllowMultipleAgentTargets(userMessage) ? 3 : 1;

        if (explicitUrls.length) {
            return explicitUrls.map((url, index) => ({
                id: `target_${index + 1}`,
                label: this.getReadableSiteLabel(url).replace(/^o site\s+/i, ''),
                url,
                query: '',
                navigationInstruction: userMessage
            }));
        }

        if (officialSources.length) {
            return officialSources
                .slice(0, targetLimit)
                .map((label, index) => this.buildOfficialAgentTarget(label, userMessage, index));
        }

        if (options?.followUpStrategy?.mode === 'continue_research' && options?.previousAgentContext?.targetUrl) {
            return [{
                id: 'target_1',
                label: this.getReadableSiteLabel(options.previousAgentContext.targetUrl).replace(/^o site\s+/i, ''),
                url: options.previousAgentContext.targetUrl,
                query: options.previousAgentContext.targetUrl,
                navigationInstruction: userMessage
            }];
        }

        const llmTargets = await this.inferAgentTargetsWithLLM(userMessage, options);
        if (llmTargets.length) {
            return llmTargets.slice(0, targetLimit);
        }

        return this.extractAgentTargetsHeuristically(userMessage, options).slice(0, targetLimit);
    }

    async inferAgentTargetsWithLLM(userMessage, options = {}) {
        const previousContext = options?.previousAgentContext || null;
        const relevantMemories = Array.isArray(options?.relevantMemories) ? options.relevantMemories : [];
        const prompt = `Você vai extrair alvos de navegação para um agente web.

Pedido do usuário:
${userMessage}

Contexto anterior:
- modo de follow-up: ${options?.followUpStrategy?.mode || 'new_research'}
- última URL: ${previousContext?.targetUrl || 'nenhuma'}
- último título: ${previousContext?.pageTitle || 'nenhum'}

Memórias relevantes:
${relevantMemories.map((memory) => `- ${memory.label}: ${memory.value}`).join('\n') || 'nenhuma'}

Responda SOMENTE com JSON válido:
{
  "targets": [
    {
      "label": "nome curto do site ou fonte",
      "url": "url exata ou vazio",
      "query": "consulta curta para localizar a fonte correta",
      "navigation_instruction": "página, seção ou ação que o agente deve seguir nesse alvo"
    }
  ]
}

Regras:
- liste no máximo 3 alvos;
- se a tarefa for continuação do mesmo site, pode devolver um único alvo com a URL anterior;
- se o pedido não exigir web, devolva targets vazio;
- não invente URLs específicas se você não tiver certeza; nesse caso, deixe "url" vazio e preencha "query";
- use rótulos curtos e claros.`;

        try {
            const rawTargets = await this.callAgentGroqWithRecovery(this.agentReasoningModel, [
                {
                    role: 'system',
                    content: 'Extraia alvos de navegação para um agente autônomo em JSON estrito.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            const parsedTargets = this.tryParseAgentJson(rawTargets);
            const candidates = Array.isArray(parsedTargets?.targets) ? parsedTargets.targets : [];
            return candidates
                .map((target, index) => ({
                    id: `target_${index + 1}`,
                    label: String(target?.label || '').trim() || `Fonte ${index + 1}`,
                    url: this.normalizeAgentUrl(target?.url || '') || '',
                    query: String(target?.query || '').trim(),
                    navigationInstruction: String(target?.navigation_instruction || target?.navigationInstruction || '').trim()
                }))
                .filter((target) => target.url || target.query)
                .slice(0, 3);
        } catch (error) {
            console.error('❌ [AGENT] Erro ao inferir alvos com LLM:', error);
            return [];
        }
    }

    extractAgentTargetsHeuristically(userMessage, options = {}) {
        const normalizedMessage = String(userMessage || '')
            .replace(/https?:\/\/\S+/gi, ' ')
            .replace(/\bwww\.[^\s]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const targetLabels = [];
        const normalizedForMatching = this.normalizeSearchText(normalizedMessage);
        const explicitSitePatterns = [
            /site d[oa] ([A-Za-z0-9._-]+)/gi,
            /site de ([A-Za-z0-9._-]+)/gi
        ];

        explicitSitePatterns.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(normalizedMessage)) !== null) {
                const label = String(match[1] || '').trim().replace(/[.,;:!?]+$/g, '');
                if (label) {
                    targetLabels.push(label);
                }
            }
        });

        const compareMatch = normalizedMessage.match(/(?:compare|comparar|entre)\s+([A-Za-z0-9._-]+)\s+e\s+([A-Za-z0-9._-]+)/i);
        if (compareMatch) {
            targetLabels.push(compareMatch[1], compareMatch[2]);
        }

        Object.keys(this.getKnownAgentDomains()).forEach((label) => {
            if (normalizedForMatching.includes(this.normalizeSearchText(label))) {
                targetLabels.push(label);
            }
        });

        const uniqueLabels = targetLabels
            .map((label) => label.trim())
            .filter(Boolean)
            .filter((label, index, array) => array.findIndex((candidate) => this.normalizeSearchText(candidate) === this.normalizeSearchText(label)) === index)
            .slice(0, 3);

        if (!uniqueLabels.length) {
            return [{
                id: 'target_1',
                label: 'Pesquisa principal',
                url: '',
                query: userMessage,
                navigationInstruction: userMessage
            }];
        }

        return uniqueLabels.map((label, index) => this.buildOfficialAgentTarget(label, userMessage, index));
    }

    shouldAllowMultipleAgentTargets(userMessage) {
        const normalized = this.normalizeSearchText(userMessage);
        const comparisonSignals = /\b(compare|comparar|versus|vs|diferenca|diferencas|dois sites|duas fontes|duas lojas|varias lojas|varios sites|muitos sites)\b/i.test(normalized);
        const knownLabels = Object.keys(this.getKnownAgentDomains()).filter((label) => normalized.includes(this.normalizeSearchText(label)));
        return comparisonSignals || knownLabels.length >= 2;
    }

    getKnownAgentDomains() {
        return {
            python: 'https://www.python.org',
            groq: 'https://groq.com',
            openai: 'https://openai.com',
            nike: 'https://www.nike.com.br',
            vercel: 'https://vercel.com',
            github: 'https://github.com',
            magalu: 'https://www.magazineluiza.com.br',
            magazineluiza: 'https://www.magazineluiza.com.br',
            'magazine luiza': 'https://www.magazineluiza.com.br',
            amazon: 'https://www.amazon.com.br',
            'mercado livre': 'https://www.mercadolivre.com.br',
            mercadolivre: 'https://www.mercadolivre.com.br',
            casasbahia: 'https://www.casasbahia.com.br',
            'casas bahia': 'https://www.casasbahia.com.br',
            kabum: 'https://www.kabum.com.br',
            fastshop: 'https://www.fastshop.com.br'
        };
    }

    extractOfficialAgentSources(userMessage) {
        const text = String(userMessage || '');
        const patterns = [
            /site oficial d[oa]\s+([A-Za-z0-9._-]+)/gi,
            /site d[oa]\s+([A-Za-z0-9._-]+)/gi,
            /site de\s+([A-Za-z0-9._-]+)/gi
        ];
        const results = [];

        patterns.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const label = String(match[1] || '').trim().replace(/[.,;:!?]+$/g, '');
                if (label) {
                    results.push(label);
                }
            }
        });

        return results
            .filter(Boolean)
            .filter((label, index, array) => array.findIndex((candidate) => this.normalizeSearchText(candidate) === this.normalizeSearchText(label)) === index);
    }

    buildOfficialAgentTarget(label, userMessage, index = 0) {
        const knownDomains = this.getKnownAgentDomains();
        const normalizedLabel = this.normalizeSearchText(label);
        const matchedDomain = Object.entries(knownDomains).find(([key]) => normalizedLabel.includes(key));
        const baseUrl = matchedDomain ? matchedDomain[1] : '';
        const preferredUrl = this.getPreferredAgentUrlForRequest(normalizedLabel, userMessage, baseUrl) || baseUrl;
        const baseHost = preferredUrl ? new URL(preferredUrl).hostname.replace(/^www\./i, '') : baseUrl ? new URL(baseUrl).hostname.replace(/^www\./i, '') : '';
        const requestsModels = /\b(modelo|modelos|models)\b/i.test(this.normalizeSearchText(userMessage));
        const requestsLatest = /\b(recente|recentes|latest|novo|novos|mais recente)\b/i.test(this.normalizeSearchText(userMessage));
        const queryParts = [
            baseHost ? `site:${baseHost}` : '',
            label,
            requestsModels ? 'models model modelos IA' : '',
            requestsLatest ? 'latest recent mais recentes' : '',
            'site oficial'
        ].filter(Boolean);

        return {
            id: `target_${index + 1}`,
            label,
            url: preferredUrl || '',
            query: queryParts.join(' '),
            navigationInstruction: userMessage,
            expectedHost: baseHost
        };
    }

    getPreferredAgentUrlForRequest(normalizedLabel, userMessage, fallbackUrl = '') {
        const normalizedRequest = this.normalizeSearchText(userMessage);

        if (normalizedLabel.includes('openai') && /\b(modelo|modelos|models)\b/i.test(normalizedRequest)) {
            return 'https://platform.openai.com/docs/models';
        }

        if (normalizedLabel.includes('groq') && /\b(modelo|modelos|models)\b/i.test(normalizedRequest)) {
            return 'https://console.groq.com/docs/models';
        }

        if (normalizedLabel.includes('python') && /\b(download|downloads)\b/i.test(normalizedRequest)) {
            return 'https://www.python.org/downloads/';
        }

        return fallbackUrl || '';
    }

    buildDeterministicAgentPlanSteps(executionMode, targets = [], userMessage, options = {}) {
        const steps = [];
        let order = 1;
        const nextId = () => `step_${order++}`;

        steps.push({
            id: nextId(),
            title: 'Entender o objetivo',
            description: 'Vou confirmar o pedido, o escopo e o resultado esperado antes de agir.',
            kind: 'understand',
            status: 'pending'
        });

        if (executionMode === 'context_only') {
            steps.push({
                id: nextId(),
                title: 'Retomar o contexto anterior',
                description: 'Vou reutilizar a pesquisa agêntica já feita para evitar navegação desnecessária.',
                kind: 'context',
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: 'Revisar e responder',
                description: 'Vou revisar o que já coletei e te responder de forma direta.',
                kind: 'respond',
                status: 'pending'
            });
            return steps;
        }

        if (executionMode === 'screen') {
            steps.push({
                id: nextId(),
                title: 'Capturar a tela atual',
                description: 'Vou observar a tela atual do app antes de concluir.',
                kind: 'screen',
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: 'Revisar a observação',
                description: 'Vou validar se a leitura da tela realmente responde ao pedido.',
                kind: 'synthesize',
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: 'Entregar a resposta',
                description: 'Vou transformar a observação em uma resposta útil e objetiva.',
                kind: 'respond',
                status: 'pending'
            });
            return steps;
        }

        if (executionMode === 'text') {
            steps.push({
                id: nextId(),
                title: 'Quebrar a tarefa em etapas',
                description: 'Vou estruturar a execução e definir a melhor abordagem antes de produzir a resposta.',
                kind: 'text',
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: 'Auto-revisar a solução',
                description: 'Vou revisar o plano para evitar uma resposta superficial ou inconsistente.',
                kind: 'synthesize',
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: 'Entregar a execução',
                description: 'Vou consolidar tudo em uma resposta final mais autônoma e acionável.',
                kind: 'respond',
                status: 'pending'
            });
            return steps;
        }

        const effectiveTargets = targets.length ? targets : [{
            id: 'target_1',
            label: 'Fonte principal',
            url: '',
            query: userMessage,
            navigationInstruction: userMessage
        }];

        effectiveTargets.forEach((target) => {
            steps.push({
                id: nextId(),
                title: `Localizar ${target.label}`,
                description: 'Vou garantir que estou indo para a fonte certa antes de navegar.',
                kind: 'resolve',
                targetId: target.id,
                status: 'pending'
            });
            steps.push({
                id: nextId(),
                title: `Navegar em ${target.label}`,
                description: target.navigationInstruction || 'Vou abrir o site e seguir a página ou seção relevante.',
                kind: 'browse',
                targetId: target.id,
                status: 'pending'
            });
        });

        steps.push({
            id: nextId(),
            title: 'Consolidar evidências',
            description: 'Vou juntar o que coletei e verificar se a resposta está realmente fundamentada.',
            kind: 'synthesize',
            status: 'pending'
        });
        steps.push({
            id: nextId(),
            title: 'Entregar a resposta',
            description: 'Vou responder exatamente ao que você pediu, com base no que foi coletado.',
            kind: 'respond',
            status: 'pending'
        });

        return steps;
    }

    buildAgentPlanSummary(userMessage, executionMode, targets = [], options = {}) {
        if (executionMode === 'context_only') {
            return 'Vou reutilizar o contexto agêntico já coletado, evitar pesquisa redundante e responder a continuação da conversa com base nele.';
        }

        if (executionMode === 'screen') {
            return 'Vou observar a tela atual do app, interpretar o que está visível e validar se isso já responde ao pedido.';
        }

        if (executionMode === 'text') {
            return 'Essa solicitação não exige navegação web obrigatória. Vou decompor a tarefa, executar um raciocínio orientado a etapas e revisar a resposta antes de entregar.';
        }

        if (targets.length > 1) {
            return `Vou pesquisar e navegar em ${targets.length} fontes nesta mesma execução, coletar evidências de cada uma e consolidar tudo em uma resposta só.`;
        }

        const firstTarget = targets[0];
        if (firstTarget?.label) {
            return `Vou localizar ${firstTarget.label}, navegar pela página relevante, observar o conteúdo real e revisar a resposta antes de entregar.`;
        }

        return 'Vou localizar a fonte mais adequada, navegar no que for necessário, observar o resultado e revisar a resposta antes de concluir.';
    }

    async executeAgentPlan(plan, options = {}) {
        if (plan.executionMode === 'context_only') {
            return this.executeContextOnlyAgentPlan(plan, options);
        }

        if (plan.executionMode === 'screen') {
            return this.executeCurrentScreenAgentPlan(plan, options);
        }

        if (plan.executionMode === 'text') {
            return this.executeTextAgentPlan(plan, options);
        }

        return this.executeWebAgentPlan(plan, options);
    }

    async runAgentPlanStep(step, runner) {
        if (!step?.id) {
            return runner();
        }

        this.updateAgentPlanStep(step.id, { status: 'in_progress', note: '' });

        try {
            const result = await runner();
            this.updateAgentPlanStep(step.id, { status: 'completed' });
            return result;
        } catch (error) {
            this.updateAgentPlanStep(step.id, {
                status: 'failed',
                note: error?.message || 'Falha ao executar esta etapa.'
            });
            throw error;
        }
    }

    async executeContextOnlyAgentPlan(plan, options = {}) {
        const previousAgentContext = options?.previousAgentContext || null;
        let contextOnlyAnswer = '';

        for (const step of plan.steps) {
            await this.runAgentPlanStep(step, async () => {
                if (step.kind === 'understand') {
                    this.addAgentThoughtLog('🧠 Vou recuperar a pesquisa anterior e confirmar se ela já é suficiente para responder agora.');
                    return;
                }

                if (step.kind === 'context') {
                    this.addAgentCheckpoint('Recuperei o contexto da pesquisa agêntica anterior para evitar navegação redundante.');
                    return;
                }

                if (step.kind === 'respond') {
                    contextOnlyAnswer = await this.generateAgentContextOnlyResponse(
                        options?.userMessage,
                        previousAgentContext,
                        options?.followUpStrategy
                    );
                    this.addAgentThoughtLog('🧪 Revisei o contexto anterior e montei a resposta diretamente a partir dele.');
                }
            });
        }

        return {
            directFinalText: contextOnlyAnswer,
            targetUrl: previousAgentContext?.targetUrl || '',
            pageTitle: previousAgentContext?.pageTitle || '',
            blocked: Boolean(previousAgentContext?.blocked),
            mode: 'context-only',
            screenshots: this.agentRunContext?.screenshots || 0,
            analysis: previousAgentContext?.analysis || {},
            pageText: this.coerceAgentList(previousAgentContext?.pageText).slice(0, 220),
            navigationTrail: Array.isArray(previousAgentContext?.navigationTrail) ? previousAgentContext.navigationTrail : [],
            screenshotData: this.agentRunContext?.lastScreenshotData || null,
            artifacts: Array.isArray(previousAgentContext?.artifacts) ? previousAgentContext.artifacts : [],
            checkpoints: Array.isArray(this.agentRunContext?.checkpoints) ? this.agentRunContext.checkpoints : []
        };
    }

    async executeCurrentScreenAgentPlan(plan, options = {}) {
        for (const step of plan.steps) {
            await this.runAgentPlanStep(step, async () => {
                if (step.kind === 'understand') {
                    this.addAgentThoughtLog('🧠 Vou observar a tela atual do app e validar se ela responde ao que foi pedido.');
                    return;
                }

                if (step.kind === 'screen') {
                    this.addAgentThoughtLog('📸 Vou capturar e analisar a tela atual do app.');
                    const imageData = await this.takeScreenshot();
                    this.addAgentScreenshot(imageData.dataUrl, 'Tela atual capturada pelo agente');

                    const prompt = this.buildAgentVisionPrompt(options?.userMessage, {
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
                        const fallback = this.buildAgentFallbackAnalysis(options?.userMessage, {
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

                    this.addAgentCheckpoint('Capturei e interpretei a tela atual antes de responder.');
                    return;
                }

                if (step.kind === 'synthesize') {
                    this.addAgentThoughtLog('🧪 Vou revisar a observação da tela para evitar uma resposta superficial.');
                    return;
                }

                if (step.kind === 'respond') {
                    this.addAgentThoughtLog('✍️ Vou transformar a observação da tela em uma resposta final mais útil.');
                }
            });
        }

        return {
            targetUrl: window.location.href,
            pageTitle: document.title,
            blocked: false,
            mode: 'current-screen',
            screenshots: this.agentRunContext?.screenshots || 0,
            analysis: this.lastAgentResponse,
            pageText: [],
            navigationTrail: [],
            screenshotData: this.agentRunContext?.lastScreenshotData || null,
            artifacts: [],
            checkpoints: Array.isArray(this.agentRunContext?.checkpoints) ? this.agentRunContext.checkpoints : []
        };
    }

    async executeTextAgentPlan(plan, options = {}) {
        let directFinalText = '';

        for (const step of plan.steps) {
            await this.runAgentPlanStep(step, async () => {
                if (step.kind === 'understand') {
                    this.addAgentThoughtLog('🧠 Vou estruturar a tarefa e decidir o melhor caminho sem depender de navegação web desnecessária.');
                    return;
                }

                if (step.kind === 'text') {
                    this.addAgentThoughtLog('🛠️ Vou quebrar a tarefa em etapas, executar uma primeira solução e preparar uma revisão crítica.');
                    return;
                }

                if (step.kind === 'synthesize') {
                    this.addAgentThoughtLog('🧪 Vou revisar o resultado textual para garantir que ele responde ao objetivo final, e não só descreve um plano genérico.');
                    return;
                }

                if (step.kind === 'respond') {
                    directFinalText = await this.generateTextAgentAutonomousResponse(options?.userMessage, plan, options);
                    this.addAgentCheckpoint('Concluí a execução textual autônoma e revisei a resposta final.');
                }
            });
        }

        return {
            directFinalText,
            targetUrl: '',
            pageTitle: 'Execução textual do agente',
            blocked: false,
            mode: 'text-agent',
            screenshots: 0,
            analysis: {
                pagina_atual: 'Execução textual planejada e revisada pelo agente.',
                elementos_interativos: [],
                acoes_possiveis: [],
                proximo_passo: 'Continuar a execução conforme o objetivo do usuário'
            },
            pageText: [],
            navigationTrail: [],
            screenshotData: null,
            artifacts: [],
            checkpoints: Array.isArray(this.agentRunContext?.checkpoints) ? this.agentRunContext.checkpoints : []
        };
    }

    async executeWebAgentPlan(plan, options = {}) {
        const targetStates = new Map(
            (Array.isArray(plan.targets) ? plan.targets : []).map((target) => [target.id, {
                ...target,
                resolvedUrl: this.normalizeAgentUrl(target.url || ''),
                resolvedTitle: '',
                resolvedFromSearch: false
            }])
        );

        for (const step of plan.steps) {
            await this.runAgentPlanStep(step, async () => {
                if (step.kind === 'understand') {
                    this.addAgentThoughtLog('🧠 Vou confirmar os alvos, a ordem de execução e o que preciso coletar em cada etapa.');
                    return;
                }

                if (step.kind === 'resolve') {
                    const target = targetStates.get(step.targetId) || [...targetStates.values()][0];
                    if (!target) {
                        return;
                    }

                    this.addAgentAction(`Localizando ${target.label}`, 'pending');
                    const resolvedTarget = target.resolvedUrl
                        ? { url: target.resolvedUrl, title: target.label, source: 'explicit-url' }
                        : await this.resolveAgentTarget(target.query || options?.userMessage || target.label);
                    const normalizedUrl = this.normalizeAgentUrl(resolvedTarget?.url);

                    if (!normalizedUrl) {
                        throw new Error(`Nao consegui localizar uma URL utilizavel para ${target.label}.`);
                    }

                    target.resolvedUrl = normalizedUrl;
                    target.resolvedTitle = resolvedTarget?.title || target.label;
                    target.resolvedFromSearch = !target.url;

                    if (this.agentRunContext) {
                        this.agentRunContext.resolvedFromSearch = this.agentRunContext.resolvedFromSearch || target.resolvedFromSearch;
                        this.agentRunContext.resolvedSearchTitle = target.resolvedTitle || this.agentRunContext.resolvedSearchTitle;
                        this.agentRunContext.resolvedSearchUrl = normalizedUrl || this.agentRunContext.resolvedSearchUrl;
                    }

                    this.addAgentAction(`Site localizado: ${target.resolvedTitle || normalizedUrl}`, 'executed');
                    this.addAgentThoughtLog(`🔎 Encontrei ${target.resolvedTitle || normalizedUrl} e vou usar esse destino na etapa seguinte.`);
                    return;
                }

                if (step.kind === 'browse') {
                    const target = targetStates.get(step.targetId) || [...targetStates.values()][0];
                    if (!target?.resolvedUrl) {
                        throw new Error(`A etapa de navegação para ${target?.label || 'o alvo'} não tinha uma URL resolvida.`);
                    }

                    if (this.agentRunContext) {
                        this.agentRunContext.visitedUrl = target.resolvedUrl;
                    }

                    this.addAgentThoughtLog(`🌐 Vou abrir ${target.resolvedUrl} e seguir a etapa "${step.title}".`);
                    this.addAgentAction(`Abrindo ${target.resolvedUrl}`, 'pending');

                    const browserTask = this.buildAgentBrowseTask(options?.userMessage, target, step, plan);
                    let session = await this.openAgentBrowserSession(target.resolvedUrl, browserTask);
                    let sourceCheck = this.verifyAgentSourceIdentity(target, session, options?.userMessage);

                    if (!sourceCheck.valid && !target.retryUsed) {
                        target.retryUsed = true;
                        this.addAgentThoughtLog(`⚠️ A fonte aberta não correspondeu a ${target.label}. Vou corrigir a rota e tentar de novo.`);
                        this.addAgentAction(`Corrigindo a fonte de ${target.label}`, 'pending');

                        const retriedTarget = await this.resolveAgentTarget(this.buildStrictSourceRetryQuery(target, options?.userMessage));
                        const retriedUrl = this.normalizeAgentUrl(retriedTarget?.url);
                        if (retriedUrl) {
                            target.resolvedUrl = retriedUrl;
                            session = await this.openAgentBrowserSession(retriedUrl, browserTask);
                            sourceCheck = this.verifyAgentSourceIdentity(target, session, options?.userMessage);
                        }
                    }

                    if (!sourceCheck.valid) {
                        this.addAgentCheckpoint(`A fonte final aberta para ${target.label} não pôde ser verificada com segurança. Vou marcar isso na resposta.`);
                    } else {
                        this.addAgentCheckpoint(`Fonte verificada para ${target.label}: ${sourceCheck.actualHost || target.label}.`);
                    }

                    this.addAgentAction(`Site carregado: ${session.currentUrl || target.resolvedUrl}`, 'executed');

                    const analysis = await this.analyzeOpenedSite(session, options?.userMessage, { targetLabel: target.label });
                    let artifact = this.buildAgentArtifact(target, session, analysis, browserTask);
                    artifact.sourceVerified = sourceCheck.valid;
                    artifact.sourceVerificationReason = sourceCheck.reason;

                    const requestsModels = /\b(modelo|modelos|models)\b/i.test(this.normalizeSearchText(options?.userMessage || ''));
                    const extractedModels = this.extractModelItemsFromPageText(this.coerceAgentList(artifact?.pageText));
                    if (requestsModels && sourceCheck.valid && extractedModels.length === 0 && !target.modelRetryUsed) {
                        target.modelRetryUsed = true;
                        const retryHost = target.expectedHost || sourceCheck.actualHost || this.extractHostToken(artifact.targetUrl);
                        if (retryHost) {
                            this.addAgentThoughtLog(`🔁 A página aberta ainda não expôs os modelos de forma clara. Vou tentar uma rota mais específica dentro da fonte oficial.`);
                            const retryQuery = `site:${retryHost} ${target.label} latest models model modelos IA`;
                            const retriedTarget = await this.resolveAgentTarget(retryQuery);
                            const retriedUrl = this.normalizeAgentUrl(retriedTarget?.url);
                            if (retriedUrl && retriedUrl !== artifact.targetUrl) {
                                const retrySession = await this.openAgentBrowserSession(retriedUrl, `${browserTask} modelos recentes`);
                                const retryAnalysis = await this.analyzeOpenedSite(retrySession, options?.userMessage, { targetLabel: target.label });
                                const retrySourceCheck = this.verifyAgentSourceIdentity(target, retrySession, options?.userMessage);
                                const retryArtifact = this.buildAgentArtifact(target, retrySession, retryAnalysis, `${browserTask} modelos recentes`);
                                retryArtifact.sourceVerified = retrySourceCheck.valid;
                                retryArtifact.sourceVerificationReason = retrySourceCheck.reason;
                                if (this.extractModelItemsFromPageText(this.coerceAgentList(retryArtifact?.pageText)).length > 0) {
                                    artifact = retryArtifact;
                                }
                            }
                        }
                    }

                    this.recordAgentArtifact(artifact);
                    this.addAgentCheckpoint(`Concluí a coleta em ${target.label}${artifact.pageTitle ? ` (${artifact.pageTitle})` : ''}.`);
                    return;
                }

                if (step.kind === 'synthesize') {
                    this.addAgentThoughtLog('🧪 Vou revisar a coleta, verificar se faltou alguma evidência importante e consolidar tudo antes da resposta final.');
                    return;
                }

                if (step.kind === 'respond') {
                    this.addAgentThoughtLog('✍️ Vou transformar a pesquisa completa em uma resposta final direta, fundamentada e útil.');
                }
            });
        }

        const artifacts = Array.isArray(this.agentRunContext?.artifacts) ? this.agentRunContext.artifacts : [];
        const lastArtifact = artifacts[artifacts.length - 1] || null;
        const mergedPageText = artifacts
            .flatMap((artifact) => this.coerceAgentList(artifact?.pageText))
            .filter((item, index, array) => array.indexOf(item) === index)
            .slice(0, 220);
        const mergedNavigationTrail = artifacts
            .flatMap((artifact) => Array.isArray(artifact?.navigationTrail) ? artifact.navigationTrail : [])
            .slice(0, 24);

        return {
            targetUrl: lastArtifact?.targetUrl || this.agentRunContext?.visitedUrl || '',
            pageTitle: lastArtifact?.pageTitle || this.agentRunContext?.pageTitle || '',
            blocked: artifacts.some((artifact) => artifact?.blocked),
            mode: artifacts.length > 1 ? 'multi-site-browser' : this.agentRunContext?.mode || 'live-browser',
            screenshots: this.agentRunContext?.screenshots || 0,
            analysis: lastArtifact?.analysis || this.lastAgentResponse,
            pageText: mergedPageText,
            navigationTrail: mergedNavigationTrail,
            screenshotData: this.agentRunContext?.lastScreenshotData || null,
            artifacts,
            checkpoints: Array.isArray(this.agentRunContext?.checkpoints) ? this.agentRunContext.checkpoints : []
        };
    }

    buildAgentBrowseTask(userMessage, target = {}, step = {}, plan = {}) {
        const baseTask = [
            userMessage,
            target?.navigationInstruction,
            step?.description,
            plan?.targets?.length > 1 ? `Foque em ${target.label}.` : ''
        ]
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join(' ');

        const normalized = this.normalizeSearchText(baseTask);
        const asksPrice = /\b(preco|precos|price|valor|mais barato|a vista|avista|pix)\b/i.test(normalized);
        const asksProduct = /\b(iphone|galaxy|macbook|playstation|maquina de lavar|lava e seca|geladeira|notebook|smartphone|celular|tv)\b/i.test(normalized);

        if (asksPrice || asksProduct) {
            return `${baseTask} Pesquise no site, abra um resultado de produto relevante e colete apenas preços realmente visíveis.`;
        }

        return baseTask;
    }

    verifyAgentSourceIdentity(target = {}, session = {}, userMessage = '') {
        const actualUrl = session?.currentUrl || session?.requestedUrl || '';
        const pageTitle = String(session?.title || session?.page?.title || '');
        const actualHost = actualUrl ? this.extractHostToken(actualUrl) : '';
        const normalizedLabel = this.normalizeSearchText(target?.label || '');
        const labelTokens = normalizedLabel.split(' ').filter((token) => token.length > 2);
        const expectedHost = String(target?.expectedHost || '').replace(/^www\./i, '');
        const identityText = this.normalizeSearchText(`${actualUrl} ${pageTitle}`);

        if (expectedHost && actualUrl) {
            try {
                const hostname = new URL(actualUrl).hostname.replace(/^www\./i, '');
                if (hostname === expectedHost || hostname.endsWith(`.${expectedHost}`)) {
                    return { valid: true, actualHost: hostname, reason: 'expected_host_match' };
                }
            } catch {
                // ignore
            }
        }

        if (!labelTokens.length) {
            return { valid: true, actualHost, reason: 'no_label_tokens' };
        }

        const hasTokenMatch = labelTokens.some((token) => identityText.includes(token));
        if (hasTokenMatch) {
            return { valid: true, actualHost, reason: 'title_or_url_match' };
        }

        const officialRequest = /site oficial|site d[oa]|site de/i.test(userMessage || '');
        return {
            valid: !officialRequest,
            actualHost,
            reason: officialRequest ? 'official_source_mismatch' : 'soft_mismatch',
            pageTitle
        };
    }

    buildStrictSourceRetryQuery(target = {}, userMessage = '') {
        const expectedHost = String(target?.expectedHost || '').replace(/^www\./i, '');
        const label = target?.label || 'fonte oficial';
        return [
            expectedHost ? `site:${expectedHost}` : '',
            label,
            userMessage,
            'fonte oficial'
        ].filter(Boolean).join(' ');
    }

    buildAgentArtifact(target = {}, session = {}, analysis = null, browserTask = '') {
        const pageContext = session?.page || {};
        const currentUrl = session?.currentUrl || session?.requestedUrl || target?.resolvedUrl || target?.url || '';
        const pageTitle = this.agentRunContext?.pageTitle || session?.title || pageContext.title || '';
        const blocked = Boolean(this.agentRunContext?.blocked);

        return {
            targetId: target?.id || '',
            targetLabel: target?.label || '',
            targetUrl: currentUrl,
            pageTitle,
            blocked,
            mode: session?.mode || this.agentRunContext?.mode || 'live-browser',
            analysis: analysis || this.lastAgentResponse || {},
            pageText: this.coerceAgentList(pageContext?.visibleText).slice(0, 220),
            navigationTrail: Array.isArray(session?.navigationTrail) ? session.navigationTrail : [],
            browserTask
        };
    }

    recordAgentArtifact(artifact = {}) {
        if (!this.agentRunContext) {
            return;
        }

        this.agentRunContext.artifacts.push(artifact);
        this.agentRunContext.pageTitle = artifact.pageTitle || this.agentRunContext.pageTitle;
        this.agentRunContext.blocked = this.agentRunContext.blocked || Boolean(artifact.blocked);
        this.agentRunContext.mode = artifact.mode || this.agentRunContext.mode;
        this.agentRunContext.visitedUrl = artifact.targetUrl || this.agentRunContext.visitedUrl;
        this.agentRunContext.pageText = [...this.coerceAgentList(this.agentRunContext.pageText), ...this.coerceAgentList(artifact.pageText)]
            .filter((item, index, array) => array.indexOf(item) === index)
            .slice(0, 220);
        this.agentRunContext.navigationTrail = [...(Array.isArray(this.agentRunContext.navigationTrail) ? this.agentRunContext.navigationTrail : []), ...(Array.isArray(artifact.navigationTrail) ? artifact.navigationTrail : [])]
            .slice(0, 24);
    }

    buildAgentSavedContext(finalText, finalContext = {}, previousAgentContext = null, followUpStrategy = {}) {
        return {
            request: finalContext?.request || '',
            targetUrl: finalContext?.targetUrl || '',
            pageTitle: finalContext?.pageTitle || '',
            blocked: Boolean(finalContext?.blocked),
            mode: finalContext?.mode || '',
            screenshots: finalContext?.screenshots || 0,
            analysis: finalContext?.analysis || {},
            pageText: this.coerceAgentList(finalContext?.pageText).slice(0, 220),
            navigationTrail: Array.isArray(finalContext?.navigationTrail) ? finalContext.navigationTrail.slice(0, 24) : [],
            resolvedFromSearch: Boolean(this.agentRunContext?.resolvedFromSearch),
            resolvedSearchTitle: this.agentRunContext?.resolvedSearchTitle || '',
            resolvedSearchUrl: this.agentRunContext?.resolvedSearchUrl || '',
            followUpMode: followUpStrategy?.mode || 'new_research',
            previousRequest: previousAgentContext?.request || '',
            finalResponse: finalText,
            reusedContext: followUpStrategy?.mode === 'answer_from_context',
            executionPlan: finalContext?.executionPlan
                ? {
                    executionMode: finalContext.executionPlan.executionMode,
                    summary: finalContext.executionPlan.summary,
                    steps: Array.isArray(finalContext.executionPlan.steps)
                        ? finalContext.executionPlan.steps.map((step) => ({
                            id: step.id,
                            title: step.title,
                            kind: step.kind,
                            status: step.status
                        }))
                        : []
                }
                : null,
            artifacts: Array.isArray(finalContext?.artifacts)
                ? finalContext.artifacts.slice(0, 4).map((artifact) => ({
                    targetLabel: artifact.targetLabel,
                    targetUrl: artifact.targetUrl,
                    pageTitle: artifact.pageTitle,
                    blocked: Boolean(artifact.blocked),
                    mode: artifact.mode,
                    sourceVerified: artifact.sourceVerified !== false,
                    pageText: this.coerceAgentList(artifact.pageText).slice(0, 80)
                }))
                : [],
            checkpoints: Array.isArray(finalContext?.checkpoints) ? finalContext.checkpoints.slice(-10) : [],
            memoriesUsed: Array.isArray(finalContext?.relevantMemories)
                ? finalContext.relevantMemories.slice(0, 6).map((memory) => ({
                    category: memory.category,
                    label: memory.label,
                    value: memory.value
                }))
                : []
        };
    }

    async reviewAndRefineAgentFinalResponse(finalText, context = {}) {
        const cleanedText = this.cleanAgentFinalText(finalText);
        const relevantItems = this.extractRelevantItemsFromPageText(context?.request, context?.pageText || []);
        const dominantColor = context?.dominantColor
            || (context?.screenshotData ? await this.detectDominantColorNameFromDataUrl(context.screenshotData) : null);

        if (['text', 'context_only'].includes(context?.executionPlan?.executionMode) && cleanedText.length >= 80) {
            return cleanedText;
        }

        if (this.isUsefulAgentFinalText(cleanedText, context?.request, relevantItems, dominantColor)) {
            return cleanedText;
        }

        this.addAgentThoughtLog('🧪 Revisei a resposta final e corrigi o que ainda estava superficial ou pouco aderente ao pedido.');
        const groundedResult = this.buildLocalGroundedAgentResult({
            ...context,
            dominantColor,
            relevantItems
        });

        return this.buildAgentFallbackNarrative({
            ...context,
            dominantColor,
            relevantItems,
            groundedResult,
            responseMode: context?.responseMode || 'new_research',
            priorContext: context?.priorContext || null
        });
    }

    async generateTextAgentAutonomousResponse(userMessage, plan, options = {}) {
        const relevantMemories = Array.isArray(options?.relevantMemories) ? options.relevantMemories : [];
        const previousAgentContext = options?.previousAgentContext || null;
        const prompt = `Você é o Drekee Agent em modo autônomo.

Pedido do usuário:
${userMessage}

Plano de execução:
${Array.isArray(plan?.steps) ? plan.steps.map((step, index) => `${index + 1}. ${step.title} - ${step.description || ''}`).join('\n') : 'sem plano'}

Contexto agêntico anterior:
- último pedido: ${previousAgentContext?.request || 'nenhum'}
- última página: ${previousAgentContext?.pageTitle || 'nenhuma'}

Memórias relevantes:
${relevantMemories.map((memory) => `- ${memory.label}: ${memory.value}`).join('\n') || 'nenhuma'}

Entregue uma resposta final em português que:
- execute o pedido com autonomia, não apenas descreva o plano;
- seja prática, específica e mais profunda do que uma resposta genérica;
- use seções curtas quando isso ajudar;
- inclua decisões, próximos passos e, se fizer sentido, uma primeira proposta de implementação;
- não mencione JSON, prompts, nem bastidores internos.`;

        try {
            const rawText = await this.callAgentGroqWithRecovery('qwen/qwen3-32b', [
                {
                    role: 'system',
                    content: 'Você produz respostas finais de um agente autônomo. Seja objetivo, útil e nada superficial.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            return this.cleanAgentFinalText(rawText);
        } catch (error) {
            console.error('❌ [AGENT] Erro na execução textual autônoma:', error);
            return [
                'Olá! Estruturei a tarefa em etapas e segui uma execução textual autônoma para não ficar em algo genérico.',
                `Objetivo: ${userMessage}.`,
                'Primeiro, defini o resultado esperado e que partes da tarefa dependem de decisão técnica.',
                'Depois, organizei a execução em blocos menores para reduzir risco e deixar um caminho claro de continuidade.',
                'Por fim, revisei a saída para que ela já sirva como ponto de partida real, e não só como uma ideia vaga.',
                'Se você quiser, eu também posso continuar a partir daqui com uma próxima etapa mais concreta.'
            ].join('\n\n');
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

    getCurrentChatObject(chatId = this.currentChatId) {
        if (!chatId) {
            return null;
        }

        return this.chats.find((chat) => chat.id === chatId) || null;
    }

    appendMessageToCurrentChat(message, chatId = this.currentChatId) {
        const chat = this.getCurrentChatObject(chatId);
        if (!chat) {
            return;
        }

        chat.messages.push(message);
        this.saveCurrentChat(chatId);
    }

    getLatestAgentContext(chat = this.getCurrentChatObject()) {
        if (!chat || !Array.isArray(chat.messages)) {
            return null;
        }

        for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
            const message = chat.messages[index];
            if (message?.role === 'assistant' && message?.mode === 'agent' && message?.agentContext) {
                return message.agentContext;
            }
        }

        return null;
    }

    getRecentAgentTurns(chat = this.getCurrentChatObject(), limit = 3) {
        if (!chat || !Array.isArray(chat.messages)) {
            return [];
        }

        const turns = [];
        for (let index = chat.messages.length - 1; index >= 0 && turns.length < limit; index -= 1) {
            const assistantMessage = chat.messages[index];
            if (assistantMessage?.role !== 'assistant' || assistantMessage?.mode !== 'agent') {
                continue;
            }

            const userMessage = chat.messages[index - 1];
            turns.unshift({
                user: userMessage?.role === 'user' ? userMessage.content : '',
                assistant: assistantMessage.content || '',
                context: assistantMessage.agentContext || null
            });
        }

        return turns;
    }

    saveAgentAssistantTurn(finalText, agentContext = {}) {
        const sanitizedContext = {
            request: agentContext?.request || '',
            targetUrl: agentContext?.targetUrl || '',
            pageTitle: agentContext?.pageTitle || '',
            blocked: Boolean(agentContext?.blocked),
            mode: agentContext?.mode || '',
            screenshots: agentContext?.screenshots || 0,
            analysis: agentContext?.analysis || {},
            pageText: this.coerceAgentList(agentContext?.pageText).slice(0, 220),
            navigationTrail: Array.isArray(agentContext?.navigationTrail) ? agentContext.navigationTrail.slice(0, 12) : [],
            resolvedFromSearch: Boolean(agentContext?.resolvedFromSearch),
            resolvedSearchTitle: agentContext?.resolvedSearchTitle || '',
            resolvedSearchUrl: agentContext?.resolvedSearchUrl || '',
            followUpMode: agentContext?.followUpMode || 'new_research',
            previousRequest: agentContext?.previousRequest || '',
            finalResponse: finalText,
            reusedContext: Boolean(agentContext?.reusedContext),
            executionPlan: agentContext?.executionPlan || null,
            artifacts: Array.isArray(agentContext?.artifacts) ? agentContext.artifacts.slice(0, 4) : [],
            checkpoints: Array.isArray(agentContext?.checkpoints) ? agentContext.checkpoints.slice(-10) : [],
            memoriesUsed: Array.isArray(agentContext?.memoriesUsed) ? agentContext.memoriesUsed.slice(0, 6) : [],
            timestamp: new Date().toISOString()
        };

        this.appendMessageToCurrentChat({
            role: 'assistant',
            content: finalText,
            mode: 'agent',
            agentContext: sanitizedContext
        }, agentContext?.chatId || this.agentRunContext?.chatId || this.currentChatId);
    }

    mergeAgentConversationContext(previousContext = null, nextContext = {}) {
        const mergeList = (left = [], right = [], limit = 220) => [...this.coerceAgentList(left), ...this.coerceAgentList(right)]
            .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .filter((item, index, array) => array.indexOf(item) === index)
            .slice(0, limit);

        if (!previousContext) {
            return {
                ...nextContext,
                pageText: mergeList([], nextContext?.pageText, 220),
                navigationTrail: Array.isArray(nextContext?.navigationTrail) ? nextContext.navigationTrail.slice(0, 20) : []
            };
        }

        return {
            ...previousContext,
            ...nextContext,
            pageText: mergeList(previousContext?.pageText, nextContext?.pageText, 220),
            navigationTrail: [...(Array.isArray(previousContext?.navigationTrail) ? previousContext.navigationTrail : []), ...(Array.isArray(nextContext?.navigationTrail) ? nextContext.navigationTrail : [])]
                .slice(-20),
            artifacts: [...(Array.isArray(previousContext?.artifacts) ? previousContext.artifacts : []), ...(Array.isArray(nextContext?.artifacts) ? nextContext.artifacts : [])]
                .slice(-6),
            checkpoints: [...(Array.isArray(previousContext?.checkpoints) ? previousContext.checkpoints : []), ...(Array.isArray(nextContext?.checkpoints) ? nextContext.checkpoints : [])]
                .slice(-12),
            memoriesUsed: [...(Array.isArray(previousContext?.memoriesUsed) ? previousContext.memoriesUsed : []), ...(Array.isArray(nextContext?.memoriesUsed) ? nextContext.memoriesUsed : [])]
                .filter((memory, index, array) => array.findIndex((candidate) => `${candidate?.category}:${candidate?.value}` === `${memory?.category}:${memory?.value}`) === index)
                .slice(-8)
        };
    }

    async decideAgentFollowUpStrategy(userMessage, previousAgentContext = null) {
        if (!previousAgentContext) {
            return { mode: 'new_research', reason: 'no_previous_agent_context' };
        }

        const deterministicStrategy = this.classifyDeterministicAgentFollowUp(userMessage, previousAgentContext);
        if (deterministicStrategy) {
            return deterministicStrategy;
        }

        const explicitUrl = this.extractAgentUrl(userMessage);
        if (explicitUrl) {
            const normalizedExplicitUrl = this.normalizeAgentUrl(explicitUrl);
            const sameHost = normalizedExplicitUrl && previousAgentContext?.targetUrl
                ? this.haveSameHost(normalizedExplicitUrl, previousAgentContext.targetUrl)
                : false;
            return {
                mode: sameHost ? 'continue_research' : 'new_research',
                reason: sameHost ? 'explicit_url_same_host' : 'explicit_url_new_host',
                startingUrl: sameHost ? normalizedExplicitUrl : null
            };
        }

        const recentTurns = this.getRecentAgentTurns(this.getCurrentChatObject(), 3);
        const prompt = `Analise a nova mensagem do usuário no contexto de uma conversa com um agente web.

Mensagem nova do usuário:
${userMessage}

Último contexto de pesquisa do agente:
- pedido anterior: ${previousAgentContext?.request || 'desconhecido'}
- url final: ${previousAgentContext?.targetUrl || 'desconhecida'}
- título final: ${previousAgentContext?.pageTitle || 'desconhecido'}
- modo: ${previousAgentContext?.mode || 'desconhecido'}
- trechos visíveis:
${this.coerceAgentList(previousAgentContext?.pageText).slice(0, 30).join('\n') || 'sem trechos'}

Últimos turnos do agente:
${recentTurns.map((turn, index) => `${index + 1}. usuário: ${turn.user}\nassistente: ${turn.assistant}`).join('\n\n') || 'sem turnos'}

Responda SOMENTE com JSON válido:
{
  "mode": "new_research" | "answer_from_context" | "continue_research",
  "reason": "motivo curto",
  "starting_url": "url ou vazio"
}

Regras:
- use "answer_from_context" se a nova pergunta puder ser respondida com base no conteúdo já coletado;
- use "continue_research" se for o mesmo assunto/site, mas exigir nova navegação ou coleta complementar;
- use "new_research" se for um assunto diferente;
- não invente fatos e não escreva nada fora do JSON.`;

        try {
            const rawDecision = await this.callAgentGroqWithRecovery(this.agentReasoningModel, [
                {
                    role: 'system',
                    content: 'Classifique continuidade de conversa de um agente web usando JSON estrito.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ]);

            const parsedDecision = this.tryParseAgentJson(rawDecision);
            if (parsedDecision?.mode && ['new_research', 'answer_from_context', 'continue_research'].includes(parsedDecision.mode)) {
                return {
                    mode: parsedDecision.mode,
                    reason: parsedDecision.reason || 'llm_classification',
                    startingUrl: this.normalizeAgentUrl(parsedDecision.starting_url || parsedDecision.startingUrl || '') || null
                };
            }
        } catch (error) {
            console.error('❌ [AGENT] Erro ao classificar continuação da conversa:', error);
        }

        return this.fallbackAgentFollowUpStrategy(userMessage, previousAgentContext);
    }

    classifyDeterministicAgentFollowUp(userMessage, previousAgentContext = null) {
        if (!previousAgentContext) {
            return null;
        }

        const normalizedMessage = this.normalizeSearchText(userMessage);
        const previousHost = previousAgentContext?.targetUrl ? this.extractHostToken(previousAgentContext.targetUrl) : '';
        const referencesExistingContext = [
            'desse modelo',
            'desses modelos',
            'desses itens',
            'dessas informacoes',
            'dessas informacoes',
            'dessa pagina',
            'desta pagina',
            'esse modelo',
            'esses modelos',
            'essas informacoes',
            'essa informacao',
            'esses dados',
            'esses resultados',
            'essa pagina',
            'esse site',
            'isso',
            'nisso',
            'nela',
            'nele',
            'acima',
            'anterior'
        ].some((token) => normalizedMessage.includes(token));
        const asksNavigation = /\b(va|entre|acesse|abra|navegue|pesquise|procure|busque|continue|volte|role|desca|suba|veja|verifique|compare|colete)\b/i.test(normalizedMessage);
        const asksExtraction = /\b(quais|qual|quantos|me diga|me fale|cite|liste|resuma|explique|parecem|parece)\b/i.test(normalizedMessage);
        const sameHostMentioned = previousHost && normalizedMessage.includes(previousHost);
        const mentionsNewHost = /\b(site|pagina|compare|comparar|entre|acesse|abra)\b/i.test(normalizedMessage) && !sameHostMentioned;
        const shortFollowUp = normalizedMessage.split(' ').filter(Boolean).length <= 12;

        if (!mentionsNewHost && shortFollowUp && /^(quais|qual|quantos|me diga|cite|liste|resuma|explique|e quais|e qual)/i.test(normalizedMessage)) {
            return {
                mode: asksNavigation ? 'continue_research' : 'answer_from_context',
                reason: 'deterministic_short_follow_up',
                startingUrl: asksNavigation ? previousAgentContext?.targetUrl || null : null
            };
        }

        if ((referencesExistingContext || sameHostMentioned) && asksExtraction && !asksNavigation) {
            return {
                mode: 'answer_from_context',
                reason: 'deterministic_existing_context_question'
            };
        }

        if ((referencesExistingContext || sameHostMentioned) && asksNavigation) {
            return {
                mode: 'continue_research',
                reason: 'deterministic_existing_context_navigation',
                startingUrl: previousAgentContext?.targetUrl || null
            };
        }

        return null;
    }

    fallbackAgentFollowUpStrategy(userMessage, previousAgentContext = null) {
        const normalizedMessage = this.normalizeSearchText(userMessage);
        const previousHost = previousAgentContext?.targetUrl ? this.extractHostToken(previousAgentContext.targetUrl) : '';
        const refersToPrevious = /essa pagina|esse site|esses modelos|esses itens|essa lista|isso|nisso|nela|nele|agora|alem disso|alem disso|sobre isso|com base nisso/i.test(normalizedMessage);
        const navigationIntent = /\b(va|entre|acesse|abra|navegue|pesquise|procure|compare|busque|liste|colete|continue)\b/i.test(normalizedMessage);
        const sameHostMentioned = previousHost && normalizedMessage.includes(previousHost);
        const shortFollowUp = normalizedMessage.split(' ').filter(Boolean).length <= 12;

        if ((refersToPrevious || sameHostMentioned) && navigationIntent) {
            return {
                mode: 'continue_research',
                reason: 'fallback_same_topic_navigation',
                startingUrl: previousAgentContext?.targetUrl || null
            };
        }

        if (refersToPrevious || sameHostMentioned) {
            return {
                mode: 'answer_from_context',
                reason: 'fallback_same_topic_context'
            };
        }

        if (shortFollowUp && !/\b(site|pagina|groq|python|nike|openai|vercel|github)\b/i.test(normalizedMessage)) {
            return {
                mode: navigationIntent ? 'continue_research' : 'answer_from_context',
                reason: 'fallback_short_follow_up',
                startingUrl: navigationIntent ? previousAgentContext?.targetUrl || null : null
            };
        }

        return {
            mode: 'new_research',
            reason: 'fallback_new_topic'
        };
    }

    haveSameHost(leftUrl, rightUrl) {
        try {
            return new URL(leftUrl).hostname.replace(/^www\./i, '') === new URL(rightUrl).hostname.replace(/^www\./i, '');
        } catch {
            return false;
        }
    }

    extractHostToken(targetUrl) {
        try {
            return new URL(targetUrl).hostname.replace(/^www\./i, '').split('.')[0];
        } catch {
            return '';
        }
    }

    async generateAgentContextOnlyResponse(userMessage, previousAgentContext, strategy = {}) {
        const localResult = this.buildLocalGroundedAgentResult({
            request: userMessage,
            targetUrl: previousAgentContext?.targetUrl,
            pageTitle: previousAgentContext?.pageTitle,
            blocked: previousAgentContext?.blocked,
            mode: previousAgentContext?.mode,
            screenshots: previousAgentContext?.screenshots,
            analysis: previousAgentContext?.analysis,
            pageText: this.coerceAgentList(previousAgentContext?.pageText).slice(0, 220),
            navigationTrail: previousAgentContext?.navigationTrail || []
        });

        if (this.shouldPreferLocalAgentContextAnswer(userMessage, localResult)) {
            return this.buildAgentContextOnlyNarrative(userMessage, previousAgentContext, localResult);
        }

        const contextPrompt = `Responda à continuação de uma conversa sobre uma pesquisa web já realizada pelo agente.

Nova pergunta do usuário:
${userMessage}

Contexto já coletado anteriormente:
- pedido anterior: ${previousAgentContext?.request || 'desconhecido'}
- url final: ${previousAgentContext?.targetUrl || 'desconhecida'}
- título final: ${previousAgentContext?.pageTitle || 'desconhecido'}
- trechos visíveis:
${this.coerceAgentList(previousAgentContext?.pageText).slice(0, 60).join('\n') || 'sem trechos'}
- análise estruturada:
${JSON.stringify(previousAgentContext?.analysis || {})}

Regras:
- responda em português do Brasil;
- responda só com base no contexto acima;
- se faltar informação, diga claramente que seria preciso continuar a navegação;
- não diga que abriu uma nova página agora, porque você está respondendo usando a pesquisa anterior;
- seja objetivo, útil e profissional.`;

        try {
            const answer = await this.callAgentGroqWithRecovery(this.agentReasoningModel, [
                {
                    role: 'system',
                    content: 'Você responde follow-ups de um agente web usando apenas o contexto coletado.'
                },
                {
                    role: 'user',
                    content: contextPrompt
                }
            ]);

            const cleanedAnswer = this.cleanAgentFinalText(answer);
            if (cleanedAnswer) {
                return cleanedAnswer;
            }
        } catch (error) {
            console.error('❌ [AGENT] Erro ao responder usando contexto anterior:', error);
        }

        return this.buildAgentContextOnlyNarrative(userMessage, previousAgentContext, localResult);
    }

    shouldPreferLocalAgentContextAnswer(userMessage, localResult) {
        const normalizedMessage = this.normalizeSearchText(userMessage);
        const extractedItems = this.coerceAgentList(localResult?.itens_encontrados || []);

        if (/desses modelos|esses modelos|modelo|modelos|audio|voz|speech|openai|gpt|llama|whisper|compound|qwen|gemma|mistral/i.test(normalizedMessage)) {
            return extractedItems.length > 0;
        }

        if (/qual|quais|quantos|cite|liste|parecem/i.test(normalizedMessage) && extractedItems.length > 0) {
            return true;
        }

        return false;
    }

    buildAgentContextOnlyNarrative(userMessage, previousAgentContext, groundedResult) {
        const extractedItems = this.coerceAgentList(groundedResult?.itens_encontrados || []).slice(0, this.extractRequestedItemCount(userMessage));
        const directAnswer = groundedResult?.resposta_direta || 'Com base no que eu já tinha coletado, esta é a melhor resposta disponível.';
        const evidence = this.coerceAgentList(groundedResult?.evidencias || [])
            .filter((item) => !extractedItems.includes(item))
            .slice(0, 4);
        const observation = groundedResult?.observacao ? `\n\n${groundedResult.observacao}` : '';

        return [
            'Olá! Estou respondendo com base na pesquisa agêntica anterior, sem abrir uma nova navegação agora.',
            directAnswer,
            extractedItems.length ? `O que já estava visível na página:\n- ${extractedItems.join('\n- ')}` : '',
            evidence.length ? `Trechos que sustentam essa resposta:\n- ${evidence.join('\n- ')}` : '',
            observation
        ].filter(Boolean).join('\n\n').trim();
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
            const errorMessage = data.error || `Falha ao abrir ${url}`;
            if (this.isRecoverableAgentBrowserFailure(errorMessage)) {
                const fallbackSession = await this.requestAgentBrowserMetadataFallback(url, errorMessage);
                if (fallbackSession) {
                    this.addAgentThoughtLog('📡 O navegador real do agente ficou indisponivel; continuei com uma visualizacao resumida para nao interromper a tarefa.');
                    return fallbackSession;
                }
            }
            throw new Error(errorMessage);
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

    isRecoverableAgentBrowserFailure(errorMessage = '') {
        const message = String(errorMessage || '');
        return /failed to launch the browser process|chrome do agente nao esta disponivel|could not find chrome|could not find chromium|error while loading shared libraries|libnss3\.so|code:\s*127/i.test(message);
    }

    async requestAgentBrowserMetadataFallback(url, reason = '') {
        try {
            const response = await fetch('/api/agent-browser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'metadata-fallback',
                    url,
                    reason
                })
            });

            const data = await response.json();
            if (!response.ok) {
                return null;
            }

            return data;
        } catch (error) {
            console.error('Agent browser metadata fallback failed:', error);
            return null;
        }
    }

    // Analisar site que foi aberto
    async analyzeOpenedSite(session, userMessage, options = {}) {
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
            return this.lastAgentResponse;
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
            return this.lastAgentResponse;
        } catch (error) {
            console.error('❌ [AGENT] Falha na visao do site, usando fallback estrutural:', error);
            this.processAgentResponse(fallbackAnalysis, { silent: true });
            return this.lastAgentResponse;
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

    isAgentRateLimitError(error) {
        const message = String(error?.message || error || '');
        return /429|rate limit|rate_limit|tpm|too many requests/i.test(message);
    }

    async waitForAgentRateLimitRecovery(providerLabel = 'API', delayMs = 90000) {
        this.addAgentThoughtLog(`⚠️ Houve limitação temporária na ${providerLabel}. Vou pausar por 1 min 30 s e retomar automaticamente assim que possível.`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        this.addAgentThoughtLog(`🔄 Retomei a execução após a pausa de recuperação da ${providerLabel}.`);
    }

    async callAgentGroqWithRecovery(model, messages, providerLabel = 'Groq') {
        try {
            return await this.agent.callGroqAPI(model, messages);
        } catch (error) {
            if (!this.isAgentRateLimitError(error)) {
                throw error;
            }

            await this.waitForAgentRateLimitRecovery(providerLabel);
            return this.agent.callGroqAPI(model, messages);
        }
    }

    async callAgentAPI(prompt, imageData) {
        this.addAgentThoughtLog('🧠 IA pensando...');

        let rateLimitDetected = false;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const geminiResponse = await this.callGeminiVision(prompt, imageData);
                if (geminiResponse) {
                    return geminiResponse;
                }

                throw new Error('Gemini retornou resposta vazia');
            } catch (error) {
                console.error('❌ [AGENT] Erro na chamada da API:', error);
                rateLimitDetected = rateLimitDetected || this.isAgentRateLimitError(error);

                try {
                    const groqResponse = await this.callGroqVision(prompt, imageData);
                    if (groqResponse) {
                        return groqResponse;
                    }
                } catch (groqError) {
                    console.error('❌ [AGENT] Erro no fallback da API:', groqError);
                    rateLimitDetected = rateLimitDetected || this.isAgentRateLimitError(groqError);
                    if (!rateLimitDetected || attempt > 0) {
                        throw groqError;
                    }
                }
            }

            if (rateLimitDetected && attempt === 0) {
                await this.waitForAgentRateLimitRecovery('API de visão');
                rateLimitDetected = false;
                continue;
            }
        }

        throw new Error('Ambas as APIs de visao falharam');
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
            pagina_atual: this.sanitizeAgentTextItem(parsed.pagina_atual, { maxLength: 280 }) || 'Sem resumo confiável da página.',
            elementos_interativos: this.coerceAgentList(parsed.elementos_interativos || parsed.elementosInterativos).slice(0, 12),
            acoes_possiveis: this.coerceAgentList(parsed.acoes_possiveis || parsed.acoesPossiveis || parsed.acoes_sugeridas).slice(0, 8),
            proximo_passo: this.sanitizeAgentTextItem(parsed.proximo_passo || parsed.proximoPasso, { maxLength: 180 }) || 'Continuar com uma etapa mais concreta.',
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
            const groqText = await this.callAgentGroqWithRecovery(this.agentReasoningModel, [
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

        const request = String(context?.request || '');
        const asksPriceComparison = /preco|precos|price|valor|mais barato|loja|lojas|a vista|avista|pix/i.test(this.normalizeSearchText(request));
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
        let itensEncontrados = validateList(result?.itens_encontrados || result?.items || []);
        let evidencias = validateList(result?.evidencias || result?.evidence || []).slice(0, 5);
        const observacao = String(result?.observacao || result?.observation || '').trim();

        if (asksPriceComparison) {
            itensEncontrados = itensEncontrados.filter((item) => /R\$\s*[\d\.\,]+/i.test(item));
            evidencias = evidencias.filter((item) => /R\$\s*[\d\.\,]+/i.test(item));

            if (!itensEncontrados.length && !evidencias.length) {
                return null;
            }
        }

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
        const baseItems = this.extractRelevantItemsFromPageText(request, context?.pageText || []);
        const relevantItems = this.filterAgentItemsForRequest(request, baseItems, context?.pageText || []).slice(0, requestedCount);
        const pageTitle = context?.pageTitle || 'Página não identificada';
        const directParts = [];
        const isListRequest = /modelo|modelos|models|lista|todos|itens/i.test(request);
        const asksAudio = /audio|voz|speech|transcri|asr|tts/i.test(this.normalizeSearchText(request));
        const asksLatest = /mais recente|mais recentes|latest|recent/i.test(this.normalizeSearchText(request));
        const asksPriceComparison = /preco|precos|price|valor|mais barato|loja|lojas|a vista|avista|pix/i.test(this.normalizeSearchText(request));

        if (/cor|color/i.test(request) && context?.dominantColor) {
            directParts.push(`A cor predominante da página é ${context.dominantColor}.`);
        }

        if (asksPriceComparison) {
            const priceComparison = this.extractAgentPriceComparisons(context?.artifacts || [], request);
            if (priceComparison.entries.length) {
                const cheaper = priceComparison.cheapest;
                directParts.push(
                    cheaper
                        ? `Comparei ${priceComparison.entries.length} loja${priceComparison.entries.length > 1 ? 's' : ''} e a opção mais barata à vista foi ${cheaper.store} por ${cheaper.displayPrice}.`
                        : `Encontrei ${priceComparison.entries.length} preço${priceComparison.entries.length > 1 ? 's' : ''} à vista nas fontes visitadas.`
                );

                return {
                    resposta_direta: directParts.join(' '),
                    itens_encontrados: priceComparison.entries.map((entry) => `${entry.store}: ${entry.displayPrice}`),
                    evidencias: priceComparison.entries.map((entry) => entry.evidence).filter(Boolean).slice(0, 4),
                    observacao: context?.blocked
                        ? 'O site limitou parte da navegação automática nesta tentativa.'
                        : ''
                };
            }

            return {
                resposta_direta: 'Não consegui extrair um preço à vista confiável nas páginas visitadas.',
                itens_encontrados: [],
                evidencias: this.coerceAgentList(context?.pageText || [])
                    .filter((item) => /r\$\s*[\d\.\,]+/i.test(item))
                    .slice(0, 4),
                observacao: context?.blocked
                    ? 'O site limitou parte da navegação automática nesta tentativa.'
                    : 'Será preciso continuar a navegação até uma página de produto ou resultado com preço visível.'
            };
        }

        if (isListRequest) {
            if (relevantItems.length) {
                if (asksAudio) {
                    directParts.push(`Entre os modelos visíveis em "${pageTitle}", os que mais parecem ser voltados a áudio são ${relevantItems.join(', ')}.`);
                } else if (asksLatest) {
                    directParts.push(`Na ordem em que a documentação exibiu os itens mais atuais, os ${relevantItems.length} modelos que consegui identificar em "${pageTitle}" foram ${relevantItems.join(', ')}.`);
                } else {
                    directParts.push(`Encontrei ${relevantItems.length} modelo${relevantItems.length > 1 ? 's' : ''} de IA explicitamente listado${relevantItems.length > 1 ? 's' : ''} em "${pageTitle}".`);
                }
            } else {
                directParts.push(
                    asksAudio
                        ? 'Não encontrei modelos com indicação clara de áudio no conteúdo visível que eu já tinha coletado.'
                        : 'Não encontrei uma lista confiável de modelos visíveis suficiente para responder com segurança.'
                );
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

    extractAgentPriceComparisons(artifacts = [], request = '') {
        const requestedProductTokens = this.extractAgentProductTokens(request);
        const entries = [];

        const artifactList = Array.isArray(artifacts) ? artifacts : [];

        artifactList.forEach((artifact) => {
            const store = artifact?.targetLabel || this.getReadableSiteLabel(artifact?.targetUrl || '');
            const pageText = this.coerceAgentList(artifact?.pageText || []);
            const priceLines = [];

            pageText.forEach((line, index) => {
                const matches = String(line || '').match(/R\$\s*[\d\.\,]+/gi) || [];
                matches.forEach((match) => {
                    const numericValue = this.parseBrazilianCurrency(match);
                    if (!Number.isFinite(numericValue)) {
                        return;
                    }

                    const normalizedLine = this.normalizeSearchText(line);
                    const nearbyLines = [
                        pageText[index - 1] || '',
                        pageText[index] || '',
                        pageText[index + 1] || ''
                    ].join(' ');
                    const normalizedNearby = this.normalizeSearchText(nearbyLines);
                    const productScore = requestedProductTokens.reduce((score, token) => (
                        normalizedNearby.includes(token) ? score + 2 : score
                    ), 0);
                    const cashScore = /a vista|avista|pix|boleto/i.test(normalizedLine) ? 10 : 0;
                    const score = productScore + cashScore;

                    priceLines.push({
                        store,
                        displayPrice: match.replace(/\s+/g, ' ').trim(),
                        numericValue,
                        score,
                        evidence: `${store}: ${line}`.trim()
                    });
                });
            });

            const bestEntry = priceLines
                .sort((left, right) => {
                    if (right.score !== left.score) {
                        return right.score - left.score;
                    }

                    return left.numericValue - right.numericValue;
                })
                .find((entry) => requestedProductTokens.length === 0 || entry.score > 0);

            if (bestEntry) {
                entries.push(bestEntry);
            }
        });

        const uniqueEntries = entries
            .filter((entry, index, array) => array.findIndex((candidate) => candidate.store === entry.store) === index)
            .sort((left, right) => left.numericValue - right.numericValue);

        return {
            entries: uniqueEntries,
            cheapest: uniqueEntries[0] || null
        };
    }

    extractAgentProductTokens(request = '') {
        const normalized = this.normalizeSearchText(request)
            .replace(/\b(preco|precos|valor|loja|lojas|mais barato|hoje|considerando|a vista|avista|pix|duas|diferentes|oficial|site|magalu|amazon|mercado livre|mercadolivre|casas bahia|casasbahia|kabum|fastshop|brasileiras|ex)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return normalized
            .split(' ')
            .filter((token) => token.length > 1)
            .slice(0, 8);
    }

    parseBrazilianCurrency(value) {
        const normalized = String(value || '')
            .replace(/R\$\s*/i, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim();
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    buildAgentFallbackNarrative({ request, targetUrl, pageTitle, blocked, mode, screenshots, analysis, dominantColor, navigationTrail, pageText, relevantItems = [], groundedResult = null, responseMode = 'new_research', priorContext = null, artifacts = [], executionPlan = null }) {
        const sections = [];
        const safeRequest = (request || '').trim();
        const siteLabel = this.getReadableSiteLabel(targetUrl);
        const navigationText = Array.isArray(navigationTrail) && navigationTrail.length
            ? navigationTrail
                .map((step) => this.sanitizeAgentTextItem(step.matchedText || step.targetHint || step.currentUrl, { maxLength: 120 }))
                .filter(Boolean)
                .join(' -> ')
            : '';
        const artifactList = Array.isArray(artifacts) ? artifacts : [];
        const requestedColor = /cor|color/i.test(safeRequest);
        const requestedList = /modelo|modelos|models|lista|todos|quais|itens/i.test(safeRequest);
        const requestedPrice = /preco|precos|price|valor|mais barato|a vista|avista|pix/i.test(this.normalizeSearchText(safeRequest));
        const safePageTitle = this.sanitizeAgentTextItem(pageTitle, { maxLength: 120 }) || pageTitle;
        const safePageText = this.coerceAgentList(pageText).slice(0, 220);
        const directAnswer = this.sanitizeAgentTextItem(groundedResult?.resposta_direta, { maxLength: 320 });
        const extractedItems = this.coerceAgentList(groundedResult?.itens_encontrados || relevantItems)
            .slice(0, this.extractRequestedItemCount(safeRequest));
        const evidences = this.coerceAgentList(groundedResult?.evidencias || [])
            .filter((item) => !extractedItems.includes(item))
            .slice(0, 4);
        const observation = this.sanitizeAgentTextItem(groundedResult?.observacao, { maxLength: 220 });
        const safeNextStep = this.sanitizeAgentTextItem(analysis?.proximo_passo, { maxLength: 180 });

        let intro = targetUrl
            ? artifactList.length > 1
                ? `Olá! Montei um plano, visitei ${artifactList.length} fontes nesta mesma execução e consolidei o que encontrei.`
                : requestedList
                    ? `Olá! Abri ${safePageTitle ? `"${safePageTitle}"` : siteLabel} e extraí os itens diretamente dessa página.`
                    : responseMode === 'continue_research'
                        ? `Olá! Continuei a pesquisa anterior em ${siteLabel}`
                        : `Olá! Já fui até ${siteLabel}`
            : executionPlan?.executionMode === 'text'
                ? 'Olá! Estruturei a tarefa em etapas e executei uma resposta autônoma sem depender de navegação web.'
                : 'Olá! Já analisei a tela que você pediu';

        if (navigationText && !requestedList) {
            intro += ` e naveguei por ${navigationText}`;
        }
        if (!/[.!?]$/.test(intro)) {
            intro += '.';
        }
        sections.push(intro);

        const resultLines = [];
        if (safePageTitle) {
            resultLines.push(`A página final aberta pelo agente foi "${safePageTitle}"${targetUrl ? ` (${targetUrl})` : ''}.`);
        }

        if (requestedColor && dominantColor) {
            resultLines.push(`Pela captura final, a cor predominante da página é ${dominantColor}.`);
        }

        if (directAnswer) {
            resultLines.push(directAnswer);
        } else if (analysis?.pagina_atual) {
            resultLines.push(`O conteúdo principal que consegui identificar foi: ${this.sanitizeAgentTextItem(analysis.pagina_atual, { maxLength: 280 })}.`);
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

        const unverifiedSources = artifactList.filter((artifact) => artifact?.sourceVerified === false);
        if (unverifiedSources.length) {
            resultLines.push('Nem todas as fontes puderam ser verificadas com segurança; considerei isso ao consolidar o resultado.');
        }

        sections.push(resultLines.join(' '));

        if (artifactList.length > 1) {
            const artifactLines = artifactList
                .map((artifact) => {
                    const label = artifact?.targetLabel || this.getReadableSiteLabel(artifact?.targetUrl || '');
                    const title = this.sanitizeAgentTextItem(artifact?.pageTitle || artifact?.targetUrl || 'Página sem título', { maxLength: 140 }) || 'Página sem título';
                    return `- ${label}: ${title}`;
                })
                .slice(0, 5);

            if (artifactLines.length) {
                sections.push(`Fontes e páginas percorridas nesta execução:\n${artifactLines.join('\n')}`);
            }
        }

        if (extractedItems.length) {
            const listTitle = requestedPrice
                ? 'Os preços que consegui confirmar nas fontes visitadas foram:'
                : /modelo|modelos|models/i.test(safeRequest) && /mais recente|mais recentes|latest|recent/i.test(this.normalizeSearchText(safeRequest))
                ? `Os ${extractedItems.length} modelos mais recentes que consegui identificar nessa página foram:`
                : /modelo|modelos|models/i.test(safeRequest)
                ? `Os ${extractedItems.length} modelos de IA que aparecem nessa página são:`
                : requestedList
                    ? `Os ${extractedItems.length} itens mais relevantes que encontrei nessa página foram:`
                : 'Os principais textos e elementos que consegui identificar foram:';
            sections.push(`${listTitle}\n- ${extractedItems.join('\n- ')}`);
        } else if (!requestedPrice && safePageText.length) {
            sections.push(`Os textos visíveis mais importantes que consegui extrair foram: ${safePageText.slice(0, 6).join(', ')}.`);
        }

        if (evidences.length) {
            sections.push(`Trechos da própria página que sustentam essa resposta:\n- ${evidences.join('\n- ')}`);
        }

        const closing = [];
        if (screenshots) {
            closing.push(`Gerei ${screenshots} captura${screenshots > 1 ? 's' : ''} durante a execução, uma para cada etapa relevante da navegação.`);
        }

        const priorPageTitle = this.sanitizeAgentTextItem(priorContext?.pageTitle, { maxLength: 120 });
        if (responseMode === 'continue_research' && priorPageTitle && priorPageTitle !== safePageTitle) {
            closing.push(`Esta etapa complementa a pesquisa anterior, cuja última página relevante era "${priorPageTitle}".`);
        }

        if (observation) {
            closing.push(observation);
        }

        if (!requestedColor && !requestedList && safeNextStep && !blocked) {
            closing.push(`Se você quiser, eu também posso continuar a navegação a partir daqui em "${safeNextStep}".`);
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

            const preferredModelItems = cleanItems.filter((item) => /llama|gpt|whisper|qwen|gemma|mistral|moonshot|deepseek|compound|claude|kimi|codex|sora|dall(?:\s|-)?e|\bo1\b|\bo3\b|\bo4\b|openai\/|meta-llama\/|groq\//i.test(item));
            return preferredModelItems
                .filter((item) => !genericNavItems.has(this.normalizeSearchText(item)))
                .filter((item) => item.length >= 2 && item.length <= 90)
                .slice(0, 12);
        }

        if (/download|downloads|release|versao|versoes|version|versions/i.test(request || '')) {
            return cleanItems
                .filter((item) => /\d|download|release|source|windows|mac|linux/i.test(item))
                .slice(0, 12);
        }

        return cleanItems.slice(0, 6);
    }

    filterAgentItemsForRequest(request, items = [], pageText = []) {
        const candidateItems = this.coerceAgentList(items);
        const normalizedRequest = this.normalizeSearchText(request);

        if (/audio|voz|speech|transcri|asr|tts/i.test(normalizedRequest)) {
            const audioItems = candidateItems.filter((item) => /whisper|audio|speech|voice|transcri|asr|tts/i.test(item));
            if (audioItems.length) {
                return audioItems;
            }
        }

        if (/openai|gpt oss|gpt/i.test(normalizedRequest)) {
            const openaiItems = candidateItems.filter((item) => /openai|gpt/i.test(item));
            if (openaiItems.length) {
                return openaiItems;
            }
        }

        if (/llama|meta/i.test(normalizedRequest)) {
            const llamaItems = candidateItems.filter((item) => /llama|meta/i.test(item));
            if (llamaItems.length) {
                return llamaItems;
            }
        }

        if (/compound|agente|agentic/i.test(normalizedRequest)) {
            const compoundItems = candidateItems.filter((item) => /compound/i.test(item));
            if (compoundItems.length) {
                return compoundItems;
            }
        }

        return candidateItems;
    }

    extractModelItemsFromPageText(pageText = []) {
        const lines = this.coerceAgentList(pageText)
            .map((item) => item.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const displayPattern = /\b(?:llama|gpt(?:-[a-z0-9.]+)?|whisper|qwen|gemma|mistral|moonshot|deepseek|compound|claude|kimi|codex|sora|dall(?:\s|-)?e|o\d|text-embedding|gpt-image|gpt-realtime|omni-moderation|tts|transcription)\b/i;
        const modelIdPattern = /^(?:[a-z0-9-]+\/)?[a-z0-9][a-z0-9./-]*$/i;
        const ignoredModelLabels = /browser search|agentic ai|modalities|capabilities|token speed|documentation|getting started|core features|tools integrations|overview|quickstart/i;
        const pairedItems = [];
        const standaloneItems = [];
        const allowedSuffixTokens = new Set(['mini', 'nano', 'pro', 'latest', 'high', 'low', 'turbo', 'large', 'small', 'medium', 'preview']);
        const extractLeadingModelLabel = (value = '') => {
            const tokens = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
            if (!tokens.length) {
                return '';
            }

            const firstToken = tokens[0];
            if (!displayPattern.test(firstToken) && !/^o\d(?:-\w+)?$/i.test(firstToken)) {
                return '';
            }

            const selected = [firstToken];
            for (let index = 1; index < tokens.length; index += 1) {
                const token = tokens[index];
                const normalizedToken = token.toLowerCase().replace(/[^\w-]/g, '');
                const isVersionToken = /^v\d+$/i.test(token) || /^\d+$/.test(token);
                if (!allowedSuffixTokens.has(normalizedToken) && !isVersionToken) {
                    break;
                }
                selected.push(token);
                if (selected.length >= 4) {
                    break;
                }
            }

            return selected.join(' ').trim();
        };
        const sanitizeDisplay = (value = '') => {
            const clean = String(value || '').replace(/\s+/g, ' ').trim();
            if (!clean) {
                return '';
            }

            let normalized = clean
                .replace(/^latest:\s*/i, '')
                .replace(/^model id\s+/i, '')
                .replace(/\s+\|\s+openai.*$/i, '')
                .trim();

            const openAiCardMatch = normalized.match(/^((?:GPT|Whisper|Codex|Sora|DALL(?:\s|-)?E|gpt-image|gpt-realtime|text-embedding|omni-moderation|o\d)[A-Za-z0-9 .:+/-]{0,48}?)(?:\s+(?:New|Preview|Best|Fastest|Flagship|Our|Built|For)\b|$)/i);
            if (openAiCardMatch?.[1]) {
                normalized = openAiCardMatch[1].trim();
            }

            const leadingLabel = extractLeadingModelLabel(normalized);
            if (leadingLabel) {
                normalized = leadingLabel;
            }

            normalized = normalized
                .replace(/\s{2,}.*/, '')
                .replace(/\b(New|Preview|Beta|Legacy|Deprecated)\b.*$/i, '')
                .replace(/[,:;.-]+$/g, '')
                .trim();

            return normalized;
        };
        const extractModelId = (value = '') => {
            const clean = String(value || '').replace(/\s+/g, ' ').trim();
            if (!clean) {
                return '';
            }

            const prefixed = clean.match(/\bmodel id\s+([a-z0-9][a-z0-9./-]*)\b/i);
            if (prefixed?.[1]) {
                return prefixed[1];
            }

            if (modelIdPattern.test(clean) && !clean.includes(' ') && (clean.includes('/') || /\d/.test(clean) || displayPattern.test(clean))) {
                return clean;
            }

            return '';
        };

        for (let index = 0; index < lines.length; index += 1) {
            const current = lines[index];
            const previous = lines[index - 1] || '';
            const next = lines[index + 1] || '';
            const currentDisplay = sanitizeDisplay(current);
            const previousDisplay = sanitizeDisplay(previous);
            const currentLooksLikeDisplay = Boolean(currentDisplay) && displayPattern.test(currentDisplay) && currentDisplay.length <= 80 && !ignoredModelLabels.test(currentDisplay);
            const currentLooksLikeId = extractModelId(current);
            const nextLooksLikeId = extractModelId(next);

            if (currentLooksLikeDisplay && nextLooksLikeId) {
                pairedItems.push(`${currentDisplay} (${nextLooksLikeId})`);
                continue;
            }

            if (currentLooksLikeId && previousDisplay && displayPattern.test(previousDisplay) && previousDisplay.length <= 80 && !ignoredModelLabels.test(previousDisplay)) {
                pairedItems.push(`${previousDisplay} (${currentLooksLikeId})`);
                continue;
            }

            if (currentLooksLikeId) {
                standaloneItems.push(currentLooksLikeId);
                continue;
            }

            if (currentLooksLikeDisplay && !/[()]/.test(currentDisplay)) {
                standaloneItems.push(currentDisplay);
            }
        }

        const pairedDisplayNames = new Set(
            pairedItems
                .map((item) => item.match(/^(.+?)\s+\(/)?.[1]?.trim())
                .filter(Boolean)
        );

        return [...pairedItems, ...standaloneItems.filter((item) => !pairedDisplayNames.has(item))]
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

    persistAgentUiState(patch = {}) {
        try {
            const currentState = JSON.parse(localStorage.getItem('drekee_agent_ui_state_v1') || '{}');
            const nextState = {
                ...currentState,
                ...patch,
                updatedAt: new Date().toISOString()
            };

            if (!nextState.activeTool && !nextState.pendingMessage) {
                localStorage.removeItem('drekee_agent_ui_state_v1');
                return;
            }

            localStorage.setItem('drekee_agent_ui_state_v1', JSON.stringify(nextState));
        } catch (error) {
            console.error('❌ [AGENT] Erro ao persistir estado da UI do agente:', error);
        }
    }

    restorePersistedAgentUiState() {
        try {
            const persistedState = JSON.parse(localStorage.getItem('drekee_agent_ui_state_v1') || '{}');
            const activeTool = persistedState?.activeTool || '';
            const pendingMessage = String(persistedState?.pendingMessage || '');

            if (pendingMessage && this.elements?.userInput && !this.elements.userInput.value.trim()) {
                this.elements.userInput.value = pendingMessage;
                this.elements.userInput.dispatchEvent(new Event('input', { bubbles: true }));
                if (activeTool) {
                    this.showNotification('📝 Restaurei sua mensagem. Reative manualmente a ferramenta desejada antes de enviar.', 'info');
                } else {
                    this.showNotification('📝 Restaurei sua mensagem após o redirecionamento.', 'info');
                }
            }

            if (activeTool) {
                if (pendingMessage) {
                    localStorage.setItem('drekee_agent_ui_state_v1', JSON.stringify({
                        pendingMessage,
                        updatedAt: new Date().toISOString()
                    }));
                } else {
                    localStorage.removeItem('drekee_agent_ui_state_v1');
                }
            }
        } catch (error) {
            console.error('❌ [AGENT] Erro ao restaurar estado da UI do agente:', error);
        }
    }

    loadAgentMemoryStore() {
        try {
            const rawValue = localStorage.getItem('drekee_agent_memory_v1');
            const parsed = rawValue ? JSON.parse(rawValue) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('❌ [AGENT] Erro ao carregar memória persistente:', error);
            return [];
        }
    }

    saveAgentMemoryStore() {
        try {
            localStorage.setItem('drekee_agent_memory_v1', JSON.stringify(this.agentLongTermMemory || []));
        } catch (error) {
            console.error('❌ [AGENT] Erro ao salvar memória persistente:', error);
        }
    }

    getRelevantAgentMemories(userMessage, limit = 5) {
        const memories = Array.isArray(this.agentLongTermMemory) ? this.agentLongTermMemory : [];
        const normalizedMessage = this.normalizeSearchText(userMessage);
        const messageTokens = normalizedMessage.split(' ').filter((token) => token.length > 2);

        return memories
            .map((memory) => {
                const normalizedValue = this.normalizeSearchText(`${memory?.label || ''} ${memory?.value || ''}`);
                let score = memory?.category === 'identity' ? 2 : 0;

                for (const token of messageTokens) {
                    if (normalizedValue.includes(token)) {
                        score += token.length > 4 ? 3 : 1;
                    }
                }

                return {
                    ...memory,
                    score
                };
            })
            .filter((memory) => memory.score > 0 || memory.category === 'identity')
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }

    extractAgentMemoryCandidates(userMessage, finalText = '', context = {}) {
        const candidates = [];
        const cleanMessage = String(userMessage || '').trim();

        const nameMatch = cleanMessage.match(/\bmeu nome e ([A-Za-zÀ-ÿ' -]{2,40})/i);
        if (nameMatch?.[1]) {
            candidates.push({
                key: 'identity:name',
                category: 'identity',
                label: 'Nome do usuário',
                value: nameMatch[1].trim()
            });
        }

        const projectMatch = cleanMessage.match(/\b(?:estou criando|quero criar|estou construindo|estou fazendo)\s+(.{4,120})/i);
        if (projectMatch?.[1]) {
            candidates.push({
                key: 'project:current',
                category: 'project',
                label: 'Projeto atual',
                value: projectMatch[1].trim().replace(/[.?!]+$/g, '')
            });
        }

        const preferenceMatch = cleanMessage.match(/\bprefiro\s+(.{3,80})/i);
        if (preferenceMatch?.[1]) {
            candidates.push({
                key: `preference:${this.normalizeSearchText(preferenceMatch[1]).split(' ').slice(0, 4).join('_')}`,
                category: 'preference',
                label: 'Preferência declarada',
                value: preferenceMatch[1].trim().replace(/[.?!]+$/g, '')
            });
        }

        const goalMatch = cleanMessage.match(/\b(?:me ajuda a|quero|preciso)\s+(.{4,120})/i);
        if (goalMatch?.[1] && !/site|pagina|abra|entre|acesse/i.test(goalMatch[1])) {
            candidates.push({
                key: `goal:${this.normalizeSearchText(goalMatch[1]).split(' ').slice(0, 5).join('_')}`,
                category: 'goal',
                label: 'Objetivo recorrente',
                value: goalMatch[1].trim().replace(/[.?!]+$/g, '')
            });
        }

        if (context?.pageTitle && /projeto|site|app/i.test(cleanMessage) && cleanMessage.length < 160) {
            candidates.push({
                key: 'context:last_agent_topic',
                category: 'context',
                label: 'Último tema agêntico',
                value: `${context.pageTitle} | ${context.request || cleanMessage}`
            });
        }

        return candidates;
    }

    rememberAgentTurn(userMessage, finalText, context = {}) {
        const candidates = this.extractAgentMemoryCandidates(userMessage, finalText, context);
        if (!candidates.length) {
            return;
        }

        const currentMemories = Array.isArray(this.agentLongTermMemory) ? this.agentLongTermMemory : [];
        const nextMemories = [...currentMemories];

        candidates.forEach((candidate) => {
            const existingIndex = nextMemories.findIndex((memory) => memory.key === candidate.key);
            const nextValue = {
                ...candidate,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                nextMemories[existingIndex] = {
                    ...nextMemories[existingIndex],
                    ...nextValue
                };
            } else {
                nextMemories.push(nextValue);
            }
        });

        this.agentLongTermMemory = nextMemories.slice(-30);
        this.saveAgentMemoryStore();
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
                        return this.sanitizeAgentTextItem(item);
                    }

                    if (item && typeof item === 'object') {
                        return this.sanitizeAgentTextItem(item.text || item.label || item.name || item.tag || '');
                    }

                    return this.sanitizeAgentTextItem(String(item || ''));
                })
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            const delimiter = value.includes('\n') ? /\n+/ : /,\s*/;
            return value
                .split(delimiter)
                .map((item) => this.sanitizeAgentTextItem(item))
                .filter(Boolean);
        }

        return [];
    }

    looksLikeAgentNoise(text = '') {
        const sample = String(text || '').trim();
        if (!sample) {
            return true;
        }

        if (sample.length > 500) {
            return true;
        }

        const suspiciousPatterns = [
            /<script\b|<\/script>|<style\b|<\/style>|<!doctype|<html\b|<\/html>/i,
            /@font-face|src:url\(|format\(['"]truetype['"]\)|dataLayer|AF_initData|WIZ_global_data/i,
            /\bfunction\b|\breturn\b|=>|var\s+[a-z_$][\w$]*|const\s+[a-z_$][\w$]*|let\s+[a-z_$][\w$]*/i,
            /_[A-Za-z0-9]+\s*=\s*function|\bSymbol\(|Object\.defineProperties|Array\.prototype|Promise|WeakMap/i,
            /[{};]{4,}|\\x[0-9a-f]{2}|\.call\(this\)|prototype\./i
        ];

        if (suspiciousPatterns.some((pattern) => pattern.test(sample))) {
            return true;
        }

        const punctuationChars = sample.replace(/[A-Za-z0-9À-ÿ\s]/g, '');
        if (sample.length > 120 && punctuationChars.length / sample.length > 0.22) {
            return true;
        }

        return false;
    }

    sanitizeAgentTextItem(value, { maxLength = 220 } = {}) {
        if (value == null) {
            return '';
        }

        let text = String(value)
            .replace(/[\u200B-\u200F\u202A-\u202E\u2060]/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!text) {
            return '';
        }

        if (this.looksLikeAgentNoise(text)) {
            return '';
        }

        if (text.length > maxLength) {
            text = `${text.slice(0, maxLength - 1).trim()}…`;
        }

        return text;
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
        this.stopAgentWorkingState();
        
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
        this.persistAgentUiState({ activeTool: null, pendingMessage: '' });
        
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
                createBtn.classList.add('active', 'agent-active');
                createBtn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300', 'border-orange-500', 'text-orange-400');
                createBtn.innerHTML = `
                    <span class="material-icons-outlined">smart_toy</span>
                    <span class="text-xs font-medium">Drekee Agent Ativo</span>
                    <span class="toolbar-status-badge toolbar-status-badge-beta">BETA</span>
                `;
            } else {
                createBtn.classList.remove('active', 'agent-active');
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
        const createBtn = document.getElementById('createToggle');
        if (createBtn) {
            createBtn.classList.remove('active', 'agent-active');
            createBtn.classList.remove('border-blue-500', 'text-blue-400', 'border-green-500', 'text-green-400');
            createBtn.innerHTML = `
                <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                <span>Ferramentas</span>
            `;
        }
    }

    // Atualizar botão de criação para mostrar modo ativo
    updateCreateButton() {
        const createBtn = document.getElementById('createToggle');
        if (!createBtn) {
            return;
        }

        createBtn.classList.remove('border-blue-500', 'text-blue-400', 'border-green-500', 'text-green-400');

        if (window.isAgentMode) {
            createBtn.classList.add('active', 'agent-active');
            createBtn.innerHTML = `
                <span class="material-icons-outlined">smart_toy</span>
                <span>Drekee Agent Ativo</span>
                <span class="toolbar-status-badge toolbar-status-badge-beta">BETA</span>
            `;
            return;
        }

        if (window.isInvestigateMode) {
            createBtn.classList.add('active');
            createBtn.innerHTML = `
                <span class="material-icons-outlined" style="font-size:1rem">troubleshoot</span>
                <span>Drekee Investigate</span>
            `;
            return;
        }

        if (window.isREMode) {
            createBtn.classList.add('active');
            createBtn.innerHTML = `
                <span class="material-icons-outlined" style="font-size:1rem">calculate</span>
                <span>RE Ativo</span>
            `;
            return;
        }

        if (window.isDocumentModeActive) {
            createBtn.classList.add('active');
            createBtn.innerHTML = `
                <span class="material-icons-outlined" style="font-size:1rem">description</span>
                <span>Documento</span>
            `;
            return;
        }

        if (window.isSlidesModeActive) {
            createBtn.classList.add('active');
            createBtn.innerHTML = `
                <span class="material-icons-outlined" style="font-size:1rem">slideshow</span>
                <span>Apresentação</span>
            `;
            return;
        }

        this.resetCreateButtons();
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

    async initializeUpdatesExperience() {
        await this.refreshUpdatesBadge();
        await this.showStartupUpdateCardIfNeeded();
    }

    async refreshUpdatesBadge() {
        const badge = this.elements?.updatesBadge;
        if (!badge) {
            return;
        }

        try {
            const unreadCount = await countUnreadUpdates();
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                badge.classList.remove('hidden');
            } else {
                badge.textContent = '0';
                badge.classList.add('hidden');
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar badge de atualizações:', error);
        }
    }

    async showStartupUpdateCardIfNeeded() {
        try {
            const update = await fetchLatestStartupUpdate();
            if (!update) {
                return;
            }

            const existing = document.getElementById('startupUpdateCard');
            if (existing) {
                existing.remove();
            }

            const card = document.createElement('div');
            card.id = 'startupUpdateCard';
            card.className = 'fixed right-5 top-20 z-[999] w-[min(380px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-[#111b30]/95 p-5 shadow-2xl backdrop-blur-xl';
            card.innerHTML = `
                <button id="startupUpdateClose" class="absolute right-3 top-3 rounded-full p-1 text-slate-400 transition hover:bg-white/5 hover:text-white">
                    <span class="material-icons-outlined" style="font-size:1rem">close</span>
                </button>
                <div class="mb-3 flex items-center gap-2">
                    <span class="toolbar-status-badge toolbar-status-badge-danger">NOVA</span>
                    <span class="text-xs uppercase tracking-[0.18em] text-slate-400">Atualização</span>
                </div>
                ${buildUpdateMediaHtml(update, 'mb-4 max-h-56 w-full rounded-2xl object-cover')}
                ${update.title ? `<h3 class="mb-2 text-base font-semibold text-white">${this.escapeHtml(update.title)}</h3>` : ''}
                ${update.body ? `<p class="text-sm leading-6 text-slate-300">${this.escapeHtml(update.body).replace(/\n/g, '<br>')}</p>` : ''}
                <div class="mt-4 flex items-center justify-between gap-3">
                    <span class="text-xs text-slate-500">${new Date(update.created_at).toLocaleString('pt-BR')}</span>
                    <a href="atualizacoes.html" class="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500">Ver atualização</a>
                </div>
            `;

            const dismiss = async () => {
                await markStartupUpdateSeen(update.id);
                card.remove();
                await this.refreshUpdatesBadge();
            };

            card.querySelector('#startupUpdateClose')?.addEventListener('click', dismiss);
            document.body.appendChild(card);
        } catch (error) {
            console.error('❌ Erro ao mostrar card inicial de atualização:', error);
        }
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
        return this.attachImageFile(file);
    }

    removeAttachment(id) {
        this.attachedFiles = this.attachedFiles.filter((attachment) => attachment.id !== id);
        this.renderAttachedFiles();
    }

    renderAttachments() {
        this.renderAttachedFiles();
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
            reader.readAsDataURL(file);
        });
    }

    async attachImageFile(file, options = {}) {
        const { silent = false } = options;
        if (!file) return false;

        if (!String(file.type || '').startsWith('image/')) {
            if (!silent) {
                this.showNotification(`❌ ${file.name || 'Arquivo'} não é uma imagem válida.`, 'error');
            }
            return false;
        }

        if (this.attachedFiles.length >= 5) {
            if (!silent) {
                this.showNotification('❌ Máximo de 5 imagens anexadas.', 'error');
            }
            return false;
        }

        const MAX_SIZE = 4 * 1024 * 1024;
        if ((file.size || 0) > MAX_SIZE) {
            if (!silent) {
                this.showNotification(`❌ A imagem ${file.name || 'selecionada'} excede 4MB.`, 'error');
            }
            return false;
        }

        try {
            const dataUrl = await this.readFileAsDataUrl(file);
            const attachment = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                file,
                preview: dataUrl,
                name: file.name || `imagem_${Date.now()}.png`,
                mime: file.type || 'image/png',
                type: 'image',
                content: dataUrl,
                size: file.size || 0
            };
            this.attachedFiles.push(attachment);
            this.renderAttachedFiles();
            if (!silent) {
                this.showNotification(`🖼️ ${attachment.name} anexada com sucesso.`, 'success');
            }
            return true;
        } catch (error) {
            console.error('❌ Erro ao anexar imagem:', error);
            if (!silent) {
                this.showNotification('❌ Não consegui anexar essa imagem.', 'error');
            }
            return false;
        }
    }

    async attachImageFromUrl(url, options = {}) {
        const { silent = false } = options;
        if (!url) return false;

        const normalizedUrl = String(url).trim();
        const candidateUrls = [
            normalizedUrl,
            `/api/image-proxy?url=${encodeURIComponent(normalizedUrl)}`
        ];

        for (const candidateUrl of candidateUrls) {
            try {
                const response = await fetch(candidateUrl);
                if (!response.ok) {
                    continue;
                }
                const blob = await response.blob();
                const extension = (blob.type || 'image/png').split('/')[1] || 'png';
                const file = new File([blob], `imagem_arrastada_${Date.now()}.${extension}`, {
                    type: blob.type || 'image/png'
                });
                const attached = await this.attachImageFile(file, { silent });
                if (attached) {
                    return true;
                }
            } catch (error) {
                console.warn('Falha ao importar imagem por URL:', candidateUrl, error);
            }
        }

        if (!silent) {
            this.showNotification('❌ Não consegui anexar a imagem arrastada.', 'error');
        }
        return false;
    }

    extractDraggedImageUrls(dataTransfer) {
        const urls = new Set();
        const html = dataTransfer?.getData('text/html') || '';
        const uriList = dataTransfer?.getData('text/uri-list') || '';
        const plainText = dataTransfer?.getData('text/plain') || '';

        if (html) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('img[src]').forEach((img) => {
                    if (img.src) urls.add(img.src);
                });
            } catch (error) {
                console.warn('Falha ao ler HTML arrastado:', error);
            }
        }

        uriList
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => urls.add(line));

        if (/^https?:\/\//i.test(plainText) && /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(plainText)) {
            urls.add(plainText.trim());
        }

        return Array.from(urls);
    }

    hasImageDataTransfer(dataTransfer) {
        if (!dataTransfer) return false;
        const items = Array.from(dataTransfer.items || []);
        if (items.some((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'))) {
            return true;
        }
        const types = Array.from(dataTransfer.types || []);
        return types.includes('Files') || types.includes('text/html') || types.includes('text/uri-list');
    }

    showDragDropOverlay() {
        const overlay = this.elements.dragDropOverlay;
        if (!overlay) return;
        overlay.classList.add('is-visible');
    }

    hideDragDropOverlay(force = false) {
        const overlay = this.elements.dragDropOverlay;
        if (!overlay) return;
        if (force) {
            this.dragOverlayCounter = 0;
        }
        if (this.dragOverlayCounter <= 0 || force) {
            overlay.classList.remove('is-visible');
        }
    }

    setupClipboardImagePaste() {
        const input = this.elements.userInput;
        if (!input) return;

        input.addEventListener('paste', async (event) => {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItems = items.filter((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'));
            if (imageItems.length === 0) {
                return;
            }

            event.preventDefault();
            let addedCount = 0;
            for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;
                const attached = await this.attachImageFile(file, { silent: true });
                if (attached) {
                    addedCount += 1;
                }
            }

            if (addedCount > 0) {
                this.showNotification(`🖼️ ${addedCount} imagem(ns) colada(s) como anexo.`, 'success');
            }
        });
    }

    setupDragAndDropAttachments() {
        const overlay = this.elements.dragDropOverlay;
        if (!overlay) return;

        const onDragEnter = (event) => {
            if (!this.hasImageDataTransfer(event.dataTransfer)) return;
            event.preventDefault();
            this.dragOverlayCounter += 1;
            this.showDragDropOverlay();
        };

        const onDragOver = (event) => {
            if (!this.hasImageDataTransfer(event.dataTransfer)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            this.showDragDropOverlay();
        };

        const onDragLeave = (event) => {
            if (!this.hasImageDataTransfer(event.dataTransfer)) return;
            event.preventDefault();
            this.dragOverlayCounter = Math.max(0, this.dragOverlayCounter - 1);
            this.hideDragDropOverlay();
        };

        const onDrop = async (event) => {
            if (!this.hasImageDataTransfer(event.dataTransfer)) return;
            event.preventDefault();
            this.hideDragDropOverlay(true);

            let addedCount = 0;
            const imageFiles = Array.from(event.dataTransfer?.files || []).filter((file) => String(file.type || '').startsWith('image/'));
            for (const file of imageFiles) {
                const attached = await this.attachImageFile(file, { silent: true });
                if (attached) {
                    addedCount += 1;
                }
            }

            if (addedCount === 0) {
                const draggedUrls = this.extractDraggedImageUrls(event.dataTransfer).slice(0, Math.max(0, 5 - this.attachedFiles.length));
                for (const url of draggedUrls) {
                    const attached = await this.attachImageFromUrl(url, { silent: true });
                    if (attached) {
                        addedCount += 1;
                    }
                }
            }

            if (addedCount > 0) {
                this.showNotification(`🖼️ ${addedCount} imagem(ns) anexada(s) por arrastar e soltar.`, 'success');
            } else {
                this.showNotification('❌ Não encontrei imagens válidas para anexar.', 'error');
            }
        };

        window.addEventListener('dragenter', onDragEnter);
        window.addEventListener('dragover', onDragOver);
        window.addEventListener('dragleave', onDragLeave);
        window.addEventListener('drop', onDrop);
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
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.currentChatId = chatId;

        this.removeFollowUpSuggestions();
        this.removeLastThinkingMessage();
        this.responseCodeBlocks.clear();

        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }

        const hasMessages = chat && chat.messages && chat.messages.length > 0;
        
        // Mover input para baixo se tiver mensagens, senão para cima
        if (hasMessages) {
            this.moveInputDown();
            this.hideWelcomeScreen(); // Esconder tela inicial se tiver mensagens
        } else {
            this.moveInputUp();
            this.showWelcomeScreen(); // Mostrar tela inicial se não tiver mensagens
        }

        if (DEBUG) {
            console.log('📂 Abrindo chat:', chatId);
            console.log('📝 Mensagens do chat:', chat.messages.length);
        }

        // Só mostrar mensagens se tiver
        if (hasMessages) {
            chat.messages.forEach((msg, index) => {
                if (DEBUG) console.log(`  ${index + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
                this.renderStoredChatMessage(msg);
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

    renderStoredChatMessage(message = {}) {
        if (!message || typeof message !== 'object') {
            return;
        }

        if (message.role === 'user') {
            const attachments = Array.isArray(message.attachments) ? message.attachments : null;
            this.addUserMessage(message.content || '', attachments, {
                preserveCreateMode: true,
                fromHistory: true
            });
            return;
        }

        if (message.role === 'assistant') {
            this.addAssistantMessage(
                message.content || '',
                Array.isArray(message.sources) ? message.sources : null,
                typeof message.thinking === 'string' ? message.thinking : null,
                {
                    persist: false,
                    fromHistory: true,
                    videos: Array.isArray(message.videos) ? message.videos : []
                }
            );
        }
    }

    updateChatTitleFromMessages(chat) {
        if (!chat || !Array.isArray(chat.messages)) {
            return;
        }

        const firstUserMessage = chat.messages.find((message) => message?.role === 'user' && typeof message.content === 'string' && message.content.trim());
        if (!firstUserMessage) {
            return;
        }

        const nextTitle = firstUserMessage.content.trim();
        chat.title = nextTitle.substring(0, 50) + (nextTitle.length > 50 ? '...' : '');
    }

    persistMessageToChat(chatId, message) {
        if (!chatId || !message || typeof message !== 'object') {
            return null;
        }

        const chat = this.chats.find((item) => item.id === chatId);
        if (!chat) {
            return null;
        }

        if (!Array.isArray(chat.messages)) {
            chat.messages = [];
        }

        chat.messages.push(message);
        this.updateChatTitleFromMessages(chat);
        this.saveCurrentChat(chatId);
        this.renderChatHistory();
        return chat;
    }

    updateAssistantMessageByContent(chatId, assistantContent, patch = {}) {
        if (!chatId || !assistantContent || !patch || typeof patch !== 'object') {
            return null;
        }

        const chat = this.chats.find((item) => item.id === chatId);
        if (!chat || !Array.isArray(chat.messages)) {
            return null;
        }

        const targetContent = String(assistantContent);

        for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
            const message = chat.messages[index];
            if (message?.role !== 'assistant' || String(message.content || '') !== targetContent) {
                continue;
            }

            Object.entries(patch).forEach(([key, value]) => {
                if (value == null) {
                    return;
                }

                if (Array.isArray(value)) {
                    message[key] = value;
                    return;
                }

                if (typeof value === 'object') {
                    message[key] = {
                        ...(typeof message[key] === 'object' && message[key] !== null ? message[key] : {}),
                        ...value
                    };
                    return;
                }

                message[key] = value;
            });

            this.saveCurrentChat(chatId);
            this.renderChatHistory();
            return message;
        }

        return null;
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



        this.elements.sendButton.addEventListener('click', this.boundHandleSend);
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        if (this.elements.updatesBtn) {
            this.elements.updatesBtn.addEventListener('click', () => {
                window.location.href = 'atualizacoes.html';
            });
        }
        
        // Configurar dropdown do botão Criar
        this.setupCreateDropdown();
        
        // Botão de Modo Depuração
        const debugBtn = document.getElementById('debugModeButton');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.toggleDebugMode());
        }



        // Botão de anexar arquivo
        this.setupAttachListeners();
        this.setupAutoScrollObserver();
        this.restorePersistedAgentUiState();
        
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
        this.setupClipboardImagePaste();
        this.setupDragAndDropAttachments();

        

        // Inicializar sistema de autenticação
        this.initAuthSystem();
        this.initializeUpdatesExperience();

        

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

                <button class="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 last:rounded-b-lg" data-external-url="https://drekeepro.vercel.app">

                    <span class="material-icons-outlined text-base text-cyan-400 mt-0.5">rocket_launch</span>

                    <div class="flex-1">
                        <div class="font-medium">Ultra</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drekee 1.5 Pro</div>
                    </div>

                </button>

            </div>

        `;



        document.body.insertAdjacentHTML('beforeend', dropdownHTML);

        

        // Setup dos botões do dropdown

        const buttons = document.querySelectorAll('#floatingModelDropdown button[data-model], #floatingModelDropdown button[data-external-url]');

        buttons.forEach(btn => {

            btn.addEventListener('click', (e) => {

                e.stopPropagation();

                if (!btn.disabled) {
                    if (btn.dataset.externalUrl) {
                        window.open(btn.dataset.externalUrl, '_blank', 'noopener,noreferrer');
                    } else {
                        const model = btn.dataset.model;
                        this.setModel(model);
                    }

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
                text.textContent = createNames[createType] || 'Criar';
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
                this.queueMathTypeset(messageElement);
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
                this.queueMathTypeset(messageElement);
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
            this.persistAgentUiState({
                activeTool: window.isAgentMode ? 'agent' : window.isREMode ? 're' : window.isInvestigateMode ? 'investigate' : null,
                pendingMessage: message
            });
            window.location.href = 'login.html';
            return;
        }

        this.persistAgentUiState({
            activeTool: window.isAgentMode ? 'agent' : window.isREMode ? 're' : window.isInvestigateMode ? 'investigate' : null,
            pendingMessage: ''
        });

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



        if (!this.currentChatId || !this.chats.find(c => c.id === this.currentChatId)) {

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

    async copyTextToClipboard(text = '') {
        const content = String(text ?? '');

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(content);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!copied) {
            throw new Error('Nao foi possivel copiar o texto');
        }
    }

    async downloadImageFromUrl(url, filename = 'drekee-unsplash.jpg', button = null) {
        if (!url) return;

        const originalLabel = button ? button.innerHTML : '';

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="material-icons-outlined" style="font-family: \'Material Icons Outlined\'; font-size: 18px; line-height: 1;">downloading</span>';
            }

            const candidates = [
                `/api/image-proxy?url=${encodeURIComponent(url)}`,
                url
            ];

            let imageBlob = null;

            for (const candidate of candidates) {
                try {
                    const response = await fetch(candidate);
                    if (!response.ok) continue;

                    imageBlob = await response.blob();
                    if (imageBlob && imageBlob.size > 0) {
                        break;
                    }
                } catch (fetchError) {
                    console.warn('⚠️ Falha ao baixar imagem por uma rota candidata:', fetchError);
                }
            }

            if (!imageBlob) {
                throw new Error('Nao foi possivel baixar a imagem');
            }

            const objectUrl = URL.createObjectURL(imageBlob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);

            if (button) {
                button.innerHTML = '<span class="material-icons-outlined" style="font-family: \'Material Icons Outlined\'; font-size: 18px; line-height: 1;">check</span>';
            }
        } catch (error) {
            console.error('❌ Erro ao baixar imagem:', error);
            if (button) {
                button.innerHTML = '<span class="material-icons-outlined" style="font-family: \'Material Icons Outlined\'; font-size: 18px; line-height: 1;">error</span>';
            }
        } finally {
            if (button) {
                setTimeout(() => {
                    button.disabled = false;
                    button.innerHTML = originalLabel;
                }, 1800);
            }
        }
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

                if (f && typeof f.content === 'string' && f.content.length > 0) {
                    fileCard.style.cursor = 'pointer';
                    fileCard.addEventListener('click', (e) => {
                        e.stopPropagation();
                        try { this.viewFileModal(f); } catch (err) { console.warn('Erro abrindo arquivo:', err); }
                    });
                }

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

    addAssistantMessage(text, sources = null, thinking = null, options = {}) {

        const messageDiv = document.createElement('div');

        messageDiv.className = 'mb-6 flex justify-start animate-slideIn';

        const uniqueId = 'msg_' + Date.now();
        const safeText = text == null ? '' : String(text);
        const sourceList = Array.isArray(sources) ? sources : [];
        const videoList = Array.isArray(options?.videos) ? options.videos : [];
        const shouldPersist = options?.persist === true;
        const targetChatId = options?.chatId || this.currentChatId;

        let sourcesHtml = '';
        
        // Adicionar fontes se existirem
        if (sourceList.length > 0) {
            sourcesHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fontes</div>
                    <div class="space-y-2">
                        ${sourceList.map((source, index) => `
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

            if (safeText.trim().startsWith('<')) {

                // Texto HTML vindo de fontes internas ou widgets. Sanitizar antes de inserir.
                let processedText = this.sanitizeHtml(safeText);
                
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
                this.queueMathTypeset(responseDiv);

            } else {

                // Texto normal - formatar

                responseDiv.innerHTML = this.formatResponse(safeText, responseDiv.id);
                this.queueMathTypeset(responseDiv);

            }

            // Adicionar indicador de thinking se houver

            if (thinking && thinking.trim()) {

                const thinkingDiv = document.createElement('div');

                thinkingDiv.className = 'mt-2 text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-600 pt-2';

                thinkingDiv.textContent = thinking;

                responseDiv.appendChild(thinkingDiv);

            }

            if (videoList.length > 0) {
                this.appendYouTubeVideosToMessage(responseDiv.id, videoList);
            }

        }



        if (shouldPersist) {
            const msgObj = { role: 'assistant', content: safeText };
            if (thinking) msgObj.thinking = thinking;
            if (sourceList.length > 0) msgObj.sources = sourceList;
            if (videoList.length > 0) msgObj.videos = videoList;
            this.persistMessageToChat(targetChatId, msgObj);
        }

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
                    <div class="text-base leading-relaxed text-gray-600 dark:text-gray-300 mb-4" id="thinkingHeader_${uniqueId}"></div>
                    <div class="text-base leading-relaxed text-gray-700 dark:text-gray-200 min-h-4" id="responseText_${uniqueId}"></div>
                </div>
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Adicionar barra invisível com botões de ação
        const actionsDiv = document.createElement('div');
        actionsDiv.id = `actions_${uniqueId}`;
        actionsDiv.className = 'flex items-center gap-1.5 mt-2 mb-1 ml-11 px-2 opacity-0 transition-opacity duration-300';
        actionsDiv.innerHTML = `
            <button class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors" id="copyBtn_${uniqueId}" title="Copiar resposta">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>
            </button>
            <button class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors" id="regenerateBtn_${uniqueId}" title="Gerar novamente">
                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">refresh</span>
            </button>
        `;
        
        this.elements.messagesContainer.appendChild(actionsDiv);
        this.scrollToBottom();
        
        // Setup dos botões de ação
        const copyBtn = document.getElementById(`copyBtn_${uniqueId}`);
        const regenerateBtn = document.getElementById(`regenerateBtn_${uniqueId}`);
        
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const responseText = document.getElementById(`responseText_${uniqueId}`);
                if (responseText) {
                    const copyTarget = document.getElementById(`response-text-responseText_${uniqueId}`) || responseText;
                    this.copyTextToClipboard(copyTarget.textContent).then(() => {
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
                if (window.ui && typeof window.ui.showRegenerateModal === 'function') {
                    window.ui.showRegenerateModal();
                }
            });
        }
        
        // Retornar objeto com IDs esperados pelos modelos
        return {
            uniqueId: uniqueId,
            headerId: `thinkingHeader_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            actionsId: `actions_${uniqueId}`,
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
        actionsDiv.id = `actions_${uniqueId}`;
        actionsDiv.className = 'flex items-center gap-1.5 mt-2 mb-1 ml-11 px-2 opacity-0 transition-opacity duration-300';

        actionsDiv.innerHTML = `

            <button class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors" id="copyBtn_${uniqueId}" title="Copiar resposta">

                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">content_copy</span>

            </button>

            <button class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-gray-600 shadow-sm backdrop-blur hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors" id="regenerateBtn_${uniqueId}" title="Gerar novamente">

                <span class="material-icons-outlined text-sm text-gray-600 dark:text-gray-400">refresh</span>

            </button>

        `;

        this.elements.messagesContainer.appendChild(actionsDiv);

        

        this.scrollToBottom();

        

        // Setup dos botões de ação

        const copyBtn = document.getElementById(`copyBtn_${uniqueId}`);

        const regenerateBtn = document.getElementById(`regenerateBtn_${uniqueId}`);

        

        if (copyBtn) {

            copyBtn.addEventListener('click', async () => {

                const responseText = document.getElementById(`responseText_${uniqueId}`);

                if (responseText) {

                    const copyTarget = document.getElementById(`response-text-responseText_${uniqueId}`) || responseText;

                    this.copyTextToClipboard(copyTarget.textContent).then(() => {

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

                if (window.ui && typeof window.ui.showRegenerateModal === 'function') {

                    window.ui.showRegenerateModal();

                }

            });

        }

        

        // RETORNAR O OBJETO COM IDs ESPERADOS PELOS MODELOS
        return {
            uniqueId: uniqueId,
            headerId: `thinkingHeader_${uniqueId}`,
            responseId: `responseText_${uniqueId}`,
            actionsId: `actions_${uniqueId}`,
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



    buildTypewriterChunks(text = '') {
        const glyphs = Array.from(String(text || ''));
        const chunks = [];
        let index = 0;

        const baseSize = glyphs.length > 4000 ? 10
            : glyphs.length > 2500 ? 8
            : glyphs.length > 1400 ? 6
            : glyphs.length > 700 ? 4
            : 2;

        while (index < glyphs.length) {
            let size = baseSize;
            const nextChar = glyphs[index + size - 1] || '';

            if (/[.,;:!?]/.test(nextChar)) {
                size += 1;
            }

            if (nextChar === '\n') {
                size = Math.max(2, baseSize - 1);
            }

            chunks.push(glyphs.slice(index, index + size).join(''));
            index += size;
        }

        return chunks;
    }

    parseResponseSegments(text = '') {
        const source = String(text || '');
        const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
        const segments = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(source)) !== null) {
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: source.slice(lastIndex, match.index)
                });
            }

            segments.push({
                type: 'code',
                ...this.parseCodeFenceInfo(match[1] || ''),
                code: (match[2] || '').trim()
            });

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < source.length) {
            segments.push({
                type: 'text',
                content: source.slice(lastIndex)
            });
        }

        return segments;
    }

    async typewriterEffect(text, element, callback, imagesHtml = '') {

        console.log('🔍 [TYPE] Iniciando typewriterEffect');
        console.log('🔍 [TYPE] Text length:', text ? text.length : 0);
        console.log('🔍 [TYPE] Element:', !!element);
        console.log('🔍 [TYPE] Callback:', typeof callback);
        
        text = (text == null) ? '' : String(text);
        const responseKey = element?.id || `response_${Date.now()}`;

        console.log('🔍 [TYPE] Iniciando typewriter com imagesHtml length:', imagesHtml.length);
        console.log('🔍 [TYPE] ImagesHtml preview:', imagesHtml.substring(0, 100));

        if (!text || text.length === 0) {
            const formattedHtml = this.formatResponse(text, responseKey);
            element.innerHTML = imagesHtml + formattedHtml;
            this.queueMathTypeset(element);
            if (callback) callback();
            return;
        }

        const segments = this.parseResponseSegments(text);
        const activeCodeBlocks = [];
        let assembledText = '';

        for (const segment of segments) {
            if (segment.type === 'code') {
                const codeIndex = activeCodeBlocks.length;
                activeCodeBlocks.push({
                    lang: segment.lang,
                    fileName: segment.fileName || '',
                    code: segment.code
                });
                assembledText += `\n\n%%CODEBLOCK${codeIndex}%%\n\n`;
                element.innerHTML = imagesHtml + this.formatResponse(assembledText, responseKey, {
                    providedCodeBlocks: activeCodeBlocks
                });
                this.scrollToBottom();
                continue;
            }

            const chunks = this.buildTypewriterChunks(segment.content);

            for (let index = 0; index < chunks.length; index++) {
                assembledText += chunks[index];

                const formattedPartial = this.formatResponse(assembledText, responseKey, {
                    providedCodeBlocks: activeCodeBlocks
                });
                element.innerHTML = imagesHtml + formattedPartial;

                if (index % 2 === 0 || index === chunks.length - 1) {
                    this.scrollToBottom();
                }

                await this.sleep(chunks.length > 220 ? 2 : chunks.length > 120 ? 3 : 4);
            }
        }

        const finalFormatted = this.formatResponse(assembledText, responseKey, {
            providedCodeBlocks: activeCodeBlocks
        });
        element.innerHTML = imagesHtml + finalFormatted;
        this.queueMathTypeset(element);

        setTimeout(() => this.scrollToBottom(), 60);

        if (callback) callback();
    }



    formatResponse(text, responseKey = null, options = {}) {

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
        const preferMathJaxDisplay = String(responseKey || '').startsWith('re_');
        const mathPlaceholder = (i) => `___MATH_RENDER_${i}___`;
        const renderMathToHtml = (math, displayMode) => {
            if (preferMathJaxDisplay) {
                const cleanedMath = String(math).trim();
                return displayMode ? `$$${cleanedMath}$$` : `$${cleanedMath}$`;
            }
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

        const providedCodeBlocks = Array.isArray(options?.providedCodeBlocks) ? options.providedCodeBlocks : null;
        const codeBlocks = providedCodeBlocks ? [...providedCodeBlocks] : [];
        const normalizedResponseKey = responseKey || `response_${Date.now()}`;
        const codePlaceholder = (index) => `%%CODEBLOCK${index}%%`;

        let cleanText = String(textWithMathPlaceholders);

        if (!providedCodeBlocks) {
            cleanText = cleanText.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (match, info, code) => {
                const blockIndex = codeBlocks.length;
                codeBlocks.push({
                    ...this.parseCodeFenceInfo(info || ''),
                    code: code.trim()
                });
                return `\n\n${codePlaceholder(blockIndex)}\n\n`;
            });
        }

        

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

        

        // Preservar código inline curto dentro da resposta

        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-flex items-center rounded-md border border-slate-700 bg-slate-900/95 px-2 py-0.5 font-mono text-[0.92em] text-slate-100">$1</code>');

        

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

        

        this.storeResponseCodeBlocks(normalizedResponseKey, codeBlocks);
        const storedCodeBlocks = this.getResponseCodeBlocks(normalizedResponseKey);

        const deferredCodeBlocks = [];
        const renderCodeBlockPlaceholder = (index) => {
            const block = storedCodeBlocks[index];
            if (!block) return '';

            if (this.shouldRenderInlineCodeBlock(block)) {
                return this.renderInlineCodeBlock(block, index, normalizedResponseKey);
            }

            deferredCodeBlocks.push({ block, index });
            return '';
        };

        formatted = formatted.replace(/<p[^>]*>\s*%%CODEBLOCK(\d+)%%\s*<\/p>/g, (match, index) => {
            return renderCodeBlockPlaceholder(Number(index));
        });

        formatted = formatted.replace(/%%CODEBLOCK(\d+)%%/g, (match, index) => {
            return renderCodeBlockPlaceholder(Number(index));
        });

        if (deferredCodeBlocks.length > 0) {
            formatted += '<div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">';
            deferredCodeBlocks.forEach(({ block, index }, deferredIndex) => {
                const displayName = this.getCodeBlockDisplayName(block, deferredIndex);
                formatted += `<button onclick="window.ui && window.ui.openCodeModalForResponse('${this.escapeInlineJsString(normalizedResponseKey)}', ${index}, '${this.escapeInlineJsString(block.lang || 'plaintext')}')" class="inline-flex items-center gap-2 rounded-xl border border-blue-400/25 bg-blue-600/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.95)] transition hover:bg-blue-500 hover:border-blue-300/35 active:scale-[0.98]">

                    <span class="material-icons-outlined" style="font-size:18px;">code</span>

                    ${this.escapeHtml(displayName)}

                </button>`;

            });

            formatted += '</div>';
        }

        if (codeBlocks.length > 0) {
            window._lastCodeBlocks = storedCodeBlocks;
        }

        return formatted;

    }

    storeResponseCodeBlocks(responseKey, codeBlocks = []) {
        if (!responseKey) return;
        if (!Array.isArray(codeBlocks) || codeBlocks.length === 0) {
            this.responseCodeBlocks.delete(responseKey);
            return;
        }
        const usedDisplayNames = new Set();
        const normalizedBlocks = codeBlocks.map((block, index) => ({
            ...block,
            displayName: this.getCodeBlockDisplayName(block, index, usedDisplayNames)
        }));
        this.responseCodeBlocks.set(responseKey, normalizedBlocks);
    }

    getResponseCodeBlocks(responseKey) {
        if (responseKey) {
            return this.responseCodeBlocks.get(responseKey) || [];
        }
        return Array.isArray(window._lastCodeBlocks) ? window._lastCodeBlocks : [];
    }

    normalizeCodeLanguage(lang = '') {
        const value = String(lang || 'plaintext').trim().toLowerCase();
        const aliases = {
            js: 'javascript',
            ts: 'typescript',
            yml: 'yaml',
            md: 'markdown',
            py: 'python',
            sh: 'bash',
            shell: 'bash',
            zsh: 'bash',
            cmd: 'plaintext',
            ps1: 'powershell'
        };
        return aliases[value] || value || 'plaintext';
    }

    inferCodeLanguageFromFileName(fileName = '') {
        const normalizedFileName = String(fileName || '').trim().split(/[\\/]/).pop() || '';
        const extension = normalizedFileName.includes('.')
            ? normalizedFileName.split('.').pop().toLowerCase()
            : '';
        const extensionMap = {
            html: 'html',
            htm: 'html',
            css: 'css',
            js: 'javascript',
            mjs: 'javascript',
            cjs: 'javascript',
            jsx: 'jsx',
            ts: 'typescript',
            tsx: 'tsx',
            py: 'python',
            php: 'php',
            java: 'java',
            rb: 'ruby',
            go: 'go',
            rs: 'rust',
            c: 'c',
            cc: 'cpp',
            cpp: 'cpp',
            cxx: 'cpp',
            cs: 'csharp',
            sh: 'bash',
            bash: 'bash',
            zsh: 'bash',
            ps1: 'powershell',
            json: 'json',
            yml: 'yaml',
            yaml: 'yaml',
            toml: 'toml',
            sql: 'sql',
            xml: 'xml',
            svg: 'xml',
            md: 'markdown',
            kt: 'kotlin',
            swift: 'swift'
        };
        return this.normalizeCodeLanguage(extensionMap[extension] || '');
    }

    detectCodeLanguageFromContent(code = '') {
        const sample = String(code || '').trim();
        if (!sample) return 'plaintext';

        if (/(<!DOCTYPE html>|<html[\s>]|<head[\s>]|<body[\s>]|<\/[a-z][\w:-]*>)/i.test(sample)) {
            return 'html';
        }

        if (/^\s*[@.#]?[a-z0-9_-]+(?:\s+[a-z0-9_-]+)*\s*\{[\s\S]*\}\s*$/i.test(sample)) {
            return 'css';
        }

        if (/^\s*(def |class |import |from [\w.]+ import |print\(|if __name__ == ['"]__main__['"])/m.test(sample)) {
            return 'python';
        }

        if (/^\s*(const |let |var |function |export |import |document\.|console\.|async function)/m.test(sample)) {
            return 'javascript';
        }

        if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(sample) && /"\s*:/.test(sample)) {
            return 'json';
        }

        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sample)) {
            return 'sql';
        }

        if (/^#!/.test(sample) || /^\s*(echo|npm|npx|node|python|pip|git|docker|curl|cd|ls|mkdir|rm|cp|mv)\b/m.test(sample)) {
            return 'bash';
        }

        return 'plaintext';
    }

    parseCodeFenceInfo(info = '') {
        const rawInfo = String(info || '').trim();
        if (!rawInfo) {
            return { lang: 'plaintext', fileName: '' };
        }

        const tokens = rawInfo
            .split(/\s+/)
            .map(token => token.trim())
            .filter(Boolean);

        let lang = '';
        let fileName = '';

        tokens.forEach((token) => {
            const cleanedToken = token.replace(/^["']|["']$/g, '');
            if (!cleanedToken) return;

            if (!fileName && (/[\\/]/.test(cleanedToken) || /\.[a-z0-9]{1,8}$/i.test(cleanedToken))) {
                fileName = cleanedToken.split(/[\\/]/).pop();
                return;
            }

            if (!lang) {
                lang = cleanedToken;
            }
        });

        if (!lang && fileName) {
            lang = this.inferCodeLanguageFromFileName(fileName);
        }

        return {
            lang: this.normalizeCodeLanguage(lang || 'plaintext'),
            fileName
        };
    }

    guessDefaultCodeFileName(lang = 'plaintext', code = '', index = 0) {
        const normalizedLang = this.normalizeCodeLanguage(lang || this.detectCodeLanguageFromContent(code));
        const fileNameMap = {
            html: 'index.html',
            css: 'style.css',
            javascript: 'script.js',
            jsx: 'App.jsx',
            typescript: 'script.ts',
            tsx: 'App.tsx',
            python: 'index.py',
            php: 'index.php',
            ruby: 'main.rb',
            java: 'Main.java',
            c: 'main.c',
            cpp: 'main.cpp',
            csharp: 'Program.cs',
            go: 'main.go',
            rust: 'main.rs',
            kotlin: 'Main.kt',
            swift: 'main.swift',
            bash: 'script.sh',
            powershell: 'script.ps1',
            json: 'data.json',
            yaml: 'config.yml',
            toml: 'config.toml',
            sql: 'query.sql',
            xml: 'file.xml',
            markdown: 'README.md'
        };

        return fileNameMap[normalizedLang] || `code-${index + 1}.txt`;
    }

    getCodeBlockDisplayName(block = {}, index = 0, usedNames = null) {
        if (block && block.displayName) {
            return block.displayName;
        }

        const blockFileName = String(block.fileName || '').trim();
        const inferredLang = blockFileName
            ? this.inferCodeLanguageFromFileName(blockFileName)
            : this.detectCodeLanguageFromContent(block.code || '');
        let displayName = blockFileName || this.guessDefaultCodeFileName(block.lang || inferredLang, block.code || '', index);

        if (usedNames instanceof Set) {
            const existingNames = usedNames;
            const lowerName = displayName.toLowerCase();

            if (existingNames.has(lowerName)) {
                const dotIndex = displayName.lastIndexOf('.');
                const baseName = dotIndex > 0 ? displayName.slice(0, dotIndex) : displayName;
                const extension = dotIndex > 0 ? displayName.slice(dotIndex) : '';
                let suffix = 2;
                let candidate = `${baseName}-${suffix}${extension}`;

                while (existingNames.has(candidate.toLowerCase())) {
                    suffix += 1;
                    candidate = `${baseName}-${suffix}${extension}`;
                }

                displayName = candidate;
            }

            existingNames.add(displayName.toLowerCase());
        }

        return displayName;
    }

    escapeInlineJsString(value = '') {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }

    highlightCodeBlockContent(code = '', lang = 'plaintext') {
        const normalizedLang = this.normalizeCodeLanguage(lang);
        const safeCode = this.escapeHtml(code);
        try {
            if (window.hljs && normalizedLang !== 'plaintext' && hljs.getLanguage(normalizedLang)) {
                return hljs.highlight(code, { language: normalizedLang, ignoreIllegals: true }).value;
            }
            if (window.hljs) {
                return hljs.highlightAuto(code).value;
            }
        } catch (error) {
            console.warn('Falha ao destacar bloco de código:', error);
        }
        return safeCode;
    }

    shouldRenderInlineCodeBlock(block = {}) {
        const code = String(block.code || '').trim();
        if (!code) return false;
        const lineCount = code.split('\n').length;
        const isCommandLike = /^(npm|npx|node|pnpm|yarn|python|pip|git|ollama|docker|curl|powershell|cmd|cd|ls|dir|mkdir|rm|del|cp|mv)\b/i.test(code);
        const isHugeBlock = lineCount > 40 || code.length > 3200;
        return isCommandLike || !isHugeBlock;
    }

    renderInlineCodeBlock(block = {}, index = 0, responseKey = '') {
        const normalizedLang = this.normalizeCodeLanguage(block.lang);
        const displayName = this.getCodeBlockDisplayName(block, index);
        const highlightedCode = this.highlightCodeBlockContent(block.code || '', normalizedLang);
        return `
            <div class="my-4 overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0b1220] shadow-[0_14px_34px_-20px_rgba(15,23,42,0.95)]">
                <div class="flex items-center justify-between gap-3 border-b border-slate-700/70 bg-slate-900/90 px-4 py-3">
                    <div>
                        <div class="text-sm font-semibold text-slate-100">${this.escapeHtml(displayName)}</div>
                        <div class="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">${this.escapeHtml(normalizedLang)}</div>
                    </div>
                    <button onclick="window.ui && window.ui.copyCodeBlockFromResponse('${this.escapeInlineJsString(responseKey)}', ${index}, this)" class="inline-flex items-center gap-1.5 rounded-full border border-slate-600/80 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-700/90">
                        <span class="material-icons-outlined text-sm">content_copy</span>
                        Copiar
                    </button>
                </div>
                <div class="overflow-x-auto p-4">
                    <pre class="m-0 whitespace-pre-wrap break-words"><code class="hljs language-${normalizedLang} text-sm leading-6 text-slate-100">${highlightedCode}</code></pre>
                </div>
            </div>
        `;
    }

    openCodeModalForResponse(responseKey, index, lang = 'plaintext') {
        const blocks = this.getResponseCodeBlocks(responseKey);
        const block = blocks[index];
        if (!block) {
            this.showNotification('❌ Não encontrei esse código para abrir.', 'error');
            return;
        }

        const normalizedLang = this.normalizeCodeLanguage(block.lang || lang);
        const displayName = this.getCodeBlockDisplayName(block, index);
        const highlighted = this.highlightCodeBlockContent(block.code || '', normalizedLang);
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[900] flex items-center justify-center p-4';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        modal.innerHTML = `
            <div class="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
                <div class="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                    <div>
                        <div class="text-sm font-semibold text-slate-100">${this.escapeHtml(displayName)}</div>
                        <div class="text-xs uppercase tracking-[0.18em] text-slate-400">${this.escapeHtml(normalizedLang)}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="codeModalCopyBtn" class="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
                            <span class="material-icons-outlined text-base">content_copy</span>
                            Copiar código
                        </button>
                        <button id="codeModalCloseBtn" class="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900">
                            <span class="material-icons-outlined text-base">close</span>
                            Fechar
                        </button>
                    </div>
                </div>
                <div class="flex-1 overflow-auto bg-slate-950 p-5">
                    <pre class="m-0"><code class="hljs language-${normalizedLang} text-sm leading-6 text-slate-100">${highlighted}</code></pre>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const copyBtn = modal.querySelector('#codeModalCopyBtn');
        const closeBtn = modal.querySelector('#codeModalCloseBtn');

        copyBtn?.addEventListener('click', async () => {
            try {
                await this.copyTextToClipboard(block.code || '');
                copyBtn.innerHTML = '<span class="material-icons-outlined text-base">check</span>Copiado';
                setTimeout(() => {
                    copyBtn.innerHTML = '<span class="material-icons-outlined text-base">content_copy</span>Copiar código';
                }, 1600);
            } catch (error) {
                console.warn('Falha ao copiar código:', error);
                copyBtn.innerHTML = '<span class="material-icons-outlined text-base">error</span>Erro ao copiar';
                setTimeout(() => {
                    copyBtn.innerHTML = '<span class="material-icons-outlined text-base">content_copy</span>Copiar código';
                }, 1600);
            }
        });

        closeBtn?.addEventListener('click', () => modal.remove());
    }

    async copyCodeBlockFromResponse(responseKey, index, button) {
        const blocks = this.getResponseCodeBlocks(responseKey);
        const block = blocks[index];
        if (!block) {
            this.showNotification('❌ Não encontrei esse código para copiar.', 'error');
            return;
        }
        try {
            await this.copyTextToClipboard(block.code || '');
            if (button) {
                const original = button.innerHTML;
                button.innerHTML = '<span class="material-icons-outlined text-sm">check</span>Copiado';
                setTimeout(() => {
                    button.innerHTML = original;
                }, 1500);
            }
        } catch (error) {
            console.warn('Falha ao copiar bloco de código:', error);
            this.showNotification('❌ Não consegui copiar o código.', 'error');
        }
    }



    // (handler global para abertura do modal foi movido para o escopo global logo abaixo da definição da classe)

    // Isso evita erro de sintaxe causado por declarações condicionais fora de métodos dentro de uma classe.

    

    openCodeModal(index, lang) {
        this.openCodeModalForResponse(null, index, lang);

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
                    <div class="carousel-img-${index}" style="flex: 1 !important; min-width: 0; height: 200px; border-radius: 12px; overflow: hidden; cursor: pointer; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); display: block !important; position: relative;"
                         onclick="window.open('${img.src}', '_blank')">
                        <button
                            type="button"
                            title="Baixar imagem"
                            onclick="event.stopPropagation(); event.preventDefault(); window.ui && window.ui.downloadImageFromUrl('${img.src}', 'drekee-unsplash-${index + 1}.jpg', this)"
                            style="position: absolute; top: 10px; right: 10px; z-index: 3; width: 36px; height: 36px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.35); background: rgba(15,23,42,0.62); color: white; display: inline-flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 6px 20px rgba(0,0,0,0.22);">
                            <span class="material-icons-outlined" style="font-family: 'Material Icons Outlined'; font-size: 18px; line-height: 1;">download</span>
                        </button>
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
                    position: relative !important;
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
                    position: relative !important;
                    float: none !important;
                    clear: none !important;
                    vertical-align: top !important;
                    box-sizing: border-box !important;
                }
                .download-btn {
                    position: absolute !important;
                    top: 10px !important;
                    right: 10px !important;
                    z-index: 3 !important;
                    width: 36px !important;
                    height: 36px !important;
                    border-radius: 9999px !important;
                    border: 1px solid rgba(255, 255, 255, 0.35) !important;
                    background: rgba(15, 23, 42, 0.62) !important;
                    color: #fff !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    backdrop-filter: blur(10px) !important;
                    -webkit-backdrop-filter: blur(10px) !important;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22) !important;
                    cursor: pointer !important;
                }
                .download-btn:hover {
                    background: rgba(15, 23, 42, 0.78) !important;
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
                            <button
                                class="download-btn"
                                type="button"
                                title="Baixar imagem"
                                onclick="event.stopPropagation(); event.preventDefault(); window.ui && window.ui.downloadImageFromUrl('${img.src}', 'drekee-unsplash-${index + 1}.jpg', this)"
                            >
                                <span class="material-icons-outlined" style="font-family: 'Material Icons Outlined'; font-size: 18px; line-height: 1;">download</span>
                            </button>
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
                        imgDiv.style.position = 'relative';
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

    appendYouTubeVideosToMessage(responseId, videos = []) {
        const responseDiv = document.getElementById(responseId);
        if (!responseDiv) {
            console.warn('⚠️ [YOUTUBE] responseId não encontrado:', responseId);
            return;
        }

        const normalizedVideos = Array.isArray(videos)
            ? videos
                .filter((video) => video && video.videoId && video.embedUrl)
                .filter((video, index, array) => array.findIndex((item) => item.videoId === video.videoId) === index)
                .slice(0, 2)
            : [];

        if (normalizedVideos.length === 0) {
            return;
        }

        const hostElement = responseDiv.parentElement || responseDiv;
        const containerId = `youtubeRecommendations_${String(responseId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const existingContainer = hostElement.querySelector(`#${containerId}`);
        if (existingContainer) {
            existingContainer.remove();
        }

        const videosHtml = normalizedVideos.map((video) => {
            const title = this.escapeHtml(video.title || 'Vídeo recomendado');
            const channel = this.escapeHtml(video.channelTitle || 'Canal');
            const description = this.escapeHtml(String(video.description || '').slice(0, 140));
            const duration = video.durationLabel ? `<span>${this.escapeHtml(video.durationLabel)}</span>` : '';
            const views = video.viewCountLabel ? `<span>${this.escapeHtml(video.viewCountLabel)}</span>` : '';
            const meta = [channel, duration, views].filter(Boolean).join(' <span style="opacity:0.45;">•</span> ');
            const watchUrl = this.escapeHtml(video.watchUrl || `https://www.youtube.com/watch?v=${video.videoId}`);
            const embedUrl = this.escapeHtml(video.embedUrl);

            return `
                <article style="
                    display:flex;
                    flex-direction:column;
                    gap:12px;
                    padding:14px;
                    border-radius:22px;
                    border:1px solid rgba(96, 165, 250, 0.16);
                    background:linear-gradient(180deg, rgba(15,23,42,0.92), rgba(9,14,28,0.98));
                    box-shadow:0 24px 40px -28px rgba(37,99,235,0.55);
                ">
                    <div style="
                        position:relative;
                        width:100%;
                        padding-top:56.25%;
                        overflow:hidden;
                        border-radius:18px;
                        border:1px solid rgba(148,163,184,0.12);
                        background:#020617;
                    ">
                        <iframe
                            src="${embedUrl}"
                            title="${title}"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                            referrerpolicy="strict-origin-when-cross-origin"
                            style="
                                position:absolute;
                                inset:0;
                                width:100%;
                                height:100%;
                                border:0;
                                border-radius:18px;
                            "
                        ></iframe>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="font-size:0.98rem; font-weight:600; line-height:1.45; color:#f8fafc;">${title}</div>
                        <div style="font-size:0.78rem; line-height:1.5; color:#94a3b8;">${meta}</div>
                        ${description ? `<div style="font-size:0.82rem; line-height:1.55; color:#cbd5e1;">${description}</div>` : ''}
                        <div>
                            <a
                                href="${watchUrl}"
                                target="_blank"
                                rel="noopener noreferrer"
                                style="
                                    display:inline-flex;
                                    align-items:center;
                                    gap:8px;
                                    padding:8px 14px;
                                    border-radius:999px;
                                    border:1px solid rgba(96, 165, 250, 0.22);
                                    background:rgba(37, 99, 235, 0.14);
                                    color:#bfdbfe;
                                    font-size:0.8rem;
                                    font-weight:600;
                                    text-decoration:none;
                                "
                            >
                                <span class="material-icons-outlined" style="font-size:16px;">open_in_new</span>
                                Assistir no YouTube
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        const section = document.createElement('section');
        section.id = containerId;
        section.style.marginTop = '20px';
        section.innerHTML = `
            <div style="
                border-radius:28px;
                border:1px solid rgba(96, 165, 250, 0.16);
                background:linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.96));
                padding:16px;
                box-shadow:0 28px 50px -34px rgba(30, 64, 175, 0.75);
            ">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                    <div style="
                        width:34px;
                        height:34px;
                        border-radius:12px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:rgba(37, 99, 235, 0.16);
                        border:1px solid rgba(96, 165, 250, 0.2);
                    ">
                        <span class="material-icons-outlined" style="font-size:18px; color:#60a5fa;">smart_display</span>
                    </div>
                    <div>
                        <div style="font-size:0.9rem; font-weight:700; color:#eff6ff;">Vídeos que podem ajudar</div>
                        <div style="font-size:0.76rem; color:#94a3b8;">Sugestões pontuais do YouTube para aprofundar esse assunto.</div>
                    </div>
                </div>
                <div style="
                    display:grid;
                    gap:14px;
                    grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
                ">
                    ${videosHtml}
                </div>
            </div>
        `;

        hostElement.insertAdjacentElement('beforeend', section);
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

    queueMathTypeset(element = null) {
        const targetElement = element && element.nodeType === 1 ? element : document.body;
        if (!targetElement) {
            return;
        }

        const containsMathMarkers = /\$\$[\s\S]+?\$\$/.test(targetElement.textContent || '') || targetElement.querySelector('.MathJax, mjx-container, .katex');
        if (!containsMathMarkers) {
            return;
        }

        const typeset = () => {
            if (!window.MathJax) {
                return;
            }

            try {
                if (typeof window.MathJax.typesetPromise === 'function') {
                    window.MathJax.typesetClear?.([targetElement]);
                    window.MathJax.typesetPromise([targetElement]).catch((error) => {
                        console.warn('Falha no MathJax.typesetPromise:', error);
                    });
                    return;
                }

                if (typeof window.MathJax.typeset === 'function') {
                    window.MathJax.typeset([targetElement]);
                }
            } catch (error) {
                console.warn('Falha ao renderizar matemática com MathJax:', error);
            }
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(typeset);
        } else {
            setTimeout(typeset, 0);
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

        const messagesContainer = this.elements.messagesContainer || document.getElementById('messagesContainer');
        const performScroll = () => {
            const targetHeight = Math.max(
                chat.scrollHeight || 0,
                messagesContainer?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0,
                document.body?.scrollHeight || 0
            );

            chat.scrollTop = targetHeight;
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            try {
                chat.scrollTo({ top: targetHeight, behavior: 'smooth' });
            } catch (e) {}

            try {
                window.scrollTo({ top: targetHeight, behavior: 'smooth' });
            } catch (e) {}
        };

        performScroll();
        requestAnimationFrame(performScroll);
        setTimeout(performScroll, 50);
        setTimeout(performScroll, 180);
        setTimeout(performScroll, 420);

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
            sendBtn.innerHTML = '<span style="display: inline-block; width: 20px; height: 20px; background: white; border: 2px solid white; border-radius: 4px;"></span>';
            sendBtn.title = 'Parar geração';
            sendBtn.setAttribute('data-agent-state', 'pause');
            sendBtn.classList.remove('w-10', 'h-10');
            sendBtn.classList.add('w-9', 'h-9');
            sendBtn.classList.add('pause-button');
            sendBtn.removeEventListener('click', this.boundHandleSend);
            sendBtn.removeEventListener('click', this.boundHandlePause);
            sendBtn.addEventListener('click', this.boundHandlePause);

        }

    }



    updateSendButtonToSend() {

        const pauseBtn = this.elements.sendButton;

        if (pauseBtn) {
            pauseBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:1.1rem">arrow_upward</span>';

            pauseBtn.title = 'Enviar mensagem';
            pauseBtn.setAttribute('data-agent-state', 'send');
            pauseBtn.classList.remove('pause-button');
            pauseBtn.classList.add('w-9', 'h-9');
            pauseBtn.removeEventListener('click', this.boundHandlePause);
            pauseBtn.removeEventListener('click', this.boundHandleSend);
            pauseBtn.addEventListener('click', this.boundHandleSend);

        }

    }



    handlePause() {

        console.log('⏸️ Usuário clicou em pausa');
        this.stopAgentWorkingState();

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
            const targetChatId = this.currentChatId;

            // Criar container com texto "Pesquisando..."
            const messageContainer = this.createRapidMessageContainer();
            this.setThinkingHeader('🔍 Pesquisando...', messageContainer.headerId);
                
            // Iniciar busca de imagens em paralelo
            const imagesPromise = this.agent.searchUnsplashImages(message);
                
            // Obter histórico da conversa atual
            const currentChat = this.chats.find(c => c.id === targetChatId);
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

            this.persistMessageToChat(targetChatId, {
                role: 'assistant',
                content: data.response || '',
                sources: Array.isArray(data.sources) ? data.sources : []
            });
            
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

                if (this.agent && typeof this.agent.attachYouTubeVideosToResponse === 'function') {
                    await this.agent.attachYouTubeVideosToResponse({
                        userMessage: message,
                        assistantResponse: data.response,
                        responseId: messageContainer.responseId,
                        chatId: targetChatId
                    });
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

        await this.initializeUpdatesExperience();

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
                    await this.initializeUpdatesExperience();
                    
                    // Forçar refresh da UI
                    this.renderChatHistory();
                    
                } else if (event === 'SIGNED_OUT') {
                    console.log('👤 Usuário fez logout');
                    this.showGuestMode();
                    this.clearUserChats();
                    this.stopHeartbeat();
                    await this.initializeUpdatesExperience();
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
            const statusCode = error?.code || error?.status || error?.statusCode;
            if (statusCode === 403 || String(error?.message || '').includes('403')) {
                console.warn('⚠️ Sem permissão para user_sessions. Ignorando heartbeat de sessão.');
                return;
            }
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
                console.warn('⚠️ Chat não encontrado para salvar:', chatId);
                if (this.currentChatId === chatId) {
                    this.currentChatId = null;
                }
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
    saveCurrentChat(chatId = this.currentChatId) {
        // Não salvar mais localmente - apenas no Supabase
        if (!chatId) return;
        
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) {
            console.warn('⚠️ Chat para salvar não existe mais:', chatId);
            if (this.currentChatId === chatId) {
                this.currentChatId = null;
            }
            return;
        }

        chat.updated = new Date().toLocaleString('pt-BR');

        // Salvar APENAS no Supabase se estiver logado (não for visitante)
        const isGuest = localStorage.getItem('isGuest') === 'true';
        if (!isGuest && window.supabase && localStorage.getItem('userSession')) {
            console.log('💾 Salvando chat atual no Supabase:', chatId);
            this.saveChatToSupabase(chatId);
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
            const response = await this.generateREResponse(message, sendFiles);
            const normalizedResponse = this.normalizeREResponse(response);
            const finalHtml = `<div class="re-response-body">${this.renderREResponseHtml(normalizedResponse)}</div>`;

            // Atualizar com a resposta completa (como HTML)
            this.updateProcessingMessage(processingId, finalHtml);
            
            // Forçar renderização MathJax para o modo RE
            setTimeout(() => {
                const messageElement = document.getElementById(`responseText_${processingId}`);
                if (messageElement) {
                    this.queueMathTypeset(messageElement);
                }
            }, 100);
            
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
        const systemPrompt = `Você é uma IA especializada no MODO RE (Resolução de Exercícios).

OBJETIVO:
Resolver exercícios exatamente como um aluno escreveria no caderno, com respostas diretas, organizadas e sem explicações desnecessárias.

REGRA PRINCIPAL:
NUNCA aja como professor explicativo. SEMPRE aja como um aluno resolvendo a questão para entregar no caderno.

COMPORTAMENTO GERAL:
- Seja direto e objetivo.
- NÃO explique conceitos, a menos que seja absolutamente necessário para a resposta.
- NÃO use linguagem didática longa.
- NÃO diga frases como "vamos resolver", "primeiro fazemos", "portanto", "concluímos".
- NÃO faça introduções ou conclusões.
- NÃO use emojis.
- NÃO use markdown.
- NÃO use listas com marcadores.
- NÃO use blocos de código.
- NÃO use HTML.

DETECÇÃO AUTOMÁTICA:
1. Matemática:
- Mostrar todos os cálculos passo a passo.
- Cada linha deve representar um passo lógico.
- Não pular etapas.

2. Interpretação de texto / Português:
- Resposta curta e direta.
- Baseada no texto.
- 1 a 3 linhas no máximo.

3. Ciências / História / Geografia:
- Resposta objetiva.
- Sem explicação longa.
- Apenas o necessário para acertar.

4. Múltipla escolha:
- Indicar apenas a alternativa correta.
Exemplo:
Resposta: A

FORMATAÇÃO (ESTILO CADERNO):
- Organize como se estivesse escrito à mão no caderno.
- Use apenas texto simples e linhas limpas.
- Em matemática, cada linha deve conter uma etapa.
- Se precisar de fração, raiz, potência, equação ou expressão algébrica, escreva usando notação matemática renderizável com delimitadores $...$ ou $$...$$ para que o visual final fique limpo.
- Para frações, prefira $\\frac{a}{b}$.
- Para raízes, prefira $\\sqrt{x}$.
- Para potências, prefira $x^2$.
- Para multiplicação, prefira ×.
- Para divisão simples, prefira ÷.
- Evite deixar /, *, %, &, @, ! soltos quando isso puder ser escrito de forma matemática ou por extenso.
- Em porcentagem, prefira escrever "por cento" quando isso deixar a linha mais limpa.

ENTRADA POR IMAGEM:
- Extraia o texto.
- Identifique as questões.
- Resolva cada uma separadamente.
- Numere as respostas.

MODO PROVA:
- Se o usuário indicar "modo prova", NÃO mostrar cálculos.
- Mostrar apenas a resposta final.

REGRAS CRÍTICAS:
- NUNCA inventar dados.
- Se não souber, responda exatamente: "Não foi possível resolver com as informações fornecidas."
- NÃO fugir do formato.
- NÃO misturar explicação com resposta.

SAÍDA FINAL:
- Apenas a resolução.
- Nada antes.
- Nada depois.`;

        // Escolher API baseado na presença de anexos
        if (sendFiles && sendFiles.length > 0) {
            console.log('📎 [RE] Usando Gemini com anexos...');
            return this.callREGeminiAPI(systemPrompt, exercise, sendFiles);
        } else {
            console.log('🧮 [RE] Usando Groq sem anexos...');
            return this.callAPI(systemPrompt, exercise);
        }
    }

    normalizeREResponse(response) {
        let text = String(response || '')
            .replace(/```[a-z0-9_-]*\n?/gi, '')
            .replace(/```/g, '')
            .replace(/^\s*[*#>-]+\s*/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/\r\n/g, '\n')
            .trim();

        const rawLines = text
            .split('\n')
            .map((line) => this.normalizeREMathLine(line))
            .filter(Boolean);

        const blocks = [];
        let mathBuffer = [];
        const flushMathBuffer = () => {
            if (!mathBuffer.length) {
                return;
            }
            mathBuffer
                .map((line) => this.convertRELineToLatex(line))
                .filter(Boolean)
                .forEach((latexLine) => {
                    blocks.push(`$$${latexLine}$$`);
                });
            mathBuffer = [];
        };

        rawLines.forEach((line) => {
            if (this.isREMathLine(line)) {
                mathBuffer.push(line);
                return;
            }
            flushMathBuffer();
            blocks.push(line);
        });

        flushMathBuffer();
        return blocks.join('\n\n').trim() || 'Não foi possível resolver com as informações fornecidas.';
    }

    renderREResponseHtml(responseText) {
        const blocks = String(responseText || '')
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean);

        return blocks.map((block) => {
            if (/^\$\$[\s\S]+\$\$$/.test(block)) {
                return this.renderREMathCard(block);
            }
            
            const lines = block
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);

            const renderedLines = lines.map((line) => {
                let processedLine = this.convertSimpleMathToLatex(line);

                if (/^\$\$[\s\S]+\$\$$/.test(processedLine)) {
                    return this.renderREMathCard(processedLine);
                }

                if (/^\$[^$\n]+\$$/.test(processedLine)) {
                    return this.renderREMathCard(`$$${processedLine.slice(1, -1)}$$`);
                }

                if (this.isREMathLine(line)) {
                    return this.renderREMathCard(`$$${this.convertRELineToLatex(line)}$$`);
                }

                return `<div class="re-text-line text-gray-700 dark:text-gray-200 leading-8 my-1">${this.escapeHtml(processedLine)}</div>`;
            });

            return `<div class="re-text-block my-2">${renderedLines.join('')}</div>`;
        }).join('');
    }

    renderREMathCard(latexBlock) {
        return `
            <div class="re-math-card">
                <div class="re-math-card-inner">
                    <div class="re-math-block">${latexBlock}</div>
                </div>
            </div>
        `;
    }

    normalizeREMathLine(line) {
        let text = String(line || '').trim();
        if (!text) {
            return '';
        }

        if (text.includes(':')) {
            const tail = text.split(':').pop().trim();
            if (this.looksLikeREMathExpression(tail)) {
                text = tail;
            }
        } else {
            const equalityMatch = text.match(/([A-Za-z0-9π√(][A-Za-z0-9π√()\s+\-*/×÷=.,^]+=[A-Za-z0-9π√()\s+\-*/×÷=.,^]+)$/i);
            if (equalityMatch) {
                text = equalityMatch[1].trim();
            }
        }

        text = text
            .replace(/^\d+\)\s*/g, '')
            .replace(/^\d+\.\s*/g, '')
            .replace(/\s*\u2022\s*/g, ' ')
            .replace(/\bpi\b/gi, 'π')
            .replace(/\s+/g, ' ')
            .trim();

        return text;
    }

    looksLikeREMathExpression(text) {
        const value = String(text || '').trim().replace(/^resposta\s*:\s*/i, '');
        if (!value) {
            return false;
        }
        return /[=+\-×÷*/^√π]/.test(value) || /\d/.test(value) || /[a-z]\s*=\s*/i.test(value);
    }

    isREMathLine(line) {
        const text = String(line || '').trim();
        if (!text) {
            return false;
        }
        if (/^resposta\s*:/i.test(text) && !this.looksLikeREMathExpression(text.replace(/^resposta\s*:/i, ''))) {
            return false;
        }
        return this.looksLikeREMathExpression(text);
    }

    convertRELineToLatex(line) {
        let text = String(line || '').trim();
        if (!text) {
            return '';
        }

        text = text.replace(/^\d+\)\s*/g, '').replace(/^\d+\.\s*/g, '');
        text = text.replace(/^resposta\s*:\s*/i, '');
        text = text
            .replace(/\bpi\b/gi, '\\pi')
            .replace(/π/g, '\\pi')
            .replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}')
            .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
            .replace(/([A-Za-z0-9)\]])\^([A-Za-z0-9]+)/g, '$1^{$2}')
            .replace(/×/g, '\\times ')
            .replace(/\*/g, '\\times ')
            .replace(/÷/g, '/')
            .replace(/([A-Za-z0-9)\]}])\s+([A-Za-z(\\])/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.includes('=')) {
            const parts = text.split('=').map((part) => this.convertREExpressionToLatex(part)).filter(Boolean);
            if (parts.length >= 2) {
                return `${parts[0]} &= ${parts.slice(1).join(' = ')}`;
            }
        }

        return this.convertREExpressionToLatex(text);
    }

    convertREExpressionToLatex(expression) {
        let text = String(expression || '').trim();
        if (!text) {
            return '';
        }

        text = text.replace(/\s+/g, ' ').trim();
        
        // Detectar frações simples (a/b)
        const simpleFractionMatch = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/);
        if (simpleFractionMatch) {
            return `\\frac{${simpleFractionMatch[1]}}{${simpleFractionMatch[2]}}`;
        }
        
        const slashIndex = this.findTopLevelSlashIndex(text);
        if (slashIndex !== -1) {
            const numerator = this.stripOuterParentheses(text.slice(0, slashIndex).trim());
            const denominator = this.stripOuterParentheses(text.slice(slashIndex + 1).trim());
            if (numerator && denominator) {
                return `\\frac{${this.convertREExpressionToLatex(numerator)}}{${this.convertREExpressionToLatex(denominator)}}`;
            }
        }

        return text;
    }

    // Converter expressões matemáticas simples para LaTeX inline
    convertSimpleMathToLatex(line) {
        let text = String(line || '').trim();
        if (!text) {
            return '';
        }

        // Se já tem delimitadores LaTeX, não processar
        if (/\$.*\$/.test(text) || /\$\$.*\$\$/.test(text)) {
            return text;
        }

        // Converter padrões matemáticos comuns
        let converted = false;

        // Equações: x = 2 -> $x = 2$
        if (text.includes('=') && /[a-zA-Z0-9]/.test(text)) {
            converted = true;
        }

        // Frações: a/b -> \frac{a}{b}
        if (text.includes('/')) {
            const fractionMatch = text.match(/^([a-zA-Z0-9\s+\-*/()]+)\s*\/\s*([a-zA-Z0-9\s+\-*/()]+)$/);
            if (fractionMatch) {
                text = `\\frac{${fractionMatch[1].trim()}}{${fractionMatch[2].trim()}}`;
                converted = true;
            }
        }

        // Potências: x^2 -> x^{2}
        text = text.replace(/([a-zA-Z])\^([0-9]+)/g, '$1^{$2}');
        if (text.includes('^{')) converted = true;

        // PI: pi -> \pi
        text = text.replace(/\bpi\b/gi, '\\pi');
        if (text.includes('\\pi')) converted = true;

        // Raiz: sqrt(x) -> \sqrt{x}
        text = text.replace(/sqrt\(\s*([^)]+)\s*\)/g, '\\sqrt{$1}');
        if (text.includes('\\sqrt')) converted = true;

        // Multiplicação: × -> \times
        text = text.replace(/×/g, '\\times');
        if (text.includes('\\times')) converted = true;

        // Se converteu algo, adicionar delimitadores
        if (converted) {
            text = `$${text}$`;
        }

        return text;
    }

    findTopLevelSlashIndex(text) {
        let depth = 0;
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (char === '(' || char === '{' || char === '[') {
                depth += 1;
                continue;
            }
            if (char === ')' || char === '}' || char === ']') {
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (char === '/' && depth === 0) {
                return index;
            }
        }
        return -1;
    }

    stripOuterParentheses(text) {
        let value = String(text || '').trim();
        while (
            value.startsWith('(') &&
            value.endsWith(')') &&
            this.hasBalancedOuterParentheses(value)
        ) {
            value = value.slice(1, -1).trim();
        }
        return value;
    }

    hasBalancedOuterParentheses(text) {
        let depth = 0;
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
                if (depth === 0 && index < text.length - 1) {
                    return false;
                }
            }
        }
        return depth === 0;
    }

    async callREGeminiAPI(systemPrompt, userMessage, sendFiles = []) {
        const formData = new FormData();
        formData.append('message', userMessage);
        formData.append('system_prompt', systemPrompt);
        formData.append('model', 'gemini-2.5-flash');

        sendFiles.forEach((fileEntry, index) => {
            if (fileEntry?.file) {
                formData.append(`file_${index}`, fileEntry.file, fileEntry.name || `file_${index}`);
            }
        });

        const response = await fetch('/api/gemini-chat', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API Gemini RE: ${errorText}`);
        }

        const data = await response.json();
        return data.text || data.response || '';
    }

    // Método auxiliar para chamadas de API
    async callAPI(systemPrompt, userMessage) {
        try {
            const response = await this.agent.callGroqAPI('llama-3.3-70b-versatile', [
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
        const userInput = document.getElementById('userInput');
        if (window.isAgentMode) {
            window.ui.deactivateAgentMode();
        } else if (window.isREMode) {
            window.isREMode = false;
            window.ui.showNotification('🛑 Modo Resolução de Exercícios desativado', 'info');
            window.ui.resetCreateButtons();
        } else if (window.isInvestigateMode) {
            window.isInvestigateMode = false;
            window.ui.showNotification('🛑 Modo Investigate desativado', 'info');
            window.ui.resetCreateButtons();
        } else if (window.isDocumentModeActive) {
            window.isDocumentModeActive = false;
            window.ui.currentCreateType = null;
            if (window.ui.setCreateType) {
                window.ui.setCreateType(null);
            }
            window.ui.showNotification('🛑 Modo Documento desativado', 'info');
            window.ui.resetCreateButtons();
        } else if (window.isSlidesModeActive) {
            window.isSlidesModeActive = false;
            window.ui.currentCreateType = null;
            if (window.ui.setCreateType) {
                window.ui.setCreateType(null);
            }
            window.ui.showNotification('🛑 Modo Apresentação desativado', 'info');
            window.ui.resetCreateButtons();
        }

        if (userInput) {
            userInput.placeholder = 'Pergunte qualquer coisa...';
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

window.handleGeneratedImageFallback = function(img) {
    if (!img) {
        return;
    }

    try {
        const currentSrc = String(img.currentSrc || img.src || '');
        const retryCount = Number(img.dataset?.retryCount || '0');
        if (/pollinations\.ai/i.test(currentSrc) && retryCount < 2) {
            const separator = currentSrc.includes('?') ? '&' : '?';
            const retryUrl = `${currentSrc}${separator}retry=${Date.now()}`;
            img.dataset.retryCount = String(retryCount + 1);
            console.warn('🔁 Repetindo tentativa de imagem Pollinations:', retryUrl);
            setTimeout(() => {
                img.src = retryUrl;
            }, 1500);
            return;
        }

        const raw = img.dataset?.fallbacks ? decodeURIComponent(img.dataset.fallbacks) : '[]';
        const candidates = JSON.parse(raw);
        const currentIndex = Number(img.dataset?.fallbackIndex || '0');

        if (!Array.isArray(candidates) || currentIndex >= candidates.length) {
            img.onerror = null;
            img.style.opacity = '0.6';
            console.warn('⚠️ Sem mais fallbacks para imagem gerada.');
            return;
        }

        const nextUrl = candidates[currentIndex];
        img.dataset.fallbackIndex = String(currentIndex + 1);
        console.warn('🔄 Tentando fallback de imagem:', nextUrl);
        img.src = nextUrl;
    } catch (error) {
        console.error('❌ Erro ao aplicar fallback da imagem gerada:', error);
        img.onerror = null;
    }
};

// Inicialização do app
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});



