'use strict';

const { sendJson } = require('../_lib/http');
const { findActiveSession } = require('../_lib/auth-repository');
const { hashSessionToken, readSessionToken } = require('../_lib/sessions');

function createHandler(dependencies = {}) {
    const env = dependencies.env || process.env;
    const lookup = dependencies.findActiveSession || findActiveSession;
    const hashToken = dependencies.hashSessionToken || hashSessionToken;

    return async function sessionHandler(request, response) {
        if (request.method !== 'GET') {
            response.setHeader('Allow', 'GET');
            return sendJson(response, 405, { error: 'Método no permitido.' });
        }
        if (env.AUTH_MODE !== 'server' || (!dependencies.findActiveSession && !env.DATABASE_URL)) {
            return sendJson(response, 503, { error: 'La sesión del servidor no está configurada.' });
        }
        const token = readSessionToken(request, env);
        if (!token) return sendJson(response, 401, { authenticated: false });
        try {
            const user = await lookup(hashToken(token), env);
            if (!user) return sendJson(response, 401, { authenticated: false });
            return sendJson(response, 200, {
                authenticated: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    premium: user.premium === true
                }
            });
        } catch {
            return sendJson(response, 503, { error: 'No se pudo consultar la sesión.' });
        }
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
