'use strict';

const { sendJson, hasSameOrigin, readJsonBody } = require('../_lib/http');
const { verifyGoogleIdToken } = require('../_lib/google');
const { createGoogleSession } = require('../_lib/auth-repository');
const {
    newSessionToken,
    hashSessionToken,
    sessionCookie
} = require('../_lib/sessions');

function createHandler(dependencies = {}) {
    const env = dependencies.env || process.env;
    const verify = dependencies.verifyGoogleIdToken || verifyGoogleIdToken;
    const persistSession = dependencies.createGoogleSession || createGoogleSession;
    const createToken = dependencies.newSessionToken || newSessionToken;
    const hashToken = dependencies.hashSessionToken || hashSessionToken;

    return async function googleAuthHandler(request, response) {
        if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST');
            return sendJson(response, 405, { error: 'Método no permitido.' });
        }
        if (env.AUTH_MODE !== 'server' || !env.APP_ORIGIN || !env.GOOGLE_CLIENT_ID
            || (!dependencies.createGoogleSession && !env.DATABASE_URL)) {
            return sendJson(response, 503, { error: 'La autenticación todavía no está configurada en el servidor.' });
        }
        if (!hasSameOrigin(request, env)) {
            return sendJson(response, 403, { error: 'Origen no autorizado.' });
        }
        if ((request.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
            return sendJson(response, 415, { error: 'La solicitud debe usar JSON.' });
        }

        let body;
        try { body = readJsonBody(request); }
        catch (error) {
            return sendJson(response, error.statusCode || 400, { error: 'La solicitud no tiene un formato válido.' });
        }
        if (!body || typeof body.credential !== 'string' || body.credential.length < 20 || body.credential.length > 8192) {
            return sendJson(response, 400, { error: 'Falta la credencial de Google.' });
        }

        let profile;
        try {
            profile = await verify(body.credential, env.GOOGLE_CLIENT_ID);
        } catch {
            return sendJson(response, 401, { error: 'Google no pudo verificar esta cuenta.' });
        }
        if (!profile || typeof profile.sub !== 'string' || !profile.sub
            || typeof profile.email !== 'string' || !profile.email
            || typeof profile.name !== 'string') {
            return sendJson(response, 401, { error: 'La identidad recibida no es válida.' });
        }

        try {
            const token = createToken();
            const user = await persistSession(profile, hashToken(token), env);
            response.setHeader('Set-Cookie', sessionCookie(token, env));
            return sendJson(response, 200, {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    premium: user.premium === true
                }
            });
        } catch {
            return sendJson(response, 503, { error: 'No se pudo iniciar la sesión. Inténtalo más tarde.' });
        }
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
