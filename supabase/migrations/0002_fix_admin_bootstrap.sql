-- 0001_init.sql の権限昇格防止トリガーに不具合があったための修正。
-- SQL EditorからのUPDATE(ログインセッションを持たない = auth.uid() が NULL)の場合、
-- is_admin() が false になり「管理者ではない」と誤判定して role の変更を無効化してしまっていた。
-- auth.uid() が NULL のとき(= アプリ経由ではなくSQL Editor/service_role等の信頼された実行)は
-- チェックをスキップするように修正する。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.manager_id := old.manager_id;
  end if;
  return new;
end;
$$;
