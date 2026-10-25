'use strict';

const { sendJson, configuredOrigin } = require('../_lib/http');

function createHandler(env = process.env) {
    return function authConfigHandler(request, response) {
        if (request.method !== 'GET') {
            response.setHeader('Allow', 'GET');
            return sendJson(response, 405, { error: 'Método no permitido.' });
        }
        const enabled = env.AUTH_MODE === 'server'
            && Boolean(env.GOOGLE_CLIENT_ID)
            && Boolean(env.DATABASE_URL)
            && Boolean(configuredOrigin(env));
        return sendJson(response, 200, { enabled });
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
