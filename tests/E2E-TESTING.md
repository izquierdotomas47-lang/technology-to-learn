# Browser acceptance sequence

There is no Playwright, Puppeteer, Cypress, or other browser E2E framework in `package.json` or the project test scripts. The current environment also has no Vercel CLI or PostgreSQL CLI available. Do not report unit tests as browser evidence.

Run this sequence only in an explicitly authorized, isolated non-production environment with the test database already migrated, server endpoints available, a browser, and a Google OAuth test client configured for the exact test origin. Do not change this checkout's `AUTH_MODE=disabled` or use real accounts. The OAuth test user's consent, client configuration and authorized origin must be verified by the owner; no credentials or origin are supplied by this repository.

Use two dedicated test accounts in separate browser profiles/contexts. Record status, timestamp, test account label (never email/token), expected values, actual values, and relevant request status for every step.

1. Open the exact authorized test origin. Verify the app loads and the initial session state is unauthenticated.
2. Complete an actual Google login with test account A. Verify the session endpoint returns A and the browser has only the expected HttpOnly session cookie; then fetch progress.
3. Start practice for each operation in order. Answer at least one question correctly and one incorrectly; verify no solution appears before the answer request completes, and that server-returned correctness is shown afterward.
4. Complete each practice unit with a passing grade. Verify XP/stars from the server response/progress endpoint, then repeat an answer/finish request and verify totals do not increase twice.
5. Start the final assessment only after all four units pass. Verify exactly 12 questions with three per operation, server-returned score/grade, and no practice XP/star award from assessment.
6. Reload the page and refetch session/progress. Verify identity, results and rewards persist without a client-supplied owner ID.
7. Sign out A and log in as test account B in its separate context. Verify B sees only its own progress, history and rewards and cannot access A's attempt IDs.
8. In an isolated loopback-only browser context, run the explicit local demo and verify its data stays separate from both server accounts.
9. Inspect console and network logs for JavaScript errors, failed requests, duplicate requests, and response bodies that reveal correct answers before submission. Do not save session cookies, ID tokens, or connection strings in the report.

For Google OAuth, mark the case **NOT EXECUTED** unless a real test account completes the browser flow at the authorized origin. A mocked GIS callback or unit test is not a successful login. If any prerequisites are unavailable, record the exact missing prerequisite and leave that step pending.
