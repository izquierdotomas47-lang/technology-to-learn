'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler: googleHandler } = require('../api/auth/google');
const { createHandler: sessionHandler } = require('../api/auth/session');
const { createHandler: logoutHandler } = require('../api/auth/logout');
const { createHandler: configHandler } = require('../api/auth/config');
const { createHandler: progressHandler } = require('../api/progress');
const { createHandler: attemptsHandler } = require('../api/attempts');
const authClient = require('../public/js/auth-client');
const {
    newSessionToken,
    hashSessionToken,
    readSessionToken,
    sessionCookie,
    clearedSessionCookie
} = require('../api/_lib/sessions');
const { configuredOrigin, hasSameOrigin, readJsonBody } = require('../api/_lib/http');
const { getSql } = require('../api/_lib/database');
const { normalizeGooglePayload, verifyGoogleIdToken } = require('../api/_lib/google');

const developmentEnv = {
    AUTH_MODE: 'server',
    APP_ORIGIN: 'http://127.0.0.1:5501',
    GOOGLE_CLIENT_ID: 'test-client-id',
    DATABASE_URL: 'postgresql://test.invalid/test',
    NODE_ENV: 'development'
};

function responseRecorder() {
    return {
        headers: {},
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        end() { this.ended = true; return this; }
    };
}

function request(method, { origin, cookie, body, headers = {} } = {}) {
    return {
        method,
        headers: {
            ...(origin ? { origin } : {}),
            ...(cookie ? { cookie } : {}),
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...headers
        },
        body
    };
}

test('Google login creates a hashed server session and returns no bearer token', async () => {
    let savedProfile;
    let savedHash;
    let verified;
    const handler = googleHandler({
        env: developmentEnv,
        verifyGoogleIdToken: async (credential, audience) => {
            verified = { credential, audience };
            return { sub: 'google-subject', email: 'student@example.test', name: 'Student' };
        },
        newSessionToken: () => 'x'.repeat(43),
        hashSessionToken: token => `hash:${token}`,
        createGoogleSession: async (profile, tokenHash) => {
            savedProfile = profile;
            savedHash = tokenHash;
            return { id: 'server-user-id', email: profile.email, name: profile.name, role: 'student', premium: false };
        }
    });
    const response = responseRecorder();
    await handler(request('POST', {
        origin: developmentEnv.APP_ORIGIN,
        body: { credential: 'a'.repeat(100) }
    }), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(verified, { credential: 'a'.repeat(100), audience: 'test-client-id' });
    assert.equal(savedProfile.sub, 'google-subject');
    assert.equal(savedHash, `hash:${'x'.repeat(43)}`);
    assert.equal(response.body.user.id, 'server-user-id');
    assert.equal(JSON.stringify(response.body).includes('x'.repeat(43)), false);
    assert.match(response.headers['Set-Cookie'], /HttpOnly/);
    assert.match(response.headers['Set-Cookie'], /SameSite=Lax/);
    assert.doesNotMatch(response.headers['Set-Cookie'], /Secure/);
    assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('Google login rejects an unapproved origin before token verification', async () => {
    let verified = false;
    const handler = googleHandler({
        env: developmentEnv,
        verifyGoogleIdToken: async () => { verified = true; },
        createGoogleSession: async () => assert.fail('session must not be created')
    });
    const response = responseRecorder();
    await handler(request('POST', { origin: 'https://attacker.example', body: { credential: 'a'.repeat(100) } }), response);
    assert.equal(response.statusCode, 403);
    assert.equal(verified, false);
});

test('Google login requires a JSON request body', async () => {
    const handler = googleHandler({
        env: developmentEnv,
        verifyGoogleIdToken: async () => assert.fail('token must not be verified'),
        createGoogleSession: async () => assert.fail('session must not be created')
    });
    const response = responseRecorder();
    await handler(request('POST', {
        origin: developmentEnv.APP_ORIGIN,
        body: { credential: 'a'.repeat(100) },
        headers: { 'content-type': 'text/plain' }
    }), response);
    assert.equal(response.statusCode, 415);
});

test('Google identity claims require the expected audience, issuer, stable subject, and verified email', () => {
    const valid = {
        iss: 'https://accounts.google.com',
        aud: 'test-client-id',
        sub: 'google-subject',
        email: 'Student@Example.Test',
        email_verified: true,
        name: 'Student'
    };
    assert.deepEqual(normalizeGooglePayload(valid, 'test-client-id'), {
        sub: 'google-subject', email: 'student@example.test', name: 'Student'
    });
    for (const payload of [
        { ...valid, aud: 'other-client' },
        { ...valid, iss: 'https://attacker.example' },
        { ...valid, email_verified: false },
        { ...valid, sub: '' },
        { ...valid, email: '' }
    ]) {
        assert.throws(() => normalizeGooglePayload(payload, 'test-client-id'));
    }
});

test('the maintained Google verifier rejects a malformed ID token', async () => {
    await assert.rejects(verifyGoogleIdToken('not-a-jwt', 'test-client-id'));
});

test('Google login rejects invalid or oversized credentials without creating a session', async () => {
    let sessions = 0;
    const handler = googleHandler({
        env: developmentEnv,
        verifyGoogleIdToken: async () => { throw new Error('invalid token'); },
        createGoogleSession: async () => { sessions++; }
    });
    const invalidResponse = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, body: { credential: 'a'.repeat(100) } }), invalidResponse);
    assert.equal(invalidResponse.statusCode, 401);
    const oversizedResponse = responseRecorder();
    await handler(request('POST', {
        origin: developmentEnv.APP_ORIGIN,
        body: { credential: 'a'.repeat(9_000) }
    }), oversizedResponse);
    assert.equal(oversizedResponse.statusCode, 400);
    assert.equal(sessions, 0);
});

test('missing server configuration fails closed', async () => {
    const handler = googleHandler({ env: { APP_ORIGIN: developmentEnv.APP_ORIGIN } });
    const response = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, body: { credential: 'a'.repeat(100) } }), response);
    assert.equal(response.statusCode, 503);
});

test('identity and progress endpoints stay closed unless AUTH_MODE is explicitly server', async () => {
    const disabledEnv = { ...developmentEnv, AUTH_MODE: 'disabled' };
    const createGoogleSession = async () => assert.fail('no account may be created while disabled');
    const verifyGoogleIdToken = async () => assert.fail('no token may be verified while disabled');
    const googleResponse = responseRecorder();
    await googleHandler({ env: disabledEnv, createGoogleSession, verifyGoogleIdToken })(
        request('POST', { origin: disabledEnv.APP_ORIGIN, body: { credential: 'a'.repeat(100) } }), googleResponse);
    assert.equal(googleResponse.statusCode, 503);

    const sessionResponse = responseRecorder();
    await sessionHandler({ env: disabledEnv, findActiveSession: async () => assert.fail('session lookup must stay closed') })(
        request('GET'), sessionResponse);
    assert.equal(sessionResponse.statusCode, 503);

    const progressResponse = responseRecorder();
    await progressHandler({ env: disabledEnv, findUserProgress: async () => assert.fail('progress lookup must stay closed') })(
        request('GET'), progressResponse);
    assert.equal(progressResponse.statusCode, 503);
});

test('public auth configuration remains disabled unless explicitly enabled and complete', () => {
    const handler = configHandler({});
    const disabled = responseRecorder();
    handler(request('GET'), disabled);
    assert.deepEqual(disabled.body, { enabled: false });

    const enabled = responseRecorder();
    configHandler({
        ...developmentEnv,
        APP_ORIGIN: 'https://app.example.test',
        VERCEL_ENV: 'production'
    })(request('GET'), enabled);
    assert.deepEqual(enabled.body, { enabled: true });
});

test('session lookup hashes the cookie and never accepts a user ID from the request', async () => {
    let lookedUpHash;
    const handler = sessionHandler({
        env: { AUTH_MODE: 'server' },
        hashSessionToken: token => `hash:${token}`,
        findActiveSession: async hash => {
            lookedUpHash = hash;
            return { id: 'user-from-session', name: 'Student', email: 'student@example.test', role: 'student', premium: false };
        }
    });
    const token = 'y'.repeat(43);
    const response = responseRecorder();
    await handler(request('GET', { cookie: `other=1; ttl_session=${token}`, headers: { 'x-user-id': 'attacker-chosen-id' } }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(lookedUpHash, `hash:${token}`);
    assert.equal(response.body.user.id, 'user-from-session');
    assert.equal(JSON.stringify(response.body).includes(token), false);
});

test('session lookup rejects absent and malformed cookies', async () => {
    let lookups = 0;
    const handler = sessionHandler({ env: { AUTH_MODE: 'server' }, findActiveSession: async () => { lookups++; return null; } });
    for (const cookie of [undefined, 'ttl_session=bad']) {
        const response = responseRecorder();
        await handler(request('GET', { cookie }), response);
        assert.equal(response.statusCode, 401);
    }
    assert.equal(lookups, 0);
});

test('session lookup treats expired or revoked database sessions as unauthenticated', async () => {
    const handler = sessionHandler({
        env: { AUTH_MODE: 'server' },
        findActiveSession: async () => null
    });
    const response = responseRecorder();
    await handler(request('GET', { cookie: `ttl_session=${'e'.repeat(43)}` }), response);
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { authenticated: false });
});

test('logout requires same origin, revokes the hashed session, and clears the cookie', async () => {
    let revokedHash;
    const handler = logoutHandler({
        env: developmentEnv,
        hashSessionToken: token => `hash:${token}`,
        revokeSession: async hash => { revokedHash = hash; }
    });
    const token = 'z'.repeat(43);
    const blocked = responseRecorder();
    await handler(request('POST', { origin: 'https://attacker.example', cookie: `ttl_session=${token}` }), blocked);
    assert.equal(blocked.statusCode, 403);
    assert.equal(revokedHash, undefined);

    const response = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie: `ttl_session=${token}` }), response);
    assert.equal(response.statusCode, 204);
    assert.equal(revokedHash, `hash:${token}`);
    assert.match(response.headers['Set-Cookie'], /Max-Age=0/);
    assert.match(response.headers['Set-Cookie'], /HttpOnly/);
});

test('production origins and cookies require HTTPS and use Secure', () => {
    const env = { APP_ORIGIN: 'https://app.example.test', VERCEL_ENV: 'production' };
    assert.equal(configuredOrigin(env), env.APP_ORIGIN);
    assert.equal(configuredOrigin({ ...env, APP_ORIGIN: 'http://app.example.test' }), null);
    assert.equal(configuredOrigin({ ...env, APP_ORIGIN: 'https://app.example.test/path' }), null);
    assert.equal(hasSameOrigin(request('POST', { origin: env.APP_ORIGIN }), env), true);
    assert.match(sessionCookie('a'.repeat(43), env), /; Secure/);
    assert.match(sessionCookie('a'.repeat(43), env), /^__Host-ttl_session=/);
    assert.match(clearedSessionCookie(env), /; Secure/);
});

test('session tokens are unpredictable-format values and only hashes are persistent identifiers', () => {
    const one = newSessionToken();
    const two = newSessionToken();
    assert.match(one, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(one, two);
    assert.match(hashSessionToken(one), /^[a-f0-9]{64}$/);
    assert.notEqual(hashSessionToken(one), one);
    assert.equal(readSessionToken(request('GET', { cookie: `ttl_session=${one}` })), one);
    const secureEnv = { VERCEL_ENV: 'production' };
    assert.equal(readSessionToken(request('GET', { cookie: `__Host-ttl_session=${one}` }), secureEnv), one);
});

test('request parser rejects oversized and malformed payloads', () => {
    assert.throws(() => readJsonBody({ headers: { 'content-length': '20000' }, body: {} }), { statusCode: 413 });
    assert.throws(() => readJsonBody({ headers: {}, body: '{' }), { statusCode: 400 });
    assert.deepEqual(readJsonBody({ headers: {}, body: { ok: true } }), { ok: true });
});

test('database adapter refuses missing or non-PostgreSQL URLs without attempting a connection', async () => {
    await assert.rejects(getSql({}), /DATABASE_URL is not configured/);
    await assert.rejects(getSql({ DATABASE_URL: 'mysql://example.test/db' }), /must use PostgreSQL/);
});

test('Neon serverless driver initializes from a PostgreSQL URL without contacting the database', async () => {
    const sql = await getSql({ DATABASE_URL: 'postgresql://ttl_test:placeholder@127.0.0.1:5432/ttl_test' });
    assert.equal(typeof sql, 'function');
});

test('progress endpoint is authenticated, read-only, and does not accept a client owner ID', async () => {
    let receivedHash;
    const handler = progressHandler({
        env: { AUTH_MODE: 'server' },
        hashSessionToken: token => `hash:${token}`,
        findUserProgress: async hash => {
            receivedHash = hash;
            return { user_id: 'server-user-a', schema_version: 1, state: {}, xp: 12, stars: 2, answered_question_ids: ['puzzle-a'] };
        }
    });
    const token = 'p'.repeat(43);
    const response = responseRecorder();
    await handler({
        method: 'GET',
        headers: { cookie: `ttl_session=${token}`, 'x-user-id': 'user-b' },
        query: { userId: 'user-b' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(receivedHash, `hash:${token}`);
    assert.deepEqual(response.body, { version: 1, state: {
        xp: 12, stars: 2, answeredQuestionIds: ['puzzle-a'], operations: {},
        assessment: { attempts: 0, completed: false }
    }, imported: false });

    const write = responseRecorder();
    await handler(request('POST'), write);
    assert.equal(write.statusCode, 405);
    assert.equal(write.headers.Allow, 'GET');
});

test('progress endpoint rejects absent, expired, or revoked sessions and backend failures', async () => {
    const handler = progressHandler({
        env: { AUTH_MODE: 'server' },
        findUserProgress: async () => null
    });
    const absent = responseRecorder();
    await handler(request('GET'), absent);
    assert.equal(absent.statusCode, 401);

    const expired = responseRecorder();
    await handler(request('GET', { cookie: `ttl_session=${'r'.repeat(43)}` }), expired);
    assert.equal(expired.statusCode, 401);

    const failing = progressHandler({
        env: { AUTH_MODE: 'server' },
        findUserProgress: async () => { throw new Error('database unavailable'); }
    });
    const unavailable = responseRecorder();
    await failing(request('GET', { cookie: `ttl_session=${'r'.repeat(43)}` }), unavailable);
    assert.equal(unavailable.statusCode, 503);
});

test('local demo requires an explicit loopback URL and the production hostname never enables it', () => {
    assert.equal(authClient.isLocalDemoAllowed({ hostname: '127.0.0.1', search: '?ttl-demo=1' }), true);
    assert.equal(authClient.isLocalDemoAllowed({ hostname: 'localhost', search: '?ttl-demo=1' }), true);
    assert.equal(authClient.isLocalDemoAllowed({ hostname: 'localhost', search: '' }), false);
    assert.equal(authClient.isLocalDemoAllowed({ hostname: 'app.example.test', search: '?ttl-demo=1' }), false);
});

test('auth client uses same-origin cookies, never returns tokens to storage, and reports HTTP failures', async () => {
    const previousFetch = globalThis.fetch;
    let observedRequest;
    try {
        globalThis.fetch = async (url, options) => {
            observedRequest = { url, options };
            return { status: 200, ok: true, json: async () => ({ user: { id: 'server-id', role: 'student' } }) };
        };
        const login = await authClient.loginWithGoogle('credential-test');
        assert.equal(login.user.id, 'server-id');
        assert.equal(observedRequest.url, '/api/auth/google');
        assert.equal(observedRequest.options.credentials, 'same-origin');
        assert.equal(observedRequest.options.cache, 'no-store');
        assert.equal(observedRequest.options.headers['Content-Type'], 'application/json');
        assert.equal(observedRequest.options.body, JSON.stringify({ credential: 'credential-test' }));
        assert.equal('localStorage' in login, false);

        globalThis.fetch = async (url, options) => {
            observedRequest = { url, options };
            return { status: 200, ok: true, json: async () => ({ attemptId: 'attempt-test' }) };
        };
        const start = await authClient.startAttempt({ mode: 'practice', operation: 'add', level: 1, total: 3, idempotencyKey: 'idempotency-key-1234' });
        assert.equal(start.attemptId, 'attempt-test');
        assert.equal(observedRequest.url, '/api/attempts');
        assert.deepEqual(JSON.parse(observedRequest.options.body), {
            mode: 'practice', operation: 'add', level: 1, total: 3,
            idempotencyKey: 'idempotency-key-1234', action: 'start'
        });

        globalThis.fetch = async (url, options) => {
            observedRequest = { url, options };
            return { status: 200, ok: true, json: async () => ({ version: 1, state: { xp: 7, stars: 2 }, imported: false }) };
        };
        assert.deepEqual(await authClient.getProgress(), { version: 1, state: { xp: 7, stars: 2 }, imported: false });
        assert.equal(observedRequest.url, '/api/progress');
        assert.equal(observedRequest.options.credentials, 'same-origin');

        let answerCalls = 0;
        let releaseAnswer;
        globalThis.fetch = async () => {
            answerCalls++;
            await new Promise(resolve => { releaseAnswer = resolve; });
            return { status: 200, ok: true, json: async () => ({ correct: true }) };
        };
        const answerPayload = { attemptId: 'attempt-test', questionId: 'math-v1-1', selectedOption: 2 };
        const answerA = authClient.answerAttemptOnce(answerPayload);
        const answerB = authClient.answerAttemptOnce(answerPayload);
        assert.equal(answerCalls, 1);
        await assert.rejects(authClient.answerAttemptOnce({ ...answerPayload, selectedOption: 1 }), /otra respuesta pendiente/);
        releaseAnswer();
        assert.deepEqual(await answerA, { correct: true });
        assert.deepEqual(await answerB, { correct: true });
        assert.equal(answerCalls, 1);

        globalThis.fetch = async (url, options) => {
            observedRequest = { url, options };
            return { status: 200, ok: true, json: async () => ({ score: 2, total: 3 }) };
        };
        assert.deepEqual(await authClient.finishAttempt('attempt-test'), { score: 2, total: 3 });
        assert.equal(observedRequest.url, '/api/attempts');
        assert.deepEqual(JSON.parse(observedRequest.options.body), { action: 'finish', attemptId: 'attempt-test' });

        globalThis.fetch = async () => ({ status: 503, ok: false, json: async () => ({ error: 'not configured' }) });
        await assert.rejects(authClient.getConfig(), error => error.status === 503 && error.message === 'not configured');
        globalThis.fetch = async () => ({ status: 401, ok: false, json: async () => ({ error: 'expired session' }) });
        await assert.rejects(authClient.getProgress(), error => error.status === 401 && error.message === 'expired session');
        globalThis.fetch = async () => { throw new TypeError('offline'); };
        await assert.rejects(authClient.getSession(), /offline/);
    } finally {
        globalThis.fetch = previousFetch;
    }
});

test('attempts require an authenticated same-origin session and reject client-owned rewards', async () => {
    let created = false;
    const handler = attemptsHandler({
        env: developmentEnv,
        findActiveSession: async () => ({ id: 'user-a', role: 'student', premium: true }),
        repository: { createAttempt: async () => { created = true; } }
    });
    const unauthorized = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, body: { action: 'start' } }), unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const forged = responseRecorder();
    await handler({ method: 'POST', headers: { origin: developmentEnv.APP_ORIGIN,
        cookie: `ttl_session=${'a'.repeat(43)}`, 'content-type': 'application/json' },
        body: { action: 'start', mode: 'practice', operation: 'add', level: 1, total: 2,
            idempotencyKey: 'idempotency-key-0001', xp: 99999, userId: 'user-b' } }, forged);
    assert.equal(forged.statusCode, 400);
    assert.equal(created, false);
});

test('attempt start is idempotent and never returns correct answers', async () => {
    let stored;
    const question = { id: 'math-v1-1', operation: 'add', options: [3, 4, 5, 6], correctAnswer: 5, correctOption: 5 };
    const handler = attemptsHandler({
        env: developmentEnv,
        findActiveSession: async () => ({ id: 'user-a', role: 'student', premium: true }),
        makeQuestionSet: () => [question],
        repository: {
            canStartPractice: async () => true,
            findAttempt: async () => stored,
            createAttempt: async (userId, attempt) => {
                stored = { id: 'attempt-1', ...attempt, request_signature: attempt.signature,
                    question_set: attempt.questions, score: 0, total: attempt.questions.length, status: 'open' };
                return stored;
            }
        }
    });
    const makeRequest = () => request('POST', { origin: developmentEnv.APP_ORIGIN,
        cookie: `ttl_session=${'b'.repeat(43)}`, body: { action: 'start', mode: 'practice',
            operation: 'add', level: 1, total: 1, idempotencyKey: 'idempotency-key-0002' } });
    const first = responseRecorder(); await handler(makeRequest(), first);
    const retry = responseRecorder(); await handler(makeRequest(), retry);
    assert.equal(first.statusCode, 200);
    assert.equal(retry.statusCode, 200);
    assert.equal(first.body.attemptId, retry.body.attemptId);
    assert.equal('correctAnswer' in first.body.questions[0], false);
    assert.equal('correctOption' in first.body.questions[0], false);
});

test('free bank exhaustion and assessment unlock are decided from server data', async () => {
    const base = {
        env: developmentEnv,
        findActiveSession: async () => ({ id: 'user-a', role: 'student', premium: true }),
        repository: {
            findAttempt: async () => null,
            findAnsweredQuestionIds: async () => ['all'],
            canStartAssessment: async () => false,
            createAttempt: async () => assert.fail('must not create attempt')
        },
        getFreeQuestion: () => ({ exhausted: true, question: null })
    };
    const handler = attemptsHandler(base);
    const exhausted = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie: `ttl_session=${'c'.repeat(43)}`,
        body: { action: 'start', mode: 'puzzle', idempotencyKey: 'idempotency-key-0003' } }), exhausted);
    assert.equal(exhausted.statusCode, 200);
    assert.deepEqual(exhausted.body, { exhausted: true, questions: [] });

    const assessment = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie: `ttl_session=${'c'.repeat(43)}`,
        body: { action: 'start', mode: 'assessment', operation: 'add', level: 1, total: 12,
            idempotencyKey: 'idempotency-key-0004' } }), assessment);
    assert.equal(assessment.statusCode, 403);
});

test('answer retries are idempotent, changed answers conflict, and finish returns server result', async () => {
    const handler = attemptsHandler({
        env: developmentEnv,
        findActiveSession: async () => ({ id: 'user-a', role: 'student', premium: true }),
        repository: {
            answerQuestion: async (_user, _attempt, _question, option) => ({ question_id: 'math-v1-1',
                selected_answer: 5, requested_answer: option === 2 ? 5 : 4, is_correct: true,
                newly_recorded: option === 2 }),
            finishAttempt: async () => ({ id: 'attempt-a', score: 1, total: 1, percentage: 100,
                grade: 5, passed: true, newly_completed: false })
        }
    });
    const cookie = `ttl_session=${'d'.repeat(43)}`;
    const good = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie, body: {
        action: 'answer', attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', questionId: 'math-v1-1', selectedOption: 2
    } }), good);
    assert.equal(good.statusCode, 200);
    assert.equal(good.body.correct, true);
    const changed = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie, body: {
        action: 'answer', attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', questionId: 'math-v1-1', selectedOption: 1
    } }), changed);
    assert.equal(changed.statusCode, 409);
    const finished = responseRecorder();
    await handler(request('POST', { origin: developmentEnv.APP_ORIGIN, cookie, body: {
        action: 'finish', attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    } }), finished);
    assert.equal(finished.statusCode, 200);
    assert.equal(finished.body.grade, 5);
    assert.equal(finished.body.newlyCompleted, false);
});
