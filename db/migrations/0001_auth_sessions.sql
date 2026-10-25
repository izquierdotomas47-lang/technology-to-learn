CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub text NOT NULL UNIQUE,
    email text NOT NULL,
    display_name text NOT NULL DEFAULT 'Estudiante',
    role text NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'teacher', 'admin')),
    premium boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash char(64) PRIMARY KEY
        CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_expiry_idx
    ON auth_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(preferences) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_progress (
    user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
    state jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(state) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    activity_key text NOT NULL CHECK (length(activity_key) BETWEEN 1 AND 180),
    operation text NOT NULL CHECK (operation IN ('add', 'subtract', 'multiply', 'divide')),
    source text NOT NULL CHECK (source IN ('quiz', 'puzzle', 'real-problem', 'assessment')),
    is_correct boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, activity_key)
);

CREATE TABLE IF NOT EXISTS reward_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    claim_key text NOT NULL CHECK (length(claim_key) BETWEEN 1 AND 180),
    reward_type text NOT NULL CHECK (reward_type IN ('xp', 'star', 'badge', 'premium')),
    amount integer NOT NULL DEFAULT 1 CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, claim_key)
);

CREATE TABLE IF NOT EXISTS unit_results (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    operation text NOT NULL CHECK (operation IN ('add', 'subtract', 'multiply', 'divide')),
    attempt_id uuid NOT NULL,
    score integer NOT NULL CHECK (score >= 0),
    total integer NOT NULL CHECK (total > 0 AND score <= total),
    grade numeric(2,1) NOT NULL CHECK (grade BETWEEN 1.0 AND 5.0),
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, attempt_id)
);

CREATE TABLE IF NOT EXISTS assessment_results (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    attempt_id uuid NOT NULL,
    score integer NOT NULL CHECK (score >= 0),
    total integer NOT NULL CHECK (total > 0 AND score <= total),
    grade numeric(2,1) NOT NULL CHECK (grade BETWEEN 1.0 AND 5.0),
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, attempt_id)
);

CREATE TABLE IF NOT EXISTS payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    amount_cop integer NOT NULL CHECK (amount_cop > 0),
    reference text NOT NULL CHECK (length(reference) BETWEEN 1 AND 180),
    payment_method text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES app_users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    UNIQUE (payment_method, reference)
);
