begin;

create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    preferred_name text not null default '',
    birth_date date,
    profession text,
    personal_info text,
    favorite_topics jsonb not null default '[]'::jsonb,
    interests jsonb not null default '[]'::jsonb,
    personality_traits jsonb not null default '[]'::jsonb,
    response_style text,
    response_style_notes text,
    onboarding_completed boolean not null default false,
    age_verified boolean not null default false,
    blocked_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_profiles_blocked_reason_check
        check (blocked_reason in ('underage') or blocked_reason is null)
);

create index if not exists idx_user_profiles_onboarding_completed
    on public.user_profiles (onboarding_completed);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can delete own profile" on public.user_profiles;

create policy "Users can view own profile" on public.user_profiles
    for select using (auth.uid() = user_id);

create policy "Users can insert own profile" on public.user_profiles
    for insert with check (auth.uid() = user_id);

create policy "Users can update own profile" on public.user_profiles
    for update using (auth.uid() = user_id);

create policy "Users can delete own profile" on public.user_profiles
    for delete using (auth.uid() = user_id);

create or replace function public.update_user_profiles_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_profiles_updated_at on public.user_profiles;

create trigger update_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.update_user_profiles_updated_at();

commit;
