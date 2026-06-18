-- Thread separation for AI Assistant conversations. Each "New chat"
-- press generates a new thread_id; history queries and the model
-- context window are bounded to the active thread so long-running
-- accounts don't drag stale context (and tokens) into every reply.
--
-- Existing messages get grouped into one thread per athlete so the
-- full prior history remains coherent when re-loaded.

alter table public.coach_messages
  add column thread_id uuid;

with athlete_threads as (
  select id as athlete_id, gen_random_uuid() as thread_id
  from public.athletes
)
update public.coach_messages cm
set thread_id = at.thread_id
from athlete_threads at
where cm.athlete_id = at.athlete_id
  and cm.thread_id is null;

alter table public.coach_messages
  alter column thread_id set not null;

create index idx_coach_messages_athlete_thread
  on public.coach_messages(athlete_id, thread_id, created_at);
