-- 交通費(ガソリン代)自動計算の単価・燃費・季節指数を、社員ごとに個別設定できるようにする。
-- null の場合は「設定」ページの全社共通デフォルト値が使われる。

alter table public.profiles
  add column fuel_price_per_liter numeric,
  add column fuel_efficiency_km_per_liter numeric,
  add column seasonal_index_summer numeric,
  add column seasonal_index_winter numeric;

-- 本人による自己更新でこれらの値を書き換えられないようにする(admin専用の設定項目)
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.fuel_price_per_liter := old.fuel_price_per_liter;
    new.fuel_efficiency_km_per_liter := old.fuel_efficiency_km_per_liter;
    new.seasonal_index_summer := old.seasonal_index_summer;
    new.seasonal_index_winter := old.seasonal_index_winter;
  end if;
  return new;
end;
$$;
