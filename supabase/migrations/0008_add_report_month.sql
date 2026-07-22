-- 「新規登録」を月単位の継続入力にするため、申請(expense_reports)に対象月(YYYY-MM)を追加。
-- 既存の申請は report_month が null のままで問題ない(申請状況の月フィルタでは提出日から月を判定する)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.expense_reports add column report_month text;
