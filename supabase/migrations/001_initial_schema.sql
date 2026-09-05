create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique not null,
  username text,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  age int check (age between 13 and 100),
  sex text,
  height_cm numeric(5,1) check (height_cm > 0 and height_cm <= 300),
  weight_kg numeric(5,1) check (weight_kg > 0 and weight_kg <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  experience_level text,
  training_location text,
  days_per_week int check (days_per_week between 1 and 7),
  session_duration_minutes int check (session_duration_minutes between 15 and 300),
  equipment text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal text not null,
  priority int not null default 1,
  created_at timestamptz not null default now(),
  unique(user_id, goal)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  preferred_days text[] not null default '{}',
  preferred_time text,
  exercise_preferences text,
  exercise_restrictions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  current_state text not null default 'NOT_STARTED',
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.training_profiles enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.user_preferences enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.conversation_messages enable row level security;

-- MVP1 uses the server-side Supabase service role only. No public policies are added.
