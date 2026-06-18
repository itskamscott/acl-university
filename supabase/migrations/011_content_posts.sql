-- Phase 2 module 2: content creation + scheduling for the athlete's
-- personal brand. One row per planned/drafted/posted piece of content.

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  title text,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'other')),
  status text not null default 'idea'
    check (status in ('idea', 'drafted', 'scheduled', 'posted')),
  planned_for date,
  posted_at timestamptz,
  caption text,
  posted_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_posts enable row level security;

create policy "Athletes can view their own content posts"
  on public.content_posts for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own content posts"
  on public.content_posts for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can update their own content posts"
  on public.content_posts for update
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can delete their own content posts"
  on public.content_posts for delete
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create trigger set_content_posts_updated_at
  before update on public.content_posts
  for each row execute function public.handle_updated_at();

create index if not exists idx_content_posts_athlete_id on public.content_posts(athlete_id);
create index if not exists idx_content_posts_status on public.content_posts(status);
create index if not exists idx_content_posts_planned_for on public.content_posts(planned_for);
create index if not exists idx_content_posts_brand_id on public.content_posts(brand_id);
