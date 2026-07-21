-- 部署マスタ・社員の部署所属・経費明細の支払先/インボイス登録番号を追加
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  approver_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;

create policy "departments_select_all" on public.departments for select using (true);
create policy "departments_admin_write" on public.departments for insert with check (public.is_admin());
create policy "departments_admin_update" on public.departments for update using (public.is_admin());
create policy "departments_admin_delete" on public.departments for delete using (public.is_admin());

alter table public.profiles add column department_id uuid references public.departments (id) on delete set null;

alter table public.expense_items add column payee text;
alter table public.expense_items add column invoice_number text;
