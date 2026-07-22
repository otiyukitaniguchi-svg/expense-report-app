-- 差し戻し(rejected)された申請を、本人が編集・再提出できるようにRLSポリシーを更新。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

drop policy "reports_update_own_draft_or_submit" on public.expense_reports;
create policy "reports_update_own_draft_or_submit"
  on public.expense_reports for update
  using (user_id = auth.uid() and status in ('draft', 'submitted', 'rejected'))
  with check (user_id = auth.uid());

drop policy "items_write_via_own_draft_report" on public.expense_items;
create policy "items_write_via_own_draft_report"
  on public.expense_items for insert
  with check (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status in ('draft', 'rejected')
    )
  );

drop policy "items_update_via_own_draft_report" on public.expense_items;
create policy "items_update_via_own_draft_report"
  on public.expense_items for update
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status in ('draft', 'rejected')
    )
  );

drop policy "items_delete_via_own_draft_report" on public.expense_items;
create policy "items_delete_via_own_draft_report"
  on public.expense_items for delete
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = expense_items.report_id and r.user_id = auth.uid() and r.status in ('draft', 'rejected')
    )
  );
