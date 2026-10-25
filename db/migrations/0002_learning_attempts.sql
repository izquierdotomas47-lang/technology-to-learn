-- Apply only to an explicitly provisioned test database first.
ALTER TABLE student_progress
    ADD COLUMN IF NOT EXISTS xp bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
    ADD COLUMN IF NOT EXISTS stars bigint NOT NULL DEFAULT 0 CHECK (stars >= 0),
    ADD COLUMN IF NOT EXISTS answered_question_ids text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS learning_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 100),
    activity_key text NOT NULL CHECK (activity_key IN ('practice', 'assessment', 'puzzle', 'real-problem')),
    request_signature char(64) NOT NULL CHECK (request_signature ~ '^[a-f0-9]{64}$'),
    operation text CHECK (operation IN ('add', 'subtract', 'multiply', 'divide')),
    rules_version integer NOT NULL CHECK (rules_version > 0),
    question_set jsonb NOT NULL CHECK (jsonb_typeof(question_set) = 'array'),
    total integer NOT NULL CHECK (total > 0 AND total <= 50),
    score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= total),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CHECK ((status = 'open' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS learning_attempts_user_created_idx
    ON learning_attempts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    question_id text NOT NULL CHECK (length(question_id) BETWEEN 1 AND 180),
    selected_answer integer NOT NULL,
    is_correct boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (attempt_id, user_id) REFERENCES learning_attempts(id, user_id) ON DELETE CASCADE,
    UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS learning_responses_user_created_idx
    ON learning_responses (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_attempt_rewards (
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    attempt_id uuid NOT NULL,
    reward_type text NOT NULL CHECK (reward_type IN ('xp-answer', 'xp-completion', 'stars')),
    reward_key text NOT NULL CHECK (length(reward_key) BETWEEN 1 AND 180),
    amount integer NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, attempt_id, reward_type, reward_key),
    FOREIGN KEY (attempt_id, user_id) REFERENCES learning_attempts(id, user_id) ON DELETE CASCADE
);
