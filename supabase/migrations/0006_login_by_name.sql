-- 氏名(name)でログインできるようにする。
-- Supabase Authはemailベースの認証しか持たないため、
-- 「氏名 → ログイン用email」を解決するRPCを用意し、
-- ログイン画面ではまずこのRPCでemailを取得してからsignInWithPasswordする。
-- 未ログイン(anon)から呼べる必要があるが、返すのはemailのみで他の個人情報は返さない。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

create or replace function public.resolve_login_email(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.email
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.name = p_name
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
