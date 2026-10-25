'use strict';

const { sendJson, hasSameOrigin, readJsonBody } = require('./_lib/http');
const { findActiveSession } = require('./_lib/auth-repository');
const { hashSessionToken, readSessionToken } = require('./_lib/sessions');
const { makeQuestionSet, getFreeQuestion, toClientQuestion, RULES_VERSION } = require('./_lib/question-catalog');
const repository = require('./_lib/learning-repository');
const { createHash } = require('node:crypto');

const ACTION_FIELDS = {
    start: ['action', 'mode', 'operation', 'level', 'total', 'idempotencyKey'],
    answer: ['action', 'attemptId', 'questionId', 'selectedOption'],
    finish: ['action', 'attemptId']
};

function createHandler(deps = {}) {
    const env = deps.env || process.env;
    const lookup = deps.findActiveSession || findActiveSession;
    const hashToken = deps.hashSessionToken || hashSessionToken;
    const repo = deps.repository || repository;
    const makeSet = deps.makeQuestionSet || makeQuestionSet;
    const chooseFree = deps.getFreeQuestion || getFreeQuestion;

    return async function attemptsHandler(req, res) {
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'POST');
            return sendJson(res, 405, { error: 'Método no permitido.' });
        }
        if (env.AUTH_MODE !== 'server' || !env.DATABASE_URL || !env.APP_ORIGIN) {
            return sendJson(res, 503, { error: 'El servicio de actividades no está configurado.' });
        }
        if (!hasSameOrigin(req, env)) return sendJson(res, 403, { error: 'Origen no autorizado.' });
        if ((req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
            return sendJson(res, 415, { error: 'La solicitud debe usar JSON.' });
        }
        let body;
        try { body = readJsonBody(req, 4096); }
        catch (error) { return sendJson(res, error.statusCode || 400, { error: 'Solicitud no válida.' }); }
        if (!body || typeof body.action !== 'string' || !ACTION_FIELDS[body.action]
            || Object.keys(body).some(key => !ACTION_FIELDS[body.action].includes(key))) {
            return sendJson(res, 400, { error: 'Solicitud no válida.' });
        }
        const token = readSessionToken(req, env);
        if (!token) return sendJson(res, 401, { error: 'Sesión no válida.' });
        try {
            const user = await lookup(hashToken(token), env);
            if (!user || user.role !== 'student') return sendJson(res, 401, { error: 'Sesión no válida.' });
            if (body.action === 'start') {
                const { mode, operation, level, total, idempotencyKey } = body;
                if (!['practice', 'assessment', 'puzzle', 'real-problem'].includes(mode)
                    || typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
                    return sendJson(res, 400, { error: 'Parámetros de intento no válidos.' });
                }
                const free = mode === 'puzzle' || mode === 'real-problem';
                if (free && operation !== undefined && !['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
                    return sendJson(res, 400, { error: 'La operación no es válida.' });
                }
                if (!free && (!['add', 'subtract', 'multiply', 'divide'].includes(operation)
                    || !Number.isInteger(level) || level < 1 || level > 3
                    || !Number.isInteger(total) || total < 1 || total > 50)) {
                    return sendJson(res, 400, { error: 'Parámetros de intento no válidos.' });
                }
                if (!free && user.premium !== true) return sendJson(res, 403, { error: 'Esta actividad requiere acceso autorizado.' });
                if (mode === 'practice' && !(await repo.canStartPractice(user.id, operation, env))) {
                    return sendJson(res, 403, { error: 'Completa y aprueba la unidad anterior para continuar.' });
                }
                if (mode === 'assessment' && total !== 12) return sendJson(res, 400, { error: 'La evaluación requiere 12 preguntas.' });
                if (mode === 'assessment' && !(await repo.canStartAssessment(user.id, env))) {
                    return sendJson(res, 403, { error: 'Completa primero las cuatro unidades requeridas.' });
                }
                const signature = createHash('sha256').update(JSON.stringify(free
                    ? { mode, operation: operation || null, version: RULES_VERSION }
                    : { mode, operation, level, total, version: RULES_VERSION })).digest('hex');
                const existing = await repo.findAttempt(user.id, idempotencyKey, env);
                if (existing) {
                    if (existing.request_signature !== signature) return sendJson(res, 409, { error: 'La clave de intento ya se usó con otros parámetros.' });
                    return sendJson(res, 200, { attemptId: existing.id, mode: existing.activity_key,
                        status: existing.status, questions: existing.question_set.map(toClientQuestion),
                        score: existing.score, total: existing.total });
                }
                let questions;
                if (free) {
                    const answered = await repo.findAnsweredQuestionIds(user.id, mode, env);
                    const selection = chooseFree(mode, answered, Math.random, operation);
                    if (selection.exhausted) return sendJson(res, 200, { exhausted: true, questions: [] });
                    questions = [selection.question];
                } else {
                    questions = makeSet({ mode, operation, level, total });
                }
                const attempt = await repo.createAttempt(user.id, {
                    idempotencyKey, activityKey: mode, operation: free ? questions[0].operation : operation,
                    rulesVersion: RULES_VERSION, signature, questions
                }, env);
                if (!attempt || attempt.request_signature !== signature) return sendJson(res, 409, { error: 'La clave de intento ya se usó con otros parámetros.' });
                return sendJson(res, 200, {
                    attemptId: attempt.id, mode: attempt.activity_key, status: attempt.status,
                    questions: attempt.question_set.map(toClientQuestion), score: attempt.score, total: attempt.total
                });
            }
            if (typeof body.attemptId !== 'string'
                || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.attemptId)) {
                return sendJson(res, 400, { error: 'Intento no válido.' });
            }
            if (body.action === 'answer') {
                if (typeof body.questionId !== 'string' || body.questionId.length > 180
                    || !Number.isInteger(body.selectedOption) || body.selectedOption < 0 || body.selectedOption > 3) {
                    return sendJson(res, 400, { error: 'Respuesta no válida.' });
                }
                const answer = await repo.answerQuestion(user.id, body.attemptId, body.questionId, body.selectedOption, env);
                if (!answer) return sendJson(res, 404, { error: 'Intento o pregunta no disponibles.' });
                if (answer.selected_answer !== answer.requested_answer) return sendJson(res, 409, { error: 'La pregunta ya fue respondida.' });
                return sendJson(res, 200, {
                    questionId: answer.question_id, correct: answer.is_correct,
                    correctAnswer: answer.correct_answer,
                    explanation: answer.explanation || null,
                    alreadyAnswered: !answer.newly_recorded
                });
            }
            const result = await repo.finishAttempt(user.id, body.attemptId, env);
            if (!result) return sendJson(res, 409, { error: 'El intento no está completo o no está disponible.' });
            return sendJson(res, 200, {
                attemptId: result.id, score: result.score, total: result.total,
                percentage: result.percentage, grade: Number(result.grade), passed: result.passed,
                newlyCompleted: result.newly_completed
            });
        } catch {
            return sendJson(res, 503, { error: 'No se pudo procesar la actividad.' });
        }
    };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
