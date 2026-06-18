-- Credits drive AI Lab Partner usage. Each message consumes 1 credit;
-- purchases (or admin grants) top the balance back up.

alter table public.athletes
  add column if not exists credits integer not null default 20;

create index if not exists idx_athletes_credits on public.athletes(credits);

-- Audit trail for every credit movement (purchase, grant, consumption).
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  amount integer not null,
  reason text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy "Athletes can view their own credit transactions"
  on public.credit_transactions for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

-- Atomic consumption: subtract 1 if available, otherwise no-op. Returns
-- the new balance, or NULL if the athlete had insufficient credits.
create or replace function public.consume_credit(p_athlete_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  update public.athletes
  set credits = credits - 1
  where id = p_athlete_id and credits > 0
  returning credits into new_balance;

  if new_balance is not null then
    insert into public.credit_transactions (athlete_id, amount, reason)
    values (p_athlete_id, -1, p_reason);
  end if;

  return new_balance;
end;
$$;

-- Admin/purchase grant: add credits and record the transaction atomically.
create or replace function public.grant_credits(
  p_athlete_id uuid,
  p_amount integer,
  p_reason text,
  p_metadata jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  update public.athletes
  set credits = credits + p_amount
  where id = p_athlete_id
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'athlete not found';
  end if;

  insert into public.credit_transactions (athlete_id, amount, reason, metadata)
  values (p_athlete_id, p_amount, p_reason, p_metadata);

  return new_balance;
end;
$$;
