-- 「+ 明細を追加」を押した直後は経費科目・税区分が未選択(空)の状態で行を作成するが、
-- これまで category_id / tax_category_id が NOT NULL だったため、追加した瞬間に
-- 保存エラーになっていた(「明細追加できない」不具合の原因)。
-- 下書き中は未選択を許可し、提出時のみアプリ側でチェックする(ReportForm.tsx側で既に実施済み)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.expense_items alter column category_id drop not null;
alter table public.expense_items alter column tax_category_id drop not null;
