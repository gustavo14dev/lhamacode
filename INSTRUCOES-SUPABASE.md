# 🚀 Instruções Rápidas - Supabase Integration

## ⚡ Setup Imediato (5 minutos)

### 1️⃣ Configurar Banco Supabase
1. Abra seu projeto Supabase: https://vvckoxcmhcaibfgfyqor.supabase.co
2. Vá para **SQL Editor**
3. Cole todo o conteúdo do arquivo `supabase-setup.sql`
4. Clique em **Run** ✅

### 2️⃣ Configurar CORS
1. Vá para **Settings > API**
2. Em **Additional Origins**, adicione: `http://localhost:8000`
3. Clique em **Save** ✅

### 3️⃣ Testar Localmente
1. Inicie o servidor na porta 8000:
   ```bash
   # VS Code: Right click > Open with Live Server
   # Ou: python -m http.server 8000
   ```

2. Acesse:
   - **Login:** `http://localhost:8000/login.html`
   - **App:** `http://localhost:8000/code.html`

### 4️⃣ Fluxo de Teste
1. **Teste Login:**
   - Acesse `login.html`
   - Use Google ou email/senha
   - Deve redirecionar para `code.html`

2. **Teste Chat:**
   - Envie uma mensagem
   - Deve aparecer no histórico
   - Recarregue a página (persiste)

3. **Teste Logout:**
   - Clique no avatar > logout
   - Deve voltar para modo visitante

## 🎯 O que foi implementado:

### ✅ Login/Cadastro
- Página `login.html` com design moderno
- Login com Google OAuth
- Login com email/senha
- "Continuar como Visitante"

### ✅ Sistema de Chat
- Histórico salvo por usuário
- Sincronização automática
- Cross-device sync
- Backup local

### ✅ UI/UX
- Header com info do usuário
- Botão de login/logout
- Modo visitante funcional
- Transições suaves

## 🔧 Arquivos Criados:
- `login.html` - Página de autenticação
- `auth.js` - Lógica de login
- `supabase-setup.sql` - Script do banco
- `README-SUPABASE.md` - Documentação completa

## 🚨 Próximos Passos:

1. **Execute o SQL** no Supabase (passo 1)
2. **Configure CORS** (passo 2)
3. **Teste localmente** (passo 3)
4. **Deploy** quando pronto

---

**Está tudo pronto! 🎉**
