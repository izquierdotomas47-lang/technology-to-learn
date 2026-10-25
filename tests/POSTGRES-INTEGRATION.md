# PostgreSQL integration test

The integration runner writes temporary users, attempts, responses and rewards, then deletes those user rows. Run it only against a newly provisioned, disposable test database with no valuable data. It never applies migrations or drops tables.

The runner fails closed unless all of these checks pass:

- `TTL_TEST_DATABASE_URL` points to the intended PostgreSQL database.
- `TTL_TEST_DATABASE_EXPECTED_NAME` and `TTL_TEST_DATABASE_EXPECTED_ROLE` match the actual `current_database()` and `current_user`; both must start with `ttl_test_`.
- `TTL_TEST_DATABASE_ACK=disposable-test-database` is explicitly set.
- The database contains the marker `ttl_test_safety(marker)` with row `disposable-test-database-v1`.
- The test role has no elevated PostgreSQL role flags or role memberships, cannot create schemas, temporary objects or objects in `public`, uses only the `public` search path, and owns none of the application/test tables. The marker belongs to a separate provisioning role.

Provision a new isolated database, a separate migration/marker owner, and a restricted test role through the approved database provider. Apply the migrations as the migration owner, then create the marker as that owner, connected specifically to the disposable database:

```sql
CREATE TABLE ttl_test_safety (
    marker text PRIMARY KEY CHECK (marker = 'disposable-test-database-v1')
);
INSERT INTO ttl_test_safety (marker) VALUES ('disposable-test-database-v1');
```

Grant the runner role only the required table DML rights, marker read access, and no schema creation rights. It must not be granted membership in another role. For example, after replacing the role with the verified test role name:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.app_users, public.auth_sessions, public.student_progress,
    public.learning_attempts, public.learning_responses,
    public.learning_attempt_rewards, public.unit_results,
    public.assessment_results
TO ttl_test_runner;
GRANT SELECT ON public.ttl_test_safety TO ttl_test_runner;
REVOKE CREATE ON SCHEMA public FROM ttl_test_runner;
REVOKE CREATE, TEMPORARY ON DATABASE ttl_test_database FROM ttl_test_runner;
REVOKE CREATE, TEMPORARY ON DATABASE ttl_test_database FROM PUBLIC;
ALTER ROLE ttl_test_runner IN DATABASE ttl_test_database SET search_path = public;
```

Apply `db/migrations/0001_auth_sessions.sql` and then `db/migrations/0002_learning_attempts.sql` to that database only. Supply the connection string through the local environment without printing it or storing it in the repository. Set the expected database and restricted role names to their actual `ttl_test_...` identities, plus the explicit acknowledgement, then run:

```text
npm run test:integration
```

Without the connection string, the runner skips without connecting. With a URL but a mismatched database/role, elevated role permissions/memberships, object creation privileges, an unexpected search path, a runner-owned/missing marker, or missing acknowledgement, it refuses to write. These checks cannot prove a provider account is disposable by themselves: the operator must verify the new isolated resource in the provider and its data-retention policy before setting the acknowledgement.

`0002_learning_attempts_down.sql` is destructive to learning attempts and the XP/star/question-history columns. Do not use it for routine test cleanup. There is no `0001` rollback migration; dropping that schema would also remove authentication and user data and is outside this test procedure.

The current integration script covers PostgreSQL-backed attempt idempotency, correct and incorrect response persistence, invalid-option rejection, an XP-overflow SQL failure that should roll back response/reward/score/progress writes, concurrent answer retries, duplicate finalization/reward checks, rejection after completion, attempt ownership, free-question history isolation, and progress persistence/read isolation. These cases remain unverified until run against a marked disposable PostgreSQL database. There is no browser end-to-end framework in this project; see the manual acceptance sequence in `E2E-TESTING.md`.
