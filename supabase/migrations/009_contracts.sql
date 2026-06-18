-- Phase 2: Contract & deliverable management.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null,
  total_value_cents integer,
  currency text not null default 'usd',
  signed_at date,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'cancelled')),
  source text not null default 'manual'
    check (source in ('manual', 'uploaded', 'generated')),
  contract_file_path text,
  generated_content text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts enable row level security;

create policy "Athletes can view their own contracts"
  on public.contracts for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own contracts"
  on public.contracts for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can update their own contracts"
  on public.contracts for update
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can delete their own contracts"
  on public.contracts for delete
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  description text not null,
  due_date date,
  completed_at timestamptz,
  proof_url text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliverables enable row level security;

create policy "Athletes can view their own deliverables"
  on public.deliverables for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own deliverables"
  on public.deliverables for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can update their own deliverables"
  on public.deliverables for update
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can delete their own deliverables"
  on public.deliverables for delete
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create table if not exists public.contract_payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'usd',
  due_date date,
  received_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contract_payments enable row level security;

create policy "Athletes can view their own contract payments"
  on public.contract_payments for select
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can insert their own contract payments"
  on public.contract_payments for insert
  with check (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can update their own contract payments"
  on public.contract_payments for update
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create policy "Athletes can delete their own contract payments"
  on public.contract_payments for delete
  using (athlete_id in (select id from public.athletes where auth_user_id = auth.uid()));

create trigger set_contracts_updated_at
  before update on public.contracts
  for each row execute function public.handle_updated_at();

create trigger set_deliverables_updated_at
  before update on public.deliverables
  for each row execute function public.handle_updated_at();

create trigger set_contract_payments_updated_at
  before update on public.contract_payments
  for each row execute function public.handle_updated_at();

create index if not exists idx_contracts_athlete_id on public.contracts(athlete_id);
create index if not exists idx_contracts_brand_id on public.contracts(brand_id);
create index if not exists idx_contracts_status on public.contracts(status);
create index if not exists idx_deliverables_contract_id on public.deliverables(contract_id);
create index if not exists idx_deliverables_due_date on public.deliverables(due_date);
create index if not exists idx_contract_payments_contract_id on public.contract_payments(contract_id);
