-- 明細入力モーダルを簡素化(日付・科目名・摘要・金額・支払先・備考のみ)するため、
-- 税区分は「経費科目ごとのデフォルト税区分」から自動解決する方式に変更。
-- また摘要(description)とは別に「備考」欄(memo)を追加。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.expense_categories
  add column default_tax_category_id uuid references public.tax_categories (id);

alter table public.expense_items add column memo text;
