-- レシート画像添付機能を削除(要件変更: 画像添付は不要、科目・金額の一覧PDF化のみで良いとのこと)
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

drop policy if exists "receipts_insert_own_folder" on storage.objects;
drop policy if exists "receipts_select_own_or_manager_or_admin" on storage.objects;
drop policy if exists "receipts_delete_own_folder" on storage.objects;

alter table public.expense_items drop column if exists receipt_path;

-- 注: "receipts" バケット自体の削除はこのSQLでは行わない。
-- Supabase SQL Editorは "delete from storage.buckets where id = 'receipts'" を実行すると
-- 依存関係チェック機能が 'receipts' を誤ってテーブル名として解釈しエラーになることがある。
-- バケットを削除したい場合は Studio の Storage 画面から "receipts" バケットを選び、
-- 手動で削除(Delete bucket)してください。空のバケットを残しておいても実害はありません。
