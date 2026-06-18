-- ACL Athlete Platform — Phase 1 Schema
-- Tables: athletes, brands, brand_activities, lab_partner_messages, invite_codes

-- ============================================================
-- 1. athletes
-- ============================================================
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  sport text,
  school text,
  graduation_year int,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athletes enable row level security;

create policy "Athletes can view their own profile"
  on public.athletes for select
  using (auth.uid() = auth_user_id);

create policy "Athletes can update their own profile"
  on public.athletes for update
  using (auth.uid() = auth_user_id);

create policy "Athletes can insert their own profile"
  on public.athletes for insert
  with check (auth.uid() = auth_user_id);

-- ============================================================
-- 2. brands
-- ============================================================
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  business_name text not null,
  category text not null check (category in ('restaurant', 'fitness', 'retail', 'auto', 'healthcare', 'real_estate', 'other')),
  city text,
  state text,
  website text,
  instagram_handle text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  status text not null default 'prospect' check (status in ('prospect', 'contacted', 'in_conversation', 'negotiating', 'deal_closed', 'not_a_fit')),
  next_followup_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brands enable row level security;

create policy "Athletes can view their own brands"
  on public.brands for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own brands"
  on public.brands for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can update their own brands"
  on public.brands for update
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can delete their own brands"
  on public.brands for delete
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

-- ============================================================
-- 3. brand_activities
-- ============================================================
create table public.brand_activities (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  activity_type text not null check (activity_type in ('outreach', 'note', 'status_change')),
  channel text check (channel in ('email', 'dm', 'call', 'in_person', 'other')),
  content text not null,
  response_received boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_activities enable row level security;

create policy "Athletes can view their own activities"
  on public.brand_activities for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own activities"
  on public.brand_activities for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

-- ============================================================
-- 4. lab_partner_messages
-- ============================================================
create table public.lab_partner_messages (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lab_partner_messages enable row level security;

create policy "Athletes can view their own messages"
  on public.lab_partner_messages for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own messages"
  on public.lab_partner_messages for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

-- ============================================================
-- 5. invite_codes (for gated signup)
-- ============================================================
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  used_by uuid references public.athletes(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- Only allow reading unused codes during signup (anon can check if code is valid)
create policy "Anyone can check if an invite code is valid"
  on public.invite_codes for select
  using (used_by is null and (expires_at is null or expires_at > now()));

-- ============================================================
-- 6. updated_at trigger function
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_athletes_updated_at
  before update on public.athletes
  for each row execute function public.handle_updated_at();

create trigger set_brands_updated_at
  before update on public.brands
  for each row execute function public.handle_updated_at();

create trigger set_brand_activities_updated_at
  before update on public.brand_activities
  for each row execute function public.handle_updated_at();

create trigger set_lab_partner_messages_updated_at
  before update on public.lab_partner_messages
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 7. Indexes for common queries
-- ============================================================
create index idx_athletes_auth_user_id on public.athletes(auth_user_id);
create index idx_brands_athlete_id on public.brands(athlete_id);
create index idx_brands_status on public.brands(status);
create index idx_brands_next_followup on public.brands(next_followup_date);
create index idx_brand_activities_brand_id on public.brand_activities(brand_id);
create index idx_brand_activities_athlete_id on public.brand_activities(athlete_id);
create index idx_lab_partner_messages_athlete_id on public.lab_partner_messages(athlete_id);
create index idx_invite_codes_code on public.invite_codes(code);
