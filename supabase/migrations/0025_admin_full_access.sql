-- 管理者が全社員の経費明細(expense_items)・交通費詳細(transportation_routes)を
-- 状態やオーナーに関わらず追加・編集・削除できるようにする。
-- (このファイルは再実行しても安全なように書かれています)

-- ---- expense_items: 管理者は追加・編集・削除が可能 ----
drop policy if exists "items_admin_insert" on public.expense_items;
create policy "items_admin_insert" on public.expense_items for insert with check (public.is_admin());
drop policy if exists "items_admin_update" on public.expense_items;
create policy "items_admin_update" on public.expense_items for update using (public.is_admin());
drop policy if exists "items_admin_delete" on public.expense_items;
create policy "items_admin_delete" on public.expense_items for delete using (public.is_admin());

-- ---- transportation_routes: 管理者は全社員分を閲覧・追加・編集・削除可能 ----
drop policy if exists "transportation_routes_admin_select" on public.transportation_routes;
create policy "transportation_routes_admin_select" on public.transportation_routes for select using (public.is_admin());
drop policy if exists "transportation_routes_admin_insert" on public.transportation_routes;
create policy "transportation_routes_admin_insert" on public.transportation_routes for insert with check (public.is_admin());
drop policy if exists "transportation_routes_admin_update" on public.transportation_routes;
create policy "transportation_routes_admin_update" on public.transportation_routes for update using (public.is_admin());
drop policy if exists "transportation_routes_admin_delete" on public.transportation_routes;
create policy "transportation_routes_admin_delete" on public.transportation_routes for delete using (public.is_admin());
