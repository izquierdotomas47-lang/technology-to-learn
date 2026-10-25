'use strict';

const { sendJson } = require('./_lib/http');
const { findUserProgress } = require('./_lib/auth-repository');
const { hashSessionToken, readSessionToken } = require('./_lib/sessions');

function createHandler(dependencies = {}) {
    const env = dependencies.env || process.env;
    const lookup = dependencies.findUserProgress || findUserProgress;
    const hashToken = dependencies.hashSessionToken || hashSessionToken;

    return async function progressHandler(request, response) {
        if (request.method !== 'GET') {
            response.setHeader('Allow', 'GET');
            return sendJson(response, 405, { error: 'Método no permitido.' });
        }
        if (env.AUTH_MODE !== 'server' || (!dependencies.findUserProgress && !env.DATABASE_URL)) {
            return sendJson(response, 503, { error: 'El progreso del servidor no está configurado.' });
        }
        const token = readSessionToken(request, env);
        if (!token) return sendJson(response, 401, { error: 'Inicia sesión para consultar el progreso.' });
        try {
            const record = await lookup(hashToken(token), env);
            if (!record) return sendJson(response, 401, { error: 'La sesión expiró o fue revocada.' });
            return sendJson(response, 200, {
                version: record.schema_version || 1,
                state: {
                    ...(record.state && typeof record.state === 'object' ? record.state : {}),
                    xp: Number(record.xp || 0),
                    stars: Number(record.stars || 0),
                    answeredQuestionIds: Array.isArray(record.answered_question_ids)
                        ? record.answered_question_ids : [],
                    operations: record.operations && typeof record.operations === 'object' ? record.operations : {},
                    assessment: record.assessment && typeof record.assessment === 'object'
                        ? record.assessment : { attempts: 0, completed: false }
                },
                imported: false
            });
        } catch {
            return sendJson(response, 503, { error: 'No se pudo consultar el progreso.' });
        }
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
