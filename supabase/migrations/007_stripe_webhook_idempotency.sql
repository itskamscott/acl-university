-- Prevent double-crediting when Stripe retries a checkout.session.completed
-- webhook. Each Stripe session id can only appear once in the ledger.

create unique index if not exists idx_credit_transactions_stripe_session_unique
  on public.credit_transactions ((metadata->>'session_id'))
  where reason = 'stripe_purchase';
