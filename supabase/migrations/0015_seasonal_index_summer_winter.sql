-- 季節指数を夏場(4月〜10月)・冬場(11月〜3月)の2種類に分ける。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.app_settings add column seasonal_index_summer numeric not null default 1;
alter table public.app_settings add column seasonal_index_winter numeric not null default 1;
alter table public.app_settings drop column if exists seasonal_index;
