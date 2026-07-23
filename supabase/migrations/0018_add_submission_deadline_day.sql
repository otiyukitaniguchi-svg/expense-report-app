-- 「設定」ページに毎月の経費精算締め切り日(1〜31)を追加。

alter table public.app_settings
  add column submission_deadline_day int not null default 31
  check (submission_deadline_day between 1 and 31);
