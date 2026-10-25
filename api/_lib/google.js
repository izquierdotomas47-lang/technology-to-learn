'use strict';

async function verifyGoogleIdToken(idToken, clientId) {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return normalizeGooglePayload(ticket.getPayload(), clientId);
}

function normalizeGooglePayload(payload, clientId) {
    if (!payload
        || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)
        || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255
        || typeof payload.email !== 'string' || !payload.email || payload.email.length > 320
        || payload.email_verified !== true
        || payload.aud !== clientId) {
        throw new Error('Google identity claims are invalid');
    }
    return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 160) : ''
    };
}

module.exports = { verifyGoogleIdToken, normalizeGooglePayload };
