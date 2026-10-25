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

const studentMusicTracks = [
    'aberrantrealities-a-full-day-of-play-562091.mp3',
    'good_b_music-cheerful-cinematic-song-without-solo-guitar-10709.mp3',
    'instrumentalmusic-cheerful-1-439080.mp3',
    'instrumentalmusic-ix27m-happy-439741.mp3',
    'sub_clair-kids-581150.mp3',
    'the_mountain-kid-action-375989.mp3'
];
let studentMusicQueue = [];
let currentStudentMusicTrack = '';
let studentMusicEnabled = true;
let studentMusicErrorShown = false;

function isStudentSessionActive() {
    return currentUser()?.role === 'student' && $('#quiz')?.classList.contains('active');
}

function syncStudentMusicButton() {
    const button = $('#musicButton');
    if (!button) return;
    button.textContent = studentMusicEnabled ? '🎵' : '🔇';
    button.setAttribute('aria-pressed', String(studentMusicEnabled));
    button.setAttribute('aria-label', studentMusicEnabled ? 'Silenciar música de fondo' : 'Activar música de fondo');
    button.title = studentMusicEnabled ? 'Silenciar música de fondo' : 'Activar música de fondo';
}

function nextStudentMusicTrack() {
    if (!studentMusicQueue.length) {
        studentMusicQueue = shuffle(studentMusicTracks);
        if (studentMusicQueue.length > 1 && studentMusicQueue[0] === currentStudentMusicTrack) {
            [studentMusicQueue[0], studentMusicQueue[1]] = [studentMusicQueue[1], studentMusicQueue[0]];
        }
    }
    currentStudentMusicTrack = studentMusicQueue.shift();
    return currentStudentMusicTrack;
}

function playNextStudentMusicTrack() {
    const audio = $('#studentMusic');
    if (!audio || !studentMusicEnabled || !isStudentSessionActive()) return;
    audio.pause();
    audio.src = appAsset(`music/questions/${encodeURIComponent(nextStudentMusicTrack())}`);
    audio.volume = 0.22;
    audio.load();
    const playback = audio.play();
    if (playback?.then) playback.then(() => { studentMusicErrorShown = false; }).catch(showStudentMusicError);
}

function startStudentMusic() {
    const audio = $('#studentMusic');
    if (!audio || !studentMusicEnabled || !isStudentSessionActive()) return;
    if (!audio.getAttribute('src') || audio.ended) {
        playNextStudentMusicTrack();
        return;
    }
    const playback = audio.play();
    if (playback?.then) playback.then(() => { studentMusicErrorShown = false; }).catch(showStudentMusicError);
}

function showStudentMusicError(error) {
    if (studentMusicErrorShown) return;
    studentMusicErrorShown = true;
    toast(error?.name === 'NotAllowedError'
        ? 'Pulsa el botón 🎵 para iniciar la música.'
        : 'No se pudo cargar una pista de música. Recarga la página e inténtalo de nuevo.');
    console.warn('No se pudo reproducir la música de las preguntas.', error);
}

function stopStudentMusic(reset = false) {
    const audio = $('#studentMusic');
    if (!audio) return;
    audio.pause();
    if (reset) {
        audio.removeAttribute('src');
        audio.load();
        currentStudentMusicTrack = '';
        studentMusicQueue = [];
    }
}

$('#studentMusic')?.addEventListener('ended', playNextStudentMusicTrack);
document.addEventListener('pointerdown', event => {
    if (event.target instanceof Element && event.target.closest('#musicButton')) return;
    if (isStudentSessionActive() && studentMusicEnabled) startStudentMusic();
}, { capture: true });
document.addEventListener('keydown', event => {
    if (event.target instanceof Element && event.target.closest('#musicButton')) return;
    if (isStudentSessionActive() && studentMusicEnabled) startStudentMusic();
}, { capture: true });

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
    $$('video, audio').forEach(media => {
        if (media.id !== 'studentMusic') media.pause();
    });
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

    const studentQuestionScreen = id === 'quiz' && currentUser()?.role === 'student';
    $('#musicButton')?.classList.toggle('hidden', !studentQuestionScreen);
    if (studentQuestionScreen) startStudentMusic();
    else stopStudentMusic(id === 'auth');

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
const authClient = window.TTLAuthClient;
const localDemoMode = authClient?.isLocalDemoAllowed(location) === true;
const MATH_TUTOR_API_URL = document.querySelector('meta[name="ttl-math-tutor-api"]')?.content.trim() || '';
const ADMIN_CODE = 'TTL-DIRECCION-2026';
const NEQUI_NUMBER = '3104337927';
const NEQUI_NUMBERS = ['3104337927', '3245957915', '3135595448'];
const GOOGLE_CLIENT_ID = window.TTL_GOOGLE_CLIENT_ID || '';
let serverAuthEnabled = false;
let serverAuthUser = null;
let serverProgressSnapshot = null;
let serverAppUser = null;
let serverAttempt = null;
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
const studentMotivations = [
    '¡Tú puedes, explorador! Cada reto te acerca a una nueva estrella.',
    '¡Qué emoción! Hoy tienes una nueva oportunidad para aprender algo genial.',
    '¡Sigue intentando! Tu esfuerzo hace crecer tu súper mente.',
    '¡Vamos con toda! Cada problema es una misión que puedes conquistar.',
    '¡Eres brillante! Un paso a la vez y llegarás muy lejos.',
    '¡No te rindas! Los grandes logros empiezan con un intento.',
    '¡Prepárate para despegar! Hoy puedes aprender y divertirte a la vez.',
    '¡Cada respuesta cuenta! Estás construyendo algo increíble.',
    '¡La aventura empieza ahora! Confía en ti y prueba ese reto.',
    '¡Tu curiosidad es un superpoder! Vamos a descubrir algo nuevo.'
];

const GAMIFICATION_RULES = Object.freeze({
    xpPerCorrectAnswer: 5,
    xpPerPracticeSession: 10,
    xpPerDailyMission: 15,
    xpPerBadge: 25,
    firstLevelThreshold: 100,
    levelThresholdStep: 25,
    dailyCorrectTarget: 3,
    dailyOperationTarget: 2,
    operationBadgeTarget: 10
});
const DAILY_OPERATION_KEYS = ['add', 'subtract', 'multiply', 'divide'];
const LEARNING_DIAGNOSTIC_RULES = Object.freeze({
    minimumAccuracyAttempts: 5,
    strengthAttempts: 8,
    strengthAccuracy: 0.8,
    recurringErrorsWindow: 5,
    recurringErrorsTarget: 2,
    trendWindow: 6,
    trendGroupSize: 3,
    trendMinimumChange: 0.2,
    historyLimit: 60
});
const OPERATION_LEARNING_GUIDES = Object.freeze({
    add: { skill: 'composición y descomposición de cantidades', activity: 'Practica sumas con objetos y pasos pequeños.' },
    subtract: { skill: 'diferencias y comprobación de la resta', activity: 'Practica cuánto queda y comprueba la diferencia.' },
    multiply: { skill: 'grupos iguales y sumas repetidas', activity: 'Practica agrupaciones iguales antes de calcular.' },
    divide: { skill: 'reparto equitativo y relación con la multiplicación', activity: 'Practica repartiendo objetos en grupos iguales.' }
});
const GAMIFICATION_BADGES = [
    { id: 'first-correct', icon: '🌟', title: 'Primera respuesta correcta', description: 'Resuelve correctamente tu primer reto.', category: 'explore', value: p => p.gamification.lifetime.correctAnswers, target: 1 },
    { id: 'first-session', icon: '🚀', title: 'Primera misión completada', description: 'Completa una sesión regular de práctica.', category: 'explore', value: p => p.gamification.lifetime.sessionsCompleted, target: 1 },
    { id: 'sum-explorer', icon: '➕', title: 'Explorador de las sumas', description: `Resuelve ${GAMIFICATION_RULES.operationBadgeTarget} retos de suma.`, category: 'operations', value: p => p.gamification.lifetime.operationCorrect.add, target: GAMIFICATION_RULES.operationBadgeTarget },
    { id: 'subtraction-specialist', icon: '➖', title: 'Especialista en restas', description: `Resuelve ${GAMIFICATION_RULES.operationBadgeTarget} retos de resta.`, category: 'operations', value: p => p.gamification.lifetime.operationCorrect.subtract, target: GAMIFICATION_RULES.operationBadgeTarget },
    { id: 'multiplication-master', icon: '✖️', title: 'Maestro de la multiplicación', description: `Resuelve ${GAMIFICATION_RULES.operationBadgeTarget} retos de multiplicación.`, category: 'operations', value: p => p.gamification.lifetime.operationCorrect.multiply, target: GAMIFICATION_RULES.operationBadgeTarget },
    { id: 'division-expert', icon: '➗', title: 'Experto en división', description: `Resuelve ${GAMIFICATION_RULES.operationBadgeTarget} retos de división.`, category: 'operations', value: p => p.gamification.lifetime.operationCorrect.divide, target: GAMIFICATION_RULES.operationBadgeTarget },
    { id: 'route-complete', icon: '🪐', title: 'Ruta de aprendizaje completada', description: 'Aprueba las cuatro unidades de Matemáticas.', category: 'operations', value: p => DAILY_OPERATION_KEYS.every(operation => p.operations[operation].completed) ? 1 : 0, target: 1 },
    { id: 'daily-constancy', icon: '🔥', title: 'Constancia diaria', description: 'Mantén una racha de aprendizaje de tres días.', category: 'streak', value: p => p.gamification.learningStreak.best, target: 3 },
    { id: 'daily-mission', icon: '🧭', title: 'Misión diaria completada', description: 'Completa una misión diaria de aprendizaje.', category: 'explore', value: p => p.gamification.lifetime.missionsCompleted, target: 1 }
];

const blankGamification = () => ({
    version: 1,
    xp: 0,
    lifetime: {
        correctAnswers: 0,
        operationCorrect: { add: 0, subtract: 0, multiply: 0, divide: 0 },
        sessionsCompleted: 0,
        missionsCompleted: 0
    },
    learningStreak: {
        current: 0,
        best: 0,
        lastActivityDate: null
    },
    daily: {
        date: null,
        correctAnswers: 0,
        operationAnswers: { add: 0, subtract: 0, multiply: 0, divide: 0 },
        puzzlesCorrect: 0,
        realProblemsCorrect: 0,
        sessionsCompleted: 0,
        pendingReviewOperations: [],
        reviewedCount: 0,
        completedMissions: []
    },
    earnedBadges: [],
    rewardClaims: [],
    processedActivities: []
});

const blankLearningProfile = () => ({
    version: 1,
    baseline: Object.fromEntries(DAILY_OPERATION_KEYS.map(operation => [operation, { attempts: 0, correct: 0 }])),
    attempts: []
});

const levelXpThreshold = level => {
    const completedLevels = Math.max(0, Math.floor(level) - 1);
    return GAMIFICATION_RULES.firstLevelThreshold * completedLevels
        + GAMIFICATION_RULES.levelThresholdStep * completedLevels * (completedLevels - 1) / 2;
};

function levelProgress(totalXp) {
    const xp = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, toNum(totalXp)));
    const first = GAMIFICATION_RULES.firstLevelThreshold;
    const step = GAMIFICATION_RULES.levelThresholdStep;
    const offset = first - step / 2;
    const completedLevels = Math.floor((-offset + Math.sqrt(offset ** 2 + 2 * step * xp)) / step);
    const level = completedLevels + 1;
    const currentThreshold = levelXpThreshold(level);
    const nextThreshold = levelXpThreshold(level + 1);
    const progressXp = Math.max(0, xp - currentThreshold);
    const requiredXp = Math.max(1, nextThreshold - currentThreshold);
    return {
        level,
        xp,
        currentThreshold,
        nextThreshold,
        progressXp,
        requiredXp,
        remainingXp: Math.max(0, nextThreshold - xp),
        percentage: Math.min(100, Math.round(progressXp / requiredXp * 100))
    };
}

let db = null;
let userId = null;
let lastCalmMessage = '';
let lastStudentMotivation = '';
const gamificationAnnouncements = new Map();

const blankProgress = () => ({
    points: 0, stars: 0, total: 0, correct: 0, time: 0, maxLevel: 1, 
    dailyStreak: 1, bestStreak: 1, todayCorrect: 0, lastDate: null, 
    perfectMissions: 0, puzzles: 0, realProblems: 0, 
    learningProfile: blankLearningProfile(),
    freeQuestionHistory: { shown: [], answered: [] },
    operations: {
        add: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        subtract: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        multiply: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }, 
        divide: { total: 0, correct: 0, completed: false, grade: null, bestGrade: 0 }
    },
    assessment: { attempts: 0, best: 0, last: 0, lastGrade: null, bestGrade: 0, completed: false },
    gamification: blankGamification()
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
    if (!localDemoMode) return;
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

    db.users.forEach(user => {
        const gamification = user.progress?.gamification;
        if (user.role !== 'student' || !gamification?.migrationPending) return;
        GAMIFICATION_BADGES.forEach(badge => {
            if (toNum(badge.value(user.progress)) >= badge.target) gamification.earnedBadges.push(badge.id);
        });
        gamification.migrationPending = false;
    });

    saveDB();
}

let storageWarned = false;
function saveDB() {
    if (!localDemoMode) return;
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
    if (!localDemoMode) return serverAppUser;
    if (!userId || !db) return null;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
        userId = null;
        sessionRemove('ttl_ultimate_user');
        return null;
    }
    return user;
}

function applyServerProgress(progressResponse) {
    if (!progressResponse?.state || !serverAuthUser) throw new Error('El progreso del servidor no es válido.');
    serverProgressSnapshot = progressResponse;
    const state = progressResponse.state;
    const progress = normalizeProgress({
        ...state,
        operations: state.operations || {},
        assessment: state.assessment || {},
        gamification: { xp: Number(state.xp) || 0 }
    });
    progress.stars = Math.max(0, Math.floor(Number(state.stars) || 0));
    serverAppUser = {
        ...serverAuthUser,
        role: serverAuthUser.role,
        premium: serverAuthUser.premium === true,
        settings: { audio: true, logo: defaultLogoSettings },
        progress
    };
}

function openServerLearningApp() {
    if (!serverAppUser) return;
    setupApp();
    navigate('home');
    $('#serverLogoutButton')?.classList.add('hidden');
}

function lockServerLearningApp(message = 'La sesión ya no está activa. Vuelve a iniciar sesión.') {
    serverAppUser = null;
    serverAuthUser = null;
    serverProgressSnapshot = null;
    serverAttempt = null;
    if (quizState?.serverSide) quizState = null;
    setServerAuthStatus(message);
    $('#serverLogoutButton')?.classList.remove('hidden');
    navigate('auth');
}

async function refreshServerProgress() {
    try {
        const fresh = await authClient.getProgress();
        applyServerProgress(fresh);
        return fresh;
    } catch (error) {
        if (error.status === 401) lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        throw error;
    }
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
    resetMathTutorConversation();
    applyDailyReset(user);
    navigate('home');
    setTimeout(greeting, 300);
}

async function handleGoogleCredential(response) {
    const status = $('#serverAuthStatus');
    if (!serverAuthEnabled || !response?.credential) {
        if (status) status.textContent = 'El acceso seguro no está disponible en este entorno.';
        return;
    }

    if (status) status.textContent = 'Verificando tu cuenta en el servidor…';
    $('#googleButton')?.classList.add('hidden');
    try {
        const result = await authClient.loginWithGoogle(response.credential);
        serverAuthUser = result.user;
        $('#serverLogoutButton')?.classList.remove('hidden');
    } catch (error) {
        if (status) status.textContent = error.status === 401
            ? 'Google no pudo verificar la cuenta. Revisa el acceso e inténtalo de nuevo.'
            : 'No se pudo iniciar sesión en el servidor. No se guardó progreso local; inténtalo más tarde.';
        $('#googleButton')?.classList.remove('hidden');
        return;
    }
    try {
        applyServerProgress(await authClient.getProgress());
        openServerLearningApp();
    } catch {
        if (status) status.textContent = 'La sesión se creó en el servidor, pero no se pudo leer el progreso. Cierra la sesión o inténtalo de nuevo; las actividades siguen bloqueadas.';
    }
}

function setupGoogleAuth() {
    const button = $('#googleButton');
    if (!button) return;
    if (!serverAuthEnabled) {
        button.classList.add('hidden');
        return;
    }
    button.classList.remove('hidden');
    if (!GOOGLE_CLIENT_ID) {
        button.innerHTML = '';
        const status = $('#serverAuthStatus');
        if (status) status.textContent = 'Falta configurar el identificador público de Google en esta página.';
        return;
    }
    if (!window.google?.accounts?.id) {
        const status = $('#serverAuthStatus');
        if (status) status.textContent = 'Google Identity Services no está disponible en esta red.';
        return;
    }
    button.innerHTML = '';
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(button, { type: 'standard', theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill', width: 330 });
}

function setServerAuthStatus(message) {
    const status = $('#serverAuthStatus');
    if (status) status.textContent = message;
}

async function initializeServerAuth() {
    $$('.tabs, #loginForm, #registerForm, #recoverForm').forEach(element => element.classList.add('hidden'));
    $('#serverAuthPanel')?.classList.remove('hidden');
    $('#googleButton')?.classList.add('hidden');
    $('#serverLogoutButton')?.classList.add('hidden');
    $('#serverLogoutButton')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        setServerAuthStatus('Cerrando la sesión en el servidor…');
        try {
            await authClient.logout();
            serverAuthUser = null;
            serverProgressSnapshot = null;
            serverAppUser = null;
            serverAttempt = null;
            if (quizState?.serverSide) quizState = null;
            button.classList.add('hidden');
            button.disabled = false;
            navigate('auth');
            if (serverAuthEnabled) {
                setServerAuthStatus('Sesión cerrada. Puedes volver a ingresar con Google.');
                $('#googleButton')?.classList.remove('hidden');
                setupGoogleAuth();
            } else {
                setServerAuthStatus('Sesión cerrada.');
            }
        } catch {
            button.disabled = false;
            setServerAuthStatus('No se pudo confirmar el cierre de sesión. Conservamos el estado actual; vuelve a intentarlo.');
        }
    });

    if (!authClient) {
        setServerAuthStatus('No se cargó el cliente de autenticación. El acceso local permanece deshabilitado aquí.');
        return;
    }
    let config;
    try {
        config = await authClient.getConfig();
    } catch {
        setServerAuthStatus('El servicio de autenticación no responde. El acceso local permanece deshabilitado aquí. Para pruebas locales explícitas, usa ?ttl-demo=1 en localhost.');
        return;
    }
    if (config.enabled !== true) {
        setServerAuthStatus('La autenticación server-side está deshabilitada o no está configurada. No se leerán ni cambiarán los datos locales. Para pruebas locales explícitas, usa ?ttl-demo=1 en localhost.');
        return;
    }

    setServerAuthStatus('Comprobando la sesión segura…');
    let session;
    try {
        session = await authClient.getSession();
    } catch (error) {
        if (error.status !== 401) {
            setServerAuthStatus('No se pudo comprobar la sesión en el servidor. No se abrió una sesión local.');
            return;
        }
        session = { authenticated: false };
    }
    serverAuthEnabled = true;
    window.addEventListener('google-ready', setupGoogleAuth);
    if (session.authenticated === true) {
        serverAuthUser = session.user;
        try {
            applyServerProgress(await authClient.getProgress());
        } catch {
            setServerAuthStatus('La sesión existe, pero no se pudo leer el progreso del servidor. Las actividades siguen bloqueadas.');
            $('#serverLogoutButton')?.classList.remove('hidden');
            return;
        }
        setServerAuthStatus('Sesión verificada. El progreso y las actividades usarán el servidor.');
        $('#serverLogoutButton')?.classList.remove('hidden');
        openServerLearningApp();
        return;
    }
    setServerAuthStatus('Inicia sesión con Google. El progreso permanecerá bloqueado hasta completar su migración segura al servidor.');
    setupGoogleAuth();
}

// Guarantee a complete, numeric progress object (self-healing for old/corrupt data)
function normalizeGamification(source, progress) {
    const defaults = blankGamification();
    const hasSavedState = source && typeof source === 'object';
    const lifetime = hasSavedState && source.lifetime && typeof source.lifetime === 'object' ? source.lifetime : {};
    const savedDaily = hasSavedState && source.daily && typeof source.daily === 'object' ? source.daily : {};
    const savedStreak = hasSavedState && source.learningStreak && typeof source.learningStreak === 'object' ? source.learningStreak : {};
    const operations = (values, legacyValues = {}) => Object.fromEntries(DAILY_OPERATION_KEYS.map(operation => [
        operation,
        Math.max(0, Math.floor(toNum(values?.[operation], toNum(legacyValues?.[operation]?.correct))))
    ]));
    const safeIds = values => Array.isArray(values)
        ? [...new Set(values.filter(value => typeof value === 'string' && value.length <= 180))]
        : [];
    const dailyDate = /^\d{4}-\d{2}-\d{2}$/.test(savedDaily.date || '') ? savedDaily.date : null;

    return {
        ...defaults,
        version: 1,
        xp: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, toNum(source?.xp))),
        lifetime: {
            correctAnswers: Math.max(0, Math.floor(toNum(lifetime.correctAnswers,
                hasSavedState ? 0 : toNum(progress.correct) + toNum(progress.puzzles) + toNum(progress.realProblems)))),
            operationCorrect: operations(lifetime.operationCorrect, hasSavedState ? {} : progress.operations),
            sessionsCompleted: Math.max(0, Math.floor(toNum(lifetime.sessionsCompleted))),
            missionsCompleted: Math.max(0, Math.floor(toNum(lifetime.missionsCompleted)))
        },
        learningStreak: {
            current: Math.max(0, Math.floor(toNum(savedStreak.current))),
            best: Math.max(0, Math.floor(toNum(savedStreak.best))),
            lastActivityDate: /^\d{4}-\d{2}-\d{2}$/.test(savedStreak.lastActivityDate || '') ? savedStreak.lastActivityDate : null
        },
        daily: {
            ...defaults.daily,
            date: dailyDate,
            correctAnswers: Math.max(0, Math.floor(toNum(savedDaily.correctAnswers))),
            operationAnswers: operations(savedDaily.operationAnswers),
            puzzlesCorrect: Math.max(0, Math.floor(toNum(savedDaily.puzzlesCorrect))),
            realProblemsCorrect: Math.max(0, Math.floor(toNum(savedDaily.realProblemsCorrect))),
            sessionsCompleted: Math.max(0, Math.floor(toNum(savedDaily.sessionsCompleted))),
            pendingReviewOperations: safeIds(savedDaily.pendingReviewOperations)
                .filter(operation => DAILY_OPERATION_KEYS.includes(operation)),
            reviewedCount: Math.max(0, Math.floor(toNum(savedDaily.reviewedCount))),
            completedMissions: safeIds(savedDaily.completedMissions)
        },
        earnedBadges: safeIds(source?.earnedBadges),
        rewardClaims: safeIds(source?.rewardClaims).slice(-3000),
        processedActivities: safeIds(source?.processedActivities).slice(-3000),
        migrationPending: !hasSavedState
    };
}

function normalizeLearningProfile(source, progress) {
    const profile = source && typeof source === 'object' ? source : {};
    const baselineSource = profile.baseline && typeof profile.baseline === 'object'
        ? profile.baseline
        : progress.operations;
    const baseline = Object.fromEntries(DAILY_OPERATION_KEYS.map(operation => {
        const values = baselineSource?.[operation] || {};
        const attempts = Math.max(0, Math.floor(toNum(values.attempts, toNum(values.total))));
        const correct = Math.min(attempts, Math.max(0, Math.floor(toNum(values.correct))));
        return [operation, { attempts, correct }];
    }));
    const attempts = (Array.isArray(profile.attempts) ? profile.attempts : [])
        .filter(item => item && typeof item === 'object'
            && typeof item.id === 'string'
            && DAILY_OPERATION_KEYS.includes(item.operation))
        .map(item => ({
            id: item.id.slice(0, 180),
            date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : todayISO(),
            operation: item.operation,
            correct: item.correct === true,
            source: ['quiz', 'puzzle', 'real-problem'].includes(item.source) ? item.source : 'quiz',
            level: Math.min(3, Math.max(1, Math.floor(toNum(item.level, 1)))),
            expression: typeof item.expression === 'string' ? item.expression.slice(0, 120) : '',
            studentAnswer: typeof item.studentAnswer === 'string' ? item.studentAnswer.slice(0, 40) : '',
            correctAnswer: typeof item.correctAnswer === 'string' ? item.correctAnswer.slice(0, 40) : '',
            reviewedAt: /^\d{4}-\d{2}-\d{2}$/.test(item.reviewedAt || '') ? item.reviewedAt : null
        }))
        .slice(-LEARNING_DIAGNOSTIC_RULES.historyLimit);
    return { version: 1, baseline, attempts };
}

function normalizeProgress(progress) {
    const base = blankProgress();
    if (!progress || typeof progress !== 'object') return base;

    // Preserve unknown historical fields (including archived subject data) during migrations.
    const merged = { ...progress, ...base };
    for (const key of Object.keys(base)) {
        if (key === 'operations' || key === 'lastDate' || key === 'assessment'
            || key === 'gamification' || key === 'learningProfile') continue;
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
    merged.gamification = normalizeGamification(progress.gamification, merged);
    merged.learningProfile = normalizeLearningProfile(progress.learningProfile, merged);
    const questionHistory = progress.freeQuestionHistory && typeof progress.freeQuestionHistory === 'object'
        ? progress.freeQuestionHistory : {};
    const normalizeQuestionIds = values => Array.isArray(values)
        ? [...new Set(values.filter(value => typeof value === 'string' && value.length <= 180))]
        : [];
    merged.freeQuestionHistory = {
        shown: normalizeQuestionIds(questionHistory.shown),
        answered: normalizeQuestionIds(questionHistory.answered)
    };
    return merged;
}

function resetDailyMissions(user) {
    if (!user?.progress?.gamification) return false;
    const daily = user.progress.gamification.daily;
    const today = todayISO();
    if (daily.date === today) return false;
    user.progress.gamification.daily = {
        ...blankGamification().daily,
        date: today
    };
    return true;
}

function xpLevelUpMessage(previousLevel, nextLevel) {
    if (nextLevel <= previousLevel) return [];
    const messages = [
        '¡Nivel nuevo desbloqueado! Cosmo celebra tu esfuerzo.',
        '¡Subiste de nivel! Cada práctica te lleva más lejos.',
        '¡Despegaste al siguiente nivel con tus aprendizajes!'
    ];
    return [`${randomItem(messages)} Ahora estás en el nivel ${nextLevel}.`];
}

function awardExperience(user, amount, claimId) {
    const gamification = user.progress.gamification;
    if (gamification.rewardClaims.includes(claimId)) return [];
    const before = levelProgress(gamification.xp).level;
    gamification.rewardClaims.push(claimId);
    if (gamification.rewardClaims.length > 3000) gamification.rewardClaims.splice(0, gamification.rewardClaims.length - 3000);
    gamification.xp = Math.min(Number.MAX_SAFE_INTEGER, gamification.xp + amount);
    const after = levelProgress(gamification.xp).level;
    const amountMessage = `Ganaste ${amount} XP.`;
    return [amountMessage, ...xpLevelUpMessage(before, after)];
}

function dailyMissionProgress(user, missionId) {
    const daily = user.progress.gamification.daily;
    if (missionId === 'correct-answers') return daily.correctAnswers;
    if (missionId === 'operation-focus') return Math.max(...DAILY_OPERATION_KEYS.map(operation => daily.operationAnswers[operation]));
    if (missionId === 'practice-session') return daily.sessionsCompleted;
    if (missionId === 'free-challenges') return Math.min(daily.puzzlesCorrect, 1) + Math.min(daily.realProblemsCorrect, 1);
    if (missionId === 'review-answer') return daily.reviewedCount;
    return 0;
}

function dailyMissionCatalog(user) {
    const missions = [
        { id: 'correct-answers', title: 'Aciertos estelares', description: `Resuelve ${GAMIFICATION_RULES.dailyCorrectTarget} ejercicios correctamente.`, target: GAMIFICATION_RULES.dailyCorrectTarget },
        { id: 'operation-focus', title: 'Enfócate en una operación', description: `Resuelve ${GAMIFICATION_RULES.dailyOperationTarget} retos de la misma operación.`, target: GAMIFICATION_RULES.dailyOperationTarget },
        user.premium
            ? { id: 'practice-session', title: 'Completa una sesión', description: 'Termina una sesión de práctica regular.', target: 1 }
            : { id: 'free-challenges', title: 'Explora dos tipos de reto', description: 'Resuelve un puzle y un reto cotidiano.', target: 2 }
    ];
    const daily = user.progress.gamification.daily;
    if (daily.pendingReviewOperations.length || daily.reviewedCount > 0 || daily.completedMissions.includes('review-answer')) {
        missions.push({
            id: 'review-answer',
            title: 'Revisa y vuelve a intentar',
            description: 'Después de un error, resuelve un nuevo reto de esa operación.',
            target: 1
        });
    }
    return missions.map(mission => ({
        ...mission,
        progress: Math.min(mission.target, dailyMissionProgress(user, mission.id)),
        complete: daily.completedMissions.includes(mission.id)
    }));
}

function checkDailyMissionRewards(user) {
    const daily = user.progress.gamification.daily;
    const messages = [];
    dailyMissionCatalog(user).forEach(mission => {
        if (mission.progress < mission.target || daily.completedMissions.includes(mission.id)) return;
        const claimId = `mission:${daily.date}:${mission.id}`;
        if (user.progress.gamification.rewardClaims.includes(claimId)) {
            daily.completedMissions.push(mission.id);
            return;
        }
        daily.completedMissions.push(mission.id);
        user.progress.gamification.lifetime.missionsCompleted++;
        const rewardMessages = awardExperience(user, GAMIFICATION_RULES.xpPerDailyMission, claimId);
        const praises = ['¡Misión diaria completada!', '¡Objetivo del día conseguido!', '¡Una misión más en tu bitácora!'];
        messages.push(`${randomItem(praises)} ${mission.title}.`, ...rewardMessages);
    });
    return messages;
}

function checkBadgeUnlocks(user, { grantRewards = true } = {}) {
    const gamification = user.progress.gamification;
    const messages = [];
    GAMIFICATION_BADGES.forEach(badge => {
        if (gamification.earnedBadges.includes(badge.id)
            || toNum(badge.value(user.progress)) < badge.target) return;
        gamification.earnedBadges.push(badge.id);
        if (!grantRewards) return;
        const rewardMessages = awardExperience(user, GAMIFICATION_RULES.xpPerBadge, `badge:${badge.id}`);
        messages.push(`¡Insignia nueva: ${badge.title}!`, ...rewardMessages);
    });
    return messages;
}

function recordLearningDay(user) {
    const streak = user.progress.gamification.learningStreak;
    const today = todayISO();
    if (streak.lastActivityDate === today) return;
    streak.current = streak.lastActivityDate === todayISO(-1) ? streak.current + 1 : 1;
    streak.best = Math.max(streak.best, streak.current);
    streak.lastActivityDate = today;
}

function currentLearningStreak(user) {
    const streak = user.progress.gamification.learningStreak;
    return [todayISO(), todayISO(-1)].includes(streak.lastActivityDate) ? streak.current : 0;
}

function updateMiniStats(user, activeStreak = currentLearningStreak(user)) {
    const miniStats = $('#miniStats');
    if (!miniStats || user?.role !== 'student' || !user.progress?.gamification) return;
    const currentLevel = levelProgress(user.progress.gamification.xp).level;
    miniStats.textContent = `Nivel ${currentLevel} · ⭐ ${toNum(user.progress.stars)} · 🔥 ${activeStreak}`;
}

function operationLearningAnalysis(user, operation) {
    const baseline = user.progress.learningProfile.baseline[operation];
    const history = user.progress.learningProfile.attempts.filter(attempt => attempt.operation === operation);
    const attempts = baseline.attempts + history.length;
    const correct = baseline.correct + history.filter(attempt => attempt.correct).length;
    const recent = history.slice(-LEARNING_DIAGNOSTIC_RULES.trendWindow);
    const recentWindow = recent.slice(-LEARNING_DIAGNOSTIC_RULES.recurringErrorsWindow);
    const recentErrors = recentWindow.filter(attempt => !attempt.correct);
    const accuracy = attempts ? correct / attempts : null;
    const recentAccuracy = recent.length
        ? recent.filter(attempt => attempt.correct).length / recent.length
        : null;
    let trend = null;
    if (recent.length >= LEARNING_DIAGNOSTIC_RULES.trendWindow) {
        const groupSize = LEARNING_DIAGNOSTIC_RULES.trendGroupSize;
        const earlier = recent.slice(0, groupSize);
        const latest = recent.slice(-groupSize);
        const change = latest.filter(attempt => attempt.correct).length / groupSize
            - earlier.filter(attempt => attempt.correct).length / groupSize;
        if (change >= LEARNING_DIAGNOSTIC_RULES.trendMinimumChange) trend = 'improving';
        else if (change <= -LEARNING_DIAGNOSTIC_RULES.trendMinimumChange) trend = 'needs-attention';
        else trend = 'steady';
    }

    let status = 'exploring';
    if (recentErrors.length >= LEARNING_DIAGNOSTIC_RULES.recurringErrorsTarget
        || (attempts >= LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts && accuracy < 0.6)) {
        status = 'reinforce';
    } else if (attempts >= LEARNING_DIAGNOSTIC_RULES.strengthAttempts
        && accuracy >= LEARNING_DIAGNOSTIC_RULES.strengthAccuracy) {
        status = 'strength';
    } else if (attempts > 0) {
        status = 'practicing';
    }
    return { operation, attempts, correct, accuracy, recent, recentErrors, recentAccuracy, trend, status };
}

function operationRecommendation(user, operation) {
    const analysis = operationLearningAnalysis(user, operation);
    const guide = OPERATION_LEARNING_GUIDES[operation];
    let reason;
    if (analysis.recentErrors.length >= LEARNING_DIAGNOSTIC_RULES.recurringErrorsTarget) {
        reason = `En tus ${analysis.recent.length} respuestas recientes de ${operationInfo[operation].name.toLowerCase()} hubo ${analysis.recentErrors.length} errores.`;
    } else if (analysis.accuracy !== null
        && analysis.attempts >= LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts
        && analysis.accuracy < 0.6) {
        reason = `La precisión registrada es ${Math.round(analysis.accuracy * 100)}% en ${analysis.attempts} respuestas; conviene reforzar este paso.`;
    } else if (analysis.status === 'strength') {
        reason = `Has acertado ${Math.round(analysis.accuracy * 100)}% en ${analysis.attempts} respuestas registradas; puedes probar un reto un poco más avanzado.`;
    } else if (analysis.attempts) {
        reason = `Hay ${analysis.attempts} respuestas registradas; unos ejercicios más ayudarán a orientar mejor esta práctica.`;
    } else {
        reason = 'Aún no hay respuestas registradas para esta operación. Empieza con un reto breve y observa cómo te va.';
    }
    return { title: `${operationInfo[operation].name}: ${guide.skill}`, reason, activity: guide.activity };
}

function recommendedOperation(user) {
    const analyses = DAILY_OPERATION_KEYS.map(operation => operationLearningAnalysis(user, operation));
    const recurringError = analyses
        .filter(analysis => analysis.recentErrors.length >= LEARNING_DIAGNOSTIC_RULES.recurringErrorsTarget)
        .sort((a, b) => b.recentErrors.length - a.recentErrors.length)[0];
    if (recurringError) return recurringError.operation;
    const lowAccuracy = analyses
        .filter(analysis => analysis.attempts >= LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts)
        .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (lowAccuracy && lowAccuracy.accuracy < 0.6) return lowAccuracy.operation;
    return analyses.sort((a, b) => a.attempts - b.attempts)[0].operation;
}

function practiceLevelFor(user, operation, selectedLevel) {
    const selected = Math.min(3, Math.max(1, Math.floor(toNum(selectedLevel, 1))));
    const analysis = operationLearningAnalysis(user, operation);
    if (analysis.recent.length < LEARNING_DIAGNOSTIC_RULES.recurringErrorsWindow) return selected;
    if (analysis.recentErrors.length >= LEARNING_DIAGNOSTIC_RULES.recurringErrorsTarget) {
        return Math.max(1, selected - 1);
    }
    if (analysis.attempts >= LEARNING_DIAGNOSTIC_RULES.strengthAttempts
        && analysis.recentAccuracy >= LEARNING_DIAGNOSTIC_RULES.strengthAccuracy
        && analysis.status === 'strength') {
        return Math.min(3, selected + 1);
    }
    return selected;
}

function renderPersonalizedLearning(user) {
    const profile = user.progress.learningProfile;
    const totalRecorded = DAILY_OPERATION_KEYS.reduce((sum, operation) =>
        sum + operationLearningAnalysis(user, operation).attempts, 0);
    $('#learningCoachOverview').textContent = totalRecorded
        ? `Orientación basada en ${totalRecorded} respuestas reales guardadas. El nivel y las notas oficiales no se deducen de una sola respuesta.`
        : 'Aún no hay respuestas registradas. Practica y Cosmo usará tus resultados para recomendar el siguiente paso.';
    const statusLabels = {
        exploring: 'Vamos a practicar',
        reinforce: 'Conviene reforzar',
        practicing: 'En práctica',
        strength: 'Fortaleza observada'
    };
    const trendLabels = {
        improving: 'Mejora en las últimas respuestas',
        steady: 'Ritmo estable en las últimas respuestas',
        'needs-attention': 'Revisemos los últimos resultados'
    };
    $('#learningDiagnostics').innerHTML = DAILY_OPERATION_KEYS.map(operation => {
        const analysis = operationLearningAnalysis(user, operation);
        const accuracyLabel = analysis.attempts >= LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts
            ? `${Math.round(analysis.accuracy * 100)}% de precisión`
            : `${analysis.attempts} ${analysis.attempts === 1 ? 'respuesta registrada' : 'respuestas registradas'}`;
        const details = analysis.trend
            ? trendLabels[analysis.trend]
            : analysis.attempts < LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts
                ? `Necesitamos ${LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts - analysis.attempts} respuestas más para calcular la precisión.`
                : analysis.recent.length
                    ? `${analysis.recentErrors.length} errores en las últimas ${analysis.recent.length} respuestas registradas.`
                    : 'Los datos anteriores muestran la precisión general; aún no hay respuestas recientes registradas.';
        return `<article class="learning-operation ${analysis.status}">
            <div><b>${escapeHTML(operationInfo[operation].name)}</b><span>${escapeHTML(statusLabels[analysis.status])}</span></div>
            <small>${escapeHTML(accuracyLabel)} · ${escapeHTML(details)}</small>
            <button type="button" class="secondary" data-learning-practice="${operation}">Practicar ${escapeHTML(operationInfo[operation].name.toLowerCase())}</button>
        </article>`;
    }).join('');

    const operation = recommendedOperation(user);
    const recommendation = operationRecommendation(user, operation);
    $('#learningRecommendationTitle').textContent = recommendation.title;
    $('#learningRecommendationReason').textContent = recommendation.reason;
    $('#learningRecommendationActivity').textContent = recommendation.activity;
    $('#learningRecommendationButton').dataset.learningPractice = operation;

    const recent = profile.attempts.slice(-4).reverse();
    $('#learningRecentActivities').innerHTML = recent.length
        ? recent.map(attempt => `<li class="${attempt.correct ? 'is-correct' : 'needs-review'}">
            <span>${escapeHTML(operationInfo[attempt.operation].name)} · ${escapeHTML(attempt.expression || 'Reto de práctica')}</span>
            <small>${attempt.correct
                ? `Respuesta correcta: ${escapeHTML(attempt.studentAnswer || attempt.correctAnswer)}`
                : `Tu respuesta: ${escapeHTML(attempt.studentAnswer || 'Sin respuesta')} · Resultado: ${escapeHTML(attempt.correctAnswer || 'revisar')}`}</small>
            <time datetime="${escapeHTML(attempt.date)}">${escapeHTML(attempt.date)}</time>
        </li>`).join('')
        : '<li class="learning-empty-state">Tus ejercicios recientes aparecerán aquí después de practicar.</li>';
}

function beginRecommendedPractice(operation) {
    const user = currentUser();
    if (!user || !DAILY_OPERATION_KEYS.includes(operation)) return;
    if (user.premium) {
        const unlockedIndex = operationKeys.findIndex(item => user.progress.operations[item]?.completed !== true);
        const requestedIndex = operationKeys.indexOf(operation);
        if (user.progress.operations[operation]?.completed || requestedIndex === unlockedIndex) {
            currentOperation = operation;
            startQuiz('practice');
            return;
        }
    }
    $('#freeMathContent')?.classList.remove('hidden');
    $('#mathSubjectButton')?.setAttribute('aria-expanded', 'true');
    $('#mathSubjectButton')?.setAttribute('aria-pressed', 'true');
    $('#mathSubjectButton')?.classList.add('selected');
    newPuzzle(operation);
    requestAnimationFrame(() => $('#puzzleQuestion')?.scrollIntoView({
        behavior: motionReduced() ? 'auto' : 'smooth',
        block: 'center'
    }));
}

function recordPersonalizedAttempt(user, {
    activityId, operation, correct, source, level, expression, studentAnswer, correctAnswer
}) {
    const attempts = user.progress.learningProfile.attempts;
    const latestUnreviewedMistake = [...attempts].reverse().find(attempt =>
        !attempt.correct && !attempt.reviewedAt && attempt.operation === operation
        && attempt.expression !== expression
    );
    if (correct && latestUnreviewedMistake) latestUnreviewedMistake.reviewedAt = todayISO();
    attempts.push({
        id: activityId,
        date: todayISO(),
        operation,
        correct: correct === true,
        source,
        level: Math.min(3, Math.max(1, Math.floor(toNum(level, 1)))),
        expression: String(expression || '').slice(0, 120),
        studentAnswer: String(studentAnswer ?? '').slice(0, 40),
        correctAnswer: String(correctAnswer ?? '').slice(0, 40),
        reviewedAt: null
    });
    if (attempts.length > LEARNING_DIAGNOSTIC_RULES.historyLimit) {
        attempts.splice(0, attempts.length - LEARNING_DIAGNOSTIC_RULES.historyLimit);
    }
}

function recordLearningActivity(user, {
    activityId, operation, correct, source, level, expression, studentAnswer, correctAnswer
}) {
    if (!user || user.role !== 'student' || !user.progress?.gamification
        || typeof activityId !== 'string' || !activityId) return [];
    resetDailyMissions(user);
    const gamification = user.progress.gamification;
    if (gamification.processedActivities.includes(activityId)) return [];
    gamification.processedActivities.push(activityId);
    if (gamification.processedActivities.length > 3000) {
        gamification.processedActivities.splice(0, gamification.processedActivities.length - 3000);
    }
    if (DAILY_OPERATION_KEYS.includes(operation)) {
        recordPersonalizedAttempt(user, {
            activityId, operation, correct, source, level, expression, studentAnswer, correctAnswer
        });
    }
    const daily = gamification.daily;
    const operationIsKnown = DAILY_OPERATION_KEYS.includes(operation);
    const messages = [];
    recordLearningDay(user);

    if (correct) {
        daily.correctAnswers++;
        gamification.lifetime.correctAnswers++;
        if (operationIsKnown) {
            daily.operationAnswers[operation]++;
            gamification.lifetime.operationCorrect[operation]++;
            if (daily.pendingReviewOperations.includes(operation)) {
                daily.pendingReviewOperations = daily.pendingReviewOperations.filter(item => item !== operation);
                daily.reviewedCount++;
            }
        }
        if (source === 'puzzle') daily.puzzlesCorrect++;
        if (source === 'real-problem') daily.realProblemsCorrect++;
        messages.push(...awardExperience(user, GAMIFICATION_RULES.xpPerCorrectAnswer, `answer:${activityId}`));
    } else if (operationIsKnown && !daily.pendingReviewOperations.includes(operation)) {
        daily.pendingReviewOperations.push(operation);
    }

    messages.push(...checkDailyMissionRewards(user));
    messages.push(...checkBadgeUnlocks(user));
    updateMiniStats(user);
    saveDB();
    return messages;
}

function completePracticeSession(user, sessionId) {
    const gamification = user.progress.gamification;
    const claimId = `session:${sessionId}`;
    if (gamification.rewardClaims.includes(claimId)) return [];
    resetDailyMissions(user);
    gamification.lifetime.sessionsCompleted++;
    gamification.daily.sessionsCompleted++;
    const messages = awardExperience(user, GAMIFICATION_RULES.xpPerPracticeSession, claimId);
    const praises = ['¡Sesión completada! Tu esfuerzo cuenta.', '¡Cerraste la misión con dedicación!', '¡Gran trabajo: terminaste tu práctica!'];
    messages.unshift(randomItem(praises));
    messages.push(...checkDailyMissionRewards(user), ...checkBadgeUnlocks(user));
    saveDB();
    return messages;
}

function announceGamification(user, messages) {
    const text = messages.filter(Boolean).join(' ');
    if (!text) {
        if (currentUser()?.id === user?.id && $('#home').classList.contains('active')) {
            renderGamification(user);
            renderPersonalizedLearning(user);
        }
        return;
    }
    gamificationAnnouncements.set(user.id, text);
    const announcement = $('#gamificationAnnouncement');
    if (currentUser()?.id !== user.id) return;
    if ($('#home').classList.contains('active')) {
        renderGamification(user);
        renderPersonalizedLearning(user);
    }
    if (announcement) announcement.textContent = text;
    const milestone = messages.some(message => /misión diaria completada|insignia nueva|nivel nuevo|subiste de nivel|despegaste al siguiente nivel/i.test(message));
    const panel = $('#gamificationPanel');
    if (milestone && panel && $('#home').classList.contains('active') && !motionReduced()) {
        panel.classList.remove('is-celebrating');
        void panel.offsetWidth;
        panel.classList.add('is-celebrating');
        setTimeout(() => panel.classList.remove('is-celebrating'), 750);
    }
}

function calendarDaysBetween(fromDate, toDate) {
    const parseDay = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const [year, month, day] = value.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    };
    const from = parseDay(fromDate);
    const to = parseDay(toDate);
    return from === null || to === null ? 0 : Math.max(0, Math.round((to - from) / 86400000));
}

function renderGamification(user) {
    const progress = levelProgress(user.progress.gamification.xp);
    $('#gamificationLevel').textContent = String(progress.level);
    $('#gamificationTotal').textContent = `${progress.xp.toLocaleString('es-CO')} XP`;
    $('#gamificationProgressFill').style.width = `${progress.percentage}%`;
    const levelBar = $('#gamificationProgressFill').parentElement;
    levelBar.setAttribute('aria-valuenow', String(progress.percentage));
    $('#gamificationNextLevel').textContent = `Faltan ${progress.remainingXp.toLocaleString('es-CO')} XP para el nivel ${progress.level + 1}`;
    const learningStreak = user.progress.gamification.learningStreak;
    const activeStreak = currentLearningStreak(user);
    $('#learningStreakValue').textContent = `🔥 ${activeStreak} ${activeStreak === 1 ? 'día' : 'días'} de aprendizaje`;

    const missions = dailyMissionCatalog(user);
    $('#dailyMissions').innerHTML = missions.map(mission => {
        const status = mission.complete ? 'Completada' : mission.progress > 0 ? 'En progreso' : 'Pendiente';
        return `<li class="daily-mission${mission.complete ? ' complete' : ''}">
            <div class="daily-mission-copy"><b>${escapeHTML(mission.title)}</b><small>${escapeHTML(mission.description)}</small></div>
            <div class="daily-mission-progress"><span>${mission.progress}/${mission.target}</span><small>${status}</small></div>
        </li>`;
    }).join('');

    const badgeElements = user.progress.gamification.earnedBadges
        .map(id => GAMIFICATION_BADGES.find(badge => badge.id === id))
        .filter(Boolean)
        .slice(-3)
        .reverse();
    $('#recentBadges').innerHTML = badgeElements.length
        ? badgeElements.map(badge => `<span class="recent-badge" title="${escapeHTML(badge.title)}"><i aria-hidden="true">${badge.icon}</i><small>${escapeHTML(badge.title)}</small></span>`).join('')
        : '<p class="no-recent-badges">Tu primera insignia te espera en la próxima misión.</p>';
    $('#gamificationAnnouncement').textContent = gamificationAnnouncements.get(user.id) || '';
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
    const missionsReset = resetDailyMissions(user);
    if (p.lastDate === today) {
        if (missionsReset) saveDB();
        return;
    }

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
    
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1.24;
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
        const motivation = $('#welcomeBubble')?.textContent || '¡Prepárate para una nueva aventura!';
        const returnMessage = gamificationAnnouncements.get(user.id);
        const returnGreeting = returnMessage?.startsWith('¡Qué bueno verte de nuevo') ? returnMessage : '';
        speak(`¡Hola, ${user.name}! ${motivation} ${returnGreeting}`);
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
        'racha de aprendizaje': 'Resuelve actividades en días consecutivos.',
        'mejor racha': 'Tu récord de días con actividad real.',
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

    const daysAway = calendarDaysBetween(user.progress?.gamification?.learningStreak?.lastActivityDate, todayISO());
    applyDailyReset(user); // roll over the streak / daily goal when a new day starts
    applyLogoSettings(user.settings?.logo);
    $('#home').classList.toggle('staff-view', user.role !== 'student');

    $('#welcomeTitle').textContent = `¡Hola, ${user.name}!`;
    $('#audioButton').textContent = user.settings?.audio ? '🔊' : '🔇';
    $('#musicButton')?.classList.add('hidden');
    syncStudentMusicButton();
    
    $('#studentDashboard').classList.toggle('hidden', user.role !== 'student');
    $('#staffDashboard').classList.toggle('hidden', user.role === 'student');
    $('#continueLearningButton').classList.toggle('hidden', user.role !== 'student');
    
    if (user.role === 'student') {
        const p = user.progress;
        const hasPremium = Boolean(user.premium);
        renderGamification(user);
        renderPersonalizedLearning(user);
        $('#welcomeSubtitle').textContent = 'Tu nave está lista. Elige una misión y sigue aprendiendo.';
        const motivationOptions = studentMotivations.filter(message => message !== lastStudentMotivation);
        lastStudentMotivation = randomItem(motivationOptions.length ? motivationOptions : studentMotivations);
        $('#welcomeBubble').textContent = lastStudentMotivation;
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
            [p.points, 'puntos'], [p.stars, 'estrellas'], [currentLearningStreak(user), 'racha de aprendizaje'],
            [p.gamification.learningStreak.best, 'mejor racha'], [p.total ? Math.round(p.correct / p.total * 100) + '%' : '0%', 'precisión']
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
        const continueButton = $('#continueLearningButton');
        const continueStatus = $('#continueLearningStatus');
        continueButton.disabled = false;
        continueButton.textContent = 'Continuar aprendiendo';
        if (!hasPremium) {
            continueStatus.textContent = 'Abre tus retos gratuitos de Matemáticas.';
        } else if (nextOperation) {
            continueStatus.textContent = `Siguiente misión: ${operationInfo[nextOperation].name}.`;
        } else if (p.assessment.completed) {
            continueButton.disabled = true;
            continueButton.textContent = '¡Ruta completada!';
            continueStatus.textContent = 'Aprobaste las cuatro unidades y la evaluación final. ¡Felicitaciones!';
        } else {
            continueStatus.textContent = p.assessment.attempts
                ? 'La evaluación final está disponible para volver a presentarla.'
                : 'Las cuatro unidades están aprobadas. La evaluación final está disponible.';
        }
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
        
        const activeStreak = currentLearningStreak(user);
        updateMiniStats(user, activeStreak);
        $('#dailyStreakValue').textContent = `${activeStreak} ${activeStreak === 1 ? 'día' : 'días'}`;
        $('#dailyText').textContent = toNum(p.todayCorrect) >= 5
            ? `¡Meta diaria cumplida! (${p.todayCorrect} aciertos)`
            : `Hoy conseguiste ${toNum(p.todayCorrect)}/5 aciertos.`;
        $('#dailyProgress').style.width = Math.min((toNum(p.todayCorrect) / 5) * 100, 100) + '%';
        newPuzzle();
        newReal();
        if (daysAway >= 3) {
            const returnMessages = [
                '¡Qué bueno verte de nuevo después de unos días! Cosmo te acompaña cuando quieras retomar.',
                '¡Cosmo se alegra de tu regreso! Cada nuevo intento es un gran comienzo.',
                '¡Bienvenido de vuelta, explorador! Tu próxima aventura puede empezar hoy.'
            ];
            announceGamification(user, [randomItem(returnMessages)]);
        }
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
    ]) addAchievement(icon, title, `Mantén una racha de ${target} días con actividad de aprendizaje.`, 'streak', p.gamification.learningStreak.best, target);

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

    GAMIFICATION_BADGES.forEach(badge => {
        const current = Math.min(badge.target, Math.max(0, toNum(badge.value(p))));
        achievements.push({
            icon: badge.icon,
            title: badge.title,
            description: badge.description,
            category: badge.category,
            current,
            target: badge.target,
            unlocked: p.gamification.earnedBadges.includes(badge.id),
            percentage: badge.target ? Math.round(current / badge.target * 100) : 0
        });
    });

    const unlocked = achievements.filter(achievement => achievement.unlocked).length;
    const achievementTotal = achievements.length;
    const summary = $('#achievementSummary');
    if (summary) {
        summary.innerHTML = `
            <div class="achievement-summary-copy"><b>${unlocked} de ${achievementTotal} logros</b><span>${unlocked === achievementTotal ? '¡Colección completa, explorador!' : 'Sigue aprendiendo para desbloquear más insignias.'}</span></div>
            <div class="achievement-summary-meter" role="progressbar" aria-label="Logros desbloqueados" aria-valuemin="0" aria-valuemax="${achievementTotal}" aria-valuenow="${unlocked}">
                <i style="width:${achievementTotal ? unlocked / achievementTotal * 100 : 0}%"></i>
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
let mathTutorMessages = [];
let mathTutorPending = false;

function resetMathTutorConversation() {
    mathTutorMessages = [];
    const messages = $('#mathTutorMessages');
    if (messages) {
        messages.replaceChildren();
        const greeting = document.createElement('p');
        greeting.className = 'math-tutor-message assistant';
        greeting.textContent = '¡Hola! Puedo darte pistas y explicarte las cuatro operaciones. ¿Qué quieres aprender?';
        messages.append(greeting);
    }
    const status = $('#mathTutorStatus');
    if (status) status.textContent = '';
    const input = $('#mathTutorInput');
    if (input) input.value = '';
}

function appendMathTutorMessage(role, text, container = $('#mathTutorMessages')) {
    if (!container) return;
    const message = document.createElement('p');
    message.className = `math-tutor-message ${role === 'model' ? 'assistant' : 'student'}`;
    message.textContent = text;
    container.append(message);
    container.scrollTop = container.scrollHeight;
}

async function requestMathTutor(payload) {
    const user = currentUser();
    if (!user || user.role !== 'student' || !user.premium) {
        throw new Error('El tutor de Matemáticas está disponible para estudiantes con acceso Premium.');
    }
    if (!MATH_TUTOR_API_URL) {
        throw new Error('El tutor aún no está conectado. Falta configurar la dirección segura de su servicio.');
    }
    let tutorEndpoint;
    try {
        tutorEndpoint = new URL(MATH_TUTOR_API_URL);
    } catch {
        throw new Error('La dirección del servicio del tutor no es válida. Inténtalo más tarde.');
    }
    if (tutorEndpoint.protocol !== 'https:') {
        throw new Error('La conexión segura del tutor no está disponible.');
    }
    const response = await fetch(tutorEndpoint.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            learningContext: quizState?.mode === 'practice' && ['hint', 'review'].includes(payload.phase)
                ? mathTutorLearningContext(user, payload.operation, quizState?.question?.level)
                : undefined,
            history: Array.isArray(payload.history) ? payload.history : mathTutorMessages.slice(-8)
        })
    });
    let result;
    try {
        result = await response.json();
    } catch (error) {
        console.error('El servicio del tutor devolvió una respuesta inválida.', error);
        throw new Error('No se pudo leer la respuesta del tutor. Inténtalo de nuevo.');
    }
    if (!response.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : 'El tutor no pudo responder. Inténtalo de nuevo.');
    }
    if (typeof result?.reply !== 'string' || !result.reply.trim()) {
        throw new Error('El tutor devolvió una respuesta vacía. Inténtalo de nuevo.');
    }
    return result.reply.trim();
}

function mathTutorLearningContext(user, operation, level) {
    if (!DAILY_OPERATION_KEYS.includes(operation)) return undefined;
    const analysis = operationLearningAnalysis(user, operation);
    return {
        operation: operationInfo[operation].name,
        focus: OPERATION_LEARNING_GUIDES[operation].skill,
        teachingApproach: OPERATION_LEARNING_GUIDES[operation].activity,
        evidence: analysis.attempts >= LEARNING_DIAGNOSTIC_RULES.minimumAccuracyAttempts
            ? analysis.status
            : 'limited',
        recentErrors: analysis.recentErrors.length,
        practiceLevel: Math.min(3, Math.max(1, Math.floor(toNum(level, 1))))
    };
}

function buildLocalMathExplanation(question) {
    const { operation, a, b, answer } = question;
    const steps = {
        add: `Empieza con ${a} y cuenta ${b} más. La suma es ${answer}.`,
        subtract: `Empieza con ${a} y quita ${b}. Comprueba cuánto queda: ${answer}.`,
        multiply: `Forma ${a} grupos de ${b}. Puedes sumar ${b} ${a} veces; en total son ${answer}.`,
        divide: `Reparte ${a} en ${b} grupos iguales. Cada grupo recibe ${answer}.`
    };
    return steps[operation] || `Revisa el ejercicio paso a paso. El resultado correcto es ${answer}.`;
}

function buildLocalMathHint(question) {
    const prompts = {
        add: `Empieza con ${question.a} y cuenta ${question.b} pasos hacia adelante.`,
        subtract: `Empieza en ${question.a} y cuenta ${question.b} pasos hacia atrás.`,
        multiply: `Dibuja ${question.a} grupos iguales con ${question.b} objetos en cada uno.`,
        divide: `Dibuja ${question.a} objetos y repártelos por igual entre ${question.b} grupos.`
    };
    return prompts[question.operation] || 'Representa el ejercicio con dibujos y resuélvelo paso a paso.';
}

function baseQuestion(operation = currentOperation, type = randomItem(questionTypes), levelOverride) {
    const level = Math.min(3, Math.max(1, toNum(levelOverride, toNum($('#levelSelect')?.value, 1))));
    const max = level === 1 ? 10 : level === 2 ? 50 : 150;
    let a, b, answer, text;
    
    if (operation === 'add') { a = randomNumber(1, max); b = randomNumber(1, max); answer = a + b; text = `${a} + ${b}`; }
    if (operation === 'subtract') { a = randomNumber(2, max); b = randomNumber(1, a); answer = a - b; text = `${a} − ${b}`; }
    if (operation === 'multiply') { a = randomNumber(1, level === 1 ? 5 : 12); b = randomNumber(1, level === 1 ? 5 : 12); answer = a * b; text = `${a} × ${b}`; }
    if (operation === 'divide') { b = randomNumber(2, level === 1 ? 5 : 10); answer = randomNumber(1, level === 3 ? 20 : 10); a = b * answer; text = `${a} ÷ ${b}`; }
    
    return { operation, a, b, answer, text, object: operationInfo[operation].object, type };
}

async function runSafeServerRetry(requestFactory) {
    try {
        return await requestFactory();
    } catch (error) {
        if (error.status === 401 || (error.status >= 400 && error.status < 500)) throw error;
        return requestFactory();
    }
}

async function startServerQuiz(mode) {
    const user = serverAppUser;
    if (!user || !authClient) return lockServerLearningApp();
    if (!user.premium) {
        toast('El curso completo de Matemáticas requiere acceso Premium.');
        navigate('premium');
        return;
    }
    const selectedLevel = Math.min(3, Math.max(1, toNum($('#levelSelect')?.value, 1)));
    const level = mode === 'practice' ? practiceLevelFor(user, currentOperation, selectedLevel) : selectedLevel;
    const total = mode === 'assessment' ? 12 : Math.min(50, Math.max(1, toNum($('#questionCount')?.value, 10)));
    const idempotencyKey = uid();
    const payload = { mode, operation: currentOperation, level, total, idempotencyKey };
    let attempt;
    try {
        attempt = await runSafeServerRetry(() => authClient.startAttempt(payload));
    } catch (error) {
        if (error.status === 401) return lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        toast(error.status === 403
            ? (error.message || 'El servidor aún no autoriza esta actividad.')
            : 'No se pudo iniciar la actividad en el servidor. No se guardó progreso local.');
        return;
    }
    if (attempt.exhausted || !Array.isArray(attempt.questions) || !attempt.questions.length) {
        toast('No hay preguntas disponibles para esta actividad.');
        return;
    }
    serverAttempt = { id: attempt.attemptId, mode };
    quizState = {
        serverSide: true,
        attemptId: attempt.attemptId,
        questions: attempt.questions,
        index: 0,
        total: attempt.total,
        correct: 0,
        started: Date.now(),
        sessionId: attempt.attemptId,
        mode,
        questionLevel: level,
        operationPlan: attempt.questions.map(question => question.operation),
        questionTypePlan: attempt.questions.map(question => question.type),
        operationTotals: Object.fromEntries(operationKeys.map(operation => [operation, 0])),
        operationCorrect: Object.fromEntries(operationKeys.map(operation => [operation, 0])),
        sessionProgressStart: {
            xp: Number(serverProgressSnapshot?.state?.xp) || 0,
            stars: Number(serverProgressSnapshot?.state?.stars) || 0
        },
        streak: 0,
        finished: false,
        finishPending: false
    };
    lastQuizMode = mode;
    $('#quizModeLabel').textContent = mode === 'assessment' ? 'UNIDAD 5 · EVALUACIÓN FINAL' : 'MISIÓN DE APRENDIZAJE';
    $('#quizMissionText').textContent = mode === 'assessment'
        ? '12 retos mezclados: tres preguntas de cada operación. ¡A por tu mejor nota!'
        : `Aprueba ${operationInfo[currentOperation].name.toLowerCase()} con una nota mínima de ${PASS_GRADE.toFixed(1)}/5.0 para desbloquear la siguiente misión.`;
    $('#quizStreak').textContent = '✨ 0';
    navigate('quiz');
    nextQuizQuestion();
}

function startQuiz(mode = 'practice') {
    if (!localDemoMode) {
        if (serverAppUser) return startServerQuiz(mode);
        toast('Inicia sesión para abrir una actividad segura.');
        return;
    }
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
    const selectedLevel = Math.min(3, Math.max(1, toNum($('#levelSelect')?.value, 1)));
    const practiceLevel = mode === 'practice'
        ? practiceLevelFor(user, currentOperation, selectedLevel)
        : selectedLevel;
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
        sessionId: uid(),
        mode,
        sessionProgressStart: {
            xp: toNum(user.progress.gamification?.xp),
            missionsCompleted: toNum(user.progress.gamification?.lifetime?.missionsCompleted),
            earnedBadges: [...(user.progress.gamification?.earnedBadges || [])]
        },
        questionLevel: practiceLevel,
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
        : `Aprueba ${operationInfo[currentOperation].name.toLowerCase()} con una nota mínima de ${PASS_GRADE.toFixed(1)}/5.0 para desbloquear la siguiente unidad.${practiceLevel !== selectedLevel ? ` Cosmo ajustó esta práctica al nivel ${practiceLevel} según tus respuestas recientes.` : ''}`;
    $('#quizStreak').textContent = '✨ 0';
    navigate('quiz');
    nextQuizQuestion();
}

function renderServerQuestion() {
    const q = quizState.question = quizState.questions[quizState.index];
    if (!q || typeof q.id !== 'string' || !Array.isArray(q.options) || !q.options.length) {
        toast('El servidor devolvió una pregunta no válida. La actividad quedó bloqueada.');
        return;
    }
    clearInterval(timerId);
    timerId = null;
    selectedAnswer = null;
    const tutorReply = $('#quizTutorReply');
    if (tutorReply) { tutorReply.textContent = ''; tutorReply.classList.add('hidden'); }
    const tutorButton = $('#quizTutorButton');
    if (tutorButton) { tutorButton.disabled = false; tutorButton.textContent = '✨ Pedir una pista a Cosmo IA'; }
    $('#questionNumber').textContent = `Pregunta ${quizState.index + 1} de ${quizState.total}`;
    $('#quizProgress').style.width = `${quizState.index / quizState.total * 100}%`;
    $('#questionType').textContent = {
        choice: '🎯 Elige una respuesta', visual: '🔭 Reto visual', story: '🪐 Historia interactiva',
        truefalse: '⚡ Detecta la señal', input: '🧭 Escribe el resultado'
    }[q.type] || 'Reto de Matemáticas';
    const scenes = [
        ['🚀', 'Despegue relámpago'], ['🛸', 'Rescate en órbita'], ['🌌', 'Portal galáctico'],
        ['🛰️', 'Código de la estación'], ['🌠', 'Caza de estrellas'], ['🪐', 'Planeta misterioso']
    ];
    const [icon, scene] = randomItem(scenes);
    $('#challengeScene').textContent = `${icon} ${scene} · ${operationInfo[q.operation]?.name || 'Matemáticas'}`;
    $('#quizOperationBadge').textContent = operationInfo[q.operation]?.name || '';
    $('#quizOperationBadge').classList.toggle('hidden', quizState.mode !== 'assessment');
    const storyPrompts = {
        add: `El radar localizó ${q.a} ${q.object}. Llegan ${q.b} más a la estación. ¿Cuántos hay ahora?`,
        subtract: `La nave transporta ${q.a} ${q.object} y entrega ${q.b}. ¿Cuántos quedan a bordo?`,
        multiply: `Se preparan ${q.a} cápsulas con ${q.b} ${q.object} en cada una. ¿Cuántos se necesitan?`,
        divide: `Hay ${q.a} ${q.object} para repartir en ${q.b} equipos. ¿Cuántos recibe cada equipo?`
    };
    $('#questionStory').textContent = q.type === 'truefalse'
        ? q.prompt
        : q.type === 'story' ? storyPrompts[q.operation] : ({
            choice: '¡La consola está parpadeando! Elige el resultado correcto para seguir avanzando.',
            visual: 'Mira con atención los objetos que llegaron. ¿Cuántos hay al completar la operación?',
            input: 'Elige una respuesta para cargar el propulsor de la nave.'
        }[q.type] || q.prompt);
    $('#visualQuestion').textContent = q.type === 'visual'
        ? q.object.repeat(Math.min(q.a, 18)) + (q.operation === 'add' ? ` + ${q.object.repeat(Math.min(q.b, 18))}`
            : q.operation === 'subtract' ? ` − ${q.b}` : q.operation === 'multiply' ? ` × ${q.b}` : ` ÷ ${q.b}`)
        : '';
    $('#equation').textContent = ['story', 'truefalse'].includes(q.type) ? '' : `${q.text} = ?`;
    const icons = ['🪐', '🚀', '🌟', '🛸'];
    $('#answerOptions').innerHTML = q.options.map((value, index) => {
        const label = q.type === 'truefalse'
            ? (Number(value) ? '¡Sí, es verdad!' : 'No, es una trampa')
            : Number(value).toLocaleString('es-CO');
        return `<button type="button" class="answer-option${q.type === 'truefalse' ? ` answer-${Number(value) ? 'true' : 'false'}` : ''}" data-value="${escapeHTML(value)}" data-option-index="${index}" data-choice="${index + 1}">
            <span class="answer-icon" aria-hidden="true">${q.type === 'truefalse' ? (Number(value) ? '✅' : '⚠️') : icons[index % icons.length]}</span>
            <span class="answer-label">${escapeHTML(label)}</span><span class="answer-key" aria-hidden="true">${index + 1}</span>
        </button>`;
    }).join('');
    $$('.answer-option').forEach(button => {
        button.onclick = () => {
            if (q.pendingOption !== undefined) return;
            $$('.answer-option').forEach(item => item.classList.remove('selected'));
            button.classList.add('selected');
            selectedAnswer = Number(button.dataset.optionIndex);
            if (q.type === 'truefalse') checkAnswer(selectedAnswer);
        };
    });
    $('#answerForm').classList.toggle('hidden', q.type === 'truefalse');
    $('#writtenAnswer').value = '';
    $('#writtenAnswer').placeholder = 'Selecciona una de las opciones';
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#nextQuestion').classList.add('hidden');
    $('#quizBubble').textContent = randomItem(['Tómate tu tiempo.', 'Respira y observa.', 'Piensa paso a paso.', 'Vamos, se puede lograr.']);
    $('#quizMascot').className = 'mascot bouncing';
    $('#timerBox').classList.add('hidden');
    $('#quizTutor')?.classList.add('hidden');
}

function nextQuizQuestion() {
    if (quizState?.serverSide) return renderServerQuestion();
    clearInterval(timerId);
    timerId = null;
    selectedAnswer = null;
    const q = quizState.question = baseQuestion(
        quizState.operationPlan[quizState.index],
        quizState.questionTypePlan[quizState.index],
        quizState.questionLevel
    );
    q.level = quizState.questionLevel;
    q.activityId = `${quizState.sessionId}:${quizState.index}:${uid()}`;
    const tutorReply = $('#quizTutorReply');
    if (tutorReply) {
        tutorReply.textContent = '';
        tutorReply.classList.add('hidden');
    }
    const tutorButton = $('#quizTutorButton');
    if (tutorButton) {
        tutorButton.disabled = false;
        tutorButton.textContent = '✨ Pedir una pista a Cosmo IA';
    }
    
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

async function submitServerQuizAnswer(selectedOption) {
    const q = quizState?.question;
    if (!quizState?.serverSide || !q || q.serverAnswered || q.answerPending) return;
    if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= q.options.length) {
        $('#feedback').textContent = 'Selecciona una de las opciones para responder.';
        $('#feedback').className = 'feedback bad';
        return;
    }
    if (q.pendingOption !== undefined && q.pendingOption !== selectedOption) {
        $('#feedback').textContent = 'La respuesta está pendiente de confirmación. Reintenta esa misma opción.';
        $('#feedback').className = 'feedback bad';
        return;
    }
    q.pendingOption = selectedOption;
    q.answerPending = true;
    $$('.answer-option').forEach(button => { button.disabled = true; });
    const submitButton = $('#answerForm button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    $('#feedback').textContent = 'Enviando la respuesta al servidor…';
    $('#feedback').className = 'feedback';
    $('#nextQuestion').classList.add('hidden');
    let result;
    try {
        const answerPayload = {
            attemptId: quizState.attemptId,
            questionId: q.id,
            selectedOption
        };
        result = await runSafeServerRetry(() => authClient.answerAttemptOnce(answerPayload));
    } catch (error) {
        q.answerPending = false;
        if (submitButton) submitButton.disabled = false;
        if (error.status === 401) return lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        if (error.status === 409 || error.status === 404) {
            quizState.serverConflict = true;
            $('#feedback').textContent = error.message || 'La pregunta ya no está disponible en este intento.';
            $('#feedback').className = 'feedback bad';
            $('#answerForm').classList.add('hidden');
            $('#nextQuestion').textContent = 'Volver al mapa';
            $('#nextQuestion').classList.remove('hidden');
            return;
        }
        q.answerError = true;
        $('#feedback').textContent = 'No pudimos confirmar la respuesta. Reintenta la misma opción; el servidor evita duplicarla.';
        $('#feedback').className = 'feedback bad';
        $('#nextQuestion').textContent = 'Reintentar respuesta';
        $('#nextQuestion').classList.remove('hidden');
        return;
    }
    q.answerPending = false;
    q.answerError = false;
    q.serverAnswered = true;
    q.attempted = true;
    q.answer = Number(result.correctAnswer);
    q.target = q.type === 'truefalse'
        ? Number(q.claim === q.answer)
        : Number(result.correctAnswer);
    const correctOptionIndex = q.type === 'truefalse'
        ? q.target
        : q.options.findIndex(option => Number(option) === Number(result.correctAnswer));
    const correct = result.correct === true;
    const chosenValue = q.options[selectedOption];
    q.studentAnswer = q.type === 'truefalse'
        ? (Number(chosenValue) ? 'Verdadero' : 'Falso')
        : String(chosenValue);
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

    let confirmedXP = null;
    try {
        await refreshServerProgress();
        confirmedXP = Number(serverProgressSnapshot.state.xp) || 0;
        updateMiniStats(serverAppUser);
    } catch (error) {
        if (error.status === 401) return;
    }
    const correctLabel = q.type === 'truefalse'
        ? (q.target ? 'Verdadero' : 'Falso')
        : Number(result.correctAnswer).toLocaleString('es-CO');
    const explanation = buildLocalMathExplanation(q);
    const feedback = correct
        ? `¡Respuesta correcta! ${explanation}${confirmedXP === null ? ' No se pudo actualizar el total de XP.' : ` El servidor confirma ${confirmedXP} XP acumulados.`}`
        : `Tu respuesta fue ${q.studentAnswer}. La correcta es ${correctLabel}. ${explanation}`;
    $('#feedback').textContent = feedback;
    $('#feedback').className = `feedback ${correct ? 'good' : 'bad'}`;
    $('#quizBubble').textContent = correct ? '¡Buen trabajo!' : 'Revisa el procedimiento paso a paso.';
    $('#quizMascot').className = correct ? 'mascot celebrating' : 'mascot thinking';
    playMelody(correct);
    const shownCorrectOption = q.type === 'truefalse'
        ? q.options.findIndex(value => Number(value) === q.target)
        : correctOptionIndex;
    $$('.answer-option').forEach((button, index) => {
        button.disabled = true;
        if (index === shownCorrectOption) button.classList.add('correct');
        if (index === selectedOption && !correct) button.classList.add('wrong');
    });
    $('#answerForm').classList.add('hidden');
    $('#nextQuestion').textContent = quizState.index >= quizState.total ? 'Ver resultados →' : 'Siguiente aventura →';
    $('#nextQuestion').classList.remove('hidden');
    if (correct) setTimeout(() => speak(feedback), 300);
}

function checkAnswer(value) {
    if (!quizState || !quizState.question) return;
    if (quizState.serverSide) return submitServerQuizAnswer(value);
    const nextButton = $('#nextQuestion');
    if (nextButton && !nextButton.classList.contains('hidden')) return;
    clearInterval(timerId);
    timerId = null;
    unlockAudio();
    
    const q = quizState.question;
    const answered = value !== null && value !== undefined && value !== '';
    const correct = answered && Number(value) === Number(q.target);
    const user = currentUser();
    q.attempted = answered;
    q.studentAnswer = answered
        ? q.type === 'truefalse' ? (Number(value) ? 'Verdadero' : 'Falso') : String(value)
        : 'No respondió';
    const gamificationMessages = quizState.mode === 'practice'
        ? recordLearningActivity(user, {
            activityId: q.activityId,
            operation: q.operation,
            correct,
            source: 'quiz',
            level: q.level,
            expression: q.text,
            studentAnswer: q.studentAnswer,
            correctAnswer: q.answer
        })
        : [];
    announceGamification(user, gamificationMessages);
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
        const xpLabel = quizState.mode === 'practice' ? ` ${gamificationMessages[0] || ''}` : '';
        const milestoneLabel = gamificationMessages.slice(1).join(' ');
        screenMessage = `${praise} La respuesta correcta es ${correctLabel}.${xpLabel ? ` ${xpLabel}` : ''}${milestoneLabel ? ` ${milestoneLabel}` : ''}`;
        voiceMessage = `${praise} ${user?.name || 'explorador'}. ${q.type === 'truefalse' ? 'Elegiste correctamente' : mathSpeech(q.text) + ' es igual a ' + q.answer}. Ganaste una estrella.${xpLabel}${milestoneLabel ? ` ${milestoneLabel}` : ''}`;
        $('#feedback').className = 'feedback good';
        $('#quizMascot').className = 'mascot celebrating';
        $('#quizBubble').textContent = praise;
        playMelody(true);
    } else {
        const support = nextSupportMessage();
        const explanation = buildLocalMathExplanation(q);
        screenMessage = answered
            ? `Tu respuesta fue ${q.studentAnswer}. La correcta es ${correctLabel}. ${support} ${explanation}`
            : `Se terminó el tiempo. La respuesta correcta es ${correctLabel}. ${support} ${explanation}`;
        voiceMessage = `${support} ${currentUser()?.name || 'explorador'}. ${explanation}`;
        $('#feedback').className = 'feedback bad';
        $('#quizMascot').className = 'mascot thinking';
        $('#quizBubble').textContent = support;
        playMelody(false);
    }
    
    $('#feedback').textContent = screenMessage;
    setTimeout(() => speak(voiceMessage, { rate: correct ? 1 : 0.94, pitch: correct ? 1.24 : 1.18 }), 700);
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

async function finishServerQuiz() {
    if (!quizState?.serverSide || quizState.finishPending || quizState.finished) return;
    quizState.finishPending = true;
    const button = $('#nextQuestion');
    button.disabled = true;
    button.textContent = 'Guardando resultados…';
    let result;
    try {
        result = await runSafeServerRetry(() => authClient.finishAttempt(quizState.attemptId));
    } catch (error) {
        quizState.finishPending = false;
        button.disabled = false;
        if (error.status === 401) return lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        $('#feedback').textContent = error.status === 409
            ? (error.message || 'El servidor aún no confirma que todas las preguntas estén respondidas.')
            : 'No se pudo confirmar el resultado. Reintenta guardar; el servidor evita duplicar la finalización.';
        $('#feedback').className = 'feedback bad';
        button.textContent = 'Reintentar guardar resultado';
        return;
    }
    quizState.finishPending = false;
    quizState.finished = true;
    quizState.correct = Number(result.score) || 0;
    quizState.percentage = Number(result.percentage) || 0;
    quizState.grade = Number(result.grade) || 1;
    quizState.passed = result.passed === true;
    let progressConfirmed = false;
    try {
        await refreshServerProgress();
        progressConfirmed = true;
        updateMiniStats(serverAppUser);
    } catch (error) {
        if (error.status === 401) return;
    }
    const xpTotal = progressConfirmed ? Number(serverProgressSnapshot.state.xp) || 0 : null;
    const starsTotal = progressConfirmed ? Number(serverProgressSnapshot.state.stars) || 0 : null;
    const elapsed = Math.max(0, Math.round((Date.now() - quizState.started) / 1000));
    const gradeLabel = `${quizState.grade.toFixed(1)}/5.0`;
    const passedMessage = quizState.mode === 'assessment'
        ? (quizState.passed
            ? `¡Evaluación aprobada, ${serverAppUser.name}! Lograste ${quizState.percentage}% y una nota de ${gradeLabel}.`
            : `Obtuviste ${quizState.percentage}% y una nota de ${gradeLabel}. Necesitas ${PASS_GRADE.toFixed(1)}/5.0 para aprobar.`)
        : (quizState.passed
            ? `¡Unidad aprobada, ${serverAppUser.name}! Lograste ${quizState.percentage}% y una nota de ${gradeLabel}.`
            : `Lograste ${quizState.percentage}% y una nota de ${gradeLabel}. Necesitas ${PASS_GRADE.toFixed(1)}/5.0 para aprobar.`);
    $('#summaryTitle').textContent = quizState.mode === 'assessment'
        ? (quizState.passed ? '¡Evaluación aprobada!' : 'Sigue entrenando')
        : (quizState.passed ? '¡Unidad aprobada!' : '¡Cada intento te acerca!');
    $('#repeatMission').textContent = quizState.mode === 'assessment' ? 'Repetir evaluación' : 'Repetir misión';
    $('#summaryMessage').textContent = progressConfirmed
        ? passedMessage : `${passedMessage} El resultado quedó guardado; no se pudo actualizar el progreso visible.`;
    const summaryStats = [
        [`${quizState.correct}/${quizState.total}`, 'aciertos'],
        [`${quizState.percentage}%`, 'precisión'], [gradeLabel, 'nota']
    ];
    if (quizState.mode === 'assessment') summaryStats.push(['4', 'operaciones'], [`${Math.round(elapsed / 60)} min`, 'tiempo']);
    else {
        if (xpTotal !== null) summaryStats.push([`${xpTotal}`, 'XP acumulados']);
        if (starsTotal !== null) summaryStats.push([`${starsTotal}`, 'estrellas totales']);
        summaryStats.push([`${Math.round(elapsed / 60)} min`, 'tiempo']);
    }
    $('#summaryStats').innerHTML = statCards(summaryStats);
    const sessionRewards = $('#sessionRewards');
    const sessionRewardsContent = $('#sessionRewardsContent');
    const showRewards = quizState.mode === 'practice' && progressConfirmed;
    const sessionRewardsTitle = $('#sessionRewardsTitle');
    if (sessionRewardsTitle) sessionRewardsTitle.textContent = 'Progreso guardado';
    sessionRewards?.classList.toggle('hidden', !showRewards);
    if (sessionRewardsContent) sessionRewardsContent.innerHTML = showRewards
        ? `<div class="session-reward-grid"><p><b>${xpTotal} XP</b><span>total confirmado por el servidor</span></p><p><b>${starsTotal} ⭐</b><span>total confirmado por el servidor</span></p></div>`
        : '';
    const breakdown = $('#assessmentBreakdown');
    if (breakdown) {
        breakdown.classList.toggle('hidden', quizState.mode !== 'assessment');
        breakdown.innerHTML = quizState.mode === 'assessment'
            ? `<h3>Resultados por operación</h3><div class="assessment-breakdown-grid">${operationKeys.map(operation => {
                const total = quizState.operationTotals[operation];
                const correct = quizState.operationCorrect[operation];
                return `<article><span>${escapeHTML(operationInfo[operation].name)}</span><b>${correct}/${total}</b><small>Respuestas calificadas por el servidor</small></article>`;
            }).join('')}</div>` : '';
    }
    serverAttempt = null;
    navigate('summary');
}

function finishQuiz() {
    if (quizState?.serverSide) return finishServerQuiz();
    const user = currentUser();
    if (!user || !quizState || !quizState.total) return navigate('auth');
    if (quizState.finished) return;
    quizState.finished = true;
    if (!user.progress?.operations) user.progress = normalizeProgress(user.progress);

    const p = user.progress;
    applyDailyReset(user); // make sure the daily goal belongs to today before adding to it

    const elapsed = Math.max(0, Math.round((Date.now() - quizState.started) / 1000));
    const percentage = Math.round(quizState.correct / quizState.total * 100);
    const grade = gradeFromPercentage(percentage);
    const passed = grade >= PASS_GRADE;
    const previousBestGrade = quizState.mode === 'practice'
        ? toNum(p.operations[currentOperation]?.bestGrade)
        : 0;
    const gamificationMessages = [];
    
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

    if (quizState.mode === 'practice') {
        if (previousBestGrade > 0 && grade > previousBestGrade) {
            const improvementMessages = [
                `¡Mejoraste tu nota de ${operationInfo[currentOperation].name}! Cosmo celebra tu progreso.`,
                `¡Nuevo avance en ${operationInfo[currentOperation].name}! Tu práctica está dando frutos.`
            ];
            gamificationMessages.push(randomItem(improvementMessages));
        }
        if (operationLearningAnalysis(user, currentOperation).trend === 'improving') {
            gamificationMessages.push(randomItem([
                `Tus respuestas recientes muestran progreso en ${operationInfo[currentOperation].name.toLowerCase()}. ¡Sigue así!`,
                `Cosmo nota que vas mejorando en ${operationInfo[currentOperation].name.toLowerCase()}.`
            ]));
        }
        gamificationMessages.push(...completePracticeSession(user, quizState.sessionId));
        announceGamification(user, gamificationMessages);
    }
    
    saveDB();
    updateMiniStats(user);
    
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
    $('#summaryMessage').textContent = [message, ...gamificationMessages].filter(Boolean).join(' ');
    const summaryValues = [
        [`${quizState.correct}/${quizState.total}`, 'aciertos'], [percentage + '%', 'precisión'],
        [grade.toFixed(1) + '/5.0', 'nota']
    ];
    if (quizState.mode === 'assessment') {
        summaryValues.push(['4', 'operaciones'], [Math.round(elapsed / 60) + ' min', 'tiempo']);
    } else {
        const xpEarned = Math.max(0, toNum(p.gamification?.xp) - toNum(quizState.sessionProgressStart?.xp));
        summaryValues.push(['+' + xpEarned, 'XP'], ['+' + quizState.correct * 12, 'puntos'], ['+' + quizState.correct, 'estrellas'], [Math.round(elapsed / 60) + ' min', 'tiempo']);
    }
    $('#summaryStats').innerHTML = statCards(summaryValues);
    const sessionRewards = $('#sessionRewards');
    const sessionRewardsContent = $('#sessionRewardsContent');
    if (sessionRewards && sessionRewardsContent) {
        const start = quizState.sessionProgressStart || {};
        const xpEarned = Math.max(0, toNum(p.gamification?.xp) - toNum(start.xp));
        const missionsEarned = Math.max(0, toNum(p.gamification?.lifetime?.missionsCompleted) - toNum(start.missionsCompleted));
        const newBadges = (p.gamification?.earnedBadges || [])
            .filter(id => !(start.earnedBadges || []).includes(id))
            .map(id => GAMIFICATION_BADGES.find(badge => badge.id === id))
            .filter(Boolean);
        const hasRewards = quizState.mode === 'practice' && (xpEarned || missionsEarned || newBadges.length);
        sessionRewards.classList.toggle('hidden', !hasRewards);
        sessionRewardsContent.innerHTML = hasRewards
            ? `<div class="session-reward-grid"><p><b>+${xpEarned} XP</b><span>avance real de esta sesión</span></p><p><b>${missionsEarned}</b><span>${missionsEarned === 1 ? 'misión completada' : 'misiones completadas'}</span></p>${newBadges.length ? `<p class="session-badges"><b>${newBadges.map(badge => `${badge.icon} ${escapeHTML(badge.title)}`).join(' · ')}</b><span>${newBadges.length === 1 ? 'nueva insignia' : 'nuevas insignias'}</span></p>` : ''}</div>`
            : '';
    }
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
    setTimeout(() => speak([message, ...gamificationMessages].filter(Boolean).join(' ')), 300);
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

const FREE_PUZZLES = [
    ['Completa el patrón: 2, 4, 6, 8, ...', 10, [9, 10, 11, 12], 'add', '2 + 2 + 2 + 2 + 2', 'puzzle-pattern-2s-v1'],
    ['Tenías 14 estrellas y regalaste 5. ¿Cuántas quedan?', 9, [7, 8, 9, 10], 'subtract', '14 − 5', 'puzzle-stars-gift-v1'],
    ['Tres cohetes llevan 4 estrellas cada uno. ¿Cuántas estrellas transportan?', 12, [8, 12, 16, 20], 'multiply', '3 × 4', 'puzzle-rockets-groups-v1'],
    ['18 cristales se reparten entre 3 astronautas. ¿Cuántos recibe cada uno?', 6, [5, 6, 7, 9], 'divide', '18 ÷ 3', 'puzzle-crystals-share-v1'],
    ['¿Qué número sigue? 3, 6, 9, 12, ...', 15, [13, 14, 15, 18], 'add', '12 + 3', 'puzzle-pattern-3s-v1'],
    ['Completa la secuencia: 5, 10, 15, ...', 20, [18, 20, 25, 30], 'add', '15 + 5', 'puzzle-pattern-5s-v1'],
    ['La nave tenía 32 unidades de combustible y usó 14. ¿Cuántas quedan?', 18, [16, 18, 20, 22], 'subtract', '32 − 14', 'puzzle-fuel-used-v1'],
    ['Un planeta tiene 27 cráteres y otro 19. ¿Cuántos cráteres más tiene el primero?', 8, [6, 8, 9, 10], 'subtract', '27 − 19', 'puzzle-craters-difference-v1'],
    ['Cada uno de 6 satélites tiene 4 paneles. ¿Cuántos paneles hay?', 24, [20, 22, 24, 28], 'multiply', '6 × 4', 'puzzle-satellite-panels-v1'],
    ['Hay 5 cajas con 7 rocas lunares en cada una. ¿Cuántas rocas hay?', 35, [30, 32, 35, 40], 'multiply', '5 × 7', 'puzzle-moon-boxes-v1'],
    ['24 tanques pequeños se reparten por igual entre 6 módulos. ¿Cuántos recibe cada módulo?', 4, [3, 4, 5, 6], 'divide', '24 ÷ 6', 'puzzle-oxygen-share-v1'],
    ['Se guardan 36 estrellas en cajas de 9. ¿Cuántas cajas se llenan?', 4, [3, 4, 5, 6], 'divide', '36 ÷ 9', 'puzzle-stars-crates-v1']
];

const FREE_REAL_PROBLEMS = [
    ['Compras 3 jugos de $2.000. ¿Cuánto pagas?', 6000, [4000, 5000, 6000, 8000], 'multiply', '3 × 2.000', 'real-juice-cost-v1'],
    ['Tienes $10.000 y gastas $3.500. ¿Cuánto queda?', 6500, [5500, 6000, 6500, 7000], 'subtract', '10.000 − 3.500', 'real-money-change-v1'],
    ['12 galletas entre 4 personas. ¿Cuántas recibe cada una?', 3, [2, 3, 4, 6], 'divide', '12 ÷ 4', 'real-cookies-share-v1'],
    ['Cada cuaderno cuesta $3.000. ¿Cuánto cuestan 4 cuadernos?', 12000, [9000, 11000, 12000, 14000], 'multiply', '4 × 3.000', 'real-notebooks-cost-v1'],
    ['En un bus hay 45 pasajeros. En una parada bajan 18. ¿Cuántos quedan?', 27, [23, 27, 33, 37], 'subtract', '45 − 18', 'real-bus-seats-v1'],
    ['Se empacan 32 manzanas por igual en 4 bolsas. ¿Cuántas van en cada bolsa?', 8, [6, 7, 8, 9], 'divide', '32 ÷ 4', 'real-apples-share-v1'],
    ['Una caja trae 6 botellas. ¿Cuántas botellas hay en 5 cajas?', 30, [25, 28, 30, 35], 'multiply', '5 × 6', 'real-water-bottles-v1'],
    ['Tienes $20.000 y compras fruta por $8.500. ¿Cuánto dinero te queda?', 11500, [10500, 11500, 12500, 13500], 'subtract', '20.000 − 8.500', 'real-market-budget-v1'],
    ['Se reparten 42 tarjetas por igual entre 7 equipos. ¿Cuántas recibe cada equipo?', 6, [5, 6, 7, 8], 'divide', '42 ÷ 7', 'real-team-sharing-v1']
];

const FREE_QUESTION_EXPLANATIONS = {
    'puzzle-pattern-2s-v1': 'El patrón aumenta de 2 en 2; después de 8 sigue 10.',
    'puzzle-stars-gift-v1': 'Al regalar 5 de las 14 estrellas, calculas 14 − 5 = 9.',
    'puzzle-rockets-groups-v1': 'Tres grupos de 4 forman 3 × 4 = 12 estrellas.',
    'puzzle-crystals-share-v1': 'Al repartir 18 entre 3, cada astronauta recibe 6.',
    'puzzle-pattern-3s-v1': 'La secuencia aumenta de 3 en 3: 12 + 3 = 15.',
    'puzzle-pattern-5s-v1': 'La secuencia aumenta de 5 en 5: 15 + 5 = 20.',
    'puzzle-fuel-used-v1': 'Restas las 14 unidades usadas: 32 − 14 = 18.',
    'puzzle-craters-difference-v1': 'La diferencia entre las cantidades es 27 − 19 = 8.',
    'puzzle-satellite-panels-v1': 'Seis grupos de 4 paneles son 6 × 4 = 24.',
    'puzzle-moon-boxes-v1': 'Cinco grupos de 7 rocas son 5 × 7 = 35.',
    'puzzle-oxygen-share-v1': 'Al repartir 24 entre 6 módulos, cada uno recibe 4.',
    'puzzle-stars-crates-v1': '36 dividido en cajas de 9 llena 4 cajas.',
    'real-juice-cost-v1': 'Tres jugos de $2.000 cuestan 3 × 2.000 = $6.000.',
    'real-money-change-v1': 'El cambio es 10.000 − 3.500 = $6.500.',
    'real-cookies-share-v1': '12 galletas entre 4 personas son 3 para cada una.',
    'real-notebooks-cost-v1': 'Cuatro cuadernos cuestan 4 × 3.000 = $12.000.',
    'real-bus-seats-v1': 'Quedan 45 − 18 = 27 pasajeros.',
    'real-apples-share-v1': '32 manzanas entre 4 bolsas son 8 por bolsa.',
    'real-water-bottles-v1': 'Cinco cajas de 6 contienen 5 × 6 = 30 botellas.',
    'real-market-budget-v1': 'Después de comprar, quedan 20.000 − 8.500 = $11.500.',
    'real-team-sharing-v1': '42 tarjetas entre 7 equipos son 6 para cada equipo.'
};

function ensureFreeQuestionIds(bank, namespace) {
    const usedIds = new Set();
    bank.forEach((question, index) => {
        const savedId = Array.isArray(question) ? question[5] : question.id;
        let id = typeof savedId === 'string' && savedId.trim() ? savedId : '';
        if (!id || usedIds.has(id)) {
            id = `free-${namespace}-legacy-${index + 1}`;
            while (usedIds.has(id)) id += '-';
            if (Array.isArray(question)) question[5] = id;
            else question.id = id;
        }
        usedIds.add(id);
    });
}

function selectFreeQuestion(bank, operation) {
    ensureFreeQuestionIds(bank, bank === FREE_PUZZLES ? 'puzzle' : 'real');
    const questions = bank.map(question => Array.isArray(question) ? {
        prompt: question[0], answer: question[1], choices: question[2],
        operation: question[3], expression: question[4], id: question[5]
    } : question);
    const user = currentUser();
    const history = user?.progress?.freeQuestionHistory;
    const answered = new Set(history?.answered || []);
    const eligible = questions.filter(question => (!operation || question.operation === operation)
        && !answered.has(question.id));
    if (!eligible.length) return null;
    const shown = new Set(history?.shown || []);
    const unseen = eligible.filter(question => !shown.has(question.id));
    const question = randomItem(unseen.length ? unseen : eligible);
    if (user && history) {
        history.shown = [...new Set([...history.shown, question.id])];
        saveDB();
    }
    return question;
}

function markFreeQuestionAnswered(question) {
    const history = currentUser()?.progress?.freeQuestionHistory;
    if (!history || history.answered.includes(question.id)) return false;
    history.answered.push(question.id);
    saveDB();
    return true;
}

async function finishServerFreeAttempt() {
    const active = serverAttempt;
    if (!active?.answered || active.finished || active.finishing) return active?.finished === true;
    active.finishing = true;
    try {
        await runSafeServerRetry(() => authClient.finishAttempt(active.id));
        active.finished = true;
        try { await refreshServerProgress(); updateMiniStats(serverAppUser); }
        catch (error) { if (error.status === 401) return false; }
        return true;
    } catch (error) {
        active.finishing = false;
        if (error.status === 401) lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        return false;
    } finally {
        active.finishing = false;
    }
}

async function loadServerFreeQuestion(category, operation) {
    if (serverAttempt?.answered && !serverAttempt.finished) {
        const finished = await finishServerFreeAttempt();
        if (!finished) {
            const retryButton = category === 'puzzle' ? $('#newPuzzle') : $('#newRealQuestion');
            retryButton.textContent = 'Reintentar cierre';
            const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
            feedback.textContent = 'La respuesta quedó guardada. Reintenta cerrar esta actividad antes de pedir otra.';
            feedback.className = 'feedback bad';
            return;
        }
        const retryButton = category === 'puzzle' ? $('#newPuzzle') : $('#newRealQuestion');
        retryButton.textContent = category === 'puzzle' ? 'Otro rompecabezas' : 'Otro ejercicio';
    }
    if (serverAttempt?.conflict) {
        try { await refreshServerProgress(); } catch { return; }
    }
    serverAttempt = null;
    const idempotencyKey = uid();
    let attempt;
    try {
        attempt = await runSafeServerRetry(() => authClient.startAttempt({
            mode: category, idempotencyKey, ...(operation ? { operation } : {})
        }));
    } catch (error) {
        if (error.status === 401) return lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
        feedback.textContent = error.message || 'No se pudo obtener una pregunta del servidor.';
        feedback.className = 'feedback bad';
        return;
    }
    if (attempt.exhausted) {
        const question = category === 'puzzle' ? $('#puzzleQuestion') : $('#realQuestion');
        const options = category === 'puzzle' ? $('#puzzleOptions') : $('#realOptions');
        const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
        question.textContent = category === 'puzzle'
            ? 'Completaste el banco de rompecabezas disponible para esta actividad. Pronto habrá contenido nuevo.'
            : 'Completaste el banco de situaciones cotidianas disponible. Pronto habrá contenido nuevo.';
        options.innerHTML = '';
        feedback.textContent = '';
        return;
    }
    const question = attempt.questions?.[0];
    if (!question || typeof question.id !== 'string' || !Array.isArray(question.options)) {
        const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
        feedback.textContent = 'El servidor devolvió una pregunta no válida.';
        feedback.className = 'feedback bad';
        return;
    }
    serverAttempt = { id: attempt.attemptId, mode: category, question, answered: false, finished: false };
    const prompt = category === 'puzzle' ? $('#puzzleQuestion') : $('#realQuestion');
    const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
    const options = category === 'puzzle' ? $('#puzzleOptions') : $('#realOptions');
    prompt.textContent = question.prompt;
    feedback.textContent = '';
    feedback.className = 'feedback';
    options.innerHTML = question.options.map((value, index) =>
        `<button type="button" class="answer-option" data-option-index="${index}">${Number(value).toLocaleString('es-CO')}</button>`
    ).join('');
    options.querySelectorAll('.answer-option').forEach(button => {
        button.onclick = () => submitServerFreeAnswer(category, Number(button.dataset.optionIndex), button);
    });
}

async function submitServerFreeAnswer(category, selectedOption, selectedButton) {
    const active = serverAttempt;
    if (!active || active.mode !== category || active.answered || active.pending) return;
    active.pending = true;
    active.selectedOption = selectedOption;
    const feedback = category === 'puzzle' ? $('#puzzleFeedback') : $('#realFeedback');
    const options = category === 'puzzle' ? $('#puzzleOptions') : $('#realOptions');
    options.querySelectorAll('button').forEach(button => { button.disabled = true; });
    feedback.textContent = 'Enviando la respuesta al servidor…';
    feedback.className = 'feedback';
    let response;
    try {
        const answerPayload = {
            attemptId: active.id, questionId: active.question.id, selectedOption
        };
        response = await runSafeServerRetry(() => authClient.answerAttemptOnce(answerPayload));
    } catch (error) {
        active.pending = false;
        if (error.status === 401) return lockServerLearningApp('La sesión expiró o fue revocada. Inicia sesión otra vez.');
        if (error.status === 409 || error.status === 404) {
            active.conflict = true;
            feedback.textContent = 'Esta pregunta ya fue respondida o el intento dejó de estar disponible. Actualiza para continuar.';
            feedback.className = 'feedback bad';
            return;
        }
        feedback.textContent = 'No pudimos confirmar la respuesta. Pulsa la misma opción otra vez para consultar el resultado guardado.';
        feedback.className = 'feedback bad';
        selectedButton.disabled = false;
        selectedButton.onclick = () => submitServerFreeAnswer(category, active.selectedOption, selectedButton);
        return;
    }
    active.pending = false;
    active.answered = true;
    let progressConfirmed = false;
    try { await refreshServerProgress(); updateMiniStats(serverAppUser); progressConfirmed = true; }
    catch (error) { if (error.status === 401) return; }
    const correct = response.correct === true;
    const explanation = response.explanation || '';
    const answerText = Number(response.correctAnswer).toLocaleString('es-CO');
    options.querySelectorAll('.answer-option').forEach((button, index) => {
        if (Number(active.question.options[index]) === Number(response.correctAnswer)) button.classList.add('correct');
        if (index === selectedOption && !correct) button.classList.add('wrong');
    });
    const intro = category === 'puzzle' ? '¡Rompecabezas resuelto!' : '¡Aplicaste las matemáticas a la vida real!';
    feedback.textContent = correct
        ? `${intro} ${explanation} ${progressConfirmed ? 'El progreso y los XP se confirmaron en el servidor.' : 'La respuesta fue aceptada, pero no se pudo actualizar el total de XP.'}`
        : `La respuesta correcta era ${answerText}. ${explanation}`;
    feedback.className = `feedback ${correct ? 'good' : 'bad'}`;
    playMelody(correct);
    speak(feedback.textContent);
    const finished = await finishServerFreeAttempt();
    if (!finished) {
        const retryButton = category === 'puzzle' ? $('#newPuzzle') : $('#newRealQuestion');
        retryButton.textContent = 'Reintentar cierre';
        feedback.textContent += ' La respuesta quedó guardada; pulsa el botón para reintentar el cierre antes de continuar.';
        feedback.className = 'feedback bad';
    }
}

function newPuzzle(operation) {
    if (!localDemoMode) {
        loadServerFreeQuestion('puzzle', operation);
        return;
    }
    const puzzle = selectFreeQuestion(FREE_PUZZLES, operation);
    if (!puzzle) {
        $('#puzzleQuestion').textContent = 'Completaste el banco de rompecabezas disponible para esta actividad. Pronto habrá contenido nuevo.';
        $('#puzzleFeedback').textContent = '';
        $('#puzzleOptions').innerHTML = '';
        return;
    }
    $('#puzzleQuestion').textContent = puzzle.prompt;
    const explanation = FREE_QUESTION_EXPLANATIONS[puzzle.id] || `Puedes comprobarlo con ${puzzle.expression || puzzle.prompt}.`;
    $('#puzzleFeedback').textContent = '';
    $('#puzzleFeedback').className = 'feedback';
    $('#puzzleOptions').innerHTML = puzzle.choices.map(v => `<button type="button" class="answer-option">${v}</button>`).join('');

    const activityId = `free:${puzzle.id}`;
    let answered = false;
    $$('#puzzleOptions .answer-option').forEach(button => {
        button.onclick = () => {
            if (answered) return; // one attempt per puzzle: no farming by clicking repeatedly
            answered = true;

            const correct = Number(button.textContent) === puzzle.answer;
            $$('#puzzleOptions .answer-option').forEach(option => {
                option.disabled = true;
                if (Number(option.textContent) === puzzle.answer) option.classList.add('correct');
            });
            if (!correct) button.classList.add('wrong');

            playMelody(correct);
            const user = currentUser();
            markFreeQuestionAnswered(puzzle);
            const gamificationMessages = recordLearningActivity(user, {
                activityId,
                operation: puzzle.operation,
                correct,
                source: 'puzzle',
                level: 1,
                expression: puzzle.expression || puzzle.prompt,
                studentAnswer: button.textContent,
                correctAnswer: puzzle.answer
            });
            announceGamification(user, gamificationMessages);
            if (correct && user?.progress) {
                user.progress.puzzles = toNum(user.progress.puzzles) + 1;
                saveDB();
            }
            const feedbackMessage = correct
                ? `¡Rompecabezas resuelto! ${explanation} ${gamificationMessages.join(' ')}`.trim()
                : `No es la respuesta correcta. ${nextSupportMessage()} ${OPERATION_LEARNING_GUIDES[puzzle.operation].activity} La respuesta correcta era ${puzzle.answer}. ${explanation}`;
            $('#puzzleFeedback').textContent = feedbackMessage;
            $('#puzzleFeedback').className = `feedback ${correct ? 'good' : 'bad'}`;
            speak(feedbackMessage);
        };
    });
}

function newReal() {
    if (!localDemoMode) {
        loadServerFreeQuestion('real-problem');
        return;
    }
    const problem = selectFreeQuestion(FREE_REAL_PROBLEMS);
    if (!problem) {
        $('#realQuestion').textContent = 'Completaste el banco de situaciones cotidianas disponible. Pronto habrá contenido nuevo.';
        $('#realFeedback').textContent = '';
        $('#realOptions').innerHTML = '';
        return;
    }
    $('#realQuestion').textContent = problem.prompt;
    const explanation = FREE_QUESTION_EXPLANATIONS[problem.id] || `Puedes comprobarlo con ${problem.expression || problem.prompt}.`;
    $('#realFeedback').textContent = '';
    $('#realFeedback').className = 'feedback';
    $('#realOptions').innerHTML = problem.choices.map(v => `<button type="button" class="answer-option">${v.toLocaleString('es-CO')}</button>`).join('');

    const activityId = `free:${problem.id}`;
    let answered = false;
    $$('#realOptions .answer-option').forEach((button, index) => {
        button.onclick = () => {
            if (answered) return; // one attempt per problem: no farming by clicking repeatedly
            answered = true;

            const correct = problem.choices[index] === problem.answer;
            $$('#realOptions .answer-option').forEach((option, i) => {
                option.disabled = true;
                if (problem.choices[i] === problem.answer) option.classList.add('correct');
            });
            if (!correct) button.classList.add('wrong');

            playMelody(correct);
            const user = currentUser();
            markFreeQuestionAnswered(problem);
            const gamificationMessages = recordLearningActivity(user, {
                activityId,
                operation: problem.operation,
                correct,
                source: 'real-problem',
                level: 1,
                expression: problem.expression || problem.prompt,
                studentAnswer: problem.choices[index],
                correctAnswer: problem.answer
            });
            announceGamification(user, gamificationMessages);
            if (correct && user?.progress) {
                user.progress.realProblems = toNum(user.progress.realProblems) + 1;
                saveDB();
            }
            const feedbackMessage = correct
                ? `¡Aplicaste las matemáticas a la vida real! ${explanation} ${gamificationMessages.join(' ')}`.trim()
                : `No es la respuesta correcta. ${nextSupportMessage()} ${OPERATION_LEARNING_GUIDES[problem.operation].activity} La respuesta correcta era ${problem.answer.toLocaleString('es-CO')}. ${explanation}`;
            $('#realFeedback').textContent = feedbackMessage;
            $('#realFeedback').className = `feedback ${correct ? 'good' : 'bad'}`;
            speak(feedbackMessage);
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
    const freeMathContent = $('#freeMathContent');
    mathSubjectButton?.addEventListener('click', () => {
        freeMathContent?.classList.remove('hidden');
        mathSubjectButton.setAttribute('aria-expanded', 'true');
        mathSubjectButton.setAttribute('aria-pressed', 'true');
        mathSubjectButton.classList.add('selected');
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
    $('#learningCoachPanel')?.addEventListener('click', event => {
        const button = event.target.closest('[data-learning-practice]');
        if (button) beginRecommendedPractice(button.dataset.learningPractice);
    });
    
    $('#logoutButton').onclick = async () => {
        if (!localDemoMode && serverAppUser) {
            const button = $('#logoutButton');
            button.disabled = true;
            try {
                await authClient.logout();
                serverAppUser = null;
                serverAuthUser = null;
                serverProgressSnapshot = null;
                serverAttempt = null;
                if (quizState?.serverSide) quizState = null;
                setServerAuthStatus('Sesión cerrada. Puedes volver a iniciar sesión con Google.');
                $('#googleButton')?.classList.remove('hidden');
                $('#serverLogoutButton')?.classList.remove('hidden');
                navigate('auth');
            } catch (error) {
                if (error.status === 401) lockServerLearningApp('La sesión ya estaba cerrada.');
                else toast('No se pudo confirmar el cierre de sesión. Inténtalo de nuevo.');
            } finally {
                button.disabled = false;
            }
            return;
        }
        if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch {} }
        clearInterval(timerId); timerId = null;
        resetMathTutorConversation();
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

    $('#musicButton').onclick = () => {
        if (!isStudentSessionActive()) return;
        const audio = $('#studentMusic');
        if (studentMusicEnabled && audio && !audio.paused) {
            studentMusicEnabled = false;
            stopStudentMusic();
        } else {
            studentMusicEnabled = true;
            startStudentMusic();
        }
        syncStudentMusicButton();
    };
    
    $('#greetingButton').onclick = () => { unlockAudio(); greeting(); };

    $('#continueLearningButton').onclick = () => {
        const user = currentUser();
        if (!user || user.role !== 'student') return;

        if (!user.premium) {
            $('#mathSubjectButton')?.click();
            requestAnimationFrame(() => $('#freeMathTitle')?.scrollIntoView({
                behavior: motionReduced() ? 'auto' : 'smooth',
                block: 'start'
            }));
            return;
        }

        const nextOperation = operationKeys.find(operation => user.progress?.operations?.[operation]?.completed !== true);
        if (nextOperation) {
            const missionButton = $(`#operationPath [data-operation="${nextOperation}"]`);
            if (missionButton && !missionButton.disabled) {
                missionButton.click();
                return;
            }
            toast('Completa y aprueba la unidad anterior para continuar.');
            renderHome();
            return;
        }

        const allOperationsComplete = operationKeys.every(operation => user.progress?.operations?.[operation]?.completed === true);
        if (allOperationsComplete && user.progress?.assessment?.completed !== true) {
            const evaluationButton = $('#evaluationButton');
            if (evaluationButton && !evaluationButton.disabled) {
                evaluationButton.click();
            }
        }
    };

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
    $('#practiceButton').onclick = () => startQuiz('practice');
    $('#evaluationButton').onclick = () => startQuiz('assessment');
    $('#repeatMission').onclick = () => startQuiz(lastQuizMode);
    $('#quitQuiz').onclick = () => { clearInterval(timerId); speechSynthesis.cancel(); navigate('home'); };

    $('#mathTutorForm').onsubmit = async event => {
        event.preventDefault();
        if (mathTutorPending) return;
        const input = $('#mathTutorInput');
        const sendButton = $('#mathTutorSend');
        const status = $('#mathTutorStatus');
        const prompt = input.value.trim();
        if (!prompt) {
            status.textContent = 'Escribe una pregunta para continuar.';
            input.focus();
            return;
        }

        mathTutorPending = true;
        sendButton.disabled = true;
        status.textContent = 'Cosmo está pensando...';
        $('#mathTutorForm').setAttribute('aria-busy', 'true');
        try {
            const reply = await requestMathTutor({
                prompt,
                phase: 'chat',
                question: '',
                operation: '',
                studentAnswer: '',
                correctAnswer: ''
            });
            appendMathTutorMessage('user', prompt);
            appendMathTutorMessage('model', reply);
            mathTutorMessages = [
                ...mathTutorMessages,
                { role: 'user', text: prompt },
                { role: 'model', text: reply }
            ].slice(-8);
            input.value = '';
            status.textContent = '';
        } catch (error) {
            console.error('No se pudo completar la pregunta al tutor.', error);
            status.textContent = error.message || 'No se pudo conectar con el tutor. Inténtalo de nuevo.';
        } finally {
            mathTutorPending = false;
            sendButton.disabled = false;
            $('#mathTutorForm').removeAttribute('aria-busy');
        }
    };

    $('#quizTutorButton').onclick = async () => {
        if (mathTutorPending || !quizState?.question) return;
        const button = $('#quizTutorButton');
        const replyElement = $('#quizTutorReply');
        const question = quizState.question;
        const reviewed = Boolean(question.attempted);
        mathTutorPending = true;
        button.disabled = true;
        button.textContent = reviewed ? 'Cosmo está explicando...' : 'Cosmo está pensando...';
        replyElement.textContent = '';
        replyElement.classList.remove('hidden');
        replyElement.classList.remove('error');
        try {
            const reply = await requestMathTutor({
                prompt: reviewed
                    ? 'Explícame paso a paso cómo resolver el ejercicio y ayúdame a entender mi respuesta.'
                    : 'Dame una pista breve para pensar y resolver el ejercicio, sin decirme el resultado.',
                phase: reviewed ? 'review' : 'hint',
                operation: question.operation,
                question: question.text,
                studentAnswer: reviewed ? question.studentAnswer : '',
                correctAnswer: reviewed ? String(question.answer) : '',
                history: []
            });
            replyElement.textContent = reply;
        } catch (error) {
            console.error('No se pudo obtener la ayuda del tutor para el ejercicio.', error);
            const localSupport = reviewed
                ? buildLocalMathExplanation(question)
                : buildLocalMathHint(question);
            replyElement.textContent = `${error.message || 'No se pudo conectar con el tutor. Inténtalo de nuevo.'} ${localSupport}`;
            replyElement.classList.add('error');
        } finally {
            mathTutorPending = false;
            button.disabled = false;
            button.textContent = reviewed ? '✨ Pedir explicación a Cosmo IA' : '✨ Pedir otra pista a Cosmo IA';
        }
    };
    
    $('#answerForm').onsubmit = e => {
        e.preventDefault(); unlockAudio();
        const typed = $('#writtenAnswer').value.trim();
        if (quizState?.serverSide) {
            const typedIndex = typed === '' ? -1 : quizState.question.options.findIndex(option => Number(option) === Number(typed));
            const optionIndex = typedIndex >= 0 ? typedIndex : selectedAnswer;
            if (!Number.isInteger(optionIndex) || optionIndex < 0) {
                $('#feedback').textContent = 'Selecciona una de las opciones que envió el servidor.';
                $('#feedback').className = 'feedback bad';
                return;
            }
            checkAnswer(optionIndex);
            return;
        }
        const value = typed !== '' ? Number(typed) : selectedAnswer;
        if (value === null || value === undefined || Number.isNaN(value)) {
            const message = `Selecciona o escribe una respuesta, ${currentUser().name}. Tómate tu tiempo.`;
            $('#feedback').textContent = message; $('#feedback').className = 'feedback bad'; speak(message); return;
        }
        checkAnswer(value);
    };
    
    $('#nextQuestion').onclick = () => {
        speechSynthesis.cancel();
        if (quizState?.serverSide && quizState.serverConflict) {
            refreshServerProgress().catch(() => {});
            navigate('home');
            return;
        }
        if (quizState?.serverSide && quizState.question?.answerError) {
            quizState.question.answerError = false;
            submitServerQuizAnswer(quizState.question.pendingOption);
            return;
        }
        quizState.index >= quizState.total ? finishQuiz() : nextQuizQuestion();
    };

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
    
    $('#newPuzzle').onclick = () => newPuzzle();
    $('#newRealQuestion').onclick = newReal;
    setupGoogleAuth();
    window.addEventListener('google-ready', setupGoogleAuth, { once: true });
    applyLogoSettings(currentUser()?.settings?.logo);
    setupRevealAnimations();
}

// ==========================================
// 9. INITIALIZE
// ==========================================
if (localDemoMode) {
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
} else {
    navigate('auth');
    initializeServerAuth();
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}
