-- 締め切りリマインダーメールを送るかどうかを社員ごとにON/OFFできるようにする。

alter table public.profiles
  add column notify_enabled boolean not null default true;
