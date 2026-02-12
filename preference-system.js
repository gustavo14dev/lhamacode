// ==================== APRENDIZADO DE PREFERÊNCIAS ====================
// Ideia 12: IA aprende seu estilo de código, linguagem preferida, etc

class PreferenceLearning {
    constructor() {
        this.profile = JSON.parse(localStorage.getItem('userProfile') || JSON.stringify(this.defaultProfile()));
    }

    defaultProfile() {
        return {
            preferredLanguages: {},
            codeStyle: {},
            explanationPreference: 'balanced', // 'simple', 'technical', 'balanced'
            preferredPatterns: {},
            suggestionsStyle: 'functional', // 'oop', 'functional', 'procedural'
            totalInteractions: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    // Analisar código para detectar preferências
    analyzeCodeStyle(fileContent, language) {
        const analysis = {
            hasSnakeCase: /_[a-z]/g.test(fileContent),
            hasCamelCase: /[a-z][A-Z]/g.test(fileContent),
            hasPascalCase: /[A-Z][a-z]/g.test(fileContent),
            usesFunctional: /(map|filter|reduce|forEach|arrow|=>)/g.test(fileContent),
            usesOOP: /(class|constructor|this\.|new |extends|implements)/g.test(fileContent),
            usesProcedural: /(for\s|while\s|if\s)/g.test(fileContent),
            hasDocComments: (/\/\*\*|\/\//g.test(fileContent)),
            hasTests: /(test\(|describe\(|it\(|assert|expect)/g.test(fileContent)
        };

        // Atualizar perfil
        this.profile.preferredLanguages[language] = (this.profile.preferredLanguages[language] || 0) + 1;
        
        if (analysis.hasSnakeCase > analysis.hasCamelCase) {
            this.profile.codeStyle.naming = 'snake_case';
        } else if (analysis.hasCamelCase > analysis.hasSnakeCase) {
            this.profile.codeStyle.naming = 'camelCase';
        }

        if (analysis.usesFunctional > analysis.usesOOP) {
            this.profile.suggestionsStyle = 'functional';
        } else if (analysis.usesOOP > analysis.usesFunctional) {
            this.profile.suggestionsStyle = 'oop';
        } else {
            this.profile.suggestionsStyle = 'procedural';
        }

        this.profile.totalInteractions++;
        this.profile.lastUpdated = new Date().toISOString();
        this.save();

        return analysis;
    }

    // Atualizar preferência de explicação baseado em feedback
    setExplanationPreference(preference) {
        this.profile.explanationPreference = preference; // 'simple', 'technical', 'balanced'
        this.save();
    }

    // Gerar system prompt personalizado
    getPersonalizedSystemPrompt() {
        const langPref = Object.entries(this.profile.preferredLanguages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'javascript';
        const styleHint = this.profile.codeStyle.naming === 'snake_case' ? 'snake_case' : 'camelCase';
        const patternHint = this.profile.suggestionsStyle;
        const explanation = this.getExplanationStyle();

        return `Você é um assistente de programação especializado.

**Preferências do usuário aprendidas:**
- Linguagem principal: ${langPref}
- Estilo de código: ${styleHint}
- Padrão de programação: ${patternHint}
- Nível de explicação: ${explanation}

Ao gerar código, siga EXATAMENTE essas preferências.
${styleHint === 'snake_case' ? 'Use snake_case para variáveis e funções.' : 'Use camelCase para variáveis e funções.'}
${patternHint === 'functional' ? 'Prefira programação funcional (map, filter, reduce).' : patternHint === 'oop' ? 'Prefira orientação a objetos (classes, herança).' : 'Use procedural quando apropriado.'}`;
    }

    getExplanationStyle() {
        const styles = {
            'simple': 'Explicações em linguagem simples, sem jargão técnico',
            'technical': 'Explicações técnicas detalhadas com terminologia profissional',
            'balanced': 'Explicações balanceadas entre simplicidade e técnica'
        };
        return styles[this.profile.explanationPreference] || styles['balanced'];
    }

    // Renderizar widget de perfil
    renderProfileWidget() {
        const topLang = Object.entries(this.profile.preferredLanguages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhuma';
        const interactions = this.profile.totalInteractions;

        return `
            <div class="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-icons-outlined text-indigo-600 dark:text-indigo-400">person</span>
                    <h5 class="font-semibold text-indigo-900 dark:text-indigo-100">Seu Perfil de Programação</h5>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <span class="text-indigo-700 dark:text-indigo-400 font-bold">Linguagem Top:</span><br>
                        <span class="text-indigo-600 dark:text-indigo-300">${topLang}</span>
                    </div>
                    <div>
                        <span class="text-indigo-700 dark:text-indigo-400 font-bold">Estilo:</span><br>
                        <span class="text-indigo-600 dark:text-indigo-300">${this.profile.codeStyle.naming || 'indefinido'}</span>
                    </div>
                    <div>
                        <span class="text-indigo-700 dark:text-indigo-400 font-bold">Padrão:</span><br>
                        <span class="text-indigo-600 dark:text-indigo-300">${this.profile.suggestionsStyle}</span>
                    </div>
                    <div>
                        <span class="text-indigo-700 dark:text-indigo-400 font-bold">Interações:</span><br>
                        <span class="text-indigo-600 dark:text-indigo-300">${interactions}</span>
                    </div>
                </div>
                <div class="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="explanation" value="simple" ${this.profile.explanationPreference === 'simple' ? 'checked' : ''} onchange="window.preferenceSystem?.setExplanationPreference('simple')">
                        <span>Explicações Simples</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="radio" name="explanation" value="balanced" ${this.profile.explanationPreference === 'balanced' ? 'checked' : ''} onchange="window.preferenceSystem?.setExplanationPreference('balanced')">
                        <span>Balanceadas</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="radio" name="explanation" value="technical" ${this.profile.explanationPreference === 'technical' ? 'checked' : ''} onchange="window.preferenceSystem?.setExplanationPreference('technical')">
                        <span>Técnicas</span>
                    </label>
                </div>
            </div>
        `;
    }

    save() {
        localStorage.setItem('userProfile', JSON.stringify(this.profile));
    }
}

export { PreferenceLearning };
export default PreferenceLearning;
