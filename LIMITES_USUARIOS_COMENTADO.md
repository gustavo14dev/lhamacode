# 💡 SISTEMA DE LIMITES DE USO - COMENTÁRIOS E ANÁLISE

## 📋 O QUE SERIA NECESSÁRIO IMPLEMENTAR

Baseado na estrutura atual do Lhama Code 1, aqui estão as propostas comentadas para adicionar um sistema de limites de uso:

---

## 1️⃣ LIMITE DE REQUISIÇÕES (Rate Limiting)

### **O QUE FAZER:**
Rastrear quantas requisições cada usuário faz por período de tempo.

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// storage/limites.js
class UsageLimiter {
    constructor() {
        // Estrutura em localStorage:
        // {
        //   "user_id": {
        //     "requests_today": 150,
        //     "requests_this_hour": 45,
        //     "last_reset_hour": "2026-01-28 14:00",
        //     "last_reset_day": "2026-01-28"
        //   }
        // }
        this.limits = {
            free: {
                requests_per_day: 100,      // 100 requisições/dia
                requests_per_hour: 20,      // 20 requisições/hora
                max_tokens_per_request: 5000
            },
            pro: {
                requests_per_day: 500,      // 500 requisições/dia
                requests_per_hour: 100,     // 100 requisições/hora
                max_tokens_per_request: 15000
            }
        };
    }

    // Verificar se usuário pode fazer requisição
    canMakeRequest(userId, plan = 'free') {
        const userStats = this.getUserStats(userId);
        const limits = this.limits[plan];

        // Check limite por hora
        if (userStats.requests_this_hour >= limits.requests_per_hour) {
            return {
                allowed: false,
                reason: `Limite de ${limits.requests_per_hour} requisições por hora atingido`,
                reset_in: this.getTimeUntilHourReset()
            };
        }

        // Check limite por dia
        if (userStats.requests_today >= limits.requests_per_day) {
            return {
                allowed: false,
                reason: `Limite de ${limits.requests_per_day} requisições por dia atingido`,
                reset_in: this.getTimeUntilDayReset()
            };
        }

        return { allowed: true };
    }

    // Incrementar contador após requisição bem-sucedida
    recordRequest(userId) {
        const stats = this.getUserStats(userId);
        stats.requests_this_hour++;
        stats.requests_today++;
        this.saveUserStats(userId, stats);
    }

    // Reset automático a cada hora
    resetHourlyCounter(userId) {
        const stats = this.getUserStats(userId);
        const now = new Date();
        const lastReset = new Date(stats.last_reset_hour);
        
        if (now.getHours() !== lastReset.getHours()) {
            stats.requests_this_hour = 0;
            stats.last_reset_hour = now.toISOString();
            this.saveUserStats(userId, stats);
        }
    }
}
```

### **QUANDO USAR:**
- Após cada `callGroqAPI()` bem-sucedida
- Mostrar aviso se usuário está próximo do limite
- Mostrar modal com upgrade para PRO se limite atingido

---

## 2️⃣ LIMITE DE TOKENS

### **O QUE FAZER:**
Controlar quantidade total de tokens (palavras) que usuário pode usar por período.

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// Calcular tokens (aproximadamente 1 token = 4 caracteres)
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// Na classe Agent - antes de chamar Groq
async processMessage(userMessage) {
    const userId = localStorage.getItem('user_id');
    const plan = localStorage.getItem('user_plan') || 'free';
    
    // Estimar tokens que será usado
    const estimatedTokens = estimateTokens(userMessage);
    
    // Checar se tem tokens disponíveis
    const limiter = new UsageLimiter();
    const userTokens = limiter.getUserTokensUsedToday(userId);
    const limit = limiter.limits[plan].tokens_per_day;
    
    if (userTokens + estimatedTokens > limit) {
        this.ui.showError(`❌ Limite de tokens diário (${limit}) será excedido`);
        return;
    }
    
    // Fazer requisição normalmente
    const response = await this.callGroqAPI(...);
    
    // Registrar tokens usados
    const actualTokens = estimateTokens(userMessage + response);
    limiter.recordTokensUsed(userId, actualTokens);
}
```

### **QUANDO USAR:**
- FREE: 50.000 tokens/dia
- PRO: 500.000 tokens/dia
- Mostrar barra de progresso: "45.230 / 50.000 tokens"

---

## 3️⃣ LIMITE DE MODELOS

### **O QUE FAZER:**
Usuários FREE só podem usar modelo "Rápido", PRO usa todos.

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// Em main.js - modelDropdown onChange
document.getElementById('modelDropdown').addEventListener('change', (e) => {
    const selectedModel = e.target.value;
    const plan = localStorage.getItem('user_plan') || 'free';
    
    // Apenas modelo "rápido" para FREE
    if (plan === 'free' && selectedModel !== 'rapido') {
        e.target.value = 'rapido';
        alert('⚠️ Plano FREE: apenas modelo "Rápido" disponível\n\nFaça upgrade para PRO para usar todos os modelos!');
        return;
    }
    
    this.currentModel = selectedModel;
});
```

### **MODELOS DISPONÍVEIS:**
- **FREE:** Apenas "Rápido" (llama-3.1-8b-instant)
- **PRO:** Todos (Rápido, Raciocínio, Pro)

---

## 4️⃣ LIMITE DE ARMAZENAMENTO

### **O QUE FAZER:**
Limitar quanto dados o usuário pode salvar (chats, snapshots, etc).

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// Antes de salvar novo chat ou snapshot
function checkStorageQuota(userId, plan = 'free') {
    const quotas = {
        free: 5 * 1024 * 1024,      // 5 MB
        pro: 100 * 1024 * 1024      // 100 MB
    };
    
    const quota = quotas[plan];
    const used = estimateStorageUsed(userId);
    
    if (used > quota * 0.9) {  // Aviso em 90%
        console.warn(`⚠️ Seu armazenamento está ${Math.round((used/quota)*100)}% cheio`);
    }
    
    if (used >= quota) {
        throw new Error(`Limite de armazenamento (${quota/1024/1024}MB) atingido!`);
    }
}

// Calcular espaço usado
function estimateStorageUsed(userId) {
    const chats = JSON.parse(localStorage.getItem('lhama_chats') || '[]');
    const snapshots = JSON.parse(localStorage.getItem('codeSnapshots') || '[]');
    
    const chatsSize = new Blob([JSON.stringify(chats)]).size;
    const snapshotsSize = new Blob([JSON.stringify(snapshots)]).size;
    
    return chatsSize + snapshotsSize;
}
```

### **QUANDO USAR:**
- FREE: 5 MB (máximo ~500 mensagens curtas)
- PRO: 100 MB (ilimitado na prática)

---

## 5️⃣ LIMITE DE RECURSOS (CPU/TIEMPO)

### **O QUE FAZER:**
Limitar tempo máximo de processamento para não sobrecarregar backend.

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// Na classe Agent
async callGroqAPI(model, customMessages = null) {
    const apiKey = this.getGroqApiKey();
    const plan = localStorage.getItem('user_plan') || 'free';
    
    // Timeout diferente por plano
    const timeouts = {
        free: 30000,    // 30 segundos
        pro: 120000     // 2 minutos
    };
    
    const timeout = timeouts[plan];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(this.groqUrl, {
            method: 'POST',
            headers: {...},
            body: JSON.stringify({...}),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            this.ui.showError(`⏱️ Requisição expirou (limite: ${timeout/1000}s)`);
        }
        throw error;
    }
}
```

---

## 6️⃣ UI PARA MOSTRAR LIMITES

### **O QUE FAZER:**
Adicionar widget na sidebar/header mostrando uso do dia.

### **IMPLEMENTAÇÃO COMENTADA:**

```javascript
// Em code.html - adicionar novo elemento
<div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
    <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">📊 Uso Hoje</div>
    
    <!-- Requisições -->
    <div class="mb-2">
        <div class="flex justify-between text-xs mb-1">
            <span>Requisições: 45/100</span>
            <span class="text-green-600 dark:text-green-400">55% restante</span>
        </div>
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-green-500" style="width: 45%"></div>
        </div>
    </div>
    
    <!-- Tokens -->
    <div class="mb-3">
        <div class="flex justify-between text-xs mb-1">
            <span>Tokens: 23.450/50.000</span>
            <span class="text-orange-600 dark:text-orange-400">47% restante</span>
        </div>
        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-orange-500" style="width: 47%"></div>
        </div>
    </div>
    
    <!-- Status Plano -->
    <div class="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
        <span class="text-xs font-medium text-blue-700 dark:text-blue-400">Plano: FREE</span>
        <button class="text-xs text-blue-600 hover:underline">Upgrade →</button>
    </div>
</div>
```

### **ATUALIZAR EM TEMPO REAL:**
```javascript
// Após cada requisição, atualizar widget
function updateUsageWidget(userId, plan = 'free') {
    const limiter = new UsageLimiter();
    const stats = limiter.getUserStats(userId);
    const limits = limiter.limits[plan];
    
    const requestsPercent = (stats.requests_today / limits.requests_per_day) * 100;
    const tokensPercent = (stats.tokens_today / limits.tokens_per_day) * 100;
    
    document.querySelector('[data-usage-requests]').textContent = 
        `${stats.requests_today}/${limits.requests_per_day}`;
    document.querySelector('[data-usage-bar-requests]').style.width = requestsPercent + '%';
    
    document.querySelector('[data-usage-tokens]').textContent = 
        `${stats.tokens_today}/${limits.tokens_per_day}`;
    document.querySelector('[data-usage-bar-tokens]').style.width = tokensPercent + '%';
}
```

---

## 7️⃣ PLANOS SUGERIDOS

| Feature | FREE | PRO |
|---------|------|-----|
| Requisições/dia | 100 | 500 |
| Requisições/hora | 20 | 100 |
| Tokens/dia | 50.000 | 500.000 |
| Modelos | Rápido | Todos |
| Armazenamento | 5 MB | 100 MB |
| Timeout | 30s | 120s |
| Modo Depuração | ✅ | ✅ |
| Timeline (Ideia 10) | ✅ | ✅ |
| Sugestões (Ideia 11) | ⚠️ Limitado | ✅ |
| Preferências (Ideia 12) | ✅ | ✅ |
| Custo/mês | $0 | $9.99 |

---

## 8️⃣ AUTENTICAÇÃO NECESSÁRIA

Para implementar limites por usuário, você precisaria:

```javascript
// Sistema de autenticação (Firebase, Auth0, etc)
class AuthSystem {
    async login(email, password) {
        // Validar credenciais
        // Retornar userId + plan
    }
    
    async register(email, password, plan = 'free') {
        // Criar usuário
        // Salvar plan
    }
    
    getCurrentUser() {
        // Retornar {userId, email, plan, created_at}
    }
}

// Uso:
const auth = new AuthSystem();
const user = auth.getCurrentUser();
console.log(`Usuário: ${user.email}, Plano: ${user.plan}`);
```

---

## ✅ RESUMO DO QUE IMPLEMENTAR

1. **LocalStorage + Backend:** Armazenar stats por userId
2. **Verificação ANTES de requisição:** Não deixar executar se limite atingido
3. **UI Visual:** Mostrar barras de progresso e avisos
4. **Upgrade modal:** "Você atingiu limite, faça upgrade para PRO"
5. **Reset automático:** Hourly/daily counters
6. **Plano gratuito vs pago:** Diferentes quotas
7. **Autenticação:** Identificar usuários (email, ID, etc)

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

- **Backend necessário:** Limites no localStorage podem ser burlados (abrir DevTools)
- **Verificação no servidor:** Implementar na API da Groq também
- **Notificações:** Avisar usuário quando próximo do limite
- **Soft limit:** Aviso em 80%, bloqueio em 100%
- **Período de trial:** 30 dias gratuito com plano PRO?
- **Cancellation:** Permitir downgrade de plano

---

## 🎯 PRÓXIMOS PASSOS SUGERIDOS

1. Implementar autenticação básica (email/senha)
2. Armazenar user_id ao fazer login
3. Adicionar verificação de limites em `callGroqAPI()`
4. Criar widget na UI mostrando uso
5. Implementar upgrade modal
6. Integrar sistema de pagamento (Stripe, PagSeguro)

---

**Comentário final:** Esse sistema protege sua API e incentiva upgrade para plano pago. Pode gerar receita enquanto mantém serviço gratuito funcional!
