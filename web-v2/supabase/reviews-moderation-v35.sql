begin;

-- Permite que Owner y Staff vean todas las reseñas.
drop policy if exists reviews_moderator_read on public.arc_reviews;
create policy reviews_moderator_read
on public.arc_reviews
for select
to authenticated
using (public.current_user_role() in ('owner','staff'));

-- Permite que Owner y Staff aprueben o rechacen.
drop policy if exists reviews_moderator_update on public.arc_reviews;
create policy reviews_moderator_update
on public.arc_reviews
for update
to authenticated
using (public.current_user_role() in ('owner','staff'))
with check (
  public.current_user_role() in ('owner','staff')
  and status in ('pending','approved','rejected')
);

grant select, update on public.arc_reviews to authenticated;
notify pgrst,'reload schema';

commit;
