-- 締め切りリマインダーメール機能を削除したため、社員ごとの通知ON/OFF列を削除。
-- (0019で追加したが、0019をまだ実行していない場合でもエラーにならないよう if exists を付けている)

alter table public.profiles
  drop column if exists notify_enabled;
