'use strict';

(function exposeAuthClient(root, factory) {
    const client = factory();
    if (typeof module === 'object' && module.exports) module.exports = client;
    if (root) root.TTLAuthClient = client;
})(typeof globalThis === 'object' ? globalThis : this, function createAuthClient() {
    const apiBase = '/api';
    const pendingAnswers = new Map();

    async function request(path, options = {}) {
        const response = await fetch(`${apiBase}${path}`, {
            credentials: 'same-origin',
            cache: 'no-store',
            ...options
        });
        if (response.status === 204) return null;
        let payload;
        try { payload = await response.json(); }
        catch { throw new Error('El servidor devolvió una respuesta inválida.'); }
        if (!response.ok) {
            const error = new Error(typeof payload?.error === 'string'
                ? payload.error : 'No se pudo completar la solicitud.');
            error.status = response.status;
            throw error;
        }
        return payload;
    }

    function isLocalDemoAllowed(locationLike) {
        if (!locationLike) return false;
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(locationLike.hostname);
        if (!loopback) return false;
        return new URLSearchParams(locationLike.search || '').get('ttl-demo') === '1';
    }

    function answerAttemptOnce(payload) {
        const key = `${payload?.attemptId || ''}:${payload?.questionId || ''}`;
        const fingerprint = JSON.stringify(payload);
        const existing = pendingAnswers.get(key);
        if (existing) {
            if (existing.fingerprint !== fingerprint) {
                return Promise.reject(new Error('Ya hay otra respuesta pendiente para esta pregunta.'));
            }
            return existing.promise;
        }
        const promise = request('/attempts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, action: 'answer' })
        }).finally(() => pendingAnswers.delete(key));
        pendingAnswers.set(key, { fingerprint, promise });
        return promise;
    }

    return {
        isLocalDemoAllowed,
        getConfig: () => request('/auth/config', { method: 'GET' }),
        getSession: () => request('/auth/session', { method: 'GET' }),
        getProgress: () => request('/progress', { method: 'GET' }),
        startAttempt: payload => request('/attempts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, action: 'start' })
        }),
        answerAttempt: payload => request('/attempts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, action: 'answer' })
        }),
        answerAttemptOnce,
        finishAttempt: attemptId => request('/attempts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'finish', attemptId })
        }),
        loginWithGoogle: credential => request('/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        }),
        logout: () => request('/auth/logout', { method: 'POST' })
    };
});
