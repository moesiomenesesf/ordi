create table public.business_settings (
  seller_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) > 0),
  description text not null default '',
  category text not null check (category in ('Confeitaria', 'Tatuagem', 'Outra')),
  monday_hours numeric(4,2) not null default 0 check (monday_hours between 0 and 24),
  tuesday_hours numeric(4,2) not null default 0 check (tuesday_hours between 0 and 24),
  wednesday_hours numeric(4,2) not null default 0 check (wednesday_hours between 0 and 24),
  thursday_hours numeric(4,2) not null default 0 check (thursday_hours between 0 and 24),
  friday_hours numeric(4,2) not null default 0 check (friday_hours between 0 and 24),
  saturday_hours numeric(4,2) not null default 0 check (saturday_hours between 0 and 24),
  sunday_hours numeric(4,2) not null default 0 check (sunday_hours between 0 and 24),
  payment_method text not null check (payment_method in ('full_upfront', 'deposit_then_final', 'full_on_delivery')),
  deposit_percent numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_settings_deposit_percent_valid check (
    (payment_method = 'deposit_then_final' and deposit_percent between 0 and 100)
    or (payment_method <> 'deposit_then_final' and deposit_percent is null)
  )
);

alter table public.business_settings enable row level security;

grant select, insert, update on public.business_settings to authenticated;

create policy "Sellers can read their own business settings"
on public.business_settings for select
to authenticated
using ((select auth.uid()) is not null and seller_id = (select auth.uid()));

create policy "Sellers can create their own business settings"
on public.business_settings for insert
to authenticated
with check ((select auth.uid()) is not null and seller_id = (select auth.uid()));

create policy "Sellers can update their own business settings"
on public.business_settings for update
to authenticated
using ((select auth.uid()) is not null and seller_id = (select auth.uid()))
with check ((select auth.uid()) is not null and seller_id = (select auth.uid()));
