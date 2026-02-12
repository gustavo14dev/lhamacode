# 🐛 COMO TESTAR O MODO DEPURAÇÃO

## Como Funciona Agora (CORRETO!)

### 1️⃣ **Ativar o Modo**
- Clique no botão "Modo Depuração" (com ícone de bug)
- O botão vai mudar de cor → **laranja** (bg-orange-50)
- Vai aparecer um **X** do lado para cancelar
- Não precisa digitar nada, não precisa ter erro - é só ativar!

### 2️⃣ **Enviar Erro para Análise**
Agora pode enviar qualquer coisa:
- Coloque o erro/exceção no campo de texto
- Clique em Enviar
- Ou aperte Enter
- **Automaticamente** vai abrir o Modo Depuração com suas 5 hipóteses

### 3️⃣ **Desativar o Modo**
- Clique no **X** que apareceu no botão
- Ou clique de novo no botão
- Volta ao estado normal (cinza)

---

## O QUE ENVIAR PARA TESTAR

### ✅ Erros de JavaScript
```
TypeError: window._debugSystem is not a constructor
    at UI.activateDebugMode (main.js:677:35)
```

### ✅ Erros de Python
```
Traceback (most recent call last):
  File "app.py", line 15, in <module>
    result = data['key']
KeyError: 'key'
```

### ✅ Erros Genéricos (Qualquer linguagem)
```
Error: Cannot find module './missing-file.js'
```

```
Segmentation fault (core dumped)
```

```
ImportError: No module named 'requests'
```

### ✅ Até coisas que PARECEM erros
```
undefined is not a function
```

```
Cannot read property 'x' of null
```

```
SyntaxError near 'else'
```

---

## O QUE ESPERAR

Quando você envia um erro:

1. **Modal abre** com "Carregando hipóteses..."
2. **5 Hipóteses aparecem** como cards:
   - Cada uma tem:
     - ✅ Título da causa provável
     - Probabilidade (ex: 85%)
     - Explicação do problema
     - Código da solução
     - Botão "Testar" (teste a solução)

3. **Clique em "Testar"** na hipótese que faz sentido:
   - Mostra se a solução funcionaria
   - Confiança de 0-100%
   - Comparação antes/depois

---

## CHECKLIST DE TESTES

- [ ] **Botão muda de cor** quando clico (laranja)
- [ ] **X aparece** no botão ativo
- [ ] **Clico no X** e volta ao normal
- [ ] **Posso enviar erro** sem ter escrito antes
- [ ] **Modal abre** com as 5 hipóteses
- [ ] **Cada hipótese mostra** título + % + explicação + código
- [ ] **Botão "Testar"** funciona em pelo menos uma hipótese
- [ ] **Resultado** mostra confiança corretamente
- [ ] **Fechar modal** funciona
- [ ] **Design** é idêntico ao resto da IA (sem quebrar nada)

---

## EXEMPLOS PRONTOS P COPIAR E TESTAR

### Teste 1: Erro simples de undefined
```
TypeError: Cannot read property 'addEventListener' of null
    at Module.<anonymous> (main.js:142:16)
```

### Teste 2: Erro de import
```
Error: Cannot find module './debug-system'
    at Function.Module._load (internal/modules/cjs_loader.js:314:19)
```

### Teste 3: Erro de syntax
```
SyntaxError: Unexpected token } in JSON at position 45
    at JSON.parse (<anonymous>)
```

### Teste 4: Erro de conexão
```
TypeError: Failed to fetch
    at async callGroqAPI (agent.js:120:15)
```

### Teste 5: Erro bem genérico
```
TypeError: this.debugModeActive is not a boolean
```

---

## Se Algo Quebrar

**Não deve quebrar nada** porque é modular.

Mas se quebrar:
1. Abre DevTools (F12)
2. Vai em Console
3. Me mostra o erro exato
4. Tira screenshot

---

## O QUE EU ESPERO QUE VC FAÇA

1. Ativa o modo
2. Envia 3-5 erros diferentes
3. Clica em "Testar" em 1-2 hipóteses
4. Me fala:
   - ✅ O que funcionou bem
   - ❌ O que quebrou
   - 💭 Alguma sugestão/mudança
   - 🎨 Design tá bom?

**Pode ser brutalmente honesto.**

Abraços! 🚀
