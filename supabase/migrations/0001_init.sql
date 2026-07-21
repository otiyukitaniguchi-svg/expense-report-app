-- 経費精算アプリ 初期スキーマ
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。
--
-- 【初回セットアップ手順】
-- 1. このSQLを実行
-- 2. Authentication画面(または本アプリのログイン画面のSupabase側)で最初の管理者アカウントを作成
--    (メール/パスワードでサインアップすると public.profiles に employee role で行が自動作成される)
-- 3. SQL Editorで以下を実行し、最初の1人だけ手動でadminに昇格させる
--      update public.profiles set role = 'admin' where id =
--        (select id from auth.users where email = 'admin@example.com');
--    (以降のユーザーのrole/manager_id変更はアプリのAdminSettings画面からadminが行う)

create extension if not exists "pgcrypto";

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null check (role in ('employee', 'manager', 'admin')) default 'employee',
  manager_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 新規ユーザー登録時にprofilesの行を自動作成(role/manager_idは後から管理者が設定)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ expense_categories ============
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.expense_categories (name) values
  ('交通費'), ('交際費'), ('会議費'), ('消耗品費'), ('通信費'), ('宿泊費'), ('雑費');

-- ============ tax_categories ============
create table public.tax_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate numeric(5, 4) not null,
  created_at timestamptz not null default now()
);

insert into public.tax_categories (name, rate) values
  ('標準税率(10%)', 0.10),
  ('軽減税率(8%)', 0.08),
  ('非課税', 0.00),
  ('不課税', 0.00);

-- ============ expense_reports ============
create table public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  status text not null check (status in ('draft', 'submitted', 'approved', 'rejected')) default 'draft',
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  total_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ expense_items ============
create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.expense_reports (id) on delete cascade,
  date date not null,
  category_id uuid not null references public.expense_categories (id),
  tax_category_id uuid not null references public.tax_categories (id),
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null default '',
  receipt_path text,
  created_at timestamptz not null default now()
);

-- ============ RLS を全テーブルで有効化 ============
alter table public.profiles enable row level security;
alter table public.expense_categories enable row level security;
alter table public.tax_categories enable row level security;
alter table public.expense_reports enable row level security;
alter table public.expense_items enable row level security;

-- ---- helper: 自分がadminかどうか ----
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---- profiles ポリシー ----
create policy "profiles_select_self_or_subordinate_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or manager_id = auth.uid()
    or public.is_admin()
  );

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- 本人による自己更新では role / manager_id を書き換えられないようにする(権限昇格防止)
create function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.manager_id := old.manager_id;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_escalation();

create policy "profiles_admin_manage"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles_admin_delete"
  on public.profiles for delete
  using (public.is_admin());

-- ---- expense_categories / tax_categories: 全員read、adminのみwrite ----
create policy "categories_select_all" on public.expense_categories for select using (true);
create policy "categories_admin_write" on public.expense_categories for insert with check (public.is_admin());
create policy "categories_admin_update" on public.expense_categories for update using (public.is_admin());
create policy "categories_admin_delete" on public.expense_categories for delete using (public.is_admin());

create policy "tax_categories_select_all" on public.tax_categories for select using (true);
create policy "tax_categories_admin_write" on public.tax_categories for insert with check (public.is_admin());
create policy "tax_categories_admin_update" on public.tax_categories for update using (public.is_admin());
create policy "tax_categories_admin_delete" on public.tax_categories for delete using (public.is_admin());

-- ---- expense_reports ポリシー ----
create policy "reports_select_own_or_manager_or_admin"
  on public.expense_reports for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = expense_reports.user_id and p.manager_id = auth.uid()
    )
  );

create policy "reports_insert_own_draft"
  on public.expense_reports for insert
  with check (user_id = auth.uid());

-- 本人はdraft状態のみ更新可(提出操作でstatusをsubmittedに変更するのも本人の権限)
create policy "reports_update_own_draft_or_submit"
  on public.expense_reports for update
  using (user_id = auth.uid() and status in ('draft', 'submitted'))
  with check (user_id = auth.uid());

-- manager/adminは承認・差し戻し操作のため部下の申請を更新可
create policy "reports_update_by_manager_or_admin"
  on public.expense_reports for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = expense_reports.user_id and p.manager_id = auth.uid()
    )
  );

create policy "reports_delete_own_draft_or_admin"
  on public.expense_reports for delete
  using ((user_id = auth.uid() and status = 'draft') or public.is_admin());

-- ---- expense_items ポリシー(親レポートの権限に連動) ----
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
            where p.id = r.user_id and p.manager_id = auth.uid()
          )
        )
    )
  );

create policy "items_write_via_own_draft_report"
  on public.expense_items for insert
  with check (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status = 'draft'
    )
  );

create policy "items_update_via_own_draft_report"
  on public.expense_items for update
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status = 'draft'
    )
  );

create policy "items_delete_via_own_draft_report"
  on public.expense_items for delete
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status = 'draft'
    )
  );

-- ============ Storage: receipts バケット ============
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts_select_own_or_manager_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[1] and p.manager_id = auth.uid()
      )
    )
  );

create policy "receipts_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
