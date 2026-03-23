import {
    PROFILE_PERSONALITY_OPTIONS,
    PROFILE_RESPONSE_STYLE_OPTIONS,
    PROFILE_TOPIC_OPTIONS,
    ensureSupabaseClient,
    fetchUserProfile,
    isBirthDateBlocked,
    isUserProfileComplete,
    saveUserProfile
} from './user-profile.js';

const stepMeta = [
    {
        title: 'Quem e voce?',
        subtitle: 'Comece com seus dados essenciais para liberar a conta.'
    },
    {
        title: 'Seus gostos e interesses',
        subtitle: 'Escolha alguns temas para a IA entender melhor onde voce gosta de aprofundar.'
    },
    {
        title: 'Seu contexto',
        subtitle: 'Agora me conte um pouco mais sobre sua rotina, interesses e personalidade.'
    },
    {
        title: 'Como quer ser atendido',
        subtitle: 'Defina o estilo de resposta e revise antes de entrar no chat.'
    }
];

const state = {
    full_name: '',
    preferred_name: '',
    birth_date: '',
    favorite_topics: [],
    interests: '',
    profession: '',
    personality_traits: [],
    personal_info: '',
    response_style: '',
    response_style_notes: ''
};

let currentStep = 0;
let currentUser = null;

const elements = {
    form: document.getElementById('onboardingForm'),
    fullNameInput: document.getElementById('fullNameInput'),
    preferredNameInput: document.getElementById('preferredNameInput'),
    birthDateInput: document.getElementById('birthDateInput'),
    interestsInput: document.getElementById('interestsInput'),
    professionInput: document.getElementById('professionInput'),
    personalInfoInput: document.getElementById('personalInfoInput'),
    responseStyleNotesInput: document.getElementById('responseStyleNotesInput'),
    topicsChipGroup: document.getElementById('topicsChipGroup'),
    personalityChipGroup: document.getElementById('personalityChipGroup'),
    responseStyleChipGroup: document.getElementById('responseStyleChipGroup'),
    stepTitle: document.getElementById('stepTitle'),
    stepSubtitle: document.getElementById('stepSubtitle'),
    backStepBtn: document.getElementById('backStepBtn'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    finishOnboardingBtn: document.getElementById('finishOnboardingBtn'),
    signOutBtn: document.getElementById('signOutBtn'),
    ageGateHint: document.getElementById('ageGateHint'),
    onboardingAlert: document.getElementById('onboardingAlert'),
    reviewPanel: document.getElementById('reviewPanel'),
    userEmailBadge: document.getElementById('userEmailBadge'),
    stepDots: Array.from(document.querySelectorAll('[data-step-dot]')),
    stepPanels: Array.from(document.querySelectorAll('[data-step]'))
};

function setAlert(message = '', type = 'error') {
    if (!elements.onboardingAlert) {
        return;
    }

    if (!message) {
        elements.onboardingAlert.classList.add('hidden');
        elements.onboardingAlert.textContent = '';
        return;
    }

    elements.onboardingAlert.classList.remove('hidden');
    elements.onboardingAlert.textContent = message;
    elements.onboardingAlert.className = type === 'success'
        ? 'mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-200'
        : 'mb-5 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200';
}

function renderChipGroup(container, options, selectedValues, { single = false, onChange } = {}) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `chip-option rounded-full px-4 py-2 text-sm font-semibold ${selectedValues.includes(option) ? 'active' : ''}`;
        button.textContent = option;
        button.addEventListener('click', () => {
            let nextSelected = [...selectedValues];

            if (single) {
                nextSelected = [option];
            } else if (nextSelected.includes(option)) {
                nextSelected = nextSelected.filter((item) => item !== option);
            } else {
                nextSelected.push(option);
            }

            onChange(nextSelected);
        });

        container.appendChild(button);
    });
}

function syncInputsFromState() {
    elements.fullNameInput.value = state.full_name;
    elements.preferredNameInput.value = state.preferred_name;
    elements.birthDateInput.value = state.birth_date;
    elements.interestsInput.value = state.interests;
    elements.professionInput.value = state.profession;
    elements.personalInfoInput.value = state.personal_info;
    elements.responseStyleNotesInput.value = state.response_style_notes;
}

function renderStep() {
    const meta = stepMeta[currentStep];
    elements.stepTitle.textContent = meta.title;
    elements.stepSubtitle.textContent = meta.subtitle;

    elements.stepPanels.forEach((panel, index) => {
        panel.classList.toggle('hidden', index !== currentStep);
    });

    elements.stepDots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentStep);
    });

    elements.backStepBtn.classList.toggle('invisible', currentStep === 0);
    elements.nextStepBtn.classList.toggle('hidden', currentStep === stepMeta.length - 1);
    elements.finishOnboardingBtn.classList.toggle('hidden', currentStep !== stepMeta.length - 1);

    renderReview();
}

function renderReview() {
    if (!elements.reviewPanel) {
        return;
    }

    const rows = [
        ['Nome', state.full_name || 'Nao informado'],
        ['Como chamar', state.preferred_name || 'Nao informado'],
        ['Nascimento', state.birth_date || 'Nao informado'],
        ['Temas favoritos', state.favorite_topics.length ? state.favorite_topics.join(', ') : 'Nenhum tema selecionado'],
        ['Interesses', state.interests || 'Nao informado'],
        ['Profissao', state.profession || 'Nao informada'],
        ['Personalidade', state.personality_traits.length ? state.personality_traits.join(', ') : 'Nao informada'],
        ['Estilo de resposta', state.response_style || 'Nao informado'],
        ['Detalhes extras', state.response_style_notes || 'Nenhum detalhe extra']
    ];

    elements.reviewPanel.innerHTML = rows.map(([label, value]) => `
        <div class="flex flex-col gap-1 rounded-2xl border border-slate-800/70 bg-slate-950/30 px-4 py-3">
            <span class="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">${label}</span>
            <span class="text-sm text-slate-200">${value}</span>
        </div>
    `).join('');
}

function syncStateFromInputs() {
    state.full_name = elements.fullNameInput.value.trim();
    state.preferred_name = elements.preferredNameInput.value.trim();
    state.birth_date = elements.birthDateInput.value;
    state.interests = elements.interestsInput.value.trim();
    state.profession = elements.professionInput.value.trim();
    state.personal_info = elements.personalInfoInput.value.trim();
    state.response_style_notes = elements.responseStyleNotesInput.value.trim();
}

function showAgeWarning() {
    if (!state.birth_date || !isBirthDateBlocked(state.birth_date)) {
        elements.ageGateHint.classList.add('hidden');
        elements.ageGateHint.textContent = '';
        return false;
    }

    elements.ageGateHint.classList.remove('hidden');
    elements.ageGateHint.textContent = 'Quem nasceu depois de 2015 nao pode usar a IA. Se voce continuar, a conta sera bloqueada.';
    return true;
}

function validateCurrentStep() {
    syncStateFromInputs();
    setAlert('');

    if (currentStep === 0) {
        if (!state.full_name) {
            setAlert('Informe o nome da pessoa.');
            return false;
        }

        if (!state.preferred_name) {
            setAlert('Informe como a IA deve chamar voce.');
            return false;
        }

        if (!state.birth_date) {
            setAlert('Informe sua data de nascimento.');
            return false;
        }

        if (showAgeWarning()) {
            return 'blocked';
        }
    }

    if (currentStep === 1 && state.favorite_topics.length === 0) {
        setAlert('Escolha pelo menos um tema que voce gosta.');
        return false;
    }

    if (currentStep === 3 && !state.response_style) {
        setAlert('Escolha como a IA deve responder.');
        return false;
    }

    return true;
}

async function blockUnderageAccount() {
    try {
        if (currentUser?.id) {
            await saveUserProfile(currentUser.id, {
                ...state,
                onboarding_completed: false
            });
        }
    } catch (error) {
        console.error('Erro ao salvar bloqueio de idade:', error);
    }

    try {
        await window.supabase?.auth?.signOut();
    } catch (error) {
        console.error('Erro ao encerrar sessao apos bloqueio:', error);
    }

    setAlert('Esta conta foi bloqueada porque a data de nascimento informada e posterior a 2015. Voce sera redirecionado.', 'error');
    localStorage.removeItem('userSession');

    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1800);
}

async function saveOnboarding() {
    syncStateFromInputs();
    setAlert('');

    if (isBirthDateBlocked(state.birth_date)) {
        await blockUnderageAccount();
        return;
    }

    try {
        const savedProfile = await saveUserProfile(currentUser.id, {
            ...state,
            onboarding_completed: true
        });

        if (!isUserProfileComplete(savedProfile)) {
            setAlert('Ainda faltam dados obrigatorios para liberar a conta.');
            return;
        }

        setAlert('Perfil salvo. Redirecionando para o chat...', 'success');
        setTimeout(() => {
            window.location.href = 'code.html';
        }, 900);
    } catch (error) {
        console.error('Erro ao salvar onboarding:', error);
        setAlert('Nao foi possivel salvar seu perfil agora. Verifique se o SQL da tabela user_profiles foi executado no Supabase.');
    }
}

async function loadExistingProfile() {
    const profile = await fetchUserProfile(currentUser.id);

    if (!profile) {
        return;
    }

    Object.assign(state, {
        full_name: profile.full_name || '',
        preferred_name: profile.preferred_name || '',
        birth_date: profile.birth_date || '',
        favorite_topics: Array.isArray(profile.favorite_topics) ? profile.favorite_topics : [],
        interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : '',
        profession: profile.profession || '',
        personality_traits: Array.isArray(profile.personality_traits) ? profile.personality_traits : [],
        personal_info: profile.personal_info || '',
        response_style: profile.response_style || '',
        response_style_notes: profile.response_style_notes || ''
    });

    syncInputsFromState();
    refreshChipGroups();
    renderReview();

    if (profile.blocked_reason === 'underage' || profile.age_verified === false) {
        await blockUnderageAccount();
        return;
    }

    if (isUserProfileComplete(profile)) {
        window.location.href = 'code.html';
    }
}

function bindInputState() {
    [
        elements.fullNameInput,
        elements.preferredNameInput,
        elements.birthDateInput,
        elements.interestsInput,
        elements.professionInput,
        elements.personalInfoInput,
        elements.responseStyleNotesInput
    ].forEach((input) => {
        input?.addEventListener('input', () => {
            syncStateFromInputs();
            showAgeWarning();
            renderReview();
        });
    });
}

function bindActions() {
    elements.backStepBtn.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep -= 1;
            renderStep();
        }
    });

    elements.nextStepBtn.addEventListener('click', async () => {
        const validation = validateCurrentStep();

        if (validation === 'blocked') {
            await blockUnderageAccount();
            return;
        }

        if (!validation) {
            return;
        }

        if (currentStep < stepMeta.length - 1) {
            currentStep += 1;
            renderStep();
        }
    });

    elements.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const validation = validateCurrentStep();

        if (validation === 'blocked') {
            await blockUnderageAccount();
            return;
        }

        if (!validation) {
            return;
        }

        await saveOnboarding();
    });

    elements.signOutBtn.addEventListener('click', async () => {
        try {
            await window.supabase?.auth?.signOut();
        } catch (error) {
            console.error('Erro ao sair do onboarding:', error);
        }

        localStorage.removeItem('userSession');
        window.location.href = 'login.html';
    });
}

function refreshChipGroups() {
    renderChipGroup(elements.topicsChipGroup, PROFILE_TOPIC_OPTIONS, state.favorite_topics, {
        onChange(nextSelected) {
            state.favorite_topics = nextSelected;
            refreshChipGroups();
            renderReview();
        }
    });

    renderChipGroup(elements.personalityChipGroup, PROFILE_PERSONALITY_OPTIONS, state.personality_traits, {
        onChange(nextSelected) {
            state.personality_traits = nextSelected;
            refreshChipGroups();
            renderReview();
        }
    });

    renderChipGroup(elements.responseStyleChipGroup, PROFILE_RESPONSE_STYLE_OPTIONS, state.response_style ? [state.response_style] : [], {
        single: true,
        onChange(nextSelected) {
            state.response_style = nextSelected[0] || '';
            refreshChipGroups();
            renderReview();
        }
    });
}

async function init() {
    ensureSupabaseClient();

    if (!window.supabase?.auth) {
        window.location.href = 'login.html';
        return;
    }

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session?.user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    elements.userEmailBadge.textContent = currentUser.email || 'Conta sem email';
    refreshChipGroups();

    bindInputState();
    bindActions();
    syncInputsFromState();
    renderStep();

    try {
        await loadExistingProfile();
    } catch (error) {
        console.error('Erro ao carregar perfil do onboarding:', error);
        setAlert('Nao foi possivel carregar seu perfil agora. Verifique se o SQL da tabela user_profiles foi executado no Supabase.');
    }
}

init();
