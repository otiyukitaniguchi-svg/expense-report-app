-- 経費明細を自由に並び替えできるように、表示順を保持する列を追加する。

alter table public.expense_items add column sort_order integer;

-- 既存データには、これまでの並び順(日付→作成日時)に基づいて連番を振っておく
with ranked as (
  select id, row_number() over (partition by report_id order by date, created_at) as rn
  from public.expense_items
)
update public.expense_items ei
set sort_order = ranked.rn
from ranked
where ei.id = ranked.id;

alter table public.expense_items alter column sort_order set default 0;
alter table public.expense_items alter column sort_order set not null;
