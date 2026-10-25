-- DESTRUCTIVE: use only to roll back an isolated test database before retaining
-- any learning data. This deletes all attempts, responses, rewards and counters.
DROP TABLE IF EXISTS learning_attempt_rewards;
DROP TABLE IF EXISTS learning_responses;
DROP TABLE IF EXISTS learning_attempts;
ALTER TABLE student_progress
    DROP COLUMN IF EXISTS answered_question_ids,
    DROP COLUMN IF EXISTS stars,
    DROP COLUMN IF EXISTS xp;
