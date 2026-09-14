-- 交通費詳細にも「申請」機能を追加する。
-- 経費精算(expense_reports)の仕組みをそのまま流用し、report_type列で経費/交通費を区別する。
-- 交通費詳細の各行(transportation_routes)は、申請されるまでreport_idがnullのまま
-- 「未申請プール」に残り、申請すると新しいexpense_reports行(report_type='transportation')に
-- まとめて紐づけられ、交通費詳細の一覧からは消えて申請状況側に移る。
-- 差し戻された場合は、自動でreport_idがnullに戻り、交通費詳細の一覧に再度表示される。
-- (このファイルは再実行しても安全なように書かれています)

alter table public.expense_reports
  add column if not exists report_type text not null default 'expense'
  check (report_type in ('expense', 'transportation'));

alter table public.transportation_routes
  add column if not exists report_id uuid references public.expense_reports (id) on delete set null;

-- 承認者(department_approvers)が、担当する交通費申請の明細を閲覧できるようにする
drop policy if exists "transportation_routes_select_via_report" on public.transportation_routes;
create policy "transportation_routes_select_via_report"
  on public.transportation_routes for select
  using (
    report_id is not null
    and exists (
      select 1 from public.expense_reports r
      join public.profiles p on p.id = r.user_id
      join public.department_approvers da on da.department_id = p.department_id
      where r.id = transportation_routes.report_id and da.approver_id = auth.uid()
    )
  );

-- 交通費申請が差し戻されたら、明細を自動で未申請プールに戻す(report_idをnullに)
create or replace function public.release_transportation_routes_on_reject()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.report_type = 'transportation' and new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.transportation_routes set report_id = null where report_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists expense_reports_release_transportation_on_reject on public.expense_reports;
create trigger expense_reports_release_transportation_on_reject
  after update on public.expense_reports
  for each row execute procedure public.release_transportation_routes_on_reject();
