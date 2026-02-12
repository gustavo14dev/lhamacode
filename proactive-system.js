// ==================== SUGESTÕES PROATIVAS ====================
// Ideia 11: IA observa código e sugere melhorias sem pedir

class ProactiveSuggestions {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
        this.suggestions = [];
        this.enabled = JSON.parse(localStorage.getItem('proactiveSuggestionsEnabled') || 'true');
    }

    // Analisar código e gerar sugestões
    async analyzeCodeForSuggestions(fileContent, fileName, language) {
        if (!this.enabled) return [];

        try {
            const prompt = `Analise este código ${language} e liste EXATAMENTE 3 sugestões de melhoria (não mais). Formato JSON: [{"type":"refactor/performance/security/style","title":"...","description":"...","impact":"alto/médio/baixo"}]

Código:
\`\`\`${language}
${fileContent.substring(0, 2000)}
\`\`\``;

            const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: 'Responda com APENAS um JSON array, sem introdução. Máximo 3 sugestões. Formato: [{"type":"...","title":"...","description":"...","impact":"..."}]' },
                { role: 'user', content: prompt }
            ]);

            // Extrair JSON
            let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
            const startIdx = jsonStr.indexOf('[');
            const endIdx = jsonStr.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                jsonStr = jsonStr.substring(startIdx, endIdx + 1);
            }

            const suggestions = JSON.parse(jsonStr);
            return suggestions.slice(0, 3); // Max 3
        } catch (error) {
            console.error('Erro ao gerar sugestões:', error);
            return [];
        }
    }

    // Renderizar widget de sugestões
    renderSuggestionsWidget(suggestions, fileName) {
        if (suggestions.length === 0) return '';

        const typeIcons = {
            'refactor': 'build',
            'performance': 'flash_on',
            'security': 'lock',
            'style': 'palette',
            'documentation': 'description'
        };

        const typeStyleMap = {
            'refactor': { icon: '#2563eb', bg: '#eff6ff', dark: '#1e3a8a', text: '#1e40af' },
            'performance': { icon: '#ea580c', bg: '#fff7ed', dark: '#7c2d12', text: '#b45309' },
            'security': { icon: '#dc2626', bg: '#fef2f2', dark: '#7f1d1d', text: '#b91c1c' },
            'style': { icon: '#9333ea', bg: '#faf5ff', dark: '#581c87', text: '#7c3aed' },
            'documentation': { icon: '#16a34a', bg: '#f0fdf4', dark: '#15803d', text: '#15803d' }
        };

        const impactStyleMap = {
            'alto': { bg: '#fef2f2', text: '#991b1b' },
            'médio': { bg: '#fff7ed', text: '#b45309' },
            'baixo': { bg: '#fefce8', text: '#854d0e' }
        };

        return `
            <div style="background: linear-gradient(to right, rgba(147, 51, 234, 0.05), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(147, 51, 234, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <span class="material-icons-outlined" style="color: #9333ea; font-size: 1.125rem;">lightbulb</span>
                    <h4 style="font-weight: 600; color: #6b21a8;">Sugestões de Melhoria - ${fileName}</h4>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${suggestions.map((s, idx) => {
                        const style = typeStyleMap[s.type] || typeStyleMap['refactor'];
                        const impact = impactStyleMap[s.impact] || impactStyleMap['médio'];
                        return `
                        <div style="background: white; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid ${style.bg};">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.25rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="material-icons-outlined" style="color: ${style.icon}; font-size: 0.875rem;">${typeIcons[s.type] || 'lightbulb'}</span>
                                    <h5 style="font-weight: 600; color: #111827; font-size: 0.875rem;">${s.title}</h5>
                                </div>
                                <span style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 0.25rem; font-weight: 700; background: ${impact.bg}; color: ${impact.text};">
                                    Impacto: ${s.impact}
                                </span>
                            </div>
                            <p style="font-size: 0.75rem; color: #4b5563; margin-bottom: 0.5rem;">${s.description}</p>
                            <button onclick="window.suggestionSystem?.askForImplementation('${s.title}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: ${style.bg}; color: ${style.text}; border: none; border-radius: 0.25rem; cursor: pointer; transition: opacity 0.2s; font-weight: 500;">
                                ✨ Aplicar sugestão
                            </button>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Pedir para IA implementar sugestão
    async askForImplementation(suggestionTitle) {
        const msg = `Implemente a sugestão: "${suggestionTitle}"`;
        this.ui.addUserMessage(msg);
        // Deixar que o usuário continue a conversa normalmente
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('proactiveSuggestionsEnabled', JSON.stringify(this.enabled));
        return this.enabled;
    }
}

export { ProactiveSuggestions };
export default ProactiveSuggestions;
