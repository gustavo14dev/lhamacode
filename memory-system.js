export class MemorySystem {
    constructor() {
        this.conversationMemory = []; // Memória da conversa atual
        this.userMemory = {}; // Memória do usuário (preferências)
        this.projectMemory = {}; // Memória de projetos/códigos
        this.maxConversationMemory = 15; // Últimas 15 interações
        this.maxProjectMemory = 50; // Máximo de projetos/códigos
    }

    // ==================== MEMÓRIA DE CONVERSA ====================
    
    addConversationMemory(role, content, timestamp = Date.now()) {
        const memory = {
            role,
            content: this.extractKeyInfo(content),
            timestamp,
            keywords: this.extractKeywords(content),
            context: this.detectContext(content)
        };
        
        this.conversationMemory.push(memory);
        
        // Manter apenas as memórias mais recentes
        if (this.conversationMemory.length > this.maxConversationMemory) {
            this.conversationMemory = this.conversationMemory.slice(-this.maxConversationMemory);
        }
        
        this.saveToLocalStorage();
    }

    getRelevantContext(query) {
        const queryKeywords = this.extractKeywords(query);
        const relevantMemories = [];
        
        // Buscar memórias relevantes baseadas em keywords e contexto
        this.conversationMemory.forEach(memory => {
            let relevanceScore = 0;
            
            // Score por keywords em comum
            queryKeywords.forEach(keyword => {
                if (memory.keywords.includes(keyword)) {
                    relevanceScore += 2;
                }
            });
            
            // Score por contexto similar
            if (memory.context && this.contextMatches(memory.context, query)) {
                relevanceScore += 3;
            }
            
            // Score por recenticidade (memórias mais recentes têm mais peso)
            const timeDiff = Date.now() - memory.timestamp;
            if (timeDiff < 300000) relevanceScore += 1; // 5 minutos
            else if (timeDiff < 900000) relevanceScore += 0.5; // 15 minutos
            
            if (relevanceScore > 0) {
                relevantMemories.push({
                    ...memory,
                    relevanceScore
                });
            }
        });
        
        // Ordenar por relevância e retornar as top 5
        return relevantMemories
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5);
    }

    // ==================== MEMÓRIA DO USUÁRIO ====================
    
    updateUserPreference(preference, value) {
        if (!this.userMemory.preferences) {
            this.userMemory.preferences = {};
        }
        this.userMemory.preferences[preference] = value;
        this.saveToLocalStorage();
    }

    getUserPreference(preference) {
        return this.userMemory.preferences?.[preference];
    }

    learnFromInteraction(userMessage, aiResponse, userFeedback = null) {
        // Aprender preferências de estilo
        if (userMessage.includes('mais simples') || userMessage.includes('resumido')) {
            this.updateUserPreference('complexity', 'simple');
        } else if (userMessage.includes('detalhado') || userMessage.includes('completo')) {
            this.updateUserPreference('complexity', 'detailed');
        }
        
        // Aprender preferências de linguagem
        if (userMessage.includes('português') || userMessage.includes('pt-br')) {
            this.updateUserPreference('language', 'pt-br');
        } else if (userMessage.includes('inglês')) {
            this.updateUserPreference('language', 'en');
        }
        
        // Aprender preferências de código
        const codeLanguages = ['javascript', 'python', 'java', 'react', 'vue', 'angular'];
        codeLanguages.forEach(lang => {
            if (userMessage.toLowerCase().includes(lang)) {
                this.updateUserPreference('preferredLanguage', lang);
            }
        });
        
        // Aprender com feedback explícito
        if (userFeedback) {
            this.updateUserPreference('lastFeedback', {
                message: userMessage,
                response: aiResponse,
                feedback: userFeedback,
                timestamp: Date.now()
            });
        }
    }

    // ==================== MEMÓRIA DE PROJETOS ====================
    
    addProjectMemory(projectName, code, language, description) {
        const projectMemory = {
            name: projectName,
            code: code,
            language: language,
            description: description,
            timestamp: Date.now(),
            keywords: this.extractKeywords(code + ' ' + description),
            size: code.length
        };
        
        if (!this.projectMemory[language]) {
            this.projectMemory[language] = [];
        }
        
        this.projectMemory[language].push(projectMemory);
        
        // Manter apenas os projetos mais recentes/relevantes
        if (this.projectMemory[language].length > this.maxProjectMemory) {
            this.projectMemory[language] = this.projectMemory[language]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, this.maxProjectMemory);
        }
        
        this.saveToLocalStorage();
    }

    getSimilarCode(codeSnippet, language) {
        if (!this.projectMemory[language]) return [];
        
        const snippetKeywords = this.extractKeywords(codeSnippet);
        const similarCode = [];
        
        this.projectMemory[language].forEach(project => {
            let similarityScore = 0;
            
            // Comparar keywords
            snippetKeywords.forEach(keyword => {
                if (project.keywords.includes(keyword)) {
                    similarityScore += 2;
                }
            });
            
            // Comparar tamanho (códigos de tamanho similar podem ser relacionados)
            const sizeDiff = Math.abs(project.size - codeSnippet.length);
            if (sizeDiff < 1000) similarityScore += 1;
            else if (sizeDiff < 5000) similarityScore += 0.5;
            
            if (similarityScore > 0) {
                similarCode.push({
                    ...project,
                    similarityScore
                });
            }
        });
        
        return similarCode
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .slice(0, 3);
    }

    // ==================== UTILITÁRIOS ====================
    
    extractKeyInfo(text) {
        // Extrair informações importantes (limitar a 500 chars)
        return text.length > 500 ? text.substring(0, 500) + '...' : text;
    }

    extractKeywords(text) {
        // Extrair keywords simples
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !this.isStopWord(word));
        
        // Retornar keywords únicas
        return [...new Set(words)].slice(0, 10);
    }

    isStopWord(word) {
        const stopWords = ['que', 'para', 'com', 'uma', 'este', 'esta', 'esse', 'essa', 
                          'the', 'and', 'for', 'with', 'this', 'that', 'from', 'they',
                          'como', 'mais', 'muito', 'pode', 'ser', 'tem', 'temos'];
        return stopWords.includes(word);
    }

    detectContext(text) {
        const contexts = {
            'code': ['function', 'class', 'const', 'let', 'var', 'import', 'export', 'def', 'return'],
            'debug': ['error', 'bug', 'erro', 'problema', 'não funciona', 'falha'],
            'help': ['ajuda', 'como', 'explica', 'mostra', 'ensina'],
            'create': ['criar', 'novo', 'gerar', 'build', 'make'],
            'fix': ['consertar', 'arrumar', 'corrigir', 'fix', 'repair']
        };
        
        for (const [context, keywords] of Object.entries(contexts)) {
            if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                return context;
            }
        }
        
        return 'general';
    }

    contextMatches(memoryContext, query) {
        return memoryContext === this.detectContext(query);
    }

    // ==================== PERSISTÊNCIA ====================
    
    saveToLocalStorage() {
        try {
            const memoryData = {
                conversationMemory: this.conversationMemory,
                userMemory: this.userMemory,
                projectMemory: this.projectMemory
            };
            localStorage.setItem('drekee_memory', JSON.stringify(memoryData));
        } catch (error) {
            console.warn('⚠️ Erro ao salvar memória:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('drekee_memory');
            if (saved) {
                const memoryData = JSON.parse(saved);
                this.conversationMemory = memoryData.conversationMemory || [];
                this.userMemory = memoryData.userMemory || {};
                this.projectMemory = memoryData.projectMemory || {};
            }
        } catch (error) {
            console.warn('⚠️ Erro ao carregar memória:', error);
        }
    }

    clearMemory() {
        this.conversationMemory = [];
        this.userMemory = {};
        this.projectMemory = {};
        localStorage.removeItem('drekee_memory');
    }

    // ==================== RELATÓRIOS ====================
    
    getMemoryStats() {
        return {
            conversationMemory: this.conversationMemory.length,
            userPreferences: Object.keys(this.userMemory.preferences || {}).length,
            projectMemory: Object.keys(this.projectMemory).length,
            totalProjects: Object.values(this.projectMemory).reduce((sum, projects) => sum + projects.length, 0)
        };
    }
}
