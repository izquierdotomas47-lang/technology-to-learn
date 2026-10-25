'use strict';

const { sendJson, hasSameOrigin } = require('../_lib/http');
const { revokeSession } = require('../_lib/auth-repository');
const {
    hashSessionToken,
    readSessionToken,
    clearedSessionCookie
} = require('../_lib/sessions');

function createHandler(dependencies = {}) {
    const env = dependencies.env || process.env;
    const revoke = dependencies.revokeSession || revokeSession;
    const hashToken = dependencies.hashSessionToken || hashSessionToken;

    return async function logoutHandler(request, response) {
        if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST');
            return sendJson(response, 405, { error: 'Método no permitido.' });
        }
        if (env.AUTH_MODE !== 'server' || !env.APP_ORIGIN
            || (!dependencies.revokeSession && !env.DATABASE_URL)) {
            return sendJson(response, 503, { error: 'El cierre de sesión no está configurado.' });
        }
        if (!hasSameOrigin(request, env)) {
            return sendJson(response, 403, { error: 'Origen no autorizado.' });
        }

        const token = readSessionToken(request, env);
        try {
            if (token) await revoke(hashToken(token), env);
            response.setHeader('Set-Cookie', clearedSessionCookie(env));
            response.setHeader('Cache-Control', 'no-store');
            response.setHeader('X-Content-Type-Options', 'nosniff');
            response.status(204).end();
        } catch {
            return sendJson(response, 503, { error: 'No se pudo cerrar la sesión de forma segura.' });
        }
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
