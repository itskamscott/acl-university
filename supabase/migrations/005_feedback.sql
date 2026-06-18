-- Feedback, bug reports, and feature requests submitted from inside the app.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete set null,
  athlete_email text,
  athlete_name text,
  type text not null check (type in ('bug', 'feature', 'other')),
  message text not null,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Athletes can view their own feedback"
  on public.feedback for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own feedback"
  on public.feedback for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Admins can view all feedback"
  on public.feedback for select
  using (
    exists (
      select 1 from public.athletes
      where auth_user_id = auth.uid() and is_admin = true
    )
  );

create index if not exists idx_feedback_created_at on public.feedback(created_at desc);
create index if not exists idx_feedback_athlete_id on public.feedback(athlete_id);
