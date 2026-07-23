-- 「経費精算ルール」ページ用のルール本文を app_settings に追加。
-- 既存のRLSポリシー(全員select可・adminのみupdate可)がそのまま適用される。

alter table public.app_settings
  add column expense_rules text not null default '';
