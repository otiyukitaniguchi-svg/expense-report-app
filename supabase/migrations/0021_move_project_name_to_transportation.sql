-- 「案件名」は経費明細ではなく交通費詳細に持たせることにしたため、列を移動する。

alter table public.expense_items
  drop column if exists project_name;

alter table public.transportation_routes
  add column if not exists project_name text;
