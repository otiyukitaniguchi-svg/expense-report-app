-- アプリ全体の設定(まずは「申請可能期間」のみ)。singleton行パターン(idはbooleanでtrue固定)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

create table public.app_settings (
  id boolean primary key default true,
  submission_start_day int not null default 1 check (submission_start_day between 1 and 31),
  submission_end_day int not null default 31 check (submission_end_day between 1 and 31),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create policy "app_settings_select_all" on public.app_settings for select using (true);
create policy "app_settings_admin_update" on public.app_settings for update using (public.is_admin());
