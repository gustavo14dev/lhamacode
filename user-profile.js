const SUPABASE_URL = 'https://vvckoxcmhcaibfgfyqor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7RlWwC4vkk1uIRGN4I5-uQ_2d4cCa5w';

const PROFILE_CACHE_KEY = 'drekee_user_profile_v1';
const BLOCKED_BIRTHDATE_CUTOFF = '2015-12-31';

export const PROFILE_TOPIC_OPTIONS = [
    'Tecnologia',
    'Programação',
    'Matemática',
    'Ciência',
    'Design',
    'Empreendedorismo',
    'Jogos',
    'Música',
    'Cinema',
    'História',
    'Esportes',
    'Idiomas'
];

export const PROFILE_PERSONALITY_OPTIONS = [
    'Curiosa',
    'Criativa',
    'Prática',
    'Analítica',
    'Comunicativa',
    'Calma',
    'Ambiciosa',
    'Detalhista'
];

export const PROFILE_RESPONSE_STYLE_OPTIONS = [
    'Formal',
    'Carinhosa',
    'Curta',
    'Explicativa',
    'Direta',
    'Didática'
];

export function ensureSupabaseClient() {
    if (window.supabase && typeof window.supabase.auth?.getUser === 'function') {
        return window.supabase;
    }

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.supabase;
    }

    return null;
}

export function getProfileCacheKey() {
    return PROFILE_CACHE_KEY;
}

export function getCachedUserProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Erro ao ler cache do perfil:', error);
        return null;
    }
}

export function cacheUserProfile(profile) {
    if (!profile || typeof profile !== 'object') {
        return;
    }

    try {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch (error) {
        console.error('Erro ao salvar cache do perfil:', error);
    }
}

export function clearCachedUserProfile() {
    localStorage.removeItem(PROFILE_CACHE_KEY);
}

function sanitizeText(value, maxLength = 400) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function normalizeStringArray(values) {
    const list = Array.isArray(values)
        ? values
        : String(values || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    const unique = [];
    for (const item of list) {
        const normalized = sanitizeText(item, 50);
        if (normalized && !unique.includes(normalized)) {
            unique.push(normalized);
        }
    }

    return unique.slice(0, 20);
}

export function isBirthDateBlocked(birthDate) {
    if (!birthDate) {
        return false;
    }

    return String(birthDate) > BLOCKED_BIRTHDATE_CUTOFF;
}

export function normalizeUserProfileInput(input = {}) {
    const birthDate = sanitizeText(input.birth_date, 10);
    const blockedByAge = isBirthDateBlocked(birthDate);

    return {
        full_name: sanitizeText(input.full_name, 120),
        preferred_name: sanitizeText(input.preferred_name, 80),
        birth_date: birthDate || null,
        profession: sanitizeText(input.profession, 120),
        personal_info: sanitizeText(input.personal_info, 600),
        favorite_topics: normalizeStringArray(input.favorite_topics),
        interests: normalizeStringArray(input.interests),
        personality_traits: normalizeStringArray(input.personality_traits),
        response_style: sanitizeText(input.response_style, 80),
        response_style_notes: sanitizeText(input.response_style_notes, 500),
        onboarding_completed: Boolean(input.onboarding_completed) && !blockedByAge,
        age_verified: Boolean(birthDate) && !blockedByAge,
        blocked_reason: blockedByAge ? 'underage' : null
    };
}

export function validateUserProfile(profile) {
    const errors = [];

    if (!profile.full_name) {
        errors.push('Informe o nome da pessoa.');
    }

    if (!profile.preferred_name) {
        errors.push('Informe como a IA deve chamar a pessoa.');
    }

    if (!profile.birth_date) {
        errors.push('Informe a data de nascimento.');
    }

    if (isBirthDateBlocked(profile.birth_date)) {
        errors.push('Pessoas nascidas depois de 2015 não podem usar a IA.');
    }

    if (!Array.isArray(profile.favorite_topics) || profile.favorite_topics.length === 0) {
        errors.push('Escolha pelo menos um tema favorito.');
    }

    if (!profile.response_style) {
        errors.push('Escolha como a IA deve responder.');
    }

    return errors;
}

export function isUserProfileComplete(profile) {
    if (!profile || typeof profile !== 'object') {
        return false;
    }

    if (profile.blocked_reason || profile.age_verified === false) {
        return false;
    }

    return Boolean(
        profile.onboarding_completed
        && profile.full_name
        && profile.preferred_name
        && profile.birth_date
        && Array.isArray(profile.favorite_topics)
        && profile.favorite_topics.length > 0
        && profile.response_style
    );
}

export async function fetchUserProfile(userId) {
    const supabase = ensureSupabaseClient();
    if (!supabase || !userId) {
        return null;
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (data) {
        cacheUserProfile(data);
    }

    return data;
}

export async function saveUserProfile(userId, input) {
    const supabase = ensureSupabaseClient();
    if (!supabase || !userId) {
        throw new Error('Supabase não disponível para salvar perfil.');
    }

    const normalized = normalizeUserProfileInput(input);
    const payload = {
        user_id: userId,
        ...normalized
    };

    const { data, error } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) {
        throw error;
    }

    cacheUserProfile(data);
    return data;
}

export function buildUserProfilePromptContext(profile = getCachedUserProfile()) {
    if (!profile || !isUserProfileComplete(profile)) {
        return '';
    }

    const details = [];

    if (profile.preferred_name) {
        details.push(`Chame o usuario de ${profile.preferred_name}.`);
    }

    if (profile.profession) {
        details.push(`Profissão ou ocupação: ${profile.profession}.`);
    }

    if (Array.isArray(profile.favorite_topics) && profile.favorite_topics.length > 0) {
        details.push(`Temas de maior interesse: ${profile.favorite_topics.join(', ')}.`);
    }

    if (Array.isArray(profile.interests) && profile.interests.length > 0) {
        details.push(`Interesses complementares: ${profile.interests.join(', ')}.`);
    }

    if (Array.isArray(profile.personality_traits) && profile.personality_traits.length > 0) {
        details.push(`Tracos pessoais informados: ${profile.personality_traits.join(', ')}.`);
    }

    if (profile.response_style) {
        details.push(`Estilo de resposta preferido: ${profile.response_style}.`);
    }

    if (profile.response_style_notes) {
        details.push(`Pedido adicional sobre como responder: ${profile.response_style_notes}.`);
    }

    if (profile.personal_info) {
        details.push(`Contexto pessoal relevante: ${profile.personal_info}.`);
    }

    if (details.length === 0) {
        return '';
    }

    return `\n\nContexto fixo do usuário:\n- Use estas preferências apenas quando agregarem valor.\n- Não mencione este contexto sem necessidade.\n- Respeite o estilo pedido, mas sem perder clareza, honestidade e utilidade.\n${details.map((item) => `- ${item}`).join('\n')}`;
}
