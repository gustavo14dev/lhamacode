/**
 * Sistema de Artifacts Inteligente para Drekee AI
 * Design 100% inspirado no Claude (Anthropic)
 */

class ArtifactSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
        this.artifactCounter = 0;
        this.activeArtifacts = new Map();
        this.decisionModel = 'Meta-Llama-3.1-8B-Instruct'; // O modelo "Lhama" para decisão
    }

    /**
     * Lógica de decisão binária (SIM/NÃO) inspirada no modelo antigo do Gustavo
     * Decide se a pergunta do usuário merece um artefato visual
     */
    async decideIfNeedsArtifact(userMessage, webData = {}, relevantContext = []) {
        console.log('🧠 [ARTIFACT-DECISION] Iniciando decisão binária...');
        
        const systemPrompt = `Você é o Llama-Decision-Engine. Sua única tarefa é analisar a pergunta do usuário e decidir se a resposta deve incluir um "Artefato" (um elemento visual, código, gráfico ou documento rico).

Responda APENAS:
- "SIM" se a pergunta envolver: criação de código, análise de dados, gráficos, diagramas, resumos estruturados, tabelas complexas ou documentos formais.
- "NÃO" se for apenas uma conversa casual, pergunta simples de texto ou se não houver necessidade de suporte visual.

REGRAS:
1. Responda estritamente com UMA PALAVRA: SIM ou NÃO.
2. Não explique sua decisão.
3. Não use pontuação.`;

        const context = `Usuário: ${userMessage}\n` + 
                       (webData.query ? `Busca Web: ${webData.query}\n` : '') +
                       (relevantContext.length > 0 ? `Contexto: ${relevantContext.map(m => m.content).join(' | ')}` : '');

        try {
            this.agent.setApiProvider('samba');
            const response = await this.agent.callGroqAPI(this.decisionModel, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context }
            ], { max_tokens: 5, temperature: 0.1 });

            const decision = response.trim().toUpperCase();
            console.log(`🎯 [ARTIFACT-DECISION] Resultado: ${decision}`);
            
            return decision.includes('SIM');
        } catch (error) {
            console.error('❌ [ARTIFACT-DECISION] Erro na decisão:', error);
            // Fallback heurístico
            return this.heuristicDecision(userMessage);
        }
    }

    /**
     * Decisão baseada em palavras-chave (Fallback)
     */
    heuristicDecision(message) {
        const keywords = ['código', 'code', 'gráfico', 'chart', 'tabela', 'diagrama', 'fluxograma', 'resumo', 'analise', 'comparação', 'javascript', 'python', 'html', 'css', 'react'];
        return keywords.some(k => message.toLowerCase().includes(k));
    }

    /**
     * Extrai o conteúdo do artifact da resposta da IA
     */
    extractArtifact(aiResponse) {
        // Padrão Claude: detecta blocos de código ou tags especiais
        const codeBlockMatch = aiResponse.match(/```([\w]*)\n([\s\S]*?)```/);
        const artifactTagMatch = aiResponse.match(/<artifact\s+type=["']([^"']+)["'](?:\s+title=["']([^"']+)["'])?>([\s\S]*?)<\/artifact>/i);

        if (artifactTagMatch) {
            return {
                type: artifactTagMatch[1],
                title: artifactTagMatch[2] || 'Artefato',
                content: artifactTagMatch[3].trim()
            };
        }

        if (codeBlockMatch) {
            return {
                type: 'code',
                title: 'Código Fonte',
                language: codeBlockMatch[1],
                content: codeBlockMatch[2].trim()
            };
        }

        return null;
    }

    /**
     * Renderiza o Artifact com design Premium Claude-style
     */
    async renderArtifact(messageId, artifact) {
        if (!artifact) return;

        const artifactId = `artifact_${Date.now()}`;
        
        // Design inspirado no Claude (painel lateral ou flutuante)
        const html = `
            <div id="${artifactId}" class="claude-artifact-container group mt-6 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div class="artifact-card overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117] shadow-2xl">
                    <!-- Header -->
                    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-800">
                        <div class="flex items-center gap-3">
                            <div class="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <span class="material-icons-outlined text-sm">${this.getIconForType(artifact.type)}</span>
                            </div>
                            <div>
                                <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">${artifact.title}</h4>
                                <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">${artifact.type}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="window.artifactSystem.copyContent('${artifactId}')" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="Copiar">
                                <span class="material-icons-outlined text-sm">content_copy</span>
                            </button>
                            <button onclick="window.artifactSystem.toggleExpand('${artifactId}')" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">
                                <span class="material-icons-outlined text-sm">fullscreen</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content Area -->
                    <div class="artifact-content-area relative max-h-[500px] overflow-auto p-0">
                        ${this.formatContent(artifact)}
                    </div>
                    
                    <!-- Footer/Status -->
                    <div class="px-4 py-2 bg-gray-50 dark:bg-[#161b22] border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <span class="text-[10px] text-gray-400 dark:text-gray-500">Drekee Artifact Engine v2.0</span>
                        <div class="flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span class="text-[10px] text-gray-400 dark:text-gray-500">Interativo</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const responseDiv = document.getElementById(messageId);
        if (responseDiv) {
            responseDiv.insertAdjacentHTML('beforeend', html);
            this.activeArtifacts.set(artifactId, artifact);
            
            // Scroll suave
            responseDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    getIconForType(type) {
        const icons = {
            code: 'code',
            chart: 'bar_chart',
            diagram: 'account_tree',
            ui: 'widgets',
            document: 'description'
        };
        return icons[type] || 'auto_awesome';
    }

    formatContent(artifact) {
        if (artifact.type === 'code') {
            return `
                <div class="bg-[#0d1117] p-4 font-mono text-sm leading-relaxed">
                    <pre class="text-gray-300"><code>${this.escapeHtml(artifact.content)}</code></pre>
                </div>
            `;
        }
        
        // Se for UI/HTML, renderiza direto (com sandbox sutil)
        if (artifact.type === 'ui' || artifact.content.includes('<div')) {
            return `<div class="p-4 bg-white dark:bg-transparent">${artifact.content}</div>`;
        }

        // Default: Markdown renderizado
        return `<div class="p-6 prose dark:prose-invert max-w-none text-sm">${artifact.content}</div>`;
    }

    copyContent(artifactId) {
        const artifact = this.activeArtifacts.get(artifactId);
        if (artifact) {
            navigator.clipboard.writeText(artifact.content);
            // Toast de sucesso (simplificado)
            console.log('Copiado para o clipboard!');
        }
    }

    toggleExpand(artifactId) {
        const el = document.getElementById(artifactId);
        if (el) {
            el.classList.toggle('fixed');
            el.classList.toggle('inset-4');
            el.classList.toggle('z-[9999]');
            el.querySelector('.artifact-content-area').classList.toggle('max-h-none');
            el.querySelector('.artifact-content-area').classList.toggle('h-[calc(100vh-120px)]');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    stripArtifactTags(text) {
        return text.replace(/<artifact[\s\S]*?<\/artifact>/gi, '').trim();
    }
}

export default ArtifactSystem;
