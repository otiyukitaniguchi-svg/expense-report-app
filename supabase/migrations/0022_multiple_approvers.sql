-- 部署の承認者を複数人選択できるようにする。
-- 従来の departments.approver_id (1人だけ) / profiles.manager_id (1人だけ) を廃止し、
-- 多対多の department_approvers テーブルに置き換える。

create table public.department_approvers (
  department_id uuid not null references public.departments (id) on delete cascade,
  approver_id uuid not null references public.profiles (id) on delete cascade,
  primary key (department_id, approver_id)
);

alter table public.department_approvers enable row level security;

create policy "department_approvers_select_all" on public.department_approvers for select using (true);
create policy "department_approvers_admin_insert" on public.department_approvers for insert with check (public.is_admin());
create policy "department_approvers_admin_delete" on public.department_approvers for delete using (public.is_admin());

-- 既存の単一承認者データを新テーブルへ移行
insert into public.department_approvers (department_id, approver_id)
select id, approver_id from public.departments where approver_id is not null
on conflict do nothing;

-- ---- RLSポリシーを department_approvers ベースに書き換え ----

drop policy "profiles_select_self_or_subordinate_or_admin" on public.profiles;
create policy "profiles_select_self_or_subordinate_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.department_approvers da
      where da.department_id = profiles.department_id and da.approver_id = auth.uid()
    )
  );

drop policy "reports_select_own_or_manager_or_admin" on public.expense_reports;
create policy "reports_select_own_or_manager_or_admin"
  on public.expense_reports for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      join public.department_approvers da on da.department_id = p.department_id
      where p.id = expense_reports.user_id and da.approver_id = auth.uid()
    )
  );

drop policy "reports_update_by_manager_or_admin" on public.expense_reports;
create policy "reports_update_by_manager_or_admin"
  on public.expense_reports for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      join public.department_approvers da on da.department_id = p.department_id
      where p.id = expense_reports.user_id and da.approver_id = auth.uid()
    )
  );

drop policy "items_select_via_report" on public.expense_items;
create policy "items_select_via_report"
  on public.expense_items for select
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id
        and (
          r.user_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1 from public.profiles p
            join public.department_approvers da on da.department_id = p.department_id
            where p.id = r.user_id and da.approver_id = auth.uid()
          )
        )
    )
  );

-- 権限昇格防止トリガーから manager_id への参照を除去
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

alter table public.profiles drop column if exists manager_id;
alter table public.departments drop column if exists approver_id;
