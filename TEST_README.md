# Guia de Testes e Qualidade de Código - Lhama Code

## 📦 Setup Inicial

Instale as dependências de desenvolvimento:

```bash
npm install
```

Isso instalará: **ESLint**, **Prettier**, **Jest** e **jsdom**.

---

## 🧪 Executar Testes

### Rodar todos os testes uma vez:
```bash
npm test
```

**Saída esperada:**
```
PASS  __tests__/ui.test.js
  UI - scrollToBottom
    ✓ deve existir função scrollToBottom
    ✓ scrollTop deve ser atribuído
    ✓ deve suportar scrollTo com behavior smooth
  Renderização de Mensagens
    ✓ deve criar elemento de mensagem
    ✓ deve escapar HTML para evitar XSS
  localStorage - Segurança
    ✓ loadChats deve retornar array vazio
    ✓ deve lidar com JSON corrompido

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

### Modo "watch" (testes em tempo real):
```bash
npm run test:watch
```
Os testes rodão novamente toda vez que você salva um arquivo.

---

## 🔍 Verificação de Qualidade

### Verificar código com ESLint:
```bash
npm run lint
```

**Identifica:**
- Variáveis não utilizadas
- Falta de ponto-e-vírgula
- Uso de `var` (deve ser `let`/`const`)
- Espaçamento incorreto

**Exemplo de saída:**
```
code/main.js
  42:5  error  'unusedVar' is assigned but never used  no-unused-vars
  145:3  error  Missing semicolon                       semi
```

### Corrigir automaticamente:
```bash
npm run lint:fix
```
Isso corrige automaticamente:
- Falta de ponto-e-vírgula
- Espaços incorretos
- Preferir `const` sobre `let` quando possível

---

## 💄 Formatação de Código

### Verificar formatação:
```bash
npm run format
```

Formata automaticamente o código com regras de estilo:
- Aspas simples (`'` em vez de `"`)
- Indentação de 4 espaços
- Linha máxima de 100 caracteres
- Sem trailing comma

---

## 📋 Workflow Recomendado

### Antes de fazer commit:

1. **Execute os testes:**
   ```bash
   npm test
   ```
   Todos devem passar ✅

2. **Verifique a qualidade:**
   ```bash
   npm run lint
   ```
   Deve estar 100% limpo

3. **Formate o código:**
   ```bash
   npm run format
   ```

4. **Faça o commit com confiança!** 🚀

### Exemplo de sessão completa:
```bash
# Fazer alterações em main.js...

npm test                 # Verifica se não quebrou
npm run lint            # Procura problemas
npm run lint:fix        # Corrige automaticamente
npm run format          # Formata estilo

# Commit está pronto!
```

---

## 🎯 O que está sendo testado?

- ✅ **Scroll automático** - Função `scrollToBottom()` funciona corretamente
- ✅ **Renderização** - Mensagens são adicionadas ao DOM sem erros
- ✅ **XSS Prevention** - HTML é escapado corretamente
- ✅ **localStorage** - Dados corrompidos são tratados com segurança
- ✅ **Debug Flag** - Logs conditnais funcionam

---

## 🔧 Configurações

### ESLint (`.eslintrc.json`)
- Estende: `eslint:recommended`
- Ambiente: Browser + ES2021
- Principais regras:
  - Sem variáveis não usadas
  - Ponto-e-vírgula obrigatório
  - Aspas simples
  - Indentação: 4 espaços
  - `const` preferido sobre `let`

### Prettier (`.prettierrc.json`)
- Aspas simples
- Indentação: 4 espaços
- Linha máxima: 100 caracteres
- Sem trailing comma

### Jest (`jest.config.js`)
- Ambiente: jsdom (simula browser)
- Testes em: `__tests__/**/*.test.js`
- Setup file: `jest.setup.js` (mocks do DOM)

---

## 🐛 Troubleshooting

### "Module not found: eslint"
```bash
npm install
```

### "Jest: No tests found"
Certifique-se que os testes estão em `__tests__/` com sufixo `.test.js`

### "localStorage is not defined"
Jest já fornece mock de localStorage no `jest.setup.js`

---

## 📊 Resumo de Comandos

| Comando | O quê faz |
|---------|-----------|
| `npm install` | Instala todas as dependências |
| `npm test` | Roda todos os testes 1 vez |
| `npm run test:watch` | Roda testes em watch mode |
| `npm run lint` | Verifica qualidade de código |
| `npm run lint:fix` | Corrige problemas automaticamente |
| `npm run format` | Formata código com Prettier |

---

## ✨ Dicas

- **Rodar 1 arquivo de testes:** `npm test -- scroll.test.js`
- **Rodar 1 test suite:** `npm test -- --testNamePattern="scrollToBottom"`
- **Verbose output:** `npm test -- --verbose`
- **Coverage report:** `npm test -- --coverage`

---

**Próximos passos:**
1. Adicionar mais testes para funções críticas
2. Integrar com CI/CD (GitHub Actions, etc.)
3. Aumentar cobertura de testes para 80%+

