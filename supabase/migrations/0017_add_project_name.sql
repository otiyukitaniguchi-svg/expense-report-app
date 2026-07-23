-- 経費明細に「案件名」(例: ○○ → ○○ のような案件表記)を追加。

alter table public.expense_items
  add column project_name text;
