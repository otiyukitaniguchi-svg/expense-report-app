-- 「交通費詳細」の路線(route)欄を廃止(距離の自動計算機能を追加するため不要になった)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.transportation_routes drop column if exists route;
