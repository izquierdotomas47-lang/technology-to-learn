"use strict";

/**
 * TECHNOLOGY TO LEARN - TTL Ultimate
 * Refactored and Structured JavaScript File
 * Ready for local execution without CORS issues
 */

// ==========================================
// 1. UTILS & HELPERS
// ==========================================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const randomItem = a => a[Math.floor(Math.random() * a.length)];
const randomNumber = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const shuffle = items => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const other = randomNumber(0, index);
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
};
const appAssetRoot = document.querySelector('meta[name="ttl-assets-root"]')?.content || 'assets';
const appAsset = path => `${appAssetRoot}/${path}`;

const escapeHTML = v => {
    return String(v).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

// Clone compatible with older browsers (no structuredClone)
const deepClone = obj => {
    try { return structuredClone(obj); }
    catch { return JSON.parse(JSON.stringify(obj)); }
};

// Unique id: crypto.randomUUID requires a secure context, so we add a fallback
const uid = () => {
    const c = (typeof window !== 'undefined' && window.crypto) ? window.crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// Dates (YYYY-MM-DD) used by the daily streak and the daily goal
const todayISO = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Safe numeric coercion (protects against corrupted or old stored data)
const toNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toast = text => {
    const toastEl = $('#toast');
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2300);
};

const motionReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let revealObserver = null;

function setupRevealAnimations() {
    if (motionReduced() || !('IntersectionObserver' in window)) return;
    revealObserver?.disconnect();
    revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px' });

    $$('.screen.active .panel, .screen.active .operation, .screen.active .premium-banner, .screen.active .stat')
        .filter(element => !element.closest('#auth'))
        .forEach((element, index) => {
            element.classList.remove('is-visible');
            element.classList.add('ttl-reveal');
            const isHome = element.closest('#home');
            const delay = isHome ? index * 130 : Math.min(index, 5) * 45;
            element.style.transitionDelay = `${delay}ms`;
            revealObserver.observe(element);
        });
}

const navigate = id => {
    // Stop timers/voices that belong to the screen we are leaving
    if (id !== 'quiz' && timerId) { clearInterval(timerId); timerId = null; }
    if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
    $$('video, audio').forEach(media => media.pause());
    $$('.screen').forEach(x => x.classList.remove('active'));
    const target = $('#' + id);
    if (target) target.classList.add('active');

    // Detiene cualquier vídeo de YouTube que se haya quedado sonando al salir
    if (id !== 'operation') {
        const frame = $('#operationVideoFrame');
        if (frame) frame.innerHTML = '';
    }
    
    const header = $('#header');
    if (header) header.classList.toggle('hidden', id === 'auth');

    // Trigger render callbacks
    if (id === 'home') renderHome();
    if (id === 'premium') renderPremium();
    if (id === 'achievements') renderAchievements();
    requestAnimationFrame(setupRevealAnimations);
    requestAnimationFrame(() => {
        const heading = target?.querySelector('h1, h2');
        if (!heading) return;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    });
    
    window.scrollTo(0, 0);
};

// ==========================================
// 2. DATABASE (LocalStorage)
// ==========================================
const DB_KEY = 'ttl_ultimate_db_v1';
const ADMIN_CODE = 'TTL-DIRECCION-2026';
const NEQUI_NUMBER = '3104337927';
const NEQUI_NUMBERS = ['3104337927', '3245957915', '3135595448'];
const GOOGLE_CLIENT_ID = window.TTL_GOOGLE_CLIENT_ID || '';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
const SUIT_STYLES = {
    classic: 'none', lunar: 'drop-shadow(0 0 20px #bbebff)', mars: 'drop-shadow(0 0 20px #ff543d)',
    alien: 'drop-shadow(0 0 20px #62ff91)', robot: 'grayscale(.4) drop-shadow(0 0 20px #b3c3d8)',
    galaxy: 'hue-rotate(35deg) drop-shadow(0 0 25px #ef5cff)'
};
const SUIT_INFO = {
    classic: { name: 'Traje clásico', icon: '✦', color: '#7bdcff', detail: 'Explorador espacial' },
    lunar: { name: 'Traje lunar', icon: '🌙', color: '#d6edff', detail: 'Misión en la Luna' },
    mars: { name: 'Traje de Marte', icon: '🔴', color: '#ff705b', detail: 'Expedición marciana' },
    alien: { name: 'Traje alienígena', icon: '👽', color: '#72ff9a', detail: 'Amigo de otra galaxia' },
    robot: { name: 'Traje robótico', icon: '🤖', color: '#b4c8e2', detail: 'Modo tecnología' },
    galaxy: { name: 'Traje galáctico', icon: '✨', color: '#f47bff', detail: 'Viajero de nebulosas' }
};
const defaultLogoSettings = { glow: '#7b4dff', background: '#0b072d', objects: ['✨', '🚀', '🪐'], suit: 'classic', suitsUsed: ['classic'] };
const questionTypes = ['choice', 'visual', 'story', 'truefalse', 'input'];
const calmMessages = [
    '¿Listo para despegar? Elige una misión y gana estrellas con cada acierto.',
    '¿Qué reto quieres conquistar hoy? Toca Matemáticas y empieza tu aventura.',
    '¡Tú eliges el rumbo! Practica y acércate a una nueva insignia.',
    '¿Preparado para superar tu récord? Elige una operación y pon a prueba tu talento.',
    'Cada respuesta te lleva más lejos. ¿Comenzamos una nueva misión?'
];

let db = null;
let userId = null;
let lastCalmMessage = '';

const blankProgress = () => ({
    points: 0, stars: 0, total: 0, correct: 0, time: 0, maxLevel: 1, 
    dailyStreak: 1, bestStreak: 1, todayCorrect: 0, lastDate: null, 
    perfectMissions: 0, puzzles: 0, realProblems: 0, 
    operations: {
        add: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        subtract: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        multiply: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        divide: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }
    },
    assessment: { attempts: 0, best: 0, last: 0, lastGrade: null, bestGrade: 0, completed: false }
});

const seed = {
    users: [
        {
            id: 'student-demo', name: 'Estrellita', email: 'estudiante@demo.com', 
            password: '123456', role: 'student', secret: 'marte', premium: false, 
            settings: { audio: true }, progress: blankProgress()
        },
        {
            id: 'teacher-demo', name: 'Profe Nova', email: 'docente@demo.com', 
            password: '123456', role: 'teacher', secret: 'venus', premium: true, 
            settings: { audio: true }, progress: {}
        },
        {
            id: 'admin-demo', name: 'Dirección Galaxy', email: 'direccion@technologytolearn.local', 
            password: 'TtL-Admin-2026!', role: 'admin', secret: 'galaxia', premium: true, 
            settings: { audio: true }, progress: {}
        }
    ],
    payments: []
};

function loadDB() {
    try {
        const raw = localStorage.getItem(DB_KEY);
        db = raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('No se pudo leer el almacenamiento local', e);
        db = null;
    }

    if (!db || typeof db !== 'object' || !Array.isArray(db.users) || db.users.length === 0) {
        db = deepClone(seed);
    }

    db.payments = Array.isArray(db.payments) ? db.payments : [];

    // Migration / self-healing: every user gets the fields the UI expects
    db.users = db.users.map(user => {
        const role = ['student', 'teacher', 'admin'].includes(user.role) ? user.role : 'student';
        return {
            ...user,
            role,
            name: user.id === 'student-demo' ? 'Estrellita' : (typeof user.name === 'string' && user.name ? user.name : 'Explorador'),
            email: typeof user.email === 'string' ? user.email.toLowerCase() : '',
            settings: {
                audio: user.settings?.audio !== false,
                logo: {
                    ...defaultLogoSettings,
                    ...(user.settings?.logo || {}),
                    objects: Array.isArray(user.settings?.logo?.objects) && user.settings.logo.objects.length === 3
                        ? user.settings.logo.objects
                        : [...defaultLogoSettings.objects],
                    suitsUsed: [...new Set([
                        ...(Array.isArray(user.settings?.logo?.suitsUsed)
                            ? user.settings.logo.suitsUsed.filter(suit => Object.hasOwn(SUIT_INFO, suit))
                            : []),
                        ...(Object.hasOwn(SUIT_INFO, user.settings?.logo?.suit) ? [user.settings.logo.suit] : ['classic'])
                    ])]
                }
            },
            premium: Boolean(user.premium),
            progress: role === 'student'
                ? normalizeProgress(user.progress)
                : (user.progress && typeof user.progress === 'object' ? user.progress : {})
        };
    });

    saveDB();
}

let storageWarned = false;
function saveDB() {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        storageWarned = false;
    } catch (e) {
        console.warn('No se pudo guardar en localStorage (¿cuota llena o modo privado?)', e);
        if (!storageWarned) {
            storageWarned = true;
            toast('No se pudo guardar el progreso en este dispositivo. Tu avance seguirá en esta sesión.');
        }
    }
}

function currentUser() {
    if (!userId || !db) return null;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
        userId = null;
        sessionRemove('ttl_ultimate_user');
        return null;
    }
    return user;
}

function applyLogoSettings(settings = defaultLogoSettings) {
    const logo = { ...defaultLogoSettings, ...settings };
    const objects = Array.isArray(logo.objects) ? logo.objects : defaultLogoSettings.objects;
    $$('#header .brand, #logoPreview').forEach(element => {
        element.style.setProperty('--logo-glow', logo.glow);
        element.style.setProperty('--logo-background', logo.background);
    });
    const mascotImages = $$('#header .app-logo, #home .mascot img, #operation .mascot img, #quizMascot img, #summary .mascot img, #premium .mascot img, #logoPreview img');
    const isAlien = logo.suit === 'alien';
    mascotImages.forEach(image => {
        if (!image.dataset.defaultAlt) image.dataset.defaultAlt = image.alt;
        image.src = appAsset(isAlien ? 'alien.svg' : 'cosmo.jpg');
        image.alt = isAlien ? 'Alien personalizado' : image.dataset.defaultAlt;
        image.style.filter = SUIT_STYLES[logo.suit] || SUIT_STYLES.classic;
    });
    const suit = SUIT_INFO[logo.suit] ? logo.suit : 'classic';
    const suitInfo = SUIT_INFO[suit];
    const preview = $('#logoPreview');
    if (preview) {
        preview.className = `logo-preview aura ${suit}`;
        preview.style.setProperty('--suit-color', suitInfo.color);
    }
    const suitBadge = preview?.querySelector('.suit-badge');
    if (suitBadge) {
        suitBadge.querySelector('.suit-badge-icon').textContent = suitInfo.icon;
        suitBadge.querySelector('b').textContent = suitInfo.name;
        suitBadge.title = suitInfo.detail;
    }
    $$('#home .mascot, #operation .mascot, #quizMascot, #summary .mascot, #premium .mascot').forEach(mascot => {
        mascot.dataset.suit = suit;
        mascot.style.setProperty('--suit-color', suitInfo.color);
        let badge = mascot.querySelector('.mascot-suit-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'mascot-suit-badge';
            badge.setAttribute('aria-hidden', 'true');
            mascot.append(badge);
        }
        badge.textContent = suitInfo.icon;
        badge.title = suitInfo.detail;
    });
    $$('[data-logo-object], [data-preview-object]').forEach(element => {
        const index = Number(element.dataset.logoObject ?? element.dataset.previewObject);
        if (Number.isInteger(index) && objects[index]) element.textContent = objects[index];
    });
    $$('#logoGlowOptions [data-glow]').forEach(button => button.classList.toggle('selected', button.dataset.glow === logo.glow));
    $$('#logoBackgroundOptions [data-background]').forEach(button => button.classList.toggle('selected', button.dataset.background === logo.background));
    $$('#logoObjectOptions [data-object]').forEach(button => button.classList.toggle('selected', objects.includes(button.dataset.object)));
    $$('#logoSuitOptions [data-suit]').forEach(button => button.classList.toggle('selected', button.dataset.suit === logo.suit));
}

function saveLogoSettings(nextSettings) {
    const user = currentUser();
    if (!user) return;
    user.settings.logo = { ...defaultLogoSettings, ...user.settings.logo, ...nextSettings };
    if (Object.hasOwn(SUIT_INFO, nextSettings.suit)) {
        user.settings.logo.suitsUsed = [...new Set([
            ...(Array.isArray(user.settings.logo.suitsUsed) ? user.settings.logo.suitsUsed : []),
            nextSettings.suit
        ])];
    }
    saveDB();
    applyLogoSettings(user.settings.logo);
    toast('¡Tu logo quedó guardado!');
}

// sessionStorage can throw in private/blocked browsing modes
const sessionGet = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
const sessionSet = (key, value) => { try { sessionStorage.setItem(key, value); } catch {} };
const sessionRemove = key => { try { sessionStorage.removeItem(key); } catch {} };

function authMessage(text, type = '') {
    const message = $('#authMessage');
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`.trim();
}

function startUserSession(user) {
    userId = user.id;
    sessionSet('ttl_ultimate_user', user.id);
    applyDailyReset(user);
    navigate('home');
    setTimeout(greeting, 300);
}

async function handleGoogleCredential(response) {
    if (!response?.credential) {
        authMessage('No recibimos la respuesta de Google. Inténtalo de nuevo.', 'bad');
        return;
    }

    authMessage('Comprobando tu cuenta de Google...');
    try {
        const result = await fetch(`${GOOGLE_TOKENINFO_URL}${encodeURIComponent(response.credential)}`);
        if (!result.ok) throw new Error('Token rechazado');
        const profile = await result.json();
        const validAudience = profile.aud === GOOGLE_CLIENT_ID;
        const validIssuer = profile.iss === 'https://accounts.google.com' || profile.iss === 'accounts.google.com';
        if (!validAudience || !validIssuer || profile.email_verified !== 'true' || !profile.email) {
            throw new Error('Identidad no verificada');
        }

        const email = profile.email.trim().toLowerCase();
        let user = db.users.find(item => item.email === email);
        if (!user) {
            user = {
                id: uid(), name: profile.name?.trim() || 'Explorador', email,
                password: '', role: 'student', secret: uid(), premium: false,
                provider: 'google', settings: { audio: true }, progress: blankProgress()
            };
            db.users.push(user);
            saveDB();
        }
        startUserSession(user);
    } catch (error) {
        console.warn('No se pudo validar el acceso de Google', error);
        authMessage('No pudimos validar tu cuenta de Google. Revisa tu conexión e inténtalo otra vez.', 'bad');
    }
}

function setupGoogleAuth() {
    const button = $('#googleButton');
    if (!button) return;
    if (!GOOGLE_CLIENT_ID) {
        button.innerHTML = '<button type="button" class="google-fallback">Continuar con Google</button>';
        button.querySelector('button').onclick = () => authMessage('El acceso con Google necesita configurar el Client ID de la aplicación.', 'bad');
        return;
    }
    if (!window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(button, { type: 'standard', theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill', width: 330 });
}

// Guarantee a complete, numeric progress object (self-healing for old/corrupt data)
function normalizeProgress(progress) {
    const base = blankProgress();
    if (!progress || typeof progress !== 'object') return base;

    const merged = { ...base };
    for (const key of Object.keys(base)) {
        if (key === 'operations' || key === 'lastDate' || key === 'assessment') continue;
        merged[key] = toNum(progress[key], base[key]);
    }
    merged.lastDate = typeof progress.lastDate === 'string' ? progress.lastDate : null;

    merged.operations = {};
    for (const op of Object.keys(base.operations)) {
        const stored = (progress.operations && progress.operations[op]) || {};
        const total = toNum(stored.total);
        const correct = toNum(stored.correct);
        const savedGrade = stored.grade === null || stored.grade === undefined
            ? stored.completed === true ? gradeFromPercentage(total ? Math.round(correct / total * 100) : 0) : null
            : Math.min(5, Math.max(1, toNum(stored.grade, 1)));
        merged.operations[op] = {
            total,
            correct,
            completed: stored.completed === true,
            grade: savedGrade,
            bestGrade: stored.bestGrade === null || stored.bestGrade === undefined
                ? (savedGrade || 0)
                : Math.min(5, Math.max(0, toNum(stored.bestGrade)))
        };
    }
    const assessment = progress.assessment && typeof progress.assessment === 'object' ? progress.assessment : {};
    merged.assessment = {
        attempts: toNum(assessment.attempts),
        best: Math.min(100, Math.max(0, toNum(assessment.best))),
        last: Math.min(100, Math.max(0, toNum(assessment.last))),
        lastGrade: assessment.lastGrade === null || assessment.lastGrade === undefined
            ? assessment.completed ? gradeFromPercentage(assessment.last) : null
            : Math.min(5, Math.max(1, toNum(assessment.lastGrade, 1))),
        bestGrade: assessment.bestGrade === null || assessment.bestGrade === undefined
            ? assessment.completed ? gradeFromPercentage(assessment.best) : 0
            : Math.min(5, Math.max(0, toNum(assessment.bestGrade))),
        completed: assessment.completed === true
    };
    return merged;
}

// Daily streak + daily goal: resets todayCorrect and updates the streak once per day
function applyDailyReset(user) {
    if (!user || user.role !== 'student') return;
    if (!user.progress || typeof user.progress !== 'object' || !user.progress.operations) {
        user.progress = normalizeProgress(user.progress);
        saveDB();
        return;
    }

    const p = user.progress;
    const today = todayISO();
    if (p.lastDate === today) return;

    if (p.lastDate === todayISO(-1)) {
        p.dailyStreak = toNum(p.dailyStreak, 1) + 1;
        p.bestStreak = Math.max(toNum(p.bestStreak, 1), p.dailyStreak);
    } else if (p.lastDate) {
        p.dailyStreak = 1; // the streak was broken
    }

    p.todayCorrect = 0;
    p.lastDate = today;
    saveDB();
}

// ==========================================
// 3. AUDIO SYSTEM
// ==========================================
let audioContext = null;
let errorBag = [];
let lastErrorMessage = '';

const supportMessages = [
    'Tú puedes.', 'Buen intento.', 'No te rindas.', 'Inténtalo de nuevo.', 
    'Vamos, tú puedes.', 'Ya casi lo tienes.', 'Ups, será la próxima.', 
    'Vamos, campeón, no te rindas.', 'Mal aterrizaje, la próxima llegamos.', 
    'Vamos, que se puede lograr.', 'Los errores también son parte del camino.', 
    'Respira con calma y vuelve a observar.', 'Cada intento te ayuda a aprender.', 
    'Cosmo está aquí para ayudarte.', 'Un error no detiene a un gran explorador.'
];

const praiseMessages = [
    '¡Excelente!', '¡Despegue perfecto!', '¡Respuesta brillante!', 
    '¡Muy bien, campeón!', '¡Gran aterrizaje!', '¡Eres una estrella de las matemáticas!', 
    '¡Lo resolviste con mucha atención!'
];

function unlockAudio() {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();
    } catch (e) {
        console.warn('Audio no soportado', e);
    }
}

// Voices load asynchronously in most browsers: cache them and keep them fresh
let cachedVoices = [];
function refreshVoices() {
    try {
        cachedVoices = ('speechSynthesis' in window) ? speechSynthesis.getVoices() : [];
    } catch {
        cachedVoices = [];
    }
}
if ('speechSynthesis' in window) {
    refreshVoices();
    try { speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch {}
    setTimeout(refreshVoices, 500);
    setTimeout(refreshVoices, 2000);
}

function spanishVoice() {
    if (!cachedVoices.length) refreshVoices();
    const voices = cachedVoices;
    const spanishVoices = voices.filter(voice => voice.lang.toLowerCase().startsWith('es'));
    const preferredNames = ['sabina', 'laura', 'paulina', 'monica', 'sofia', 'lucia', 'elena', 'helena', 'ximena'];
    return preferredNames.map(name => spanishVoices.find(voice => voice.name.toLowerCase().includes(name))).find(Boolean)
        || spanishVoices.find(voice => /es-(mx|co|us)/i.test(voice.lang) && voice.localService)
        || spanishVoices.find(voice => voice.localService)
        || spanishVoices[0];
}

function speak(text, options = {}) {
    const user = currentUser();
    if (!user?.settings?.audio) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    
    try { speechSynthesis.cancel(); } catch {}
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = spanishVoice();
    
    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        utterance.lang = 'es-ES';
    }
    
    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = options.pitch ?? 1.08;
    utterance.volume = 1;
    
    try { speechSynthesis.speak(utterance); } catch (e) { console.warn('No se pudo reproducir la voz', e); }
}
window.hablar = speak; // Exposed for HTML/debug

function nextSupportMessage() {
    if (!errorBag.length) {
        errorBag = [...supportMessages].sort(() => Math.random() - 0.5);
    }
    let message = errorBag.pop();
    if (message === lastErrorMessage && errorBag.length) {
        const replacement = errorBag.pop();
        errorBag.push(message);
        message = replacement;
    }
    lastErrorMessage = message;
    return message;
}

function playMelody(correct) {
    const user = currentUser();
    if (!user?.settings?.audio) return;
    
    unlockAudio();
    if (!audioContext) return;
    
    const good = [
        [[440, 550, 700], [0.12, 0.12, 0.18], 'sine'],
        [[523, 659, 784], [0.11, 0.11, 0.2], 'triangle'],
        [[392, 523, 659, 784], [0.09, 0.09, 0.09, 0.18], 'sine'],
        [[480, 620, 760], [0.13, 0.13, 0.2], 'sine']
    ];
    
    const bad = [
        [[330, 250], [0.13, 0.24], 'sine'],
        [[290, 230, 180], [0.09, 0.09, 0.22], 'triangle'],
        [[430, 310], [0.08, 0.28], 'square'],
        [[220, 280, 190], [0.1, 0.1, 0.22], 'sine'],
        [[380, 245, 200], [0.07, 0.12, 0.24], 'triangle'],
        [[310, 180], [0.15, 0.3], 'sawtooth']
    ];
    
    const [frequencies, durations, type] = randomItem(correct ? good : bad);
    let start = audioContext.currentTime + 0.02;
    
    frequencies.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const duration = durations[index];
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        gain.gain.setValueAtTime(0.045, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        
        oscillator.start(start);
        oscillator.stop(start + duration);
        
        start += duration;
    });
}

function greeting() {
    const user = currentUser();
    if (!user) return;
    if (user.role === 'student') {
        speak(`Hola, ${user.name}. Tu nave está lista. Elige una misión y sigue aprendiendo. Tómate tu tiempo con tranquilidad.`);
    } else {
        speak(`Hola, ${user.name}. El panel de seguimiento está listo.`);
    }
}

// ==========================================
// 4. QUIZ / OPERATIONS DATA
// ==========================================
let currentOperation = 'add';
let quizState = null;
let selectedAnswer = null;
let timerId = null;

const operationInfo = {
    add: {
        name: 'Suma', description: 'Sumar es juntar cantidades para encontrar el total.',
        tip: 'Respira, observa y cuenta hacia adelante.', object: '🍎',
        videoSrc: appAsset('videos/suma.mp4'), audioSrc: appAsset('audios/suma.mp3')
    },
    subtract: {
        name: 'Resta', description: 'Restar es quitar elementos o encontrar la diferencia.',
        tip: 'Cuenta hacia atrás con tranquilidad.', object: '🍪',
        videoSrc: appAsset('videos/resta.mp4'), audioSrc: appAsset('audios/resta.mp3')
    },
    multiply: {
        name: 'Multiplicación', description: 'Multiplicar es organizar varios grupos iguales.',
        tip: 'Suma los grupos paso a paso.', object: '⭐',
        videoSrc: appAsset('videos/multiplicacion.mp4'), audioSrc: appAsset('audios/multiplicacion.mp3')
    },
    divide: {
        name: 'División', description: 'Dividir es repartir una cantidad en grupos iguales.',
        tip: 'Reparte uno a uno y comprueba.', object: '🧁',
        videoSrc: appAsset('videos/division.mp4'), audioSrc: appAsset('audios/division.mp3')
    }
};

const gradeFromPercentage = percentage => Number((1 + 4 * Math.min(100, Math.max(0, percentage)) / 100).toFixed(1));

const videoEmbedHTML = info => `<div class="video-player-stage"><video class="operation-video" controls playsinline preload="metadata" aria-label="Vídeo de ${escapeHTML(info.name)}">
    <source src="${escapeHTML(info.videoSrc)}" type="video/mp4">
    Tu navegador no puede reproducir este video.
</video>
<button class="video-guided-start" type="button" aria-label="Iniciar aprendizaje guiado de ${escapeHTML(info.name)}">
    <span aria-hidden="true">▶</span>
    <b>Presiona para iniciar tu aprendizaje guiado</b>
    <small>Video y audio te acompañarán paso a paso</small>
</button></div>
<audio class="video-audio-track" preload="metadata" hidden aria-hidden="true" tabindex="-1">
    <source src="${escapeHTML(info.audioSrc)}" type="audio/mpeg">
</audio>`;

const applyVideoAudioSettings = frame => {
    const video = frame?.querySelector('video');
    const audio = frame?.querySelector('.video-audio-track');
    const guidedStart = frame?.querySelector('.video-guided-start');
    if (!video || !audio || !guidedStart) return;
    const showVideoError = message => {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'video-error';
        errorMessage.setAttribute('role', 'alert');
        errorMessage.textContent = message;
        frame.querySelector('.video-error')?.remove();
        frame.append(errorMessage);
    };
    video.addEventListener('error', () => showVideoError(location.protocol === 'file:'
        ? 'Para reproducir este video, abre la página desde un servidor local o desde el sitio publicado; no desde un archivo file://.'
        : 'No se pudo cargar este video. Comprueba tu conexión e inténtalo de nuevo.'));
    guidedStart.addEventListener('click', async () => {
        guidedStart.disabled = true;
        try {
            await video.play();
        } catch (error) {
            guidedStart.disabled = false;
            console.error(`No se pudo iniciar el video de ${video.getAttribute('aria-label')}.`, error);
            showVideoError('No se pudo iniciar el video. Vuelve a intentarlo y comprueba tu conexión.');
        }
    });
    video.addEventListener('loadedmetadata', () => frame.querySelector('.video-error')?.remove());
    if (location.protocol === 'file:') {
        showVideoError('Para reproducir este video, abre la página desde un servidor local o desde el sitio publicado; no desde un archivo file://.');
    }
    const syncPosition = force => {
        if (audio.readyState === 0 || !Number.isFinite(video.currentTime)) return;
        if (force || Math.abs(audio.currentTime - video.currentTime) > 0.15) {
            audio.currentTime = video.currentTime;
        }
    };
    const syncAudioSettings = () => {
        audio.volume = video.volume;
        audio.muted = video.muted;
    };
    let audioStartPromise = null;
    const startAudio = () => {
        if (audioStartPromise) return audioStartPromise;
        audioStartPromise = (async () => {
            try {
                if (audio.readyState === 0) {
                    await new Promise((resolve, reject) => {
                        let timeoutId;
                        const cleanup = () => {
                            clearTimeout(timeoutId);
                            audio.removeEventListener('loadedmetadata', onLoaded);
                            audio.removeEventListener('error', onError);
                        };
                        const onLoaded = () => { cleanup(); resolve(); };
                        const onError = () => { cleanup(); reject(new Error('No se pudieron cargar los metadatos del audio.')); };
                        audio.addEventListener('loadedmetadata', onLoaded, { once: true });
                        audio.addEventListener('error', onError, { once: true });
                        timeoutId = setTimeout(() => {
                            cleanup();
                            reject(new Error('Se agotó el tiempo para cargar el audio del video.'));
                        }, 8000);
                    });
                }
                if (Math.abs(audio.currentTime - video.currentTime) > 0.15) {
                    await new Promise((resolve, reject) => {
                        let timeoutId;
                        const cleanup = () => {
                            clearTimeout(timeoutId);
                            audio.removeEventListener('seeked', onSeeked);
                            audio.removeEventListener('error', onError);
                        };
                        const onSeeked = () => {
                            cleanup();
                            if (Math.abs(audio.currentTime - video.currentTime) > 0.3) {
                                reject(new Error('El audio no alcanzó la posición actual del video.'));
                                return;
                            }
                            resolve();
                        };
                        const onError = () => {
                            cleanup();
                            reject(new Error('No se pudo sincronizar el audio con el video.'));
                        };
                        audio.addEventListener('seeked', onSeeked, { once: true });
                        audio.addEventListener('error', onError, { once: true });
                        timeoutId = setTimeout(() => {
                            cleanup();
                            reject(new Error('Se agotó el tiempo para sincronizar el audio con el video.'));
                        }, 5000);
                        try {
                            audio.currentTime = video.currentTime;
                            if (!audio.seeking && Math.abs(audio.currentTime - video.currentTime) <= 0.15) onSeeked();
                        } catch (error) {
                            cleanup();
                            reject(error);
                        }
                    });
                }
                audio.playbackRate = video.playbackRate;
                syncAudioSettings();
                await audio.play();
            } catch (error) {
                console.error(`No se pudo sincronizar el audio del video de ${video.getAttribute('aria-label')}.`, error);
                toast('No se pudo sincronizar el audio del video. Comprueba el archivo y el volumen del dispositivo.');
            } finally {
                audioStartPromise = null;
            }
        })();
        return audioStartPromise;
    };

    video.volume = Number($('#videoVolume')?.value ?? 1);
    video.muted = $('#videoMuteButton')?.getAttribute('aria-pressed') === 'true';
    syncAudioSettings();
    video.addEventListener('play', () => {
        guidedStart.classList.add('is-hidden');
        guidedStart.disabled = false;
        startAudio();
    });
    video.addEventListener('pause', () => audio.pause());
    video.addEventListener('seeking', () => syncPosition(true));
    video.addEventListener('seeked', () => {
        syncPosition(true);
        if (!video.paused) startAudio();
    });
    video.addEventListener('timeupdate', () => syncPosition(false));
    video.addEventListener('ratechange', () => { audio.playbackRate = video.playbackRate; });
    video.addEventListener('volumechange', syncAudioSettings);
    video.addEventListener('ended', () => {
        audio.pause();
        audio.currentTime = 0;
        guidedStart.querySelector('b').textContent = 'Volver a ver el aprendizaje guiado';
        guidedStart.setAttribute('aria-label', 'Repetir video guiado');
        guidedStart.classList.remove('is-hidden');
    });
    audio.addEventListener('loadedmetadata', () => syncPosition(true));
};

// Pinta el vídeo de la operación en el recuadro indicado y actualiza los enlaces de escape.
const showOperationVideo = (op, targetSelector) => {
    const info = operationInfo[op];
    if (!info) return;
    const frame = $(targetSelector);
    if (frame) {
        frame.innerHTML = videoEmbedHTML(info);
        applyVideoAudioSettings(frame);
    }
};

// ==========================================
// 5. RENDER FUNCTIONS
// ==========================================
function statCards(values, interactive = false) {
    const explanations = {
        puntos: 'Ganas 12 por cada respuesta correcta. Muestran tu avance.',
        estrellas: 'Ganas 1 por cada acierto. ¡Colecciónalas!',
        'racha diaria': 'Entra en días seguidos para mantenerla.',
        'mejor racha': 'Tu récord de días consecutivos.',
        precisión: 'Porcentaje de respuestas correctas en tus prácticas.'
    };
    return values.map((value, index) => {
        const [amount, label] = value;
        const content = `<b>${amount}</b><small>${label}</small>`;
        if (!interactive) return `<article class="stat">${content}</article>`;
        const explanationId = `statExplanation${index}`;
        return `<button class="stat stat-help" type="button" data-stat-help aria-expanded="false" aria-controls="${explanationId}">
            ${content}<span class="stat-explanation" id="${explanationId}" hidden>${explanations[label]}</span>
        </button>`;
    }).join('');
}

function forecast(p) {
    if (!p.total) return 'Sin actividad';
    if (p.total < 10) return 'En seguimiento inicial';
    const rate = p.correct / p.total;
    return rate >= 0.85 ? 'Desempeño alto' : rate >= 0.65 ? 'Desempeño medio' : 'Requiere acompañamiento';
}

function studentUsers() {
    return db.users.filter(u => u.role === 'student');
}

function renderMathGradeSummary(progress) {
    const list = $('#mathGradeList');
    const average = $('#mathGradeAverage');
    const count = $('#mathGradeCount');
    if (!list || !average || !count) return;

    const grades = [
        ...operationKeys.map(operation => ({
            label: operationInfo[operation].name,
            grade: progress.operations[operation].grade
        })),
        {
            label: 'Evaluación final',
            grade: progress.assessment.attempts ? progress.assessment.lastGrade : null
        }
    ];
    const recordedGrades = grades
        .map(item => item.grade)
        .filter(grade => grade !== null && grade !== undefined && Number.isFinite(Number(grade)))
        .map(Number);
    const roundedAverage = recordedGrades.length
        ? Number((recordedGrades.reduce((total, grade) => total + grade, 0) / recordedGrades.length).toFixed(1))
        : null;

    list.innerHTML = grades.map(({ label, grade }) => {
        const hasGrade = grade !== null && grade !== undefined && Number.isFinite(Number(grade));
        const displayedGrade = hasGrade ? Number(grade).toFixed(1) : '—';
        return `<article class="math-grade-item${hasGrade ? ' has-grade' : ''}">
            <span>${escapeHTML(label)}</span>
            <b>${displayedGrade}<small>${hasGrade ? '/ 5.0' : 'Pendiente'}</small></b>
        </article>`;
    }).join('');
    average.textContent = roundedAverage === null ? '—' : roundedAverage.toFixed(1);
    count.textContent = `(${recordedGrades.length} de ${grades.length} notas)`;
}

function renderHome() {
    const user = currentUser();
    if (!user) return navigate('auth');

    applyDailyReset(user); // roll over the streak / daily goal when a new day starts
    applyLogoSettings(user.settings?.logo);
    $('#home').classList.toggle('staff-view', user.role !== 'student');

    $('#welcomeTitle').textContent = `¡Hola, ${user.name}!`;
    $('#audioButton').textContent = user.settings?.audio ? '🔊' : '🔇';
    
    $('#studentDashboard').classList.toggle('hidden', user.role !== 'student');
    $('#staffDashboard').classList.toggle('hidden', user.role === 'student');
    
    if (user.role === 'student') {
        const p = user.progress;
        const hasPremium = Boolean(user.premium);
        $('#welcomeSubtitle').textContent = 'Tu nave está lista. Elige una misión y sigue aprendiendo.';
        $('#welcomeBubble').textContent = randomItem(['Tómate tu tiempo con tranquilidad.', 'Aprender no es una carrera.', 'Los errores también son parte del camino.', 'Cada intento fortalece tu mente.']);
        const nextCalmMessage = randomItem(calmMessages.filter(message => message !== lastCalmMessage));
        $('#calmMessage').textContent = nextCalmMessage;
        lastCalmMessage = nextCalmMessage;
        $('#mathSubjectSubtitle').textContent = 'Práctica gratuita · rutas y retos cotidianos';
        $('#premiumHomeTitle').textContent = hasPremium ? 'Continuar curso Premium' : 'Curso completo · Premium';
        $('#premiumHomeDescription').textContent = hasPremium
            ? 'Retoma las unidades guiadas y consulta tus notas.'
            : '4 unidades guiadas, videos y evaluación con nota.';
        $('#premiumHomeAction').textContent = hasPremium ? 'Abrir curso' : 'Conocer';
        
        $('#studentStats').innerHTML = statCards([
            [p.points, 'puntos'], [p.stars, 'estrellas'], [p.dailyStreak, 'racha diaria'],
            [p.bestStreak, 'mejor racha'], [p.total ? Math.round(p.correct / p.total * 100) + '%' : '0%', 'precisión']
        ], true);
        $$('#studentStats [data-stat-help]').forEach(button => {
            button.onclick = () => {
                const expanded = button.getAttribute('aria-expanded') === 'true';
                button.setAttribute('aria-expanded', String(!expanded));
                button.querySelector('.stat-explanation').hidden = expanded;
            };
        });

        const pathOperations = ['add', 'subtract', 'multiply', 'divide'];
        const completedOperations = pathOperations.filter(operation => p.operations?.[operation]?.completed === true);
        const nextOperation = pathOperations.find(operation => p.operations?.[operation]?.completed !== true);
        const pathProgress = $('#operationPath');
        const progressText = $('#pathProgressText');
        const progressFill = $('#pathProgressFill');
        if (pathProgress && progressText && progressFill) {
            const progress = completedOperations.length + (p.assessment.completed ? 1 : 0);
            progressText.textContent = nextOperation
                ? `${completedOperations.length} de 5 unidades · evaluación final pendiente`
                : p.assessment.completed ? '¡Ruta completa! 5 de 5 unidades aprobadas.' : '4 de 5 unidades · evaluación final disponible';
            progressFill.style.width = `${progress / 5 * 100}%`;
            pathProgress.style.setProperty('--route-progress', String(Math.min(progress / 4, 1)));
            pathProgress.querySelector('.route-progress')?.setAttribute('aria-valuemax', '5');
            pathProgress.querySelector('.route-progress')?.setAttribute('aria-valuenow', String(progress));

            pathProgress.querySelectorAll('[data-operation]').forEach(button => {
                const operation = button.dataset.operation;
                const completed = p.operations?.[operation]?.completed === true;
                const current = operation === nextOperation;
                button.classList.toggle('is-complete', completed);
                button.classList.toggle('is-current', current);
                button.classList.toggle('is-up-next', !completed && !current);
                button.disabled = !completed && !current;
                button.setAttribute('aria-disabled', String(button.disabled));
                if (current) button.setAttribute('aria-current', 'step');
                else button.removeAttribute('aria-current');

                const status = button.querySelector('.path-status');
                if (status) {
                    const grade = p.operations?.[operation]?.grade;
                    status.textContent = completed
                        ? `Aprobada · ${Number(grade).toFixed(1)}/5.0`
                        : current ? 'Disponible ahora' : 'Completa la anterior';
                }
            });
        }
        const evaluationButton = $('#evaluationButton');
        const evaluationStatus = $('#evaluationStatus');
        const evaluationUnit = $('#evaluationUnit');
        if (evaluationButton && evaluationStatus) {
            const allUnitsComplete = completedOperations.length === pathOperations.length;
            evaluationButton.disabled = !allUnitsComplete;
            evaluationUnit?.classList.toggle('is-unlocked', allUnitsComplete);
            evaluationUnit?.classList.toggle('is-complete', p.assessment.completed);
            evaluationButton.textContent = !allUnitsComplete
                ? '🔒 Evaluación bloqueada'
                : p.assessment.completed ? '↻ Volver a presentar' : '🚀 Iniciar unidad';
            evaluationStatus.textContent = !allUnitsComplete
                ? `Completa y aprueba las cuatro unidades anteriores (${completedOperations.length}/4) para desbloquear la evaluación.`
                : p.assessment.completed
                    ? `Aprobada · nota ${Number(p.assessment.lastGrade).toFixed(1)}/5.0 · mejor ${Number(p.assessment.bestGrade).toFixed(1)}/5.0. Puedes repetirla.`
                    : '12 preguntas: 3 de suma, 3 de resta, 3 de multiplicación y 3 de división. Nota de 1.0 a 5.0.';
        }
        renderMathGradeSummary(p);
        
        $('#miniStats').textContent = `⭐ ${p.stars} · 🔥 ${p.dailyStreak}`;
        $('#dailyStreakValue').textContent = `${p.dailyStreak} ${p.dailyStreak === 1 ? 'día' : 'días'}`;
        $('#dailyText').textContent = toNum(p.todayCorrect) >= 5
            ? `¡Meta diaria cumplida! (${p.todayCorrect} aciertos)`
            : `Hoy conseguiste ${toNum(p.todayCorrect)}/5 aciertos.`;
        $('#dailyProgress').style.width = Math.min((toNum(p.todayCorrect) / 5) * 100, 100) + '%';
        newPuzzle();
        newReal();
    } else {
        const admin = user.role === 'admin';
        $('#welcomeSubtitle').textContent = admin ? 'Gestión institucional y aprobación de Premium.' : 'Seguimiento pedagógico y pronósticos.';
        $('#welcomeBubble').textContent = 'Los datos ayudan a acompañar el aprendizaje.';
        $('#staffTitle').textContent = admin ? 'Panel directivo y administrativo' : 'Panel docente';
        $('#paymentAdmin').classList.toggle('hidden', !admin);
        renderStaff();
    }
}

function renderStaff() {
    const users = studentUsers();
    const total = users.reduce((a, u) => a + toNum(u.progress?.total), 0);
    const correct = users.reduce((a, u) => a + toNum(u.progress?.correct), 0);
    const approvedUnits = users.reduce((count, user) => {
        const progress = normalizeProgress(user.progress);
        return count + operationKeys.filter(operation => progress.operations[operation].completed).length
            + Number(progress.assessment.completed);
    }, 0);
    const totalMinutes = users.reduce((minutes, user) => minutes + toNum(user.progress?.time) / 60, 0);
    const metrics = [
        ['01', users.length.toLocaleString('es-CO'), 'Estudiantes', 'Matrícula registrada'],
        ['02', total.toLocaleString('es-CO'), 'Ejercicios', 'Intentos de práctica'],
        ['03', `${total ? Math.round(correct / total * 100) : 0}%`, 'Precisión del grupo', `${correct.toLocaleString('es-CO')} respuestas correctas`],
        ['04', `${users.length ? Math.round(totalMinutes / users.length) : 0} min`, 'Estudio promedio', 'Por estudiante'],
        ['05', approvedUnits.toLocaleString('es-CO'), 'Unidades aprobadas', 'En toda la plataforma']
    ];
    $('#staffStats').innerHTML = metrics.map(([mark, value, label, detail]) => `
        <article class="staff-stat">
            <span class="staff-stat-mark" aria-hidden="true">${mark}</span>
            <b>${value}</b>
            <span class="staff-stat-label">${label}</span>
            <small>${detail}</small>
        </article>
    `).join('');

    const rows = users.map(user => {
        const p = normalizeProgress(user.progress);
        const ops = Object.entries(p.operations).sort((a, b) => toNum(b[1].total) - toNum(a[1].total));
        const favorite = ops.length && toNum(ops[0][1].total) > 0 ? operationInfo[ops[0][0]]?.name : null;
        const accuracy = p.total ? Math.round(p.correct / p.total * 100) : 0;
        const completedUnits = operationKeys.filter(operation => p.operations[operation].completed).length
            + Number(p.assessment.completed);
        const forecastLabel = forecast(p);
        const forecastClass = p.total < 10 ? 'initial' : accuracy >= 85 ? 'strong' : accuracy >= 65 ? 'reinforce' : 'support';
        const gradeCell = (grade, label) => grade === null || grade === undefined
            ? `<span class="staff-no-data" aria-label="Sin nota en ${escapeHTML(label)}">—</span>`
            : `<span class="staff-grade ${grade >= PASS_GRADE ? 'passed' : 'needs-review'}" aria-label="${escapeHTML(label)}: nota ${Number(grade).toFixed(1)} de 5.0">${Number(grade).toFixed(1)}</span>`;
        const initials = String(user.name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('es-CO');
        return `<tr>
            <td>
                <div class="staff-student">
                    <span class="staff-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
                    <span><b>${escapeHTML(user.name)}</b><small>${escapeHTML(user.email)}</small></span>
                </div>
            </td>
            <td><span class="staff-status ${forecastClass}">${escapeHTML(forecastLabel)}</span></td>
            <td>
                <div class="staff-accuracy"><b>${accuracy}%</b><span class="staff-meter" role="progressbar" aria-label="Precisión de ${escapeHTML(user.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${accuracy}"><i style="width:${accuracy}%"></i></span></div>
            </td>
            <td>
                <div class="staff-route"><b>${completedUnits} <span>/ 5</span></b><span class="staff-meter" role="progressbar" aria-label="Unidades aprobadas por ${escapeHTML(user.name)}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${completedUnits}"><i style="width:${completedUnits / 5 * 100}%"></i></span></div>
            </td>
            ${operationKeys.map(operation => `<td>${gradeCell(p.operations[operation].grade, operationInfo[operation].name)}</td>`).join('')}
            <td>${gradeCell(p.assessment.attempts ? p.assessment.lastGrade : null, 'Evaluación final')}</td>
            <td>${Math.round(toNum(p.time) / 60).toLocaleString('es-CO')} min</td>
            <td>${favorite ? `<span class="staff-operation">${escapeHTML(favorite)}</span>` : '<span class="staff-no-data">Sin actividad</span>'}</td>
        </tr>`;
    }).join('');

    const studentTable = $('#studentTable');
    studentTable.innerHTML = rows || '<tr class="staff-empty"><td colspan="11">Aún no hay estudiantes registrados.</td></tr>';
    const search = $('#studentSearch');
    if (search) {
        search.oninput = () => {
            const query = search.value.trim().toLocaleLowerCase('es-CO');
            let visible = 0;
            studentTable.querySelectorAll('tr:not(.staff-empty)').forEach(row => {
                const matches = row.textContent.toLocaleLowerCase('es-CO').includes(query);
                row.hidden = !matches;
                if (matches) visible++;
            });
            if (rows) {
                let empty = studentTable.querySelector('.staff-empty');
                if (!visible) {
                    if (!empty) {
                        empty = document.createElement('tr');
                        empty.className = 'staff-empty';
                        empty.innerHTML = '<td colspan="11">No hay estudiantes que coincidan con la búsqueda.</td>';
                        studentTable.append(empty);
                    }
                } else {
                    empty?.remove();
                }
            }
        };
    }

    if (currentUser().role === 'admin') renderPayments();
}

let paymentFilter = 'pending';

function renderPayments() {
    const pendingPayments = db.payments.filter(payment => payment.status === 'pending');
    const amountPending = pendingPayments.reduce((total, payment) => total + toNum(payment.amount), 0);
    const summary = $('#paymentSummary');
    if (summary) {
        summary.innerHTML = `
            <article><span>Por revisar</span><b>${pendingPayments.length.toLocaleString('es-CO')}</b><small>solicitudes pendientes</small></article>
            <article><span>Valor pendiente</span><b>$${amountPending.toLocaleString('es-CO')}</b><small>COP · por verificar</small></article>`;
    }

    $$('#paymentFilters [data-payment-filter]').forEach(button => {
        button.classList.toggle('selected', button.dataset.paymentFilter === paymentFilter);
        button.onclick = () => {
            paymentFilter = button.dataset.paymentFilter;
            renderPayments();
        };
    });

    const visiblePayments = [...db.payments]
        .filter(payment => paymentFilter === 'all' || payment.status === 'pending')
        .sort((left, right) => Number(right.status === 'pending') - Number(left.status === 'pending'));
    const resultCount = $('#paymentResultCount');
    if (resultCount) {
        resultCount.textContent = paymentFilter === 'pending'
            ? `${pendingPayments.length.toLocaleString('es-CO')} pendientes`
            : `${visiblePayments.length.toLocaleString('es-CO')} solicitudes`;
    }

    const paymentList = $('#paymentList');
    paymentList.innerHTML = visiblePayments.length ? visiblePayments.map(payment => {
        const user = db.users.find(item => item.id === payment.userId);
        const isPending = payment.status === 'pending';
        const statusLabel = isPending ? 'Pendiente de revisión' : payment.status === 'approved' ? 'Aprobada' : 'Rechazada';
        const statusClass = isPending ? 'pending' : payment.status === 'approved' ? 'approved' : 'rejected';
        return `
            <article class="payment-card ${statusClass}">
                <div class="payment-card-main">
                    <div class="payment-person">
                        <span class="payment-avatar" aria-hidden="true">${escapeHTML(String(user?.name || payment.email || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('es-CO'))}</span>
                        <span><b>${escapeHTML(user?.name || 'Cuenta de usuario')}</b><small>${escapeHTML(payment.email || user?.email || 'Sin correo')}</small></span>
                    </div>
                    <span class="payment-status ${statusClass}"><i aria-hidden="true"></i>${statusLabel}</span>
                </div>
                <div class="payment-details">
                    <div><small>Valor reportado</small><b>$${toNum(payment.amount).toLocaleString('es-CO')} COP</b></div>
                    <div><small>Medio de pago</small><b>Nequi · ${escapeHTML(payment.nequi ?? NEQUI_NUMBER)}</b></div>
                    <div><small>Referencia</small><b>${escapeHTML(payment.reference || 'No indicada')}</b></div>
                </div>
                ${isPending ? `<div class="payment-card-actions"><span>Verifica el comprobante antes de activar el acceso.</span><button type="button" class="staff-approve" data-approve="${escapeHTML(payment.id)}">Aprobar solicitud</button></div>` : ''}
            </article>`;
    }).join('') : `
        <div class="payment-empty">
            <span aria-hidden="true">${paymentFilter === 'pending' ? '✓' : '—'}</span>
            <b>${paymentFilter === 'pending' ? 'Todo al día' : 'Sin solicitudes'}</b>
            <p>${paymentFilter === 'pending' ? 'No tienes solicitudes pendientes de revisión.' : 'Aún no se han recibido solicitudes Premium.'}</p>
        </div>`;
    
    $$('[data-approve]').forEach(button => {
        button.onclick = () => {
            const payment = db.payments.find(p => p.id === button.dataset.approve);
            if (!payment) { toast('Esa solicitud ya no existe.'); return renderPayments(); }
            if (payment.status !== 'pending') { toast('Esa solicitud ya fue procesada.'); return renderPayments(); }

            const user = db.users.find(u => u.id === payment.userId);
            payment.status = 'approved';
            if (user) user.premium = true;
            saveDB();
            renderPayments();

            if (payment.email) {
                location.href = `mailto:${payment.email}?subject=${encodeURIComponent('Pago Premium confirmado')}&body=${encodeURIComponent('Confirmamos tu acceso Premium. Referencia: ' + payment.reference)}`;
            }
        };
    });
}

function renderAchievements() {
    const user = currentUser();
    if (!user) return navigate('auth');

    const p = normalizeProgress(user.progress);
    const ops = p.operations;
    const logo = user.settings?.logo || defaultLogoSettings;
    const suitsUsed = Array.isArray(logo.suitsUsed) ? logo.suitsUsed : ['classic'];
    const addAchievement = (icon, title, description, category, value, target = 1) => {
        const current = Math.max(0, Math.min(target, toNum(value)));
        achievements.push({
            icon, title, description, category, current, target,
            unlocked: current >= target,
            percentage: target ? Math.round(current / target * 100) : 0
        });
    };
    const achievements = [];
    const anyUnitGrade = minimum => Math.max(...operationKeys.map(operation => toNum(ops[operation].bestGrade))) >= minimum;

    for (const [target, title, icon] of [
        [1, 'Primera misión', '🚀'], [10, 'Explorador constante', '🧭'], [25, 'Rumbo a las estrellas', '🌠'],
        [50, 'Piloto de confianza', '🛸'], [100, 'Gran explorador', '🌌'], [500, 'Leyenda espacial', '🏅']
    ]) addAchievement(icon, title, `Completa ${target} ${target === 1 ? 'pregunta' : 'preguntas'} de práctica.`, 'explore', p.total, target);

    for (const [target, title, icon] of [
        [1, 'Primera estrella', '⭐'], [10, 'Cielo brillante', '✨'], [25, 'Constelación propia', '🌟'],
        [50, 'Cazador de estrellas', '💫'], [100, 'Lluvia estelar', '☄️'], [500, 'Universo de estrellas', '🌠']
    ]) addAchievement(icon, title, `Gana ${target} ${target === 1 ? 'estrella' : 'estrellas'} respondiendo correctamente.`, 'explore', p.stars, target);

    for (const [target, title, icon] of [
        [3, 'Llama encendida', '🔥'], [7, 'Semana espacial', '🗓️'], [14, 'Dos semanas sin parar', '☄️'],
        [30, 'Racha de otro planeta', '🌋'], [60, 'Maestro de la constancia', '🏆']
    ]) addAchievement(icon, title, `Mantén una racha de ${target} días.`, 'streak', p.bestStreak, target);

    for (const [target, title, icon] of [
        [1, 'Misión impecable', '💯'], [5, 'Cinco misiones perfectas', '🌟'],
        [10, 'Precisión de astronauta', '🎯'], [25, 'Perfección galáctica', '👑']
    ]) addAchievement(icon, title, `Termina ${target} ${target === 1 ? 'práctica' : 'prácticas'} con todas las respuestas correctas.`, 'explore', p.perfectMissions, target);

    for (const [operation, title, icon] of [
        ['add', 'Fan de la suma', '➕'], ['subtract', 'Experto en restas', '➖'],
        ['multiply', 'Multiplicador estelar', '✖️'], ['divide', 'Repartidor galáctico', '➗']
    ]) addAchievement(icon, title, `Resuelve 25 preguntas de ${operationInfo[operation].name.toLowerCase()}.`, 'operations', ops[operation].total, 25);

    for (const [operation, title, icon] of [
        ['add', 'Unidad de suma aprobada', '➕'], ['subtract', 'Unidad de resta aprobada', '➖'],
        ['multiply', 'Unidad de multiplicación aprobada', '✖️'], ['divide', 'Unidad de división aprobada', '➗']
    ]) addAchievement(icon, title, `Aprueba ${operationInfo[operation].name.toLowerCase()} con nota mínima de 3.8/5.0.`, 'operations', ops[operation].completed ? 1 : 0);

    const allUnitsComplete = operationKeys.every(operation => ops[operation].completed);
    addAchievement('🪐', 'Ruta de las cuatro operaciones', 'Aprueba suma, resta, multiplicación y división.', 'operations', allUnitsComplete ? 1 : 0);
    for (const [minimum, title, icon] of [
        [3, 'Primera nota aprobada', '📘'], [4, 'Cuadro de honor', '🥈'], [5, 'Nota perfecta', '🥇']
    ]) addAchievement(icon, title, `Alcanza una nota de ${minimum}.0/5.0 o más en una unidad.`, 'operations', anyUnitGrade(minimum) ? 1 : 0);

    for (const [target, title, description, value] of [
        [1, 'Primera evaluación', 'Presenta la unidad final de las cuatro operaciones.', p.assessment.attempts],
        [1, 'Evaluación aprobada', 'Aprueba la unidad final con una nota mínima de 3.5/5.0.', p.assessment.completed ? 1 : 0],
        [90, 'Casi sin errores', 'Obtén 90% o más en una evaluación.', p.assessment.best],
        [100, 'Evaluación perfecta', 'Responde correctamente las 12 preguntas de la evaluación.', p.assessment.best],
        [5, 'Nunca dejes de intentarlo', 'Presenta la evaluación final cinco veces.', p.assessment.attempts]
    ]) addAchievement(title === 'Evaluación perfecta' ? '💎' : '📝', title, description, 'assessment', value, target);

    for (const [target, title, icon] of [
        [1, 'Puzle resuelto', '🧩'], [10, 'Cerebro de astronauta', '🧠']
    ]) addAchievement(icon, title, `Resuelve ${target} ${target === 1 ? 'rompecabezas' : 'rompecabezas'}.`, 'explore', p.puzzles, target);

    for (const [target, title, icon] of [
        [1, 'Matemáticas de la vida real', '🛒'], [10, 'Experto fuera del aula', '🌍']
    ]) addAchievement(icon, title, `Resuelve ${target} ${target === 1 ? 'reto práctico' : 'retos prácticos'}.`, 'explore', p.realProblems, target);

    for (const [suit, title, icon] of [
        ['classic', 'Traje clásico', '🧑‍🚀'], ['lunar', 'Explorador lunar', '🌙'], ['mars', 'Misión en Marte', '🔴'],
        ['alien', 'Amigo alienígena', '👽'], ['robot', 'Modo robótico', '🤖'], ['galaxy', 'Traje galáctico', '🌌']
    ]) addAchievement(icon, title, `Prueba el ${SUIT_INFO[suit].name.toLowerCase()} en tu personalizador.`, 'creative', suitsUsed.includes(suit) ? 1 : 0);

    const customizedLogo = logo.glow !== defaultLogoSettings.glow
        || logo.background !== defaultLogoSettings.background
        || (Array.isArray(logo.objects) && logo.objects.some((object, index) => object !== defaultLogoSettings.objects[index]))
        || (logo.suit && logo.suit !== 'classic');
    addAchievement('🎨', 'Diseñador de tu galaxia', 'Personaliza los colores, los objetos o el traje de tu logo.', 'creative', customizedLogo ? 1 : 0);
    addAchievement('👑', 'Acceso a la Zona Premium', 'Desbloquea la Zona Premium para explorar sus retos.', 'creative', user.premium ? 1 : 0);

    const unlocked = achievements.filter(achievement => achievement.unlocked).length;
    const summary = $('#achievementSummary');
    if (summary) {
        summary.innerHTML = `
            <div class="achievement-summary-copy"><b>${unlocked} de 50 logros</b><span>${unlocked === 50 ? '¡Colección completa, explorador!' : 'Sigue aprendiendo para desbloquear más insignias.'}</span></div>
            <div class="achievement-summary-meter" role="progressbar" aria-label="Logros desbloqueados" aria-valuemin="0" aria-valuemax="50" aria-valuenow="${unlocked}">
                <i style="width:${unlocked / 50 * 100}%"></i>
            </div>`;
    }

    const grid = $('#achievementGrid');
    const renderCards = filter => {
        const visible = filter === 'all' ? achievements : achievements.filter(achievement => achievement.category === filter);
        grid.innerHTML = visible.map(achievement => `
            <article class="achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}" data-category="${achievement.category}">
                <div class="achievement-icon" aria-hidden="true">${achievement.icon}</div>
                <b>${achievement.title}</b>
                <p>${achievement.description}</p>
                <div class="achievement-meter" role="progressbar" aria-label="${achievement.title}" aria-valuemin="0" aria-valuemax="${achievement.target}" aria-valuenow="${achievement.current}">
                    <i style="width:${achievement.percentage}%"></i>
                </div>
                <small>${achievement.unlocked ? '✓ Desbloqueado' : `${achievement.current.toLocaleString('es-CO')} / ${achievement.target.toLocaleString('es-CO')}`}</small>
            </article>
        `).join('');
    };

    $$('#achievementFilters [data-achievement-filter]').forEach(button => {
        button.classList.toggle('selected', button.dataset.achievementFilter === 'all');
        button.onclick = () => {
            $$('#achievementFilters [data-achievement-filter]').forEach(filter => filter.classList.toggle('selected', filter === button));
            renderCards(button.dataset.achievementFilter);
        };
    });
    renderCards('all');
}

function renderPremium() {
    const user = currentUser();
    if (!user) return navigate('auth');
    $('#premiumTitle').textContent = 'Curso completo de Matemáticas';
    $('#premiumDescription').textContent = 'Aprende las cuatro operaciones con videos, práctica y una evaluación final.';
    $('#premiumState').innerHTML = user.premium 
        ? '<p class="feedback good"><b>Curso Premium activo</b></p>' 
        : '<p>El curso completo está disponible con acceso Premium.</p>';
    $('#paymentSection').classList.toggle('hidden', user.premium);
    $('#premiumContent').classList.toggle('hidden', !user.premium);
    $('#nequiChoices').innerHTML = NEQUI_NUMBERS.map((number, index) => `<button type="button" class="nequi-choice ${index === 0 ? 'selected' : ''}" data-nequi="${number}">${number}</button>`).join('');
    $('#paymentNequi').innerHTML = NEQUI_NUMBERS.map(number => `<option value="${number}">${number}</option>`).join('');
    $$('#nequiChoices [data-nequi]').forEach(button => button.onclick = () => {
        $$('#nequiChoices [data-nequi]').forEach(item => item.classList.remove('selected'));
        button.classList.add('selected');
        $('#paymentNequi').value = button.dataset.nequi;
        try { navigator.clipboard?.writeText(button.dataset.nequi); } catch {}
        toast('Número copiado');
    });
    
    if (!user.premium) {
        $('#paymentEmail').value = user.email;
    }
}

const PASS_GRADE = 3.5;
const operationKeys = ['add', 'subtract', 'multiply', 'divide'];
let lastQuizMode = 'practice';

function baseQuestion(operation = currentOperation, type = randomItem(questionTypes)) {
    const level = Math.min(3, Math.max(1, toNum($('#levelSelect')?.value, 1)));
    const max = level === 1 ? 10 : level === 2 ? 50 : 150;
    let a, b, answer, text;
    
    if (operation === 'add') { a = randomNumber(1, max); b = randomNumber(1, max); answer = a + b; text = `${a} + ${b}`; }
    if (operation === 'subtract') { a = randomNumber(2, max); b = randomNumber(1, a); answer = a - b; text = `${a} − ${b}`; }
    if (operation === 'multiply') { a = randomNumber(1, level === 1 ? 5 : 12); b = randomNumber(1, level === 1 ? 5 : 12); answer = a * b; text = `${a} × ${b}`; }
    if (operation === 'divide') { b = randomNumber(2, level === 1 ? 5 : 10); answer = randomNumber(1, level === 3 ? 20 : 10); a = b * answer; text = `${a} ÷ ${b}`; }
    
    return { operation, a, b, answer, text, object: operationInfo[operation].object, type };
}

function startQuiz(mode = 'practice') {
    const user = currentUser();
    if (!user || user.role !== 'student' || !user.progress?.operations) {
        toast('Las misiones están disponibles para estudiantes.');
        return;
    }
    if (!user.premium) {
        toast('El curso completo de Matemáticas requiere acceso Premium.');
        navigate('premium');
        return;
    }
    const completedUnits = operationKeys.filter(operation => user.progress.operations[operation]?.completed).length;
    if (mode === 'assessment' && completedUnits < operationKeys.length) {
        toast('Primero aprueba las cuatro unidades para desbloquear la evaluación.');
        return;
    }
    if (mode === 'practice') {
        const operationIndex = operationKeys.indexOf(currentOperation);
        const unlockedIndex = operationKeys.findIndex(operation => !user.progress.operations[operation]?.completed);
        const isCompleted = user.progress.operations[currentOperation]?.completed === true;
        if (operationIndex < 0 || (!isCompleted && operationIndex !== unlockedIndex)) {
            toast('Completa y aprueba la unidad anterior para continuar.');
            renderHome();
            return;
        }
    }
    applyDailyReset(user);
    unlockAudio();
    const total = mode === 'assessment'
        ? operationKeys.length * 3
        : Math.min(50, Math.max(1, toNum($('#questionCount')?.value, 10)));
    const operationPlan = mode === 'assessment'
        ? operationKeys.flatMap(operation => Array(3).fill(operation)).sort(() => Math.random() - 0.5)
        : Array(total).fill(currentOperation);
    const questionTypePlan = Array.from(
        { length: Math.ceil(total / questionTypes.length) },
        () => shuffle(questionTypes)
    ).flat().slice(0, total);
    quizState = {
        index: 0,
        total,
        correct: 0,
        started: Date.now(),
        mode,
        operationPlan,
        questionTypePlan,
        operationTotals: Object.fromEntries(operationKeys.map(operation => [operation, 0])),
        operationCorrect: Object.fromEntries(operationKeys.map(operation => [operation, 0])),
        streak: 0
    };
    lastQuizMode = mode;
    $('#quizModeLabel').textContent = mode === 'assessment' ? 'UNIDAD 5 · EVALUACIÓN FINAL' : 'MISIÓN DE APRENDIZAJE';
    $('#quizMissionText').textContent = mode === 'assessment'
        ? '12 retos mezclados: tres preguntas de cada operación. ¡A por tu mejor nota!'
        : `Aprueba ${operationInfo[currentOperation].name.toLowerCase()} con una nota mínima de ${PASS_GRADE.toFixed(1)}/5.0 para desbloquear la siguiente unidad.`;
    $('#quizStreak').textContent = '✨ 0';
    navigate('quiz');
    nextQuizQuestion();
}

function nextQuizQuestion() {
    clearInterval(timerId);
    timerId = null;
    selectedAnswer = null;
    const q = quizState.question = baseQuestion(
        quizState.operationPlan[quizState.index],
        quizState.questionTypePlan[quizState.index]
    );
    
    $('#questionNumber').textContent = `Pregunta ${quizState.index + 1} de ${quizState.total}`;
    $('#quizProgress').style.width = (quizState.index / quizState.total) * 100 + '%';
    $('#questionType').textContent = {
        choice: '🎯 Elige una respuesta', visual: '🔭 Reto visual', story: '🪐 Historia interactiva',
        truefalse: '⚡ Detecta la señal', input: '🧭 Escribe el resultado'
    }[q.type];
    const missionScenes = [
        ['🚀', 'Despegue relámpago'], ['🛸', 'Rescate en órbita'], ['🌌', 'Portal galáctico'],
        ['🛰️', 'Código de la estación'], ['🌠', 'Caza de estrellas'], ['🪐', 'Planeta misterioso']
    ];
    const [missionIcon, missionTitle] = randomItem(missionScenes);
    $('#challengeScene').textContent = `${missionIcon} ${missionTitle} · ${operationInfo[q.operation].name}`;
    $('#quizOperationBadge').textContent = operationInfo[q.operation].name;
    $('#quizOperationBadge').classList.toggle('hidden', quizState.mode !== 'assessment');

    const storyPrompts = {
        add: `El radar localizó ${q.a} ${q.object}. Llegan ${q.b} más a la estación. ¿Cuántos hay ahora?`,
        subtract: `La nave transporta ${q.a} ${q.object} y entrega ${q.b}. ¿Cuántos quedan a bordo?`,
        multiply: `Se preparan ${q.a} cápsulas con ${q.b} ${q.object} en cada una. ¿Cuántos se necesitan?`,
        divide: `Hay ${q.a} ${q.object} para repartir en ${q.b} equipos. ¿Cuántos recibe cada equipo?`
    };
    const prompts = {
        choice: '¡La consola está parpadeando! Elige el resultado correcto para seguir avanzando.',
        visual: 'Mira con atención los objetos que llegaron. ¿Cuántos hay al completar la operación?',
        story: storyPrompts[q.operation],
        truefalse: '¡Alerta de la computadora! ¿La señal tiene el resultado correcto?',
        input: 'Teclea tu respuesta y carga el propulsor de la nave.'
    };
    if (q.type === 'truefalse') {
        q.claim = Math.random() < 0.5 ? q.answer : q.answer + randomItem([-2, -1, 1, 2]);
        $('#questionStory').textContent = `¿Es verdadero que ${q.text} = ${q.claim}?`;
    } else {
        $('#questionStory').textContent = prompts[q.type];
    }
    
    $('#visualQuestion').textContent = q.type === 'visual'
        ? q.object.repeat(Math.min(q.a, 18)) + (q.operation === 'add' ? ' + ' + q.object.repeat(Math.min(q.b, 18)) : q.operation === 'subtract' ? `  − ${q.b}` : q.operation === 'multiply' ? `  × ${q.b}` : `  ÷ ${q.b}`)
        : '';
    
    $('#equation').textContent = ['story', 'truefalse'].includes(q.type) ? '' : q.text + ' = ?';
    
    let target = q.answer;
    if (q.type === 'truefalse') {
        target = q.claim === q.answer ? 1 : 0;
    }
    q.target = target;
    
    const values = new Set([target]);
    let attempts = 0;
    while (values.size < 4 && q.type !== 'truefalse' && attempts < 30) {
        values.add(Math.max(0, target + randomNumber(-8, 8)));
        attempts++;
    }
    for (let fallback = 0; values.size < 4 && fallback < 4; fallback++) values.add(target + fallback + 1);
    const options = q.type === 'truefalse' ? [[1, '¡Sí, es verdad!'], [0, 'No, es una trampa']] : [...values].sort(() => Math.random() - 0.5).map(v => [v, v]);
    const answerIcons = ['🪐', '🚀', '🌟', '🛸'];
    $('#answerOptions').innerHTML = options.map(([value, label], index) => `
        <button type="button" class="answer-option${q.type === 'truefalse' ? ` answer-${value ? 'true' : 'false'}` : ''}" data-value="${value}" data-choice="${index + 1}">
            <span class="answer-icon" aria-hidden="true">${q.type === 'truefalse' ? (value ? '✅' : '⚠️') : answerIcons[index]}</span>
            <span class="answer-label">${escapeHTML(label)}</span>
            <span class="answer-key" aria-hidden="true">${index + 1}</span>
        </button>`).join('');
    
    $$('.answer-option').forEach(button => {
        button.onclick = () => {
            $$('.answer-option').forEach(x => x.classList.remove('selected'));
            button.classList.add('selected');
            selectedAnswer = Number(button.dataset.value);
            if (q.type === 'truefalse') checkAnswer(selectedAnswer);
        };
    });
    
    $('#answerForm').classList.toggle('hidden', q.type === 'truefalse');
    $('#writtenAnswer').value = '';
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#nextQuestion').classList.add('hidden');
    $('#quizBubble').textContent = randomItem(['Tómate tu tiempo.', 'Respira y observa.', 'Piensa paso a paso.', 'Vamos, se puede lograr.']);
    $('#quizMascot').className = 'mascot bouncing';
    $('#writtenAnswer').placeholder = q.type === 'input' ? 'Escribe tu respuesta' : 'O escribe aquí';
    
    const seconds = Math.max(0, toNum($('#timeSelect')?.value, 0));
    $('#timerBox').classList.toggle('hidden', seconds === 0);
    
    if (seconds) {
        let remaining = seconds;
        $('#timerValue').textContent = remaining;
        timerId = setInterval(() => {
            remaining--;
            $('#timerValue').textContent = remaining;
            if (remaining === 15) speak(`Quedan quince segundos, ${currentUser()?.name || 'explorador'}. Respira con calma.`);
            if (remaining <= 0) { clearInterval(timerId); timerId = null; checkAnswer(null); }
        }, 1000);
    }
}

function mathSpeech(text) { return text.replace(/\+/g, ' más ').replace(/−|-/g, ' menos ').replace(/×|\*/g, ' por ').replace(/÷|\//g, ' dividido entre '); }

function checkAnswer(value) {
    if (!quizState || !quizState.question) return;
    const nextButton = $('#nextQuestion');
    if (nextButton && !nextButton.classList.contains('hidden')) return;
    clearInterval(timerId);
    timerId = null;
    unlockAudio();
    
    const q = quizState.question;
    const answered = value !== null && value !== undefined && value !== '';
    const correct = answered && Number(value) === Number(q.target);
    quizState.index++;
    quizState.operationTotals[q.operation]++;
    if (correct) {
        quizState.correct++;
        quizState.operationCorrect[q.operation]++;
        quizState.streak++;
    } else {
        quizState.streak = 0;
    }
    $('#quizStreak').textContent = `✨ ${quizState.streak}`;
    
    const correctLabel = q.type === 'truefalse' ? (q.target ? 'Verdadero' : 'Falso') : q.answer;
    let screenMessage, voiceMessage;
    
    if (correct) {
        const praise = randomItem(praiseMessages);
        screenMessage = `${praise} La respuesta correcta es ${correctLabel}.`;
        voiceMessage = `${praise} ${currentUser()?.name || 'explorador'}. ${q.type === 'truefalse' ? 'Elegiste correctamente' : mathSpeech(q.text) + ' es igual a ' + q.answer}. Ganaste una estrella.`;
        $('#feedback').className = 'feedback good';
        $('#quizMascot').className = 'mascot celebrating';
        $('#quizBubble').textContent = praise;
        playMelody(true);
    } else {
        const support = nextSupportMessage();
        screenMessage = answered ? `Tu respuesta fue ${q.type === 'truefalse' ? (value ? 'Verdadero' : 'Falso') : value}. La correcta es ${correctLabel}. ${support}` : `Se terminó el tiempo. La respuesta correcta es ${correctLabel}. ${support}`;
        voiceMessage = `${support} ${currentUser()?.name || 'explorador'}. La respuesta correcta es ${correctLabel}.`;
        $('#feedback').className = 'feedback bad';
        $('#quizMascot').className = 'mascot thinking';
        $('#quizBubble').textContent = support;
        playMelody(false);
    }
    
    $('#feedback').textContent = screenMessage;
    setTimeout(() => speak(voiceMessage, { rate: correct ? 0.94 : 0.87, pitch: correct ? 1.08 : 1.02 }), 700);
    $('#answerForm').classList.add('hidden');
    
    $$('.answer-option').forEach(button => {
        button.disabled = true;
        const number = Number(button.dataset.value);
        if (number === Number(q.target)) button.classList.add('correct');
        if (answered && number === Number(value) && !correct) button.classList.add('wrong');
    });
    
    $('#nextQuestion').classList.remove('hidden');
    $('#nextQuestion').textContent = quizState.index >= quizState.total ? 'Ver resultados →' : 'Siguiente aventura →';
}

function finishQuiz() {
    const user = currentUser();
    if (!user || !quizState || !quizState.total) return navigate('auth');
    if (!user.progress?.operations) user.progress = normalizeProgress(user.progress);

    const p = user.progress;
    applyDailyReset(user); // make sure the daily goal belongs to today before adding to it

    const elapsed = Math.max(0, Math.round((Date.now() - quizState.started) / 1000));
    const percentage = Math.round(quizState.correct / quizState.total * 100);
    const grade = gradeFromPercentage(percentage);
    const passed = grade >= PASS_GRADE;
    
    if (quizState.mode === 'assessment') {
        p.assessment.attempts++;
        p.assessment.last = percentage;
        p.assessment.best = Math.max(p.assessment.best, percentage);
        p.assessment.lastGrade = grade;
        p.assessment.bestGrade = Math.max(p.assessment.bestGrade, grade);
        p.assessment.completed ||= passed;
    } else {
        p.total = toNum(p.total) + quizState.total;
        p.correct = toNum(p.correct) + quizState.correct;
        p.points = toNum(p.points) + quizState.correct * 12;
        p.stars = toNum(p.stars) + quizState.correct;
        p.todayCorrect = toNum(p.todayCorrect) + quizState.correct;
        p.time = toNum(p.time) + elapsed;
        p.maxLevel = Math.max(toNum(p.maxLevel, 1), toNum($('#levelSelect')?.value, 1));
        p.operations[currentOperation].total = toNum(p.operations[currentOperation].total) + quizState.total;
        p.operations[currentOperation].correct = toNum(p.operations[currentOperation].correct) + quizState.correct;
        p.operations[currentOperation].grade = grade;
        p.operations[currentOperation].bestGrade = Math.max(p.operations[currentOperation].bestGrade, grade);
        if (passed) p.operations[currentOperation].completed = true;
        if (percentage === 100) p.perfectMissions = toNum(p.perfectMissions) + 1;
    }
    
    saveDB();
    
    const message = quizState.mode === 'assessment'
        ? passed
            ? `¡Unidad final aprobada, ${user.name}! Lograste ${percentage}% y una nota de ${grade.toFixed(1)}/5.0 en las cuatro operaciones.`
            : `Obtuviste ${percentage}% y una nota de ${grade.toFixed(1)}/5.0. Necesitas una nota mínima de ${PASS_GRADE.toFixed(1)}/5.0 para aprobar. Puedes volver a practicar y repetir la evaluación.`
        : passed
            ? `¡Unidad aprobada, ${user.name}! Lograste ${percentage}% y una nota de ${grade.toFixed(1)}/5.0. Ya puedes continuar con la siguiente misión.`
            : `Lograste ${percentage}% y una nota de ${grade.toFixed(1)}/5.0. Necesitas una nota mínima de ${PASS_GRADE.toFixed(1)}/5.0 para aprobar esta unidad. Practica y vuelve a intentarlo.`;
    $('#summaryTitle').textContent = quizState.mode === 'assessment'
        ? (passed ? '¡Evaluación aprobada!' : 'Sigue entrenando')
        : (passed ? '¡Unidad aprobada!' : '¡Cada intento te acerca!');
    $('#repeatMission').textContent = quizState.mode === 'assessment' ? 'Repetir evaluación' : 'Repetir misión';
    $('#summaryMessage').textContent = message;
    const summaryValues = [
        [`${quizState.correct}/${quizState.total}`, 'aciertos'], [percentage + '%', 'precisión'],
        [grade.toFixed(1) + '/5.0', 'nota']
    ];
    if (quizState.mode === 'assessment') {
        summaryValues.push(['4', 'operaciones'], [Math.round(elapsed / 60) + ' min', 'tiempo']);
    } else {
        summaryValues.push(['+' + quizState.correct * 12, 'puntos'], ['+' + quizState.correct, 'estrellas'], [Math.round(elapsed / 60) + ' min', 'tiempo']);
    }
    $('#summaryStats').innerHTML = statCards(summaryValues);
    const breakdown = $('#assessmentBreakdown');
    if (breakdown) {
        breakdown.classList.toggle('hidden', quizState.mode !== 'assessment');
        breakdown.innerHTML = quizState.mode === 'assessment'
            ? `<h3>Resultados por operación</h3><div class="assessment-breakdown-grid">${operationKeys.map(operation => {
                const total = quizState.operationTotals[operation];
                const correct = quizState.operationCorrect[operation];
                const operationGrade = gradeFromPercentage(total ? Math.round(correct / total * 100) : 0);
                return `<article><span>${escapeHTML(operationInfo[operation].name)}</span><b>${correct}/${total}</b><small>Nota ${operationGrade.toFixed(1)}/5.0</small></article>`;
            }).join('')}</div>`
            : '';
    }
    navigate('summary');
    setTimeout(() => speak(message), 300);
}

// ==========================================
// 7. PREMIUM CONTENT
// ==========================================
const routes = {
    add: ['Juntar objetos', 'Recta numérica', 'Sumas con llevadas', 'Compras y totales'],
    subtract: ['Quitar objetos', 'Comparar cantidades', 'Restas con préstamo', 'Cambio y diferencias'],
    multiply: ['Grupos iguales', 'Suma repetida', 'Tablas y patrones', 'Cantidades por grupos'],
    divide: ['Reparto equitativo', 'Relación con multiplicación', 'División exacta', 'Distribución real']
};

function newPuzzle() {
    const puzzle = randomItem([
        ['Tres cohetes llevan 4 estrellas cada uno. ¿Cuántas estrellas transportan?', 12, [8, 12, 16, 20]],
        ['18 cristales se reparten entre 3 astronautas. ¿Cuántos recibe cada uno?', 6, [5, 6, 7, 9]],
        ['Completa el patrón: 2, 4, 6, 8, ...', 10, [9, 10, 11, 12]]
    ]);
    $('#puzzleQuestion').textContent = puzzle[0];
    $('#puzzleOptions').innerHTML = puzzle[2].map(v => `<button type="button" class="answer-option">${v}</button>`).join('');

    let answered = false;
    $$('#puzzleOptions .answer-option').forEach(button => {
        button.onclick = () => {
            if (answered) return; // one attempt per puzzle: no farming by clicking repeatedly
            answered = true;

            const correct = Number(button.textContent) === puzzle[1];
            $$('#puzzleOptions .answer-option').forEach(option => {
                option.disabled = true;
                if (Number(option.textContent) === puzzle[1]) option.classList.add('correct');
            });
            if (!correct) button.classList.add('wrong');

            playMelody(correct);
            speak(correct ? '¡Rompecabezas resuelto!' : nextSupportMessage());

            const user = currentUser();
            if (correct && user?.progress) {
                user.progress.puzzles = toNum(user.progress.puzzles) + 1;
                saveDB();
            }
        };
    });
}

function newReal() {
    const problem = randomItem([
        ['Compras 3 jugos de $2.000. ¿Cuánto pagas?', 6000, [4000, 5000, 6000, 8000]],
        ['Tienes $10.000 y gastas $3.500. ¿Cuánto queda?', 6500, [5500, 6000, 6500, 7000]],
        ['12 galletas entre 4 personas. ¿Cuántas recibe cada una?', 3, [2, 3, 4, 6]]
    ]);
    $('#realQuestion').textContent = problem[0];
    $('#realOptions').innerHTML = problem[2].map(v => `<button type="button" class="answer-option">${v.toLocaleString('es-CO')}</button>`).join('');

    let answered = false;
    $$('#realOptions .answer-option').forEach((button, index) => {
        button.onclick = () => {
            if (answered) return; // one attempt per problem: no farming by clicking repeatedly
            answered = true;

            const correct = problem[2][index] === problem[1];
            $$('#realOptions .answer-option').forEach((option, i) => {
                option.disabled = true;
                if (problem[2][i] === problem[1]) option.classList.add('correct');
            });
            if (!correct) button.classList.add('wrong');

            playMelody(correct);
            speak(correct ? '¡Aplicaste las matemáticas a la vida real!' : nextSupportMessage());

            const user = currentUser();
            if (correct && user?.progress) {
                user.progress.realProblems = toNum(user.progress.realProblems) + 1;
                saveDB();
            }
        };
    });
}

// ==========================================
// 8. EVENT LISTENERS SETUP
// ==========================================
function setupApp() {
    const authScreen = $('#auth');
    const lamp = $('#loginLamp');
    const cord = $('#lampCord');
    const logoSwitch = $('#logoLampSwitch');
    let cordReleaseTimer = null;
    const toggleLoginLamp = () => {
        const lampOn = !authScreen.classList.contains('lamp-off');
        const nextOn = !lampOn;
        authScreen.classList.toggle('lamp-off', !nextOn);
        authScreen.classList.toggle('lamp-on', nextOn);
        authScreen.dataset.lamp = nextOn ? 'on' : 'off';
        const nextLabel = nextOn ? 'Apagar la lámpara' : 'Encender la lámpara';
        lamp?.setAttribute('aria-label', nextLabel);
        lamp?.setAttribute('aria-pressed', String(nextOn));
        logoSwitch?.setAttribute('aria-pressed', String(nextOn));
    };
    lamp?.addEventListener('click', toggleLoginLamp);
    cord?.addEventListener('click', toggleLoginLamp);
    cord?.addEventListener('pointerdown', event => {
        cord.setPointerCapture?.(event.pointerId);
        clearTimeout(cordReleaseTimer);
        cord.classList.add('pulling');
    });
    cord?.addEventListener('pointerup', event => {
        cord.releasePointerCapture?.(event.pointerId);
        clearTimeout(cordReleaseTimer);
        cordReleaseTimer = setTimeout(() => cord.classList.remove('pulling'), 180);
    });
    cord?.addEventListener('lostpointercapture', () => {
        clearTimeout(cordReleaseTimer);
        cordReleaseTimer = setTimeout(() => cord.classList.remove('pulling'), 180);
    });
    cord?.addEventListener('pointercancel', () => cord.classList.remove('pulling'));
    logoSwitch?.addEventListener('click', toggleLoginLamp);
    logoSwitch?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleLoginLamp();
        }
    });

    const mathSubjectButton = $('#mathSubjectButton');
    const englishSubjectButton = $('#englishSubjectButton');
    const freeMathContent = $('#freeMathContent');
    const englishSubjectNotice = $('#englishSubjectNotice');
    mathSubjectButton?.addEventListener('click', () => {
        freeMathContent?.classList.remove('hidden');
        englishSubjectNotice?.classList.add('hidden');
        mathSubjectButton.setAttribute('aria-expanded', 'true');
        mathSubjectButton.setAttribute('aria-pressed', 'true');
        englishSubjectButton?.setAttribute('aria-expanded', 'false');
        englishSubjectButton?.setAttribute('aria-pressed', 'false');
        mathSubjectButton.classList.add('selected');
        englishSubjectButton?.classList.remove('selected');
    });
    englishSubjectButton?.addEventListener('click', () => {
        freeMathContent?.classList.add('hidden');
        englishSubjectNotice?.classList.remove('hidden');
        mathSubjectButton?.setAttribute('aria-expanded', 'false');
        mathSubjectButton?.setAttribute('aria-pressed', 'false');
        englishSubjectButton.setAttribute('aria-expanded', 'true');
        englishSubjectButton.setAttribute('aria-pressed', 'true');
        mathSubjectButton?.classList.remove('selected');
        englishSubjectButton.classList.add('selected');
    });

    // Auth Tabs
    $$('[data-auth]').forEach(button => button.onclick = () => {
        $$('[data-auth]').forEach(x => x.classList.toggle('active', x === button));
        $$('.form').forEach(x => x.classList.add('hidden'));
        $('#' + button.dataset.auth + 'Form')?.classList.remove('hidden');
        authMessage('');
    });
    
    $('#registerRole').onchange = () => $('#adminCodeField')?.classList.toggle('hidden', $('#registerRole').value !== 'admin');

    $$('#logoGlowOptions [data-glow]').forEach(button => button.onclick = () => saveLogoSettings({ glow: button.dataset.glow }));
    $$('#logoBackgroundOptions [data-background]').forEach(button => button.onclick = () => saveLogoSettings({ background: button.dataset.background }));
    $$('#logoObjectOptions [data-object]').forEach(button => button.onclick = () => {
        const user = currentUser();
        if (!user) return;
        const objects = [...(user.settings?.logo?.objects || defaultLogoSettings.objects)];
        objects[Number(button.dataset.slot)] = button.dataset.object;
        saveLogoSettings({ objects });
    });
    $$('#logoSuitOptions [data-suit]').forEach(button => button.onclick = () => saveLogoSettings({ suit: button.dataset.suit }));
    
    // Auth Forms
    $('#loginForm').onsubmit = e => {
        e.preventDefault(); unlockAudio();
        const email = $('#loginEmail').value.trim().toLowerCase(), password = $('#loginPassword').value;
        const user = db.users.find(u => u.email === email && u.password === password);
        if (!user) return authMessage('Correo o contraseña incorrectos.', 'bad');
        startUserSession(user);
    };
    
    $('#registerForm').onsubmit = e => {
        e.preventDefault();
        const role = $('#registerRole').value;
        if (role === 'admin' && $('#adminCode').value !== ADMIN_CODE) return $('#authMessage').textContent = 'Código privado incorrecto.';
        const email = $('#registerEmail').value.trim().toLowerCase();
        if (!email) return $('#authMessage').textContent = 'Escribe un correo válido.';
        if (db.users.some(u => u.email === email)) return $('#authMessage').textContent = 'Ese correo ya existe.';
        const user = {
            id: uid(),
            name: $('#registerName').value.trim() || 'Explorador',
            email,
            password: $('#registerPassword').value,
            role,
            secret: $('#registerSecret').value.trim().toLowerCase(),
            premium: false,
            settings: { audio: true },
            progress: role === 'student' ? blankProgress() : {}
        };
        db.users.push(user); saveDB();
        userId = user.id;
        sessionSet('ttl_ultimate_user', user.id);
        applyDailyReset(user);
        navigate('home');
        setTimeout(greeting, 300);
    };
    
    $('#recoverForm').onsubmit = e => {
        e.preventDefault();
        const newPass = $('#recoverPassword').value;
        if (newPass.length < 6) return authMessage('La contraseña debe tener al menos 6 caracteres.', 'bad');
        const user = db.users.find(u => u.email === $('#recoverEmail').value.trim().toLowerCase() && u.secret === $('#recoverSecret').value.trim().toLowerCase());
        if (!user) return authMessage('Los datos no coinciden.', 'bad');
        user.password = newPass; saveDB(); toast('Contraseña actualizada');
        $('#recoverForm').reset();
    };

    // Navigation
    $$('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav));
    
    $('#logoutButton').onclick = () => {
        if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
        clearInterval(timerId); timerId = null;
        userId = null;
        sessionRemove('ttl_ultimate_user');
        $('#auth')?.classList.add('lamp-off');
        $('#auth')?.classList.remove('lamp-on');
        if ($('#auth')) $('#auth').dataset.lamp = 'off';
        $('#loginLamp')?.setAttribute('aria-pressed', 'false');
        $('#loginLamp')?.setAttribute('aria-label', 'Encender la lámpara');
        $('#logoLampSwitch')?.setAttribute('aria-pressed', 'false');
        $('#lampCord')?.classList.remove('pulling');
        $('#auth .auth-panel')?.classList.remove('panel-reveal', 'panel-hide');
        navigate('auth');
    };
    
    $('#audioButton').onclick = () => {
        const user = currentUser();
        if (!user) return;
        unlockAudio();
        user.settings.audio = !user.settings.audio;
        saveDB();
        $('#audioButton').textContent = user.settings.audio ? '🔊' : '🔇';
        if (user.settings.audio) { playMelody(true); setTimeout(greeting, 350); }
        else if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
    };
    
    $('#greetingButton').onclick = () => { unlockAudio(); greeting(); };

    const videoVolume = $('#videoVolume');
    const videoMuteButton = $('#videoMuteButton');
    const videoVolumeValue = $('#videoVolumeValue');
    const updateVideoAudioControls = video => {
        if (!video) return;
        const isMuted = video.muted || video.volume === 0;
        videoMuteButton.textContent = isMuted ? '🔇' : '🔊';
        videoMuteButton.setAttribute('aria-label', isMuted ? 'Activar sonido del video' : 'Silenciar video');
        videoMuteButton.setAttribute('aria-pressed', String(video.muted));
        videoVolumeValue.textContent = `${Math.round(video.volume * 100)}%`;
    };

    videoVolume?.addEventListener('input', () => {
        const video = $('#operationVideoFrame video');
        if (!video) return;
        video.volume = Number(videoVolume.value);
        if (video.volume > 0) video.muted = false;
        updateVideoAudioControls(video);
    });

    videoMuteButton?.addEventListener('click', () => {
        const video = $('#operationVideoFrame video');
        if (!video) return;
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) {
            video.volume = 1;
            videoVolume.value = '1';
        }
        updateVideoAudioControls(video);
    });

    // Operations
    $$('[data-operation]').forEach(button => button.onclick = () => {
        const requestedOperation = button.dataset.operation;
        const user = currentUser();
        if (!user?.premium) {
            toast('El curso completo de Matemáticas requiere acceso Premium.');
            navigate('premium');
            return;
        }
        const unlockedIndex = operationKeys.findIndex(operation => user?.progress?.operations?.[operation]?.completed !== true);
        const requestedIndex = operationKeys.indexOf(requestedOperation);
        if (!user || user.role !== 'student' || !user.progress?.operations || requestedIndex < 0
            || (!user.progress.operations[requestedOperation]?.completed && requestedIndex !== unlockedIndex)) {
            toast('Completa y aprueba la unidad anterior para continuar.');
            renderHome();
            return;
        }
        currentOperation = requestedOperation;
        const info = operationInfo[currentOperation];
        if (!info) return;
        const title = $('#operationTitle');
        if (title) title.textContent = info.name;
        const desc = $('#operationDescription');
        if (desc) desc.textContent = info.description;
        const tip = $('#operationTip');
        if (tip) tip.textContent = info.tip;
        // El vídeo se ve de inmediato, sin tener que entrar en la guía
        showOperationVideo(currentOperation, '#operationVideoFrame');
        navigate('operation');
    });

    // Quiz Controls
    $('#practiceButton').onclick = startQuiz;
    $('#evaluationButton').onclick = () => startQuiz('assessment');
    $('#repeatMission').onclick = () => startQuiz(lastQuizMode);
    $('#quitQuiz').onclick = () => { clearInterval(timerId); speechSynthesis.cancel(); navigate('home'); };
    
    $('#answerForm').onsubmit = e => {
        e.preventDefault(); unlockAudio();
        const typed = $('#writtenAnswer').value.trim();
        const value = typed !== '' ? Number(typed) : selectedAnswer;
        if (value === null || value === undefined || Number.isNaN(value)) {
            const message = `Selecciona o escribe una respuesta, ${currentUser().name}. Tómate tu tiempo.`;
            $('#feedback').textContent = message; $('#feedback').className = 'feedback bad'; speak(message); return;
        }
        checkAnswer(value);
    };
    
    $('#nextQuestion').onclick = () => { speechSynthesis.cancel(); quizState.index >= quizState.total ? finishQuiz() : nextQuizQuestion(); };

    // Dashboard Excel
    $('#excelButton').onclick = () => {
        const rows = [['Estudiante', 'Correo', 'Estado académico', 'Precisión', 'Unidades aprobadas', 'Nota suma', 'Nota resta', 'Nota multiplicación', 'Nota división', 'Nota evaluación final', 'Aciertos', 'Ejercicios', 'Nivel', 'Racha', 'Minutos'], ...studentUsers().map(user => { const p = normalizeProgress(user.progress); return [user.name, user.email, forecast(p), p.total ? Math.round(p.correct / p.total * 100) + '%' : '0%', operationKeys.filter(operation => p.operations[operation].completed).length + Number(p.assessment.completed), p.operations.add.grade ?? '', p.operations.subtract.grade ?? '', p.operations.multiply.grade ?? '', p.operations.divide.grade ?? '', p.assessment.attempts ? p.assessment.lastGrade ?? '' : '', p.correct, p.total, p.maxLevel, p.dailyStreak, Math.round(p.time / 60)]; })];
        const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${rows.map((row, index) => `<tr>${row.map(value => `<${index ? 'td' : 'th'}>${escapeHTML(value)}</${index ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></body></html>`;
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' })); link.download = 'reporte-estudiantes-notas.xls'; link.click(); URL.revokeObjectURL(link.href);
    };

    // Premium Features
    $('#paymentForm').onsubmit = e => {
        e.preventDefault();
        const user = currentUser();
        if (!user) return;

        const reference = $('#paymentReference').value.trim();
        const amount = toNum($('#paymentAmount').value, 0);
        const email = $('#paymentEmail').value.trim().toLowerCase();

        if (!reference) return toast('Escribe la referencia del comprobante.');
        if (amount <= 0) return toast('Ingresa el valor enviado en COP.');
        if (db.payments.some(p => p.reference === reference)) return toast('La referencia ya fue registrada');

        const nequi = $('#paymentNequi').value || NEQUI_NUMBER;
        db.payments.push({ id: uid(), userId: user.id, email, reference, amount, nequi, status: 'pending' });
        saveDB(); toast('Solicitud enviada para verificación'); e.target.reset();
        $('#paymentEmail').value = user.email;
    };
    
    $$('[data-route]').forEach(button => button.onclick = () => {
        const key = button.dataset.route; const info = operationInfo[key];
        $('#routeContent').innerHTML = `<p class="eyebrow">RUTA DE PRÁCTICA GRATUITA</p><h2>${info.name}</h2><p>${info.description}</p>${routes[key].map((stage, index) => `<section class="panel"><h3>Etapa ${index + 1}: ${stage}</h3><p>${['Representa la operación con objetos y dibujos.', 'Practica con ejemplos guiados y comprueba cada paso.', 'Resuelve retos progresivos con retroalimentación.', 'Aplica lo aprendido en situaciones de la vida real.'][index]}</p></section>`).join('')}`;
        navigate('route');
    });
    
    $('#newPuzzle').onclick = newPuzzle;
    $('#newRealQuestion').onclick = newReal;
    setupGoogleAuth();
    window.addEventListener('google-ready', setupGoogleAuth, { once: true });
    applyLogoSettings(currentUser()?.settings?.logo);
    setupRevealAnimations();
}

// ==========================================
// 9. INITIALIZE
// ==========================================
loadDB();
const savedSession = sessionGet('ttl_ultimate_user');
if (savedSession && db.users.some(u => u.id === savedSession)) {
    userId = savedSession;
    applyDailyReset(currentUser());
    setupApp();
    navigate('home');
} else {
    sessionRemove('ttl_ultimate_user');
    setupApp();
    navigate('auth');
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}
