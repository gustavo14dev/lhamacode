/**
 * Sistema de Artifacts Inteligente para Drekee AI
 * Responsável por decidir e renderizar elementos visuais/interativos automáticos
 * Similar ao sistema de Artifacts do Claude (Anthropic)
 */

class ArtifactSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
        this.artifactCounter = 0;
        this.activeArtifacts = new Map();
    }

    /**
     * Analisa a resposta da IA e decide se um artifact é necessário
     * @param {string} userMessage - Mensagem do usuário
     * @param {string} aiResponse - Resposta da IA
     * @param {string} mode - Modo de resposta (rapido, raciocinio, pro)
     * @returns {Promise<Object>} Decisão sobre o artifact
     */
    async decideArtifact(userMessage, aiResponse, mode = 'rapido') {
        try {
            const decision = {
                shouldRender: false,
                type: null,
                content: null,
                title: null,
                description: null
            };

            // Extrair artifact tags se existirem
            const artifactMatch = aiResponse.match(/<artifact\s+type=["']([^"']+)["'](?:\s+title=["']([^"']+)["'])?(?:\s+description=["']([^"']+)["'])?>([\s\S]*?)<\/artifact>/i);
            
            if (artifactMatch) {
                decision.shouldRender = true;
                decision.type = artifactMatch[1];
                decision.title = artifactMatch[2] || this.generateDefaultTitle(artifactMatch[1]);
                decision.description = artifactMatch[3] || '';
                decision.content = artifactMatch[4].trim();
                return decision;
            }

            // Análise heurística se não houver tags explícitas
            if (mode === 'pro' || mode === 'raciocinio') {
                const heuristic = await this.analyzeForArtifactHeuristic(userMessage, aiResponse);
                if (heuristic.shouldRender) {
                    return heuristic;
                }
            }

            return decision;
        } catch (error) {
            console.error('❌ Erro ao decidir artifact:', error);
            return { shouldRender: false, type: null, content: null, title: null, description: null };
        }
    }

    /**
     * Análise heurística para detectar quando um artifact seria útil
     * @private
     */
    async analyzeForArtifactHeuristic(userMessage, aiResponse) {
        const patterns = {
            code: {
                regex: /```[\w]*\n([\s\S]*?)```/g,
                threshold: 1,
                type: 'code'
            },
            chart: {
                regex: /(?:gráfico|gráficos|chart|charts|dados|estatísticas|números|percentual|taxa|crescimento|evolução|comparação|análise de dados)/i,
                threshold: 2,
                type: 'chart'
            },
            diagram: {
                regex: /(?:diagrama|fluxograma|arquitetura|estrutura|processo|etapas|passo a passo|timeline|linha do tempo)/i,
                threshold: 2,
                type: 'diagram'
            },
            ui: {
                regex: /(?:calculadora|simulador|interativo|ferramenta|app|aplicativo|widget|componente)/i,
                threshold: 2,
                type: 'ui'
            },
            document: {
                regex: /(?:documento|relatório|proposta|plano|guia|manual|especificação|resumo executivo)/i,
                threshold: 2,
                type: 'document'
            }
        };

        const combined = `${userMessage} ${aiResponse}`;
        let bestMatch = null;
        let bestScore = 0;

        for (const [key, pattern] of Object.entries(patterns)) {
            const matches = combined.match(pattern.regex);
            const count = matches ? matches.length : 0;
            
            if (count >= pattern.threshold) {
                const score = count * 10 + (pattern.regex.test(userMessage) ? 5 : 0);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = pattern.type;
                }
            }
        }

        if (bestMatch) {
            return {
                shouldRender: true,
                type: bestMatch,
                title: this.generateDefaultTitle(bestMatch),
                description: `Elemento ${bestMatch} gerado automaticamente`,
                content: aiResponse
            };
        }

        return { shouldRender: false, type: null, content: null, title: null, description: null };
    }

    /**
     * Gera um título padrão baseado no tipo de artifact
     * @private
     */
    generateDefaultTitle(type) {
        const titles = {
            code: '💻 Código',
            chart: '📊 Gráfico',
            diagram: '🔄 Diagrama',
            ui: '🎨 Componente Interativo',
            document: '📄 Documento'
        };
        return titles[type] || '✨ Elemento Visual';
    }

    /**
     * Renderiza um artifact na UI
     * @param {string} messageId - ID da mensagem
     * @param {Object} artifact - Objeto com informações do artifact
     */
    async renderArtifact(messageId, artifact) {
        if (!artifact.shouldRender || !artifact.type) {
            return;
        }

        const artifactId = `artifact_${this.artifactCounter++}`;
        this.activeArtifacts.set(artifactId, artifact);

        try {
            switch (artifact.type) {
                case 'code':
                    await this.renderCodeArtifact(messageId, artifactId, artifact);
                    break;
                case 'chart':
                    await this.renderChartArtifact(messageId, artifactId, artifact);
                    break;
                case 'diagram':
                    await this.renderDiagramArtifact(messageId, artifactId, artifact);
                    break;
                case 'ui':
                    await this.renderUIArtifact(messageId, artifactId, artifact);
                    break;
                case 'document':
                    await this.renderDocumentArtifact(messageId, artifactId, artifact);
                    break;
                default:
                    console.warn('⚠️ Tipo de artifact desconhecido:', artifact.type);
            }
        } catch (error) {
            console.error('❌ Erro ao renderizar artifact:', error);
            this.renderArtifactError(messageId, artifactId, error);
        }
    }

    /**
     * Renderiza um artifact de código
     * @private
     */
    async renderCodeArtifact(messageId, artifactId, artifact) {
        const codeMatch = artifact.content.match(/```[\w]*\n([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1] : artifact.content;
        const language = artifact.content.match(/```([\w]*)/)?.[1] || 'javascript';

        const html = `
            <div id="${artifactId}" class="artifact artifact-code rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg my-4" style="background: #f5f5f5; dark:background: #1e1e1e;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">code</span>
                        <span class="font-semibold">${this.escapeHtml(artifact.title || 'Código')}</span>
                        <span class="text-xs opacity-75">${language}</span>
                    </div>
                    <button class="artifact-copy-btn px-3 py-1 rounded text-xs bg-white/20 hover:bg-white/30 transition-all" onclick="window.artifactSystem && window.artifactSystem.copyArtifactCode('${artifactId}')">
                        📋 Copiar
                    </button>
                </div>
                <div class="artifact-content p-4 overflow-x-auto" style="background: #f5f5f5; dark:background: #1e1e1e;">
                    <pre style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5; color: #333; dark:color: #e0e0e0;"><code>${this.escapeHtml(code)}</code></pre>
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
    }

    /**
     * Renderiza um artifact de gráfico
     * @private
     */
    async renderChartArtifact(messageId, artifactId, artifact) {
        const html = `
            <div id="${artifactId}" class="artifact artifact-chart rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg my-4" style="background: white; dark:background: #1e1e1e;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">bar_chart</span>
                        <span class="font-semibold">${this.escapeHtml(artifact.title || 'Gráfico')}</span>
                    </div>
                </div>
                <div class="artifact-content p-6" style="background: white; dark:background: #1e1e1e; min-height: 300px;">
                    <canvas id="${artifactId}_canvas" style="width: 100%; height: 300px;"></canvas>
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
        
        // Tentar renderizar gráfico com Chart.js se disponível
        setTimeout(() => {
            this.renderChartFromArtifact(artifactId, artifact.content);
        }, 100);
    }

    /**
     * Renderiza um artifact de diagrama
     * @private
     */
    async renderDiagramArtifact(messageId, artifactId, artifact) {
        const html = `
            <div id="${artifactId}" class="artifact artifact-diagram rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg my-4" style="background: white; dark:background: #1e1e1e;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">architecture</span>
                        <span class="font-semibold">${this.escapeHtml(artifact.title || 'Diagrama')}</span>
                    </div>
                </div>
                <div class="artifact-content p-6" style="background: white; dark:background: #1e1e1e; min-height: 300px; display: flex; align-items: center; justify-content: center;">
                    <div style="text-align: center; color: #999;">
                        <p>📊 Diagrama renderizado</p>
                        <p style="font-size: 12px; margin-top: 8px;">Conteúdo do diagrama será exibido aqui</p>
                    </div>
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
    }

    /**
     * Renderiza um artifact de UI interativa
     * @private
     */
    async renderUIArtifact(messageId, artifactId, artifact) {
        const html = `
            <div id="${artifactId}" class="artifact artifact-ui rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg my-4" style="background: white; dark:background: #1e1e1e;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #ec4899 0%, #db2777 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">widgets</span>
                        <span class="font-semibold">${this.escapeHtml(artifact.title || 'Componente Interativo')}</span>
                    </div>
                </div>
                <div class="artifact-content p-6" style="background: white; dark:background: #1e1e1e;">
                    ${artifact.content}
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
    }

    /**
     * Renderiza um artifact de documento
     * @private
     */
    async renderDocumentArtifact(messageId, artifactId, artifact) {
        const html = `
            <div id="${artifactId}" class="artifact artifact-document rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg my-4" style="background: white; dark:background: #1e1e1e;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">description</span>
                        <span class="font-semibold">${this.escapeHtml(artifact.title || 'Documento')}</span>
                    </div>
                </div>
                <div class="artifact-content p-6 prose prose-sm dark:prose-invert max-w-none" style="background: white; dark:background: #1e1e1e;">
                    ${artifact.content}
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
    }

    /**
     * Injeta um artifact na mensagem do assistente
     * @private
     */
    injectArtifactToMessage(messageId, html) {
        const responseDiv = document.getElementById(messageId);
        if (responseDiv) {
            responseDiv.insertAdjacentHTML('beforeend', html);
        }
    }

    /**
     * Renderiza um gráfico usando Chart.js
     * @private
     */
    renderChartFromArtifact(artifactId, content) {
        try {
            // Tentar extrair dados JSON do conteúdo
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return;

            const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            
            // Se Chart.js estiver disponível, renderizar
            if (window.Chart) {
                const canvas = document.getElementById(`${artifactId}_canvas`);
                if (canvas) {
                    new window.Chart(canvas, data);
                }
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível renderizar gráfico:', error);
        }
    }

    /**
     * Copia o conteúdo de um artifact de código
     */
    copyArtifactCode(artifactId) {
        const artifact = this.activeArtifacts.get(artifactId);
        if (!artifact) return;

        const codeMatch = artifact.content.match(/```[\w]*\n([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1] : artifact.content;

        navigator.clipboard.writeText(code).then(() => {
            const btn = document.querySelector(`#${artifactId} .artifact-copy-btn`);
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = '✅ Copiado!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }
        }).catch(err => {
            console.error('❌ Erro ao copiar:', err);
        });
    }

    /**
     * Renderiza um erro ao processar artifact
     * @private
     */
    renderArtifactError(messageId, artifactId, error) {
        const html = `
            <div id="${artifactId}" class="artifact artifact-error rounded-lg border border-red-300 dark:border-red-600 overflow-hidden shadow-lg my-4" style="background: #fef2f2; dark:background: #7f1d1d;">
                <div class="artifact-header flex items-center justify-between px-4 py-3" style="background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); color: white;">
                    <div class="flex items-center gap-2">
                        <span class="material-icons-outlined text-lg">error</span>
                        <span class="font-semibold">Erro ao renderizar elemento</span>
                    </div>
                </div>
                <div class="artifact-content p-4" style="color: #991b1b;">
                    <p style="font-size: 13px; margin: 0;">${this.escapeHtml(error.message || 'Erro desconhecido')}</p>
                </div>
            </div>
        `;

        this.injectArtifactToMessage(messageId, html);
    }

    /**
     * Escapa HTML para evitar XSS
     * @private
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Remove tags de artifact da resposta de texto
     * @param {string} response - Resposta da IA
     * @returns {string} Resposta sem tags de artifact
     */
    stripArtifactTags(response) {
        return response.replace(/<artifact\s+type=["'][^"']+["'](?:\s+[^>]*)?>[\s\S]*?<\/artifact>/gi, '').trim();
    }
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArtifactSystem;
}
