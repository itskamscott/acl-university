-- ============================================================================
-- 028: Phase 4 — auto-generate a payouts row when a deal closes
-- ----------------------------------------------------------------------------
-- Fires on contracts.acl_status transitioning into 'paid'. Computes:
--   acl_fee     = gross_amount * coalesce(acl_percentage, org.default_acl_percentage) / 100
--   athlete_net = gross_amount - acl_fee
-- Errors if gross_amount is null or org/team isn't set — those are required
-- before a deal can land in 'paid' anyway.
-- Idempotent: on conflict (contract_id) do nothing (one payout per deal).
-- ============================================================================

-- Each contract gets at most one payout row.
create unique index if not exists uq_payouts_contract_id on public.payouts(contract_id);

create or replace function public.handle_contract_paid()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_percentage numeric(5,2);
  v_acl_fee numeric(12,2);
  v_athlete_net numeric(12,2);
  v_org_default numeric(5,2);
begin
  -- Only fire on the transition INTO 'paid'
  if (new.acl_status = 'paid' and (old.acl_status is distinct from 'paid')) then
    if (new.gross_amount is null) then
      raise exception 'Cannot mark contract % paid: gross_amount is null', new.id
        using errcode = 'check_violation';
    end if;
    if (new.org_id is null) then
      raise exception 'Cannot mark contract % paid: org_id is null', new.id
        using errcode = 'check_violation';
    end if;

    select default_acl_percentage into v_org_default
      from public.organizations where id = new.org_id;
    v_percentage := coalesce(new.acl_percentage, v_org_default, 0);
    v_acl_fee := round(new.gross_amount * v_percentage / 100.0, 2);
    v_athlete_net := new.gross_amount - v_acl_fee;

    insert into public.payouts (
      contract_id, org_id, team_id, gross_amount, acl_fee, athlete_net, status
    ) values (
      new.id, new.org_id, new.team_id, new.gross_amount, v_acl_fee, v_athlete_net, 'pending'
    )
    on conflict (contract_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_contract_paid on public.contracts;
create trigger trg_handle_contract_paid
  after update of acl_status on public.contracts
  for each row execute function public.handle_contract_paid();
