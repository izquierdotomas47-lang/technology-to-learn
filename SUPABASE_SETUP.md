# Supabase preparation

## Current transition state

The root app and `public/` are still the existing HTML/CSS/JavaScript applications. Their accounts, passwords, roles, Premium flag, grades, progress, XP, payment requests, and sessions remain browser-managed in `ttl_ultimate_db_v1`. Supabase is **not connected** to either UI, and no existing local data is uploaded or deleted by this preparation.

The only backend currently present is the existing serverless math tutor (`netlify/functions/math-tutor.js`, also wrapped by `api/math-tutor.js`). Gemini remains configured separately with server environment variables. Google Identity currently runs client-side and does not establish a Supabase session or a server-side application role.

## Proposed architecture and risks by phase

| Phase | Architecture/change | Main risk addressed | Status |
|---|---|---|---|
| 0. Preserve current operation | Keep root and `public/` as static HTML/CSS/JS using the current local database; keep Supabase mode off. Netlify publishes `public/`; Vercel has the `/api/math-tutor` wrapper. | Avoid account lockout, silent data loss, or pretending local sessions are remote authentication. Existing browser-trust risks remain. | Current |
| 1. Database foundation | Apply the additive PostgreSQL migration; Supabase Auth UUIDs own profiles and progress; RLS scopes reads; browser role/grade/reward writes are withheld; privileged payment review is a gated RPC. | Cross-account reads, browser-assigned admin roles, forged grades/XP, and repeated payment approval. | Prepared; requires project deployment and live RLS tests |
| 2. Authentication | Add Supabase Auth to both frontends behind an explicit feature flag; validate recovery, email verification, origin allowlists, and roles before any real-account cutover. | Plaintext legacy passwords, spoofed sessions/roles, account takeover, and Google `file://` origin errors. | Not implemented |
| 3. Authoritative persistence/import | Add verified server-side writes for attempts, official grades, XP, missions and badges; accept only explicitly previewed, sanitized per-user snapshots and reconcile conflicts before import. | Client-manipulated rewards/results, duplicate events, importing other accounts, overwriting newer remote data. | Staging structure prepared; endpoints and reconciliation are not implemented |
| 4. Premium and Nequi | Keep the existing manual payment review; require verified admin claims and audit all server-side decisions; derive Premium from active entitlements. | Client-side approval, unintended Premium grants, and unaudited administrative changes. | Schema/RPC prepared; not connected to current screens |
| 5. Tutor and production cutover | Retain Gemini; authenticate and rate-limit tutor requests server-side; verify restore, monitoring, origin settings, and both deployments before removing local fallback. | Unauthenticated API abuse, secret exposure, and premature loss of local account recovery. | Future work |

Supabase's browser client, if/when added, will use only the project URL and publishable/anon key. A trusted server endpoint must validate the user's access token before any privileged write; it alone may use the service-role key. RLS remains defense-in-depth for browser-safe reads and submissions. The root and Netlify `public/` variants must receive equivalent auth, entitlement, and persistence behavior before rollout.

## Additive database migration

Apply `supabase/migrations/0001_initial_schema.sql` to a new Supabase project using the Supabase SQL Editor or the Supabase CLI migration workflow. The script adds:

- `profiles` linked to `auth.users`; new signups receive the `student` role.
- `student_progress`, `learning_attempts`, `operation_results`, and gamification tables with idempotency keys and uniqueness constraints.
- `premium_entitlements`, Nequi `payment_requests`, and a protected admin review RPC with an audit entry.
- `local_progress_imports` as a server-only, per-account staging area. It is not writable through the client Data API and a staged record does not alter authoritative progress.
- RLS policies and restricted table grants. Authenticated users can read their own learning records, update only their profile name/audio preference, submit a pending Nequi request, and stage an import. They cannot write official results, XP, rewards, entitlements, payment decisions, or role values through the Data API.

Admin recognition uses the trusted JWT `app_metadata.role = "admin"` claim. Do not place this claim in `user_metadata`, allow a browser to update it, or accept a role field from an unauthenticated request. Provision and revoke administrator claims only from a trusted administrative process using the Supabase server-side Admin API and the service-role key. The `admin_review_payment` RPC additionally locks the request, permits one transition from `pending`, grants an entitlement only on the explicit `approved` decision, and writes an audit record. An approval represents the existing human Nequi review; it does not verify a payment with Nequi.

The service-role key bypasses RLS. It belongs only in a server deployment secret store. Never add it to either HTML file, frontend JavaScript, `.env.example` with a real value, or LocalStorage.

## Environment variables

`.env.example` lists placeholder variable names. It is documentation only; static HTML does not read `.env` files. Configure variables in the Netlify/Vercel project settings when deploying server code:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (public only; RLS remains mandatory)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_AUTH_ENABLED=false` until the separate auth rollout is implemented and tested
- Existing tutor secrets: `GEMINI_API_KEY`, optional `GEMINI_MODEL`, and `MATH_TUTOR_ALLOWED_ORIGINS`

Do not turn on a frontend Supabase mode by copying secrets into a static config file. When the UI integration is implemented, only the project URL and publishable/anon key may be delivered to the browser. Authentication/session checks and privileged writes must be enforced by Supabase policies or a verified server endpoint.

## Local data import — explicit and non-destructive

No automatic migration runs at signup or page load. A future import action must be presented to the account holder after verified Supabase login and must:

1. Read only that signed-in user's local progress from `ttl_ultimate_db_v1`; do not submit other users, passwords, recovery secrets, payment records, or personal fields.
2. Normalize the snapshot using the existing progress rules, validate operation keys, grade ranges, XP totals, mission dates, badges, and history bounds, then show a preview and require explicit confirmation.
3. Hash the canonical sanitized snapshot (SHA-256) and submit it only to a future authenticated server import endpoint, which stages it under the verified Supabase `auth.users.id`. The `(user_id, source_fingerprint)` unique constraint makes repeat staging detectable. The client has no direct insert grant on the staging table.
4. Compare against remote records before any future acceptance. If a remote profile/progress record exists or the source account/email is ambiguous, mark it `needs_review`; never overwrite a newer remote value or merge two accounts automatically.
5. Keep the original `ttl_ultimate_db_v1` data unchanged and retain an export/rollback copy. Passwords must be reset or recreated through Supabase Auth; legacy plaintext passwords and recovery secrets must never be copied.
6. Only a later server-side import operation may validate and accept staged data. This migration intentionally does not add an import/overwrite RPC or grant authenticated clients update access to authoritative progress.

## Rollout order

1. Create/configure a Supabase project, register HTTPS application origins, enable the intended email verification/recovery policy, and apply the additive SQL migration.
2. Verify RLS and role claims in a non-production project with two student accounts and one trusted admin before adding Supabase code to the UI.
3. Implement Supabase Auth behind an explicit feature flag while keeping the local mode available. Do not silently treat a local session as a Supabase session.
4. Add server-side, idempotent activity/result/reward writes and an import review flow. Reconcile legacy local data account-by-account only after verification.
5. Move Premium checks and payment decisions to verified server authorization. Keep Nequi review manual; do not grant entitlement when a request is merely submitted.
6. Authenticate tutor requests server-side and enforce per-user quotas. CORS/origin allowlists are not user authentication.
7. Enable production cutover only after recovery, RLS isolation, admin authorization, idempotency, Premium denial, and restore procedures pass against the actual Supabase project.

## Required external setup and limits

- A Supabase project URL and publishable/anon key are required for future client auth; a service-role secret is required only by trusted server functions.
- Configure the production and preview HTTPS origins in Supabase Auth redirect settings, Google Identity authorized JavaScript origins, and the tutor origin allowlist. `file://` is not a valid production origin and must not be made permissive to suppress Google errors.
- The current browser admin-registration code, seeded demo credentials, local Premium grants, and local payment approval remain insecure until the UI and server authorization rollout is completed. The SQL schema alone does not secure the currently deployed app.
- No real Supabase project was available during this preparation, so the migration, RLS behavior, Auth flow, remote persistence, payment RPC, and cross-device sync have not been executed against a live provider.
