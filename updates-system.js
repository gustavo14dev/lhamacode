const SUPABASE_URL = 'https://vvckoxcmhcaibfgfyqor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7RlWwC4vkk1uIRGN4I5-uQ_2d4cCa5w';

const GUEST_KEY = 'drekee_updates_guest_id';
const SEEN_PREFIX = 'drekee_updates_seen::';
const STARTUP_PREFIX = 'drekee_updates_startup_seen::';

function ensureSupabaseClient() {
    if (window.supabase?.from) {
        return window.supabase;
    }

    if (window.supabase?.createClient) {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.supabase;
    }

    return null;
}

function getGuestAudienceId() {
    let guestId = localStorage.getItem(GUEST_KEY);
    if (!guestId) {
        guestId = `guest-${crypto.randomUUID()}`;
        localStorage.setItem(GUEST_KEY, guestId);
    }
    return guestId;
}

async function getAudienceId() {
    const supabase = ensureSupabaseClient();
    if (!supabase?.auth) {
        return getGuestAudienceId();
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
            return `user:${user.id}`;
        }
    } catch {
        // Fall back to a persistent guest id.
    }

    return getGuestAudienceId();
}

function readIdSet(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
        return new Set();
    }
}

function writeIdSet(storageKey, values) {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(values)));
}

async function getSeenStorageKey() {
    const audienceId = await getAudienceId();
    return `${SEEN_PREFIX}${audienceId}`;
}

async function getStartupStorageKey() {
    const audienceId = await getAudienceId();
    return `${STARTUP_PREFIX}${audienceId}`;
}

export async function fetchPublishedUpdates(limit = 50) {
    const supabase = ensureSupabaseClient();
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('site_updates')
        .select('id, title, body, image_data_url, show_on_startup, is_published, created_at, updated_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data : [];
}

export async function markUpdatesSeen(updateIds = []) {
    if (!updateIds.length) {
        return;
    }

    const storageKey = await getSeenStorageKey();
    const seen = readIdSet(storageKey);
    updateIds.forEach((id) => seen.add(String(id)));
    writeIdSet(storageKey, seen);
}

export async function countUnreadUpdates() {
    const updates = await fetchPublishedUpdates();
    const storageKey = await getSeenStorageKey();
    const seen = readIdSet(storageKey);
    return updates.filter((update) => !seen.has(String(update.id))).length;
}

export async function fetchLatestStartupUpdate() {
    const supabase = ensureSupabaseClient();
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('site_updates')
        .select('id, title, body, image_data_url, show_on_startup, created_at')
        .eq('is_published', true)
        .eq('show_on_startup', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    const storageKey = await getStartupStorageKey();
    const startupSeen = readIdSet(storageKey);
    return startupSeen.has(String(data.id)) ? null : data;
}

export async function markStartupUpdateSeen(updateId) {
    if (!updateId) {
        return;
    }

    const startupKey = await getStartupStorageKey();
    const startupSeen = readIdSet(startupKey);
    startupSeen.add(String(updateId));
    writeIdSet(startupKey, startupSeen);
    await markUpdatesSeen([updateId]);
}

export async function getCurrentAuthenticatedUser() {
    const supabase = ensureSupabaseClient();
    if (!supabase?.auth) {
        return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        throw error;
    }

    return user || null;
}

export async function canCurrentUserPostUpdates() {
    const supabase = ensureSupabaseClient();
    const user = await getCurrentAuthenticatedUser();
    if (!supabase || !user?.id) {
        return false;
    }

    const { data, error } = await supabase
        .from('app_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return Boolean(data?.user_id);
}

export async function createSiteUpdate({ title = '', body = '', imageDataUrl = '', showOnStartup = false }) {
    const supabase = ensureSupabaseClient();
    const user = await getCurrentAuthenticatedUser();

    if (!supabase || !user?.id) {
        throw new Error('É necessário estar logado para postar atualizações.');
    }

    const canPost = await canCurrentUserPostUpdates();
    if (!canPost) {
        throw new Error('Sua conta não tem permissão para postar atualizações.');
    }

    const cleanTitle = String(title || '').trim();
    const cleanBody = String(body || '').trim();
    const cleanImage = String(imageDataUrl || '').trim();

    if (!cleanTitle && !cleanBody && !cleanImage) {
        throw new Error('Preencha pelo menos um título, um texto ou uma imagem.');
    }

    if (showOnStartup) {
        await supabase
            .from('site_updates')
            .update({ show_on_startup: false })
            .eq('show_on_startup', true);
    }

    const payload = {
        title: cleanTitle || null,
        body: cleanBody || null,
        image_data_url: cleanImage || null,
        show_on_startup: Boolean(showOnStartup),
        is_published: true,
        author_id: user.id
    };

    const { data, error } = await supabase
        .from('site_updates')
        .insert(payload)
        .select('id, title, body, image_data_url, show_on_startup, created_at')
        .single();

    if (error) {
        throw error;
    }

    return data;
}

export async function compressImageToDataUrl(file, maxWidth = 1280, quality = 0.86) {
    if (!(file instanceof File)) {
        return '';
    }

    const dataUrl = await fileToDataUrl(file);
    const image = await loadImage(dataUrl);

    const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);

    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return canvas.toDataURL(outputType, outputType === 'image/png' ? undefined : quality);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem.'));
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Falha ao processar a imagem.'));
        image.src = dataUrl;
    });
}

export function formatUpdateDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}
