-- Image attachments for the AI Assistant chat. The athlete uploads an
-- image, the assistant gets it as a vision-capable input, and the
-- resulting tool calls update brands / contracts / content as if the
-- athlete had typed the same data manually.
--
-- Layout: assistant-uploads/{athlete_id}/{uuid}.{ext}. Bucket is
-- private; signed URLs are minted on read. Same RLS pattern as the
-- existing `contracts` bucket.

alter table public.coach_messages
  add column image_paths text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('assistant-uploads', 'assistant-uploads', false)
on conflict (id) do nothing;

create policy "Athletes can upload to their assistant folder"
  on storage.objects for insert
  with check (
    bucket_id = 'assistant-uploads'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );

create policy "Athletes can read their assistant folder"
  on storage.objects for select
  using (
    bucket_id = 'assistant-uploads'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );

create policy "Athletes can delete files from their assistant folder"
  on storage.objects for delete
  using (
    bucket_id = 'assistant-uploads'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );
