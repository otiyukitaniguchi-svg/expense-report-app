-- 「交通費詳細」機能: 出発地・到着地・路線・距離(km)を入力すると、
-- 距離×単価(円/L)÷燃費(Km/L)×季節指数 でガソリン代を自動計算して記録できる
-- 一覧(申請とは独立した個人メモ用途)。
-- Supabaseダッシュボードの SQL Editor でこのファイルの内容をそのまま実行してください。

alter table public.app_settings add column fuel_price_per_liter numeric not null default 170;
alter table public.app_settings add column fuel_efficiency_km_per_liter numeric not null default 15;
alter table public.app_settings add column seasonal_index numeric not null default 1;

create table public.transportation_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  departure text not null,
  arrival text not null,
  route text,
  distance_km numeric not null check (distance_km >= 0),
  amount numeric not null default 0,
  memo text,
  created_at timestamptz not null default now()
);

alter table public.transportation_routes enable row level security;

create policy "transportation_routes_select_own"
  on public.transportation_routes for select
  using (user_id = auth.uid());

create policy "transportation_routes_insert_own"
  on public.transportation_routes for insert
  with check (user_id = auth.uid());

create policy "transportation_routes_update_own"
  on public.transportation_routes for update
  using (user_id = auth.uid());

create policy "transportation_routes_delete_own"
  on public.transportation_routes for delete
  using (user_id = auth.uid());
