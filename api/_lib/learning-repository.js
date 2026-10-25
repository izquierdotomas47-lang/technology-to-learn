'use strict';

const { getSql } = require('./database');

async function createAttempt(userId, attempt, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        WITH inserted AS (
            INSERT INTO learning_attempts
                (user_id, idempotency_key, activity_key, request_signature, operation,
                 rules_version, question_set, total)
            VALUES (${userId}, ${attempt.idempotencyKey}, ${attempt.activityKey}, ${attempt.signature},
                ${attempt.operation}, ${attempt.rulesVersion}, ${JSON.stringify(attempt.questions)}::jsonb, ${attempt.questions.length})
            ON CONFLICT (user_id, idempotency_key) DO UPDATE
                SET idempotency_key = learning_attempts.idempotency_key
            RETURNING id, user_id, idempotency_key, request_signature, activity_key, operation,
                rules_version, question_set, total, score, status
        )
        SELECT * FROM inserted
    `;
    return row || null;
}

async function findAttempt(userId, idempotencyKey, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        SELECT id, user_id, idempotency_key, request_signature, activity_key, operation,
            rules_version, question_set, total, score, status
        FROM learning_attempts WHERE user_id = ${userId}::uuid AND idempotency_key = ${idempotencyKey}
        LIMIT 1
    `;
    return row || null;
}

async function findAnsweredQuestionIds(userId, activityKey, env = process.env) {
    const sql = await getSql(env);
    const rows = await sql`
        SELECT DISTINCT r.question_id
        FROM learning_responses r JOIN learning_attempts a ON a.id = r.attempt_id
        WHERE r.user_id = ${userId}::uuid AND a.activity_key = ${activityKey}
    `;
    return rows.map(row => row.question_id);
}

async function answerQuestion(userId, attemptId, questionId, selectedOption, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        WITH target AS (
            SELECT a.id, a.user_id, a.activity_key, a.status,
                q.value AS question,
                (q.value->'options'->>${selectedOption})::integer AS selected_answer,
                ((q.value->'options'->>${selectedOption})::integer = (q.value->>'correctOption')::integer) AS is_correct
            FROM learning_attempts a
            CROSS JOIN LATERAL jsonb_array_elements(a.question_set) q(value)
            WHERE a.id = ${attemptId}::uuid AND a.user_id = ${userId}::uuid
                AND q.value->>'id' = ${questionId}
                AND ${selectedOption} < jsonb_array_length(q.value->'options')
        ), inserted AS (
            INSERT INTO learning_responses (attempt_id, user_id, question_id, selected_answer, is_correct)
            SELECT id, user_id, question->>'id', selected_answer, is_correct
            FROM target WHERE status = 'open'
            ON CONFLICT (attempt_id, question_id) DO UPDATE
                SET question_id = learning_responses.question_id
            RETURNING attempt_id, user_id, question_id, selected_answer, is_correct, (xmax = 0) AS newly_recorded
        ), reward AS (
            INSERT INTO learning_attempt_rewards (user_id, attempt_id, reward_type, reward_key, amount)
            SELECT i.user_id, i.attempt_id, 'xp-answer', i.question_id, 5
            FROM inserted i JOIN target t ON t.id = i.attempt_id
            WHERE i.is_correct AND i.newly_recorded AND t.activity_key IN ('practice', 'puzzle', 'real-problem')
            ON CONFLICT DO NOTHING
            RETURNING user_id, amount
        ), progress AS (
            INSERT INTO student_progress (user_id, xp, answered_question_ids)
            SELECT i.user_id, COALESCE(sum(r.amount), 0), ARRAY[i.question_id]
            FROM inserted i LEFT JOIN reward r ON r.user_id = i.user_id
            WHERE i.newly_recorded
            GROUP BY i.user_id, i.question_id
            ON CONFLICT (user_id) DO UPDATE SET
                xp = student_progress.xp + EXCLUDED.xp,
                answered_question_ids = CASE
                    WHEN EXCLUDED.answered_question_ids[1] = ANY(student_progress.answered_question_ids)
                    THEN student_progress.answered_question_ids
                    ELSE array_append(student_progress.answered_question_ids, EXCLUDED.answered_question_ids[1])
                END,
                updated_at = now()
            RETURNING user_id
        ), score AS (
            UPDATE learning_attempts a SET score = a.score + 1
            FROM inserted i WHERE a.id = i.attempt_id AND i.is_correct AND i.newly_recorded
            RETURNING a.id
        )
        SELECT r.attempt_id, r.question_id, r.selected_answer, r.is_correct,
            (SELECT selected_answer FROM target LIMIT 1) AS requested_answer,
            (SELECT question->>'correctAnswer' FROM target LIMIT 1) AS correct_answer,
            (SELECT question->>'explanation' FROM target LIMIT 1) AS explanation,
            COALESCE((SELECT newly_recorded FROM inserted LIMIT 1), false) AS newly_recorded
        FROM learning_responses r
        WHERE r.attempt_id = ${attemptId}::uuid AND r.user_id = ${userId}::uuid
            AND r.question_id = ${questionId}
    `;
    return row || null;
}

async function finishAttempt(userId, attemptId, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        WITH ready AS (
            SELECT a.id, a.user_id, a.activity_key, a.total, a.score
            FROM learning_attempts a
            WHERE a.id = ${attemptId}::uuid AND a.user_id = ${userId}::uuid
                AND a.status = 'open'
                AND (SELECT count(*) FROM learning_responses r WHERE r.attempt_id = a.id) = a.total
        ), completed AS (
            UPDATE learning_attempts a SET status = 'completed', completed_at = now()
            FROM ready x WHERE a.id = x.id
            RETURNING a.id, a.user_id, a.activity_key, a.total, a.score, a.completed_at
        ), rewards AS (
            INSERT INTO learning_attempt_rewards (user_id, attempt_id, reward_type, reward_key, amount)
            SELECT c.user_id, c.id, vals.reward_type, vals.reward_key, vals.amount
            FROM completed c CROSS JOIN LATERAL (VALUES
                ('xp-completion'::text, 'completion'::text, 10),
                ('stars'::text, 'completion'::text, c.score)
            ) vals(reward_type, reward_key, amount)
            WHERE c.activity_key = 'practice' AND vals.amount > 0
            ON CONFLICT DO NOTHING
            RETURNING user_id, reward_type, amount
        ), result AS (
            INSERT INTO unit_results (user_id, operation, attempt_id, score, total, grade)
            SELECT c.user_id, a.operation, c.id, c.score, c.total,
                round((1 + 4 * round(100 * c.score::numeric / c.total) / 100)::numeric, 1)
            FROM completed c JOIN learning_attempts a ON a.id = c.id
            WHERE c.activity_key = 'practice'
            ON CONFLICT (user_id, attempt_id) DO NOTHING
            RETURNING user_id
        ), assessment AS (
            INSERT INTO assessment_results (user_id, attempt_id, score, total, grade)
            SELECT c.user_id, c.id, c.score, c.total,
                round((1 + 4 * round(100 * c.score::numeric / c.total) / 100)::numeric, 1)
            FROM completed c WHERE c.activity_key = 'assessment'
            ON CONFLICT (user_id, attempt_id) DO NOTHING
            RETURNING user_id
        ), updated AS (
            INSERT INTO student_progress (user_id, xp, stars)
            SELECT user_id, COALESCE(sum(amount) FILTER (WHERE reward_type = 'xp-completion'), 0),
                COALESCE(sum(amount) FILTER (WHERE reward_type = 'stars'), 0)
            FROM rewards GROUP BY user_id
            ON CONFLICT (user_id) DO UPDATE SET
                xp = student_progress.xp + EXCLUDED.xp,
                stars = student_progress.stars + EXCLUDED.stars,
                updated_at = now()
            RETURNING user_id
        )
        SELECT c.id, c.total, c.score, round((c.score::numeric / c.total) * 100)::integer AS percentage,
            round((1 + 4 * round(100 * c.score::numeric / c.total) / 100)::numeric, 1) AS grade,
            (round((1 + 4 * round(100 * c.score::numeric / c.total) / 100)::numeric, 1) >= 3.5) AS passed,
            c.completed_at, true AS newly_completed
        FROM completed c
        UNION ALL
        SELECT a.id, a.total, a.score, round((a.score::numeric / a.total) * 100)::integer,
            round((1 + 4 * round(100 * a.score::numeric / a.total) / 100)::numeric, 1),
            (round((1 + 4 * round(100 * a.score::numeric / a.total) / 100)::numeric, 1) >= 3.5),
            a.completed_at, false
        FROM learning_attempts a WHERE a.id = ${attemptId}::uuid AND a.user_id = ${userId}::uuid
            AND a.status = 'completed' AND NOT EXISTS (SELECT 1 FROM completed)
        LIMIT 1
    `;
    if (row) return row;
    // A concurrent finalizer may have committed while this statement waited
    // on the row lock. This read returns that committed result without writing.
    const [completed] = await sql`
        SELECT id, total, score, round((score::numeric / total) * 100)::integer AS percentage,
            round((1 + 4 * round(100 * score::numeric / total) / 100)::numeric, 1) AS grade,
            (round((1 + 4 * round(100 * score::numeric / total) / 100)::numeric, 1) >= 3.5) AS passed,
            completed_at, false AS newly_completed
        FROM learning_attempts
        WHERE id = ${attemptId}::uuid AND user_id = ${userId}::uuid AND status = 'completed'
        LIMIT 1
    `;
    return completed || null;
}

async function canStartAssessment(userId, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        SELECT count(DISTINCT operation) = 4 AS allowed
        FROM unit_results
        WHERE user_id = ${userId}::uuid AND grade >= 3.5
    `;
    return row?.allowed === true;
}

async function canStartPractice(userId, operation, env = process.env) {
    const sql = await getSql(env);
    const [row] = await sql`
        WITH passed AS (
            SELECT DISTINCT operation FROM unit_results
            WHERE user_id = ${userId}::uuid AND grade >= 3.5
        ), next_operation AS (
            SELECT candidate.operation
            FROM unnest(ARRAY['add', 'subtract', 'multiply', 'divide']::text[])
                WITH ORDINALITY AS candidate(operation, position)
            WHERE NOT EXISTS (SELECT 1 FROM passed WHERE passed.operation = candidate.operation)
            ORDER BY candidate.position LIMIT 1
        )
        SELECT EXISTS (SELECT 1 FROM passed WHERE passed.operation = ${operation})
            OR EXISTS (SELECT 1 FROM next_operation WHERE next_operation.operation = ${operation}) AS allowed
    `;
    return row?.allowed === true;
}

module.exports = { createAttempt, findAttempt, findAnsweredQuestionIds, answerQuestion, finishAttempt, canStartAssessment, canStartPractice };
