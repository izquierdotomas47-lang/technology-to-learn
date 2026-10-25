'use strict';

const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

async function main() {
    const connectionString = process.env.TTL_TEST_DATABASE_URL;
    if (!connectionString) {
        console.log('SKIP: configura TTL_TEST_DATABASE_URL para una base de prueba desechable con migraciones 0001 y 0002 aplicadas.');
        return;
    }
    if (process.env.TTL_TEST_DATABASE_ACK !== 'disposable-test-database') {
        throw new Error('Refusing database writes without TTL_TEST_DATABASE_ACK=disposable-test-database');
    }
    const expectedDatabase = process.env.TTL_TEST_DATABASE_EXPECTED_NAME;
    const expectedRole = process.env.TTL_TEST_DATABASE_EXPECTED_ROLE;
    if (!/^ttl_test_[a-z0-9_]+$/.test(expectedDatabase || '')
        || !/^ttl_test_[a-z0-9_]+$/.test(expectedRole || '')) {
        throw new Error('Refusing database writes without an explicit test database and restricted role identity');
    }
    const env = { ...process.env, DATABASE_URL: connectionString };
    const { getSql } = require('../api/_lib/database');
    const repo = require('../api/_lib/learning-repository');
    const { makeQuestionSet, getFreeQuestion } = require('../api/_lib/question-catalog');
    const { findUserProgress } = require('../api/_lib/auth-repository');
    const sql = await getSql(env);
    const [identity] = await sql`
        SELECT current_database() AS database_name, current_user AS role_name,
            current_schemas(false) AS active_schemas,
            has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public_objects,
            has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schemas,
            has_database_privilege(current_user, current_database(), 'TEMP') AS can_create_temp_objects,
            EXISTS (SELECT 1 FROM pg_auth_members membership WHERE membership.member = r.oid) AS has_role_memberships,
            EXISTS (SELECT 1 FROM pg_tables owned WHERE owned.schemaname = 'public'
                AND owned.tablename IN ('app_users', 'auth_sessions', 'student_progress', 'learning_attempts',
                    'learning_responses', 'learning_attempt_rewards', 'unit_results', 'assessment_results', 'ttl_test_safety')
                AND owned.tableowner = current_user) AS owns_test_tables,
            r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls
        FROM pg_roles r WHERE r.rolname = current_user
    `;
    if (identity?.database_name !== expectedDatabase || identity?.role_name !== expectedRole) {
        throw new Error('Refusing database writes: connected database or role does not match the explicitly expected test identity');
    }
    if (JSON.stringify(identity.active_schemas) !== JSON.stringify(['public'])
        || identity.can_create_public_objects || identity.can_create_schemas || identity.can_create_temp_objects
        || identity.has_role_memberships || identity.owns_test_tables
        || identity.rolsuper || identity.rolcreatedb || identity.rolcreaterole
        || identity.rolreplication || identity.rolbypassrls) {
        throw new Error('Refusing database writes: test role has elevated privileges or an unexpected search_path');
    }
    let safetyMarker;
    try {
        [safetyMarker] = await sql`
            SELECT safety.marker, tables.tableowner AS marker_owner
            FROM public.ttl_test_safety safety
            JOIN pg_tables tables ON tables.schemaname = 'public' AND tables.tablename = 'ttl_test_safety'
            WHERE safety.marker = 'disposable-test-database-v1'
            LIMIT 1
        `;
    } catch {
        throw new Error('Refusing database writes: required disposable-database safety marker is missing');
    }
    if (!safetyMarker || safetyMarker.marker_owner === expectedRole) {
        throw new Error('Refusing database writes: marker must exist and be owned by a separate provisioning role');
    }
    console.log('PASS: disposable database identity, restricted role, public-only search path and externally owned marker verified.');
    const marker = randomUUID();
    let userId;
    let otherUserId;
    try {
        const [user] = await sql`
            INSERT INTO app_users (google_sub, email, display_name)
            VALUES (${`integration-${marker}`}, ${`${marker}@example.test`}, 'QA temporal')
            RETURNING id::text AS id
        `;
        userId = user.id;
        const [createdOther] = await sql`
            INSERT INTO app_users (google_sub, email, display_name)
            VALUES (${`integration-other-${marker}`}, ${`other-${marker}@example.test`}, 'QA temporal alterno')
            RETURNING id::text AS id
        `;
        otherUserId = createdOther.id;
        const questions = makeQuestionSet({ mode: 'practice', operation: 'add', level: 1, total: 2 });
        const signature = createHash('sha256').update(marker).digest('hex');
        const attempt = await repo.createAttempt(userId, {
            idempotencyKey: `integration-${marker}`, activityKey: 'practice', operation: 'add',
            rulesVersion: 1, signature, questions
        }, env);
        const sameAttempt = await repo.createAttempt(userId, {
            idempotencyKey: `integration-${marker}`, activityKey: 'practice', operation: 'add',
            rulesVersion: 1, signature, questions
        }, env);
        assert.equal(sameAttempt.id, attempt.id, 'a retry with the same idempotency key returns the existing attempt');
        console.log('PASS: attempt creation idempotency.');
        const [correctQuestion, incorrectQuestion] = questions;
        const selectedOption = correctQuestion.options.findIndex(option => option === correctQuestion.correctOption);
        const wrongOption = incorrectQuestion.options.findIndex(option => option !== incorrectQuestion.correctOption);
        assert.equal(await repo.answerQuestion(userId, attempt.id, correctQuestion.id, 99, env), null,
            'out-of-range option is rejected without a response');

        const maxXp = String(2n ** 63n - 1n);
        await sql`
            INSERT INTO student_progress (user_id, xp)
            VALUES (${userId}::uuid, ${maxXp}::bigint)
            ON CONFLICT (user_id) DO UPDATE SET xp = EXCLUDED.xp
        `;
        await assert.rejects(
            repo.answerQuestion(userId, attempt.id, correctQuestion.id, selectedOption, env),
            error => error?.code === '22003',
            'XP overflow must produce PostgreSQL numeric_value_out_of_range (22003)'
        );
        const [rolledBack] = await sql`
            SELECT a.score, a.status, p.xp, p.stars,
                cardinality(p.answered_question_ids) AS answered_questions,
                (SELECT count(*) FROM learning_responses r WHERE r.attempt_id = a.id) AS responses,
                (SELECT count(*) FROM learning_attempt_rewards reward WHERE reward.attempt_id = a.id) AS rewards,
                (SELECT count(*) FROM learning_attempts other WHERE other.user_id = a.user_id) AS attempts
            FROM learning_attempts a JOIN student_progress p ON p.user_id = a.user_id
            WHERE a.id = ${attempt.id}::uuid AND a.user_id = ${userId}::uuid
        `;
        assert.equal(Number(rolledBack.score), 0);
        assert.equal(String(rolledBack.xp), maxXp);
        assert.equal(Number(rolledBack.responses), 0, 'SQL failure rolls back the response insert');
        assert.equal(Number(rolledBack.rewards), 0, 'SQL failure rolls back reward records');
        assert.equal(Number(rolledBack.stars), 0, 'SQL failure leaves stars unchanged');
        assert.equal(Number(rolledBack.answered_questions), 0, 'SQL failure leaves question history unchanged');
        assert.equal(rolledBack.status, 'open', 'SQL failure leaves the attempt open');
        assert.equal(Number(rolledBack.attempts), 1, 'SQL failure creates no extra attempt');
        await sql`UPDATE student_progress SET xp = 0, stars = 0, answered_question_ids = '{}' WHERE user_id = ${userId}::uuid`;
        console.log('PASS: injected SQL failure rolls back response, reward, score, attempt status and progress changes.');

        const responses = await Promise.all(Array.from({ length: 8 }, () =>
            repo.answerQuestion(userId, attempt.id, correctQuestion.id, selectedOption, env)));
        assert.ok(responses.every(Boolean), 'all concurrent retries return the persisted response');
        assert.ok(responses.every(result => result.is_correct));
        assert.equal((await repo.answerQuestion(userId, attempt.id, incorrectQuestion.id, wrongOption, env)).is_correct, false,
            'an incorrect option is persisted as incorrect');
        const conflictingRetry = await repo.answerQuestion(userId, attempt.id, correctQuestion.id,
            (selectedOption + 1) % correctQuestion.options.length, env);
        assert.notEqual(conflictingRetry.selected_answer, conflictingRetry.requested_answer,
            'a changed retry cannot replace the recorded answer');
        const results = await Promise.all([repo.finishAttempt(userId, attempt.id, env), repo.finishAttempt(userId, attempt.id, env)]);
        assert.ok(results.every(Boolean), 'concurrent finalization retries return the saved result');
        assert.ok(results.every(result => result.score === 1 && result.total === 2 && Number(result.grade) === 3));
        const afterFinish = await repo.answerQuestion(userId, attempt.id, correctQuestion.id, selectedOption, env);
        assert.ok(!afterFinish || afterFinish.requested_answer === null,
            'a completed attempt cannot accept another answer');
        const [state] = await sql`SELECT xp, stars FROM student_progress WHERE user_id = ${userId}::uuid`;
        const [counts] = await sql`
            SELECT (SELECT count(*) FROM learning_responses WHERE attempt_id = ${attempt.id}::uuid) AS responses,
                (SELECT count(*) FROM learning_attempt_rewards WHERE attempt_id = ${attempt.id}::uuid) AS rewards
        `;
        assert.equal(Number(state.xp), 15, 'one correct-answer reward plus one completion reward');
        assert.equal(Number(state.stars), 1, 'one star for the correct answer');
        assert.equal(Number(counts.responses), 2, 'only one response per question is persisted');
        assert.equal(Number(counts.rewards), 3, 'no duplicate answer, completion, or star reward');
        console.log('PASS: correct/incorrect answers, retries, invalid answer, post-finish rejection, and single rewards.');
        assert.equal(await repo.answerQuestion(otherUserId, attempt.id, correctQuestion.id, selectedOption, env), null,
            'another account cannot read or answer the first account\'s question');
        assert.equal(await repo.finishAttempt(otherUserId, attempt.id, env), null,
            'another account cannot finalize the first account\'s attempt');
        const [otherState] = await sql`
            SELECT COALESCE((SELECT xp FROM student_progress WHERE user_id = ${otherUserId}::uuid), 0) AS xp,
                COALESCE((SELECT stars FROM student_progress WHERE user_id = ${otherUserId}::uuid), 0) AS stars
        `;
        assert.equal(Number(otherState.xp), 0, 'another account receives no rewards from the first account\'s activity');
        assert.equal(Number(otherState.stars), 0);

        const free = getFreeQuestion('puzzle', [], () => 0).question;
        const freeSignature = createHash('sha256').update(`free-${marker}`).digest('hex');
        const freeAttempt = await repo.createAttempt(userId, {
            idempotencyKey: `free-${marker}`, activityKey: 'puzzle', operation: free.operation,
            rulesVersion: 1, signature: freeSignature, questions: [free]
        }, env);
        const freeOption = free.options.findIndex(option => option === free.correctOption);
        assert.ok((await repo.answerQuestion(userId, freeAttempt.id, free.id, freeOption, env)).is_correct);
        assert.ok(await repo.finishAttempt(userId, freeAttempt.id, env));
        assert.ok((await repo.findAnsweredQuestionIds(userId, 'puzzle', env)).includes(free.id));
        assert.deepEqual(await repo.findAnsweredQuestionIds(otherUserId, 'puzzle', env), [],
            'the free-question history is scoped to its owner');

        const userTokenHash = createHash('sha256').update(`session-${marker}`).digest('hex');
        const otherTokenHash = createHash('sha256').update(`other-session-${marker}`).digest('hex');
        await sql`
            INSERT INTO auth_sessions (token_hash, user_id, expires_at)
            VALUES (${userTokenHash}, ${userId}::uuid, now() + interval '1 hour'),
                (${otherTokenHash}, ${otherUserId}::uuid, now() + interval '1 hour')
        `;
        const persisted = await findUserProgress(userTokenHash, env);
        const otherProgress = await findUserProgress(otherTokenHash, env);
        assert.equal(Number(persisted.xp), 20, 'progress persists across independent database requests');
        assert.ok(persisted.answered_question_ids.includes(free.id));
        assert.equal(Number(otherProgress.xp || 0), 0, 'another authenticated session reads only its own progress');
        assert.deepEqual(otherProgress.answered_question_ids || [], []);
        console.log('PASS: independent free-question history, persisted progress and cross-account isolation.');
    } finally {
        if (userId) await sql`DELETE FROM app_users WHERE id = ${userId}::uuid`;
        if (otherUserId) await sql`DELETE FROM app_users WHERE id = ${otherUserId}::uuid`;
    }
}

main().catch(error => {
    console.error('FAIL: PostgreSQL integration test failed:', error.code || 'DB_TEST_FAILURE');
    process.exitCode = 1;
});
