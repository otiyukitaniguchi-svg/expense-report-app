-- 差し戻し(rejected)された申請は本人が削除できるようにする(提出済み・承認済みは記録として残すため不可のまま)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

drop policy "reports_delete_own_draft_or_admin" on public.expense_reports;
create policy "reports_delete_own_draft_or_admin"
  on public.expense_reports for delete
  using ((user_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin());
