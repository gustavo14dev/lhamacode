// artifact-system.js
// Sistema de Artifacts Inteligentes para Drekee AI
// Gerencia decisao automatica e renderizacao de elementos visuais/interativos.

const ARTIFACT_KEYWORDS = {
    code: ['python', 'javascript', 'html', 'css', 'react', 'function', 'class', 'import', 'const', 'let', 'var', 'def', 'code', 'codigo', 'snippet', 'script', 'programa'],
    chart: ['chart', 'grafico', 'graph', 'plot', 'dados', 'data', 'estatistica', 'percentual', 'porcentagem', 'crescimento', 'evolucao'],
    diagram: ['diagram', 'diagrama', 'flowchart', 'fluxograma', 'arquitetura', 'architecture', 'workflow', 'pipeline', 'mermaid'],
    ui: ['calculadora', 'calculator', 'simulador', 'simulator', 'formulario', 'form', 'componente', 'component', 'widget', 'interativo'],
    document: ['table', 'tabela', 'documento', 'document', 'markdown', 'relatorio', 'report', 'lista', 'list']
};

const ARTIFACT_TAG_REGEX = /<artifact\s+type="([^"]+)"(?:\s+title="([^"]*)")?(?:\s+description="([^"]*)")?>([\s\S]*?)<\/artifact>/gi;

class ArtifactSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
    }

    async decideIfNeedsArtifact(userMessage, webData, relevantContext) {
        try {
            const contextText = Array.isArray(relevantContext)
                ? relevantContext.map(c => typeof c === 'string' ? c : c.text || '').join(' ')
                : '';
            const webText = webData && Array.isArray(webData.results)
                ? webData.results.map(r => r.title || '').join(' ')
                : '';
            const combined = `${userMessage} ${contextText} ${webText}`;
            return this._shouldCreateArtifact(combined);
        } catch (err) {
            console.error('[ArtifactSystem] Erro ao decidir artifact:', err);
            return false;
        }
    }

    _shouldCreateArtifact(text) {
        const lower = text.toLowerCase();
        for (const keywords of Object.values(ARTIFACT_KEYWORDS)) {
            let score = 0;
            for (const kw of keywords) {
                if (lower.includes(kw)) score++;
            }
            if (score >= 2) return true;
        }
        return false;
    }

    extractArtifact(aiResponse) {
        const explicit = this._extractExplicitArtifact(aiResponse);
        if (explicit) return explicit;

        const heuristic = this._analyzeForArtifactHeuristic('', aiResponse);
        return heuristic;
    }

    _extractExplicitArtifact(aiResponse) {
        ARTIFACT_TAG_REGEX.lastIndex = 0;
        const match = ARTIFACT_TAG_REGEX.exec(aiResponse);
        if (!match) return null;

        return {
            type: match[1],
            title: match[2] || '',
            description: match[3] || '',
            content: match[4].trim(),
            source: 'explicit'
        };
    }

    _analyzeForArtifactHeuristic(userMessage, aiResponse) {
        const combined = `${userMessage} ${aiResponse}`.toLowerCase();
        let bestType = null;
        let bestScore = 0;

        for (const [type, keywords] of Object.entries(ARTIFACT_KEYWORDS)) {
            let score = 0;
            for (const kw of keywords) {
                if (combined.includes(kw)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        }

        if (bestScore < 2) return null;

        return {
            type: bestType,
            title: '',
            description: '',
            content: aiResponse,
            source: 'heuristic'
        };
    }

    async renderArtifact(messageId, artifact) {
        if (!artifact) return;
        try {
            const container = document.getElementById(messageId);
            if (!container) return;

            const el = document.createElement('div');
            el.className = 'artifact-card';
            el.innerHTML = this._buildArtifactHTML(artifact);
            container.appendChild(el);
        } catch (err) {
            console.error('[ArtifactSystem] Erro ao renderizar artifact:', err);
            this.renderArtifactError(messageId, err);
        }
    }

    _buildArtifactHTML(artifact) {
        const icons = { code: 'code', chart: 'bar_chart', diagram: 'account_tree', ui: 'widgets', document: 'description' };
        const icon = icons[artifact.type] || 'extension';
        const title = artifact.title || artifact.type;

        return `
            <div class="flex items-center gap-2 mb-2">
                <span class="material-icons-outlined text-blue-400 text-base">${icon}</span>
                <span class="text-sm font-semibold text-slate-200">${title}</span>
            </div>
            <div class="artifact-content-area text-sm text-slate-300 overflow-auto max-h-96">
                <pre><code>${this._escapeHTML(artifact.content)}</code></pre>
            </div>
        `;
    }

    renderArtifactError(messageId, error) {
        try {
            const container = document.getElementById(messageId);
            if (!container) return;

            const el = document.createElement('div');
            el.className = 'artifact-card artifact-error';
            el.innerHTML = `<span class="text-red-400 text-sm">Erro ao renderizar artifact: ${this._escapeHTML(String(error.message || error))}</span>`;
            container.appendChild(el);
        } catch (e) {
            console.error('[ArtifactSystem] Erro ao renderizar erro de artifact:', e);
        }
    }

    stripArtifactTags(text) {
        return text.replace(ARTIFACT_TAG_REGEX, '').trim();
    }

    static cleanArtifactTags(text) {
        return text.replace(ARTIFACT_TAG_REGEX, '').trim();
    }

    _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

export default ArtifactSystem;
