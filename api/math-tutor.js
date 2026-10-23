const { handler } = require('../netlify/functions/math-tutor');

function allowedOrigins() {
    return (process.env.MATH_TUTOR_ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => {
            try {
                return new URL(value.trim()).origin;
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

module.exports = async (request, response) => {
    const origin = request.headers.origin;
    const origins = allowedOrigins();
    if (!origin || !origins.includes(origin)) {
        response.status(403).json({ error: 'No se pudo validar el origen de la solicitud.' });
        return;
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(204).end();
        return;
    }

    const result = await handler({
        httpMethod: request.method,
        headers: {
            ...request.headers,
            'x-nf-client-connection-ip': request.headers['x-real-ip'] || 'unknown'
        },
        body: typeof request.body === 'string'
            ? request.body
            : JSON.stringify(request.body ?? null)
    });

    for (const [name, value] of Object.entries(result.headers)) {
        response.setHeader(name, value);
    }
    response.status(result.statusCode).send(result.body);
};
