-- Private storage bucket for contract files. Objects are laid out as
-- {athlete_id}/{contract_id}/{filename} so RLS can scope per-athlete.

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy "Athletes can upload to their contracts folder"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );

create policy "Athletes can read their contracts folder"
  on storage.objects for select
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );

create policy "Athletes can update files in their contracts folder"
  on storage.objects for update
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );

create policy "Athletes can delete files from their contracts folder"
  on storage.objects for delete
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in (
      select id::text from public.athletes where auth_user_id = auth.uid()
    )
  );
