-- Web Push subscriptions. Each browser/device pair an athlete enables
-- gets a row with the endpoint + key material the web-push library
-- needs to encrypt a payload. The unique (athlete_id, endpoint) guard
-- makes "Enable" idempotent if the user clicks twice from the same
-- device.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (athlete_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Athletes can manage their own push subscriptions"
  on public.push_subscriptions for all
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()))
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create index idx_push_subscriptions_athlete on public.push_subscriptions(athlete_id);
