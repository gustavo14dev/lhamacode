// Configuração do Supabase
const SUPABASE_URL = 'https://vvckoxcmhcaibfgfyqor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7RlWwC4vkk1uIRGN4I5-uQ_2d4cCa5w';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos DOM
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const googleLogin = document.getElementById('googleLogin');
const guestBtn = document.getElementById('guestBtn');
const showSignup = document.getElementById('showSignup');
const togglePassword = document.getElementById('togglePassword');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

// Estado
let isLoginMode = true;

// Funções auxiliares
function showLoading(show = true) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function showToast(message, type = 'info') {
    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };
    
    const colors = {
        success: 'text-green-500',
        error: 'text-red-500',
        info: 'text-blue-500',
        warning: 'text-yellow-500'
    };
    
    toastIcon.textContent = icons[type];
    toastIcon.className = `material-icons-outlined text-lg ${colors[type]}`;
    toastMessage.textContent = message;
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const icon = togglePassword.querySelector('span');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        passwordInput.type = 'password';
        icon.textContent = 'visibility';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

// Event Listeners
togglePassword?.addEventListener('click', togglePasswordVisibility);

// Login com Email/Senha
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    // Validação
    if (!validateEmail(email)) {
        showToast('Email inválido', 'error');
        return;
    }
    
    if (!validatePassword(password)) {
        showToast('A senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        if (isLoginMode) {
            // Login
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            showToast('Login realizado com sucesso!', 'success');
            
            // Salvar preferência de lembrar
            if (remember) {
                localStorage.setItem('rememberUser', email);
            } else {
                localStorage.removeItem('rememberUser');
            }
            
            // Redirecionar para o app
            setTimeout(() => {
                window.location.href = 'code.html';
            }, 1000);
            
        } else {
            // Cadastro
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin + '/code.html'
                }
            });
            
            if (error) throw error;
            
            showToast('Cadastro realizado! Verifique seu email para confirmar.', 'success');
            
            // Limpar formulário
            loginForm.reset();
            
            // Voltar para modo login
            setTimeout(() => {
                toggleMode(true);
            }, 2000);
        }
        
    } catch (error) {
        console.error('Erro na autenticação:', error);
        
        let errorMessage = 'Ocorreu um erro. Tente novamente.';
        
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'Email ou senha incorretos.';
        } else if (error.message.includes('User already registered')) {
            errorMessage = 'Este email já está cadastrado.';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Por favor, confirme seu email antes de fazer login.';
        }
        
        showToast(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
});

// Login com Google
googleLogin?.addEventListener('click', async () => {
    showLoading(true);
    
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/code.html'
            }
        });
        
        if (error) throw error;
        
        // O redirecionamento será feito automaticamente pelo Supabase
        
    } catch (error) {
        console.error('Erro no login com Google:', error);
        showToast('Erro ao fazer login com Google', 'error');
        showLoading(false);
    }
});

// Continuar como Visitante
guestBtn?.addEventListener('click', () => {
    // Marcar como visitante no localStorage
    localStorage.setItem('isGuest', 'true');
    localStorage.removeItem('userSession');
    
    showToast('Continuando como visitante...', 'info');
    
    setTimeout(() => {
        window.location.href = 'code.html';
    }, 500);
});

// Alternar entre Login/Cadastro
showSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode(false);
});

function toggleMode(loginMode) {
    isLoginMode = loginMode;
    
    const title = document.querySelector('h1');
    const subtitle = document.querySelector('p.text-sm');
    const submitBtn = document.getElementById('loginBtn');
    const toggleLink = document.getElementById('showSignup');
    const forgotPassword = document.querySelector('a[href="#"]');
    
    if (loginMode) {
        title.textContent = 'Bem-vindo de volta!';
        subtitle.textContent = 'Faça login para continuar';
        submitBtn.innerHTML = '<span class="material-icons-outlined text-sm">login</span> Entrar';
        toggleLink.textContent = 'Cadastre-se';
        forgotPassword.style.display = 'block';
        loginForm.querySelector('button[type="submit"]').textContent = 'Entrar';
    } else {
        title.textContent = 'Criar sua conta';
        subtitle.textContent = 'Cadastre-se para salvar suas conversas';
        submitBtn.innerHTML = '<span class="material-icons-outlined text-sm">person_add</span> Cadastrar';
        toggleLink.textContent = 'Já tem uma conta? Entre';
        forgotPassword.style.display = 'none';
        loginForm.querySelector('button[type="submit"]').textContent = 'Cadastrar';
    }
}

// Verificar sessão atual ao carregar
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar se já está logado
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Já está logado, redirecionar
        window.location.href = 'code.html';
        return;
    }
    
    // Carregar email lembrado
    const rememberedEmail = localStorage.getItem('rememberUser');
    if (rememberedEmail) {
        document.getElementById('email').value = rememberedEmail;
        document.getElementById('remember').checked = true;
    }
    
    // Verificar se é visitante
    if (localStorage.getItem('isGuest') === 'true') {
        // Se era visitante, limpar e mostrar login
        localStorage.removeItem('isGuest');
    }
});

// Esqueceu a senha (placeholder)
document.querySelector('a[href="#"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Funcionalidade de recuperação de senha em breve!', 'info');
});

// Detectar modo escuro
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
});
