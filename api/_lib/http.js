'use strict';

function sendJson(response, statusCode, payload, headers = {}) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    response.status(statusCode).json(payload);
}

function configuredOrigin(env = process.env) {
    const value = env.APP_ORIGIN;
    if (typeof value !== 'string' || !value) return null;
    try {
        const parsed = new URL(value);
        if (parsed.origin !== value || parsed.username || parsed.password) return null;
        const deployed = env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview'
            || env.NODE_ENV === 'production';
        if (deployed && parsed.protocol !== 'https:') return null;
        if (!deployed && parsed.protocol !== 'https:'
            && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname))) return null;
        return parsed.origin;
    } catch {
        return null;
    }
}

function hasSameOrigin(request, env = process.env) {
    const expected = configuredOrigin(env);
    return Boolean(expected && request.headers?.origin === expected);
}

function readJsonBody(request, maxBytes = 12_288) {
    const declaredLength = Number(request.headers?.['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        const error = new Error('Request body too large');
        error.statusCode = 413;
        throw error;
    }

    const body = request.body;
    if (typeof body === 'string') {
        if (Buffer.byteLength(body, 'utf8') > maxBytes) {
            const error = new Error('Request body too large');
            error.statusCode = 413;
            throw error;
        }
        try { return JSON.parse(body); }
        catch {
            const error = new Error('Invalid JSON');
            error.statusCode = 400;
            throw error;
        }
    }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) {
            const error = new Error('Request body too large');
            error.statusCode = 413;
            throw error;
        }
        return body;
    }
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
}

module.exports = { sendJson, configuredOrigin, hasSameOrigin, readJsonBody };
