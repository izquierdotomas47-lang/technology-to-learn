-- Initial additive schema for Technology to Learn SAS.
-- This migration does not read, import, or modify ttl_ultimate_db_v1.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce(
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
        false
    );
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default 'Explorador'
        check (char_length(display_name) between 1 and 80),
    role text not null default 'student'
        check (role in ('student', 'teacher', 'admin')),
    audio_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.student_progress (
    user_id uuid primary key references auth.users(id) on delete cascade,
    schema_version integer not null default 1 check (schema_version > 0),
    progress_state jsonb not null default '{}'::jsonb
        check (jsonb_typeof(progress_state) = 'object'),
    updated_at timestamptz not null default now()
);

create table if not exists public.learning_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    activity_id text not null check (char_length(activity_id) between 1 and 180),
    operation text not null check (operation in ('add', 'subtract', 'multiply', 'divide')),
    is_correct boolean not null,
    source text not null check (source in ('quiz', 'puzzle', 'real-problem')),
    difficulty smallint not null default 1 check (difficulty between 1 and 3),
    expression text not null default '' check (char_length(expression) <= 120),
    student_answer text not null default '' check (char_length(student_answer) <= 40),
    correct_answer text not null default '' check (char_length(correct_answer) <= 40),
    occurred_at timestamptz not null default now(),
    unique (user_id, activity_id)
);

create table if not exists public.operation_results (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    unit_key text not null check (unit_key in ('add', 'subtract', 'multiply', 'divide', 'assessment')),
    attempt_number integer not null check (attempt_number > 0),
    score_percent smallint not null check (score_percent between 0 and 100),
    academic_grade numeric(2, 1) not null check (academic_grade between 1.0 and 5.0),
    passed boolean not null,
    result_details jsonb not null default '{}'::jsonb
        check (jsonb_typeof(result_details) = 'object'),
    created_at timestamptz not null default now(),
    unique (user_id, unit_key, attempt_number)
);

create table if not exists public.gamification_accounts (
    user_id uuid primary key references auth.users(id) on delete cascade,
    xp bigint not null default 0 check (xp >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.gamification_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 180),
    event_type text not null check (event_type in ('correct_answer', 'practice_session', 'daily_mission', 'badge')),
    xp_delta integer not null check (xp_delta >= 0),
    event_details jsonb not null default '{}'::jsonb
        check (jsonb_typeof(event_details) = 'object'),
    created_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
);

create table if not exists public.daily_missions (
    user_id uuid not null references auth.users(id) on delete cascade,
    mission_date date not null,
    mission_timezone text not null default 'UTC'
        check (char_length(mission_timezone) between 1 and 80),
    mission_id text not null check (char_length(mission_id) between 1 and 80),
    progress integer not null default 0 check (progress >= 0),
    target integer not null check (target > 0),
    completed_at timestamptz,
    reward_claimed_at timestamptz,
    primary key (user_id, mission_date, mission_id)
);

create table if not exists public.earned_badges (
    user_id uuid not null references auth.users(id) on delete cascade,
    badge_id text not null check (char_length(badge_id) between 1 and 80),
    earned_at timestamptz not null default now(),
    primary key (user_id, badge_id)
);

create table if not exists public.premium_entitlements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source text not null check (source in ('manual_nequi', 'administrator_grant')),
    payment_request_id uuid,
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    revoked_at timestamptz,
    approved_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists premium_entitlements_payment_request_unique
    on public.premium_entitlements(payment_request_id)
    where payment_request_id is not null;

create table if not exists public.payment_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    payment_method text not null default 'nequi' check (payment_method = 'nequi'),
    destination_number text not null
        check (destination_number in ('3104337927', '3245957915', '3135595448')),
    reference text not null unique check (char_length(reference) between 1 and 120),
    amount_cop numeric(12, 2) not null check (amount_cop > 0),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    review_note text check (review_note is null or char_length(review_note) <= 500),
    created_at timestamptz not null default now(),
    check (
        (status = 'pending' and reviewed_by is null and reviewed_at is null)
        or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    )
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'premium_entitlements_payment_request_fk'
          and conrelid = 'public.premium_entitlements'::regclass
    ) then
        alter table public.premium_entitlements
            add constraint premium_entitlements_payment_request_fk
            foreign key (payment_request_id)
            references public.payment_requests(id)
            on delete restrict;
    end if;
end;
$$;

create table if not exists public.admin_audit_log (
    id bigint generated always as identity primary key,
    actor_user_id uuid not null references auth.users(id) on delete restrict,
    action text not null check (char_length(action) between 1 and 80),
    target_type text not null check (char_length(target_type) between 1 and 80),
    target_id text not null check (char_length(target_id) between 1 and 180),
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    created_at timestamptz not null default now()
);

create table if not exists public.local_progress_imports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
    payload jsonb not null check (
        jsonb_typeof(payload) = 'object'
        and pg_column_size(payload) <= 262144
    ),
    status text not null default 'staged'
        check (status in ('staged', 'validated', 'imported', 'needs_review', 'rejected')),
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    unique (user_id, source_fingerprint)
);

create index if not exists learning_attempts_user_occurred_idx
    on public.learning_attempts(user_id, occurred_at desc);
create index if not exists operation_results_user_created_idx
    on public.operation_results(user_id, created_at desc);
create index if not exists payment_requests_status_created_idx
    on public.payment_requests(status, created_at desc);

create or replace function public.create_student_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate_name text;
begin
    candidate_name := left(
        coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Explorador'),
        80
    );

    insert into public.profiles (id, display_name, role)
    values (new.id, candidate_name, 'student')
    on conflict (id) do nothing;

    insert into public.student_progress (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.gamification_accounts (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_ttl_profile on auth.users;
create trigger on_auth_user_created_ttl_profile
    after insert on auth.users
    for each row execute function public.create_student_profile();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create or replace function public.assign_authenticated_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'A signed-in user is required'
            using errcode = '42501';
    end if;

    new.user_id := auth.uid();
    return new;
end;
$$;

drop trigger if exists payment_requests_assign_owner on public.payment_requests;
create trigger payment_requests_assign_owner
    before insert on public.payment_requests
    for each row execute function public.assign_authenticated_owner();

drop trigger if exists local_progress_imports_assign_owner on public.local_progress_imports;
create trigger local_progress_imports_assign_owner
    before insert on public.local_progress_imports
    for each row execute function public.assign_authenticated_owner();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

drop trigger if exists student_progress_set_updated_at on public.student_progress;
create trigger student_progress_set_updated_at
    before update on public.student_progress
    for each row execute function public.set_updated_at();

drop trigger if exists gamification_accounts_set_updated_at on public.gamification_accounts;
create trigger gamification_accounts_set_updated_at
    before update on public.gamification_accounts
    for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.student_progress enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.operation_results enable row level security;
alter table public.gamification_accounts enable row level security;
alter table public.gamification_events enable row level security;
alter table public.daily_missions enable row level security;
alter table public.earned_badges enable row level security;
alter table public.premium_entitlements enable row level security;
alter table public.payment_requests enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.local_progress_imports enable row level security;

revoke all on public.profiles, public.student_progress, public.learning_attempts,
    public.operation_results, public.gamification_accounts, public.gamification_events,
    public.daily_missions, public.earned_badges, public.premium_entitlements,
    public.payment_requests, public.admin_audit_log, public.local_progress_imports
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, audio_enabled) on public.profiles to authenticated;
grant select on public.student_progress, public.learning_attempts, public.operation_results,
    public.gamification_accounts, public.gamification_events, public.daily_missions,
    public.earned_badges, public.premium_entitlements to authenticated;
grant select on public.payment_requests to authenticated;
grant insert (destination_number, reference, amount_cop) on public.payment_requests to authenticated;
grant select on public.admin_audit_log to authenticated;
grant select on public.local_progress_imports to authenticated;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
    for select to authenticated
    using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists student_progress_read_self_or_admin on public.student_progress;
create policy student_progress_read_self_or_admin on public.student_progress
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists learning_attempts_read_self_or_admin on public.learning_attempts;
create policy learning_attempts_read_self_or_admin on public.learning_attempts
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists operation_results_read_self_or_admin on public.operation_results;
create policy operation_results_read_self_or_admin on public.operation_results
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists gamification_accounts_read_self_or_admin on public.gamification_accounts;
create policy gamification_accounts_read_self_or_admin on public.gamification_accounts
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists gamification_events_read_self_or_admin on public.gamification_events;
create policy gamification_events_read_self_or_admin on public.gamification_events
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists daily_missions_read_self_or_admin on public.daily_missions;
create policy daily_missions_read_self_or_admin on public.daily_missions
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists earned_badges_read_self_or_admin on public.earned_badges;
create policy earned_badges_read_self_or_admin on public.earned_badges
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists premium_entitlements_read_self_or_admin on public.premium_entitlements;
create policy premium_entitlements_read_self_or_admin on public.premium_entitlements
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists payment_requests_read_self_or_admin on public.payment_requests;
create policy payment_requests_read_self_or_admin on public.payment_requests
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists payment_requests_insert_own_pending on public.payment_requests;
create policy payment_requests_insert_own_pending on public.payment_requests
    for insert to authenticated
    with check (
        (select auth.uid()) = user_id
        and status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
    );

drop policy if exists admin_audit_log_read_admin on public.admin_audit_log;
create policy admin_audit_log_read_admin on public.admin_audit_log
    for select to authenticated
    using ((select public.is_admin()));

drop policy if exists local_progress_imports_read_self_or_admin on public.local_progress_imports;
create policy local_progress_imports_read_self_or_admin on public.local_progress_imports
    for select to authenticated
    using ((select auth.uid()) = user_id or (select public.is_admin()));

create or replace function public.admin_review_payment(
    p_request_id uuid,
    p_decision text,
    p_review_note text default null
)
returns table (request_id uuid, new_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
    payment_row public.payment_requests%rowtype;
    reviewer uuid := auth.uid();
begin
    if reviewer is null or not public.is_admin() then
        raise exception 'Administrator authorization required'
            using errcode = '42501';
    end if;
    if p_decision is null or p_decision not in ('approved', 'rejected') then
        raise exception 'Unsupported payment decision'
            using errcode = '22023';
    end if;
    if p_review_note is not null and char_length(p_review_note) > 500 then
        raise exception 'Review note is too long'
            using errcode = '22023';
    end if;

    select * into payment_row
    from public.payment_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Payment request not found'
            using errcode = 'P0002';
    end if;
    if payment_row.status <> 'pending' then
        raise exception 'Payment request has already been reviewed'
            using errcode = '23505';
    end if;

    update public.payment_requests
    set status = p_decision,
        reviewed_by = reviewer,
        reviewed_at = now(),
        review_note = nullif(btrim(p_review_note), '')
    where id = p_request_id;

    if p_decision = 'approved' then
        insert into public.premium_entitlements (
            user_id, source, payment_request_id, approved_by
        )
        values (
            payment_row.user_id, 'manual_nequi', payment_row.id, reviewer
        )
        on conflict (payment_request_id) where payment_request_id is not null do nothing;
    end if;

    insert into public.admin_audit_log (
        actor_user_id, action, target_type, target_id, details
    )
    values (
        reviewer,
        'payment_' || p_decision,
        'payment_request',
        p_request_id::text,
        jsonb_build_object('note_present', p_review_note is not null)
    );

    return query select p_request_id, p_decision;
end;
$$;

revoke all on function public.admin_review_payment(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payment(uuid, text, text) to authenticated;
