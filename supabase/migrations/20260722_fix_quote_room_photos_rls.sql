-- Les fichiers sont stockés sous :
-- <auth.uid()>/<quote_id>/<room_id>/<file_name>

alter table public.quote_room_photos enable row level security;

grant select, insert, delete on table public.quote_room_photos to authenticated;

drop policy if exists "quote_room_photos_select_owned_rooms"
  on public.quote_room_photos;
create policy "quote_room_photos_select_owned_rooms"
  on public.quote_room_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quote_rooms as room
      where room.id = quote_room_photos.room_id
        and room.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "quote_room_photos_insert_owned_rooms"
  on public.quote_room_photos;
create policy "quote_room_photos_insert_owned_rooms"
  on public.quote_room_photos
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.quote_rooms as room
      where room.id = quote_room_photos.room_id
        and room.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "quote_room_photos_delete_owned_rooms"
  on public.quote_room_photos;
create policy "quote_room_photos_delete_owned_rooms"
  on public.quote_room_photos
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quote_rooms as room
      where room.id = quote_room_photos.room_id
        and room.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "quote_room_photos_storage_insert_own_folder"
  on storage.objects;
create policy "quote_room_photos_storage_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'quote-room-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Supabase Storage renvoie les métadonnées de l'objet après l'INSERT.
-- Cette politique est donc nécessaire même pour un simple upload.
drop policy if exists "quote_room_photos_storage_select_own_folder"
  on storage.objects;
create policy "quote_room_photos_storage_select_own_folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'quote-room-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "quote_room_photos_storage_delete_own_folder"
  on storage.objects;
create policy "quote_room_photos_storage_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'quote-room-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
