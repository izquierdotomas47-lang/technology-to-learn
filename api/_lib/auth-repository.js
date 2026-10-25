'use strict';

const { getSql } = require('./database');
const { SESSION_MAX_AGE_SECONDS } = require('./sessions');

async function createGoogleSession(profile, tokenHash, env = process.env) {
    const sql = await getSql(env);
    const [user] = await sql`
        WITH account AS (
            INSERT INTO app_users (google_sub, email, display_name)
            VALUES (${profile.sub}, ${profile.email}, ${profile.name || 'Estudiante'})
            ON CONFLICT (google_sub) DO UPDATE SET
                email = EXCLUDED.email,
                display_name = CASE
                    WHEN app_users.display_name = 'Estudiante' THEN EXCLUDED.display_name
                    ELSE app_users.display_name
                END,
                updated_at = now()
            RETURNING id, email, display_name, role, premium
        ), inserted_session AS (
            INSERT INTO auth_sessions (token_hash, user_id, expires_at)
            SELECT ${tokenHash}, id, now() + (${SESSION_MAX_AGE_SECONDS} * interval '1 second')
            FROM account
            RETURNING user_id
        )
        SELECT account.id::text AS id, account.email, account.display_name AS name,
            account.role, account.premium
        FROM account JOIN inserted_session ON inserted_session.user_id = account.id
    `;
    if (!user) throw new Error('Could not create authenticated session');
    return user;
}

async function findActiveSession(tokenHash, env = process.env) {
    const sql = await getSql(env);
    const [user] = await sql`
        SELECT app_users.id::text AS id, app_users.email,
            app_users.display_name AS name, app_users.role, app_users.premium
        FROM auth_sessions
        JOIN app_users ON app_users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ${tokenHash}
            AND auth_sessions.revoked_at IS NULL
            AND auth_sessions.expires_at > now()
        LIMIT 1
    `;
    return user || null;
}

async function revokeSession(tokenHash, env = process.env) {
    const sql = await getSql(env);
    await sql`
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, now())
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `;
}

async function findUserProgress(tokenHash, env = process.env) {
    const sql = await getSql(env);
    const [record] = await sql`
        SELECT auth_sessions.user_id::text AS user_id,
            student_progress.schema_version,
            student_progress.state,
            student_progress.xp,
            student_progress.stars,
            student_progress.answered_question_ids,
            COALESCE((
                SELECT jsonb_object_agg(unit.operation, jsonb_build_object(
                    'completed', unit.passed,
                    'grade', unit.last_grade,
                    'bestGrade', unit.best_grade,
                    'total', unit.total,
                    'correct', unit.correct
                ))
                FROM (
                    SELECT operation, bool_or(grade >= 3.5) AS passed,
                        (array_agg(grade ORDER BY completed_at DESC))[1] AS last_grade,
                        max(grade) AS best_grade, sum(total) AS total, sum(score) AS correct
                    FROM unit_results WHERE user_id = auth_sessions.user_id
                    GROUP BY operation
                ) unit
            ), '{}'::jsonb) AS operations,
            (
                SELECT jsonb_build_object(
                    'attempts', count(*),
                    'last', (array_agg(round((score::numeric / total) * 100) ORDER BY completed_at DESC))[1],
                    'best', max(round((score::numeric / total) * 100)),
                    'lastGrade', (array_agg(grade ORDER BY completed_at DESC))[1],
                    'bestGrade', max(grade),
                    'completed', bool_or(grade >= 3.5)
                )
                FROM assessment_results WHERE user_id = auth_sessions.user_id
            ) AS assessment
        FROM auth_sessions
        LEFT JOIN student_progress ON student_progress.user_id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ${tokenHash}
            AND auth_sessions.revoked_at IS NULL
            AND auth_sessions.expires_at > now()
        LIMIT 1
    `;
    return record || null;
}

module.exports = { createGoogleSession, findActiveSession, revokeSession, findUserProgress };
