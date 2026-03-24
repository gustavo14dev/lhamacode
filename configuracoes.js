import {
    PROFILE_PERSONALITY_OPTIONS,
    PROFILE_RESPONSE_STYLE_OPTIONS,
    PROFILE_TOPIC_OPTIONS,
    ensureSupabaseClient,
    fetchUserProfile,
    isBirthDateBlocked,
    saveUserProfile
} from './user-profile.js';

const state = {
    favorite_topics: [],
    personality_traits: [],
    response_style: ''
};

const elements = {
    form: document.getElementById('profileEditForm'),
    alert: document.getElementById('profileSaveAlert'),
    emailInput: document.getElementById('userEmail'),
    fullNameInput: document.getElementById('settingsFullNameInput'),
    preferredNameInput: document.getElementById('settingsPreferredNameInput'),
    birthDateInput: document.getElementById('settingsBirthDateInput'),
    professionInput: document.getElementById('settingsProfessionInput'),
    interestsInput: document.getElementById('settingsInterestsInput'),
    personalInfoInput: document.getElementById('settingsPersonalInfoInput'),
    responseStyleNotesInput: document.getElementById('settingsResponseStyleNotesInput'),
    topicsChipGroup: document.getElementById('settingsTopicsChipGroup'),
    personalityChipGroup: document.getElementById('settingsPersonalityChipGroup'),
    responseStyleChipGroup: document.getElementById('settingsResponseStyleChipGroup')
};

let currentUser = null;

function setAlert(message = '', type = 'error') {
    if (!elements.alert) {
        return;
    }

    if (!message) {
        elements.alert.className = 'hidden rounded-xl border px-4 py-3 text-sm';
        elements.alert.textContent = '';
        return;
    }

    elements.alert.className = type === 'success'
        ? 'rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200'
        : 'rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200';
    elements.alert.textContent = message;
}

function renderChipGroup(container, options, selectedValues, onChange, { single = false } = {}) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = option;
        button.className = `rounded-full border px-3 py-2 text-sm font-semibold transition-all ${
            selectedValues.includes(option)
                ? 'border-blue-400/50 bg-blue-600/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-300/30 hover:bg-white/10'
        }`;
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

function refreshChipGroups() {
    renderChipGroup(elements.topicsChipGroup, PROFILE_TOPIC_OPTIONS, state.favorite_topics, (nextSelected) => {
        state.favorite_topics = nextSelected;
        refreshChipGroups();
    });

    renderChipGroup(elements.personalityChipGroup, PROFILE_PERSONALITY_OPTIONS, state.personality_traits, (nextSelected) => {
        state.personality_traits = nextSelected;
        refreshChipGroups();
    });

    renderChipGroup(elements.responseStyleChipGroup, PROFILE_RESPONSE_STYLE_OPTIONS, state.response_style ? [state.response_style] : [], (nextSelected) => {
        state.response_style = nextSelected[0] || '';
        refreshChipGroups();
    }, { single: true });
}

function fillForm(profile) {
    elements.fullNameInput.value = profile.full_name || '';
    elements.preferredNameInput.value = profile.preferred_name || '';
    elements.birthDateInput.value = profile.birth_date || '';
    elements.professionInput.value = profile.profession || '';
    elements.interestsInput.value = Array.isArray(profile.interests) ? profile.interests.join(', ') : '';
    elements.personalInfoInput.value = profile.personal_info || '';
    elements.responseStyleNotesInput.value = profile.response_style_notes || '';

    state.favorite_topics = Array.isArray(profile.favorite_topics) ? profile.favorite_topics : [];
    state.personality_traits = Array.isArray(profile.personality_traits) ? profile.personality_traits : [];
    state.response_style = profile.response_style || '';
    refreshChipGroups();
}

async function blockAccountForAge(payload) {
    try {
        await saveUserProfile(currentUser.id, {
            ...payload,
            onboarding_completed: false
        });
    } catch (error) {
        console.error('Erro ao salvar bloqueio por idade:', error);
    }

    try {
        await window.supabase?.auth?.signOut();
    } catch (error) {
        console.error('Erro ao encerrar sessão após bloqueio:', error);
    }

    localStorage.removeItem('userSession');
    setAlert('Esta conta foi bloqueada porque a data de nascimento informada é posterior a 2015. Você será redirecionado.', 'error');

    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1800);
}

async function handleSaveProfile(event) {
    event.preventDefault();
    setAlert('');

    const payload = {
        full_name: elements.fullNameInput.value.trim(),
        preferred_name: elements.preferredNameInput.value.trim(),
        birth_date: elements.birthDateInput.value,
        profession: elements.professionInput.value.trim(),
        interests: elements.interestsInput.value.trim(),
        personal_info: elements.personalInfoInput.value.trim(),
        favorite_topics: state.favorite_topics,
        personality_traits: state.personality_traits,
        response_style: state.response_style,
        response_style_notes: elements.responseStyleNotesInput.value.trim(),
        onboarding_completed: true
    };

    if (!payload.full_name || !payload.preferred_name || !payload.birth_date || !payload.response_style || payload.favorite_topics.length === 0) {
        setAlert('Preencha nome, como prefere ser chamado, data de nascimento, temas favoritos e estilo de resposta.');
        return;
    }

    if (isBirthDateBlocked(payload.birth_date)) {
        await blockAccountForAge(payload);
        return;
    }

    try {
        await saveUserProfile(currentUser.id, payload);
        setAlert('Perfil salvo com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        setAlert('Não foi possível salvar seu perfil. Verifique se o SQL da tabela user_profiles foi executado no Supabase.');
    }
}

async function init() {
    ensureSupabaseClient();

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session?.user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    if (elements.emailInput) {
        elements.emailInput.value = currentUser.email || '';
    }

    refreshChipGroups();

    try {
        const profile = await fetchUserProfile(currentUser.id);
        if (profile) {
            fillForm(profile);
        }
    } catch (error) {
        console.error('Erro ao carregar perfil em configurações:', error);
        setAlert('Não foi possível carregar seu perfil. Verifique se o SQL da tabela user_profiles foi executado no Supabase.');
    }

    elements.form?.addEventListener('submit', handleSaveProfile);
}

init();
