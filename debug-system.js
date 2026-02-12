// ==================== SISTEMA DE DEPURAÇÃO INTERATIVA ====================
// Aparece no chat como resultado normal, com hipóteses, estatísticas e histórico

class DebugSystem {
    constructor(agent, ui) {
        this.agent = agent;
        this.ui = ui;
        this.debugHistory = [];
        this.currentDebugSession = null;
    }

    // Detectar linguagem do erro com mais precisão
    detectLanguage(errorText) {
        const lower = errorText.toLowerCase();
        if (lower.includes('traceback') || lower.includes('file "') || lower.includes('syntaxerror') || lower.includes('import error')) return 'python';
        if (lower.includes('exception') || lower.includes(' at ') || lower.includes('.java:') || lower.includes('nullpointerexception')) return 'java';
        if (lower.includes('cargo') || lower.includes('rustc') || lower.includes('borrow checker')) return 'rust';
        if (lower.includes('c++') || lower.includes('compilation error')) return 'cpp';
        if (lower.includes('uncaught') || lower.includes('typeerror') || lower.includes('referenceerror') || lower.includes('.js:')) return 'javascript';
        return 'javascript';
    }

    // Gerar hipóteses via IA
    async generateHypotheses(errorText, language, existingHypotheses = []) {
        console.log('🔵 generateHypotheses: 1. Iniciado');
        try {
            const existingCount = existingHypotheses.length;
            
            const userMessage = `Você é um especialista em debug. Analise este ERRO e liste 5 HIPÓTESES REAIS sobre a causa.
Retorne APENAS um JSON array válido com EXATAMENTE 5 objetos. Nada antes, nada depois.
Cada objeto deve ter: id (1-5), probability (90-50), title, explanation, solution (código real), testCase (como testar).

ERRO:
${errorText.substring(0, 300)}

LINGUAGEM: ${language}

Responda APENAS com JSON válido, sem markdown, sem explicação:`;

            console.log('🔵 generateHypotheses: 2. Chamando callGroqAPI');
            const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: 'Você é um especialista em debugging. Analise erros e retorne hipóteses reais baseadas na linguagem. Responda APENAS com JSON array válido, nada mais.' },
                { role: 'user', content: userMessage }
            ]);

            console.log('🔵 generateHypotheses: 3. Response recebido, length:', response?.length);
            console.log('🔵 generateHypotheses: 3.1 Primeiros 500 chars:', response?.substring(0, 500));
            
            if (!response || response.trim().length === 0) {
                console.warn('🔵 generateHypotheses: Response vazio, usando default');
                return this.generateDefaultHypotheses(errorText, language);
            }

            // Extrair JSON - ESTRATÉGIA AGRESSIVA
            let jsonStr = response.trim();
            
            // Remove markdown
            jsonStr = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            
            // Remove TUDO antes do primeiro [
            const startIdx = jsonStr.indexOf('[');
            if (startIdx !== -1) {
                jsonStr = jsonStr.substring(startIdx);
            }
            
            // Remove TUDO depois do último ]
            const endIdx = jsonStr.lastIndexOf(']');
            if (endIdx !== -1) {
                jsonStr = jsonStr.substring(0, endIdx + 1);
            }
            
            console.log('🔵 generateHypotheses: 4. Após limpeza, length:', jsonStr.length);
            console.log('🔵 generateHypotheses: 4.1 Conteúdo:', jsonStr.substring(0, 150));
            
            // Validar se tem conteúdo
            if (!jsonStr.includes('{') || jsonStr.length < 50) {
                console.warn('🔵 generateHypotheses: JSON muito pequeno ou vazio, usando default');
                return this.generateDefaultHypotheses(errorText, language);
            }
            
            // Parse
            let hypotheses;
            try {
                hypotheses = JSON.parse(jsonStr);
                console.log('🔵 generateHypotheses: 5. Parse OK, length:', hypotheses.length);
            } catch (parseErr) {
                console.error('🔵 generateHypotheses: Parse error -', parseErr.message);
                console.log('🔵 generateHypotheses: String que falhou:', jsonStr);
                return this.generateDefaultHypotheses(errorText);
            }
            
            if (!Array.isArray(hypotheses) || hypotheses.length < 5) {
                console.warn('🔵 generateHypotheses: Menos de 5 hipóteses, completando');
                const defaults = this.generateDefaultHypotheses(errorText, language);
                hypotheses = [...hypotheses, ...defaults.slice(hypotheses.length)];
            }
            
            // Renumerar IDs
            const result = hypotheses.slice(0, 5).map((h, i) => ({
                id: existingCount + i + 1,
                probability: Math.max(50, Math.min(100, h.probability || (70 - i * 5))),
                title: String(h.title || 'Hipótese ' + (i + 1)).substring(0, 50),
                explanation: String(h.explanation || 'Análise'),
                solution: String(h.solution || 'console.log("debug");'),
                testCase: String(h.testCase || 'Verificar logs')
            }));
            
            console.log('🔵 generateHypotheses: 6. Retornando', result.length, 'hipóteses');
            return result;
        } catch (error) {
            console.error('🔵 generateHypotheses: ERRO GERAL -', error.message);
            console.error('🔵 Stack:', error.stack);
            console.warn('🔵 Caindo para hipóteses padrão por linguagem:', language);
            return this.generateDefaultHypotheses(errorText, language);
        }
    }

    // Hipóteses padrão baseadas na linguagem detectada
    generateDefaultHypotheses(errorText, language = 'javascript') {
        const baseIdeas = {
            'python': [
                ["Módulo não importado", "O módulo ou função não foi importado corretamente", "from module import function", "Verifique import"],
                ["Indentação incorreta", "Erro de indentação é comum em Python", "def function():\\n    pass", "Cheque espaços"],
                ["Tipo de dado incompatível", "Operação incompatível com tipo de dado", "str(value)", "Converta tipo"],
                ["Variável indefinida", "Variável usada antes de ser declarada", "variable = None", "Defina antes de usar"],
                ["Argumentos insuficientes", "Função chamada com poucos argumentos", "function(arg1, arg2)", "Verifique assinatura"]
            ],
            'java': [
                ["Null Pointer Exception", "Objeto não foi inicializado", "Object obj = new Object();", "Inicialize objeto"],
                ["ClassNotFoundException", "Classe não encontrada no classpath", "import java.util.ArrayList;", "Importe classe"],
                ["Type Mismatch", "Tipo de dado não corresponde", "Integer num = (Integer) value;", "Cast correto"],
                ["Method not found", "Método não existe ou tem assinatura diferente", "obj.method();", "Verifique método"],
                ["Import error", "Classe não importada", "import java.util.*;", "Importe pacote"]
            ],
            'cpp': [
                ["Undefined reference", "Função não está linkada ou definida", "void function() { }", "Defina função"],
                ["Syntax error", "Erro de sintaxe C++", "int x = 5;", "Cheque sintaxe"],
                ["Memory leak", "Memória não foi liberada", "delete pointer;", "Use delete"],
                ["Compilation error", "Erro durante compilação", "g++ -c file.cpp", "Compile corretamente"],
                ["Header not found", "Header file não encontrado", "#include \"file.h\"", "Verifique include"]
            ],
            'rust': [
                ["Borrow checker error", "Violação das regras de propriedade Rust", "&value", "Use referência"],
                ["Type mismatch", "Tipos não correspondem", "as i32", "Faça cast apropriado"],
                ["Use of moved value", "Valor foi movido", "let clone = value.clone();", "Clone se necessário"],
                ["Pattern matching incomplete", "Match não cobre todos os casos", "_ => { }", "Adicione catch-all"],
                ["Lifetime issue", "Lifetime não é suficiente", "'a lifetime", "Verifique lifetime"]
            ]
        };
        
        const ideas = baseIdeas[language] || baseIdeas['javascript'];
        
        // Se não tem 5 ideias, completar com genéricas
        if (!ideas || ideas.length === 0) {
            ideas = [
                ["Variável não inicializada", "A variável pode não ter sido declarada", "var x = null;", "Declare antes"],
                ["Tipo incompatível", "Type mismatch ou conversão errada", "Number(value)", "Cheque tipo"],
                ["Função não existe", "Função não foi definida ou importada", "function fn() {}", "Procure definição"],
                ["Escopo errado", "Variável em escopo local vs global", "Mova declaração", "Teste bloco"],
                ["Erro de lógica", "Condição ou algoritmo incorreto", "if (condition) {}", "Revise lógica"]
            ];
        }

        return ideas.slice(0, 5).map(([title, exp, sol, test], i) => ({
            id: i + 1,
            probability: 85 - (i * 8),
            title,
            explanation: exp,
            solution: sol,
            testCase: test
        }));
    }

    // Testar hipótese
    async testHypothesis(hypothesis, errorText, language) {
        try {
            const prompt = `A solução "${hypothesis.solution}" resolve esse erro: "${errorText.substring(0, 150)}"? Responda APENAS com JSON: {"works":true,"explanation":"...","confidence":85}`;

            const response = await this.agent.callGroqAPI('llama-3.1-8b-instant', [
                { role: 'system', content: 'Responda APENAS com um JSON object, nada de texto: {"works":true,"explanation":"...","confidence":85}' },
                { role: 'user', content: prompt }
            ]);

            // Extrair JSON com estratégia robusta
            let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
            
            const startIdx = jsonStr.indexOf('{');
            const endIdx = jsonStr.lastIndexOf('}');
            
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                jsonStr = jsonStr.substring(startIdx, endIdx + 1);
            }
            
            const result = JSON.parse(jsonStr);
            return {
                works: result.works || false,
                explanation: result.explanation || "Resultado incerto",
                confidence: result.confidence || 50
            };
        } catch (error) {
            console.error('Erro ao testar hipótese:', error);
            return { works: false, explanation: "Erro ao validar", confidence: 0 };
        }
    }
    // Método principal: analisa erro e renderiza
    async analyzeError(errorText) {
        try {
            // Verificar se API key está setada
            if (!this.agent.getGroqApiKey()) {
                console.warn('⚠️ API KEY GROQ NÃO CONFIGURADA!');
                this.ui.addAssistantMessage(`⚠️ <strong>API Key Groq não configurada!</strong><br>Use: <code>session.start("sua_chave_groq")</code><br>As hipóteses abaixo são genéricas até você configurar a API.`);
            }
            
            const language = this.detectLanguage(errorText);
            
            // Criar session
            this.currentDebugSession = {
                errorText,
                language,
                hypotheses: [],
                totalGenerated: 0,
                tested: 0,
                successful: 0
            };

            // Gerar primeiras 5 hipóteses
            const hypotheses = await this.generateHypotheses(errorText, language);
            
            this.currentDebugSession.hypotheses = hypotheses;
            this.currentDebugSession.totalGenerated = hypotheses.length;

            // Renderiza direto no chat via renderDebugInChat
            this.renderDebugInChat(hypotheses, errorText, language, 0);
            
        } catch (error) {
            console.error('DebugSystem error:', error);
            this.ui.addAssistantMessage(`❌ Erro ao analisar: ${error.message}`);
        }
    }

    renderDebugInChat(hypotheses, errorText, language, currentCount = 0) {
        // Renderizar o card de debug DENTRO do chat em vez de modal
        if (!hypotheses || hypotheses.length === 0) {
            this.ui.addAssistantMessage('❌ Erro ao gerar hipóteses de depuração.');
            return;
        }

        const modal = document.getElementById('debugModal');
        const content = document.getElementById('debugModalContent');

        // Erro display
        const errorDisplay = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 font-mono text-xs text-red-700 dark:text-red-400 overflow-x-auto max-h-24">
                ${errorText.substring(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;')}${errorText.length > 300 ? '...' : ''}
            </div>
        `;

        // Hypotheses
        const hypothesesHTML = hypotheses.map((h) => `
            <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 bg-gray-50 dark:bg-gray-900/50">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <div>
                            <h4 class="font-semibold text-gray-900 dark:text-white">${h.id}. ${h.title}</h4>
                            <span class="inline-block mt-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-bold">${h.probability}% de probabilidade</span>
                        </div>
                    </div>
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">${h.explanation}</p>
                <div class="bg-gray-800 dark:bg-gray-950 rounded p-3 mb-2 text-sm text-gray-200 whitespace-pre-wrap break-words">
                    ${h.solution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
                <p class="text-xs text-gray-500 italic">Caso de teste: ${h.testCase}</p>
                <div id="result-${h.id}"></div>
            </div>
        `).join('');

        // Stats
        const stats = `
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📊 Estatísticas</p>
                <div class="grid grid-cols-2 gap-2">
                    <div class="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                        <div class="font-bold text-gray-900 dark:text-white debugStat-generated">${currentCount + hypotheses.length}</div>
                        <div class="text-xs text-gray-500">Geradas</div>
                    </div>
                    <div class="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                        <div class="font-bold text-orange-600 dark:text-orange-400 debugStat-rate">0%</div>
                        <div class="text-xs text-gray-500">Taxa</div>
                    </div>
                </div>
            </div>
        `;

        // Botão para gerar mais (até 20 no total)
        const generateMoreHTML = `
            <div class="mt-2 mb-4">
                <button class="debugGenerateMoreBtn px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Gerar mais 5 hipóteses</button>
            </div>
        `;

        // Renderizar tudo como mensagem no chat
        const fullHTML = errorDisplay + hypothesesHTML + generateMoreHTML + stats;
        this.ui.addAssistantMessage(fullHTML);
        // Setup event listeners (Gerar mais hipóteses)
        setTimeout(() => {
            document.querySelectorAll('.debugGenerateMoreBtn').forEach(btn => {
                if (!btn.hasListener) {
                    btn.hasListener = true;
                    btn.addEventListener('click', async (e) => {
                        try {
                            btn.disabled = true;
                            btn.textContent = 'Gerando...';

                            const session = this.currentDebugSession || { errorText, language, hypotheses: [], totalGenerated: 0 };
                            const remaining = 20 - (session.totalGenerated || session.hypotheses.length || 0);
                            if (remaining <= 0) {
                                btn.textContent = 'Limite atingido (20)';
                                return;
                            }

                            // Sempre pedimos 5 e depois cortamos se necessário
                            const newOnes = await this.generateHypotheses(errorText, language, session.hypotheses);
                            const amount = Math.min(5, remaining, newOnes.length);
                            const toAdd = newOnes.slice(0, amount);

                            // Atualizar sessão
                            session.hypotheses = session.hypotheses.concat(toAdd);
                            session.totalGenerated = session.hypotheses.length;
                            this.currentDebugSession = session;

                            // Encontrar última mensagem de assistente e seu container de resposta
                            const lastMsg = this.ui.elements.messagesContainer.lastElementChild;
                            if (lastMsg) {
                                const responseDiv = lastMsg.querySelector('[id^="responseText_"]');
                                if (responseDiv) {
                                    // Construir HTML das novas hipóteses e anexar
                                    const newHTML = toAdd.map(h => `
                                        <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 bg-gray-50 dark:bg-gray-900/50">
                                            <div class="flex items-start justify-between gap-3 mb-2">
                                                <div>
                                                    <h4 class="font-semibold text-gray-900 dark:text-white">${h.id}. ${h.title}</h4>
                                                    <span class="inline-block mt-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs font-bold">${h.probability}% de probabilidade</span>
                                                </div>
                                            </div>
                                            <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">${h.explanation}</p>
                                            <div class="bg-gray-800 dark:bg-gray-950 rounded p-3 mb-2 text-sm text-gray-200 whitespace-pre-wrap break-words">
                                                ${h.solution.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                                            </div>
                                            <p class="text-xs text-gray-500 italic">Caso de teste: ${h.testCase}</p>
                                            <div id="result-${h.id}"></div>
                                        </div>
                                    `).join('');
                                    responseDiv.innerHTML += newHTML;

                                    // Atualizar contador de geradas e taxa (taxa permanece como estava)
                                    const genSpan = lastMsg.querySelector('.debugStat-generated');
                                    if (genSpan) genSpan.textContent = String(session.totalGenerated);
                                }
                            }

                            // Atualizar botão conforme limite
                            if (session.totalGenerated >= 20) {
                                btn.textContent = 'Limite atingido (20)';
                                btn.disabled = true;
                            } else {
                                btn.textContent = 'Gerar mais 5 hipóteses';
                                btn.disabled = false;
                            }
                        } catch (err) {
                            console.error('Erro ao gerar mais hipóteses:', err);
                            btn.textContent = 'Erro, tente novamente';
                            btn.disabled = false;
                        }
                    });
                }
            });
        }, 100);
    }

    showDebugModal(htmlContent = null) {
        const modal = document.getElementById('debugModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.remove('pointer-events-none');
    }

    hideDebugModal() {
        const modal = document.getElementById('debugModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.add('pointer-events-none');
    }

    createDebugHTML(hypotheses, errorText, language, currentCount) {
        // Redireciona para renderização no chat
        this.renderDebugInChat(hypotheses, errorText, language, currentCount);
        return '<!-- Renderizado no chat -->';
    }

    createTestResultHTML(hypothesis, testResult) {
        const statusIcon = testResult.works ? '✅' : '❌';
        const bgColor = testResult.works ? 'green' : 'red';
        const textColor = testResult.works ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
        const bgLight = testResult.works ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
        const borderColor = testResult.works ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800';

        return `
            <div class="mt-3 bg-white dark:bg-gray-900 rounded-lg border ${borderColor} p-3">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">${statusIcon}</span>
                    <h5 class="font-semibold text-gray-800 dark:text-gray-100 text-sm">${testResult.works ? 'Solução Válida' : 'Solução Inválida'}</h5>
                </div>
                <p class="text-xs text-gray-700 dark:text-gray-400 mb-2">${testResult.explanation}</p>
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="bg-${bgColor}-500 h-2 rounded-full transition-all" style="width: ${testResult.confidence}%"></div>
                    </div>
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-300">${testResult.confidence}%</span>
                </div>
            </div>
        `;
    }

    updateDebugStats(wasSuccessful) {
        const modal = document.getElementById('debugModal');
        if (!modal) return;

        const tested = modal.querySelector('.debugStat-tested');
        const success = modal.querySelector('.debugStat-success');
        const rate = modal.querySelector('.debugStat-rate');

        if (tested && success && rate) {
            const testedCount = parseInt(tested.textContent) + 1;
            const successCount = parseInt(success.textContent) + (wasSuccessful ? 1 : 0);
            const successRate = Math.round((successCount / testedCount) * 100);

            tested.textContent = testedCount;
            success.textContent = successCount;
            rate.textContent = successRate + '%';
        }
    }
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugSystem;
}

// Exportar como ES6 module
export { DebugSystem };
export default DebugSystem;
