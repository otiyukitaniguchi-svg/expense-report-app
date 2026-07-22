-- 「新規登録」でチェックした明細だけを新しい申請(status='submitted')に分離して提出する処理は、
-- 通常のUPDATE(expense_items.report_idを提出済みレポートへ付け替え)だとRLSのWITH CHECKに
-- 弾かれてしまう(移動先レポートがdraft/rejectedではないため)。
-- そのため、この処理全体をsecurity definer関数にまとめてRLSを迂回しつつ、
-- 関数内部でauth.uid()による本人チェックを行う。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

create or replace function public.submit_selected_items(p_item_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_report_id uuid;
  v_source_user_id uuid;
  v_title text;
  v_report_month text;
  v_total numeric;
  v_new_report_id uuid;
begin
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception '明細が選択されていません';
  end if;

  select r.id, r.user_id, r.title, r.report_month
    into v_source_report_id, v_source_user_id, v_title, v_report_month
  from public.expense_items i
  join public.expense_reports r on r.id = i.report_id
  where i.id = p_item_ids[1];

  if v_source_user_id is null or v_source_user_id != auth.uid() then
    raise exception '権限がありません';
  end if;

  if exists (
    select 1
    from public.expense_items i
    join public.expense_reports r on r.id = i.report_id
    where i.id = any(p_item_ids)
      and (
        r.user_id != auth.uid()
        or r.id != v_source_report_id
        or r.status != 'draft'
        or i.category_id is null
        or i.tax_category_id is null
        or i.amount <= 0
      )
  ) then
    raise exception '選択した明細が不正です(所有者・下書き状態・必須項目を確認してください)';
  end if;

  select coalesce(sum(amount), 0) into v_total
  from public.expense_items
  where id = any(p_item_ids);

  insert into public.expense_reports (user_id, title, status, submitted_at, total_amount, report_month)
  values (auth.uid(), v_title, 'submitted', now(), v_total, v_report_month)
  returning id into v_new_report_id;

  update public.expense_items
  set report_id = v_new_report_id
  where id = any(p_item_ids);

  update public.expense_reports
  set total_amount = (
    select coalesce(sum(amount), 0) from public.expense_items where report_id = v_source_report_id
  )
  where id = v_source_report_id;

  return v_new_report_id;
end;
$$;

revoke all on function public.submit_selected_items(uuid[]) from public;
grant execute on function public.submit_selected_items(uuid[]) to authenticated;
