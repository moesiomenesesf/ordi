-- Keep anonymous access column-limited on the underlying tables and use
-- security-invoker views so these projections continue to respect RLS.
alter table public.products add column public_slug uuid;

update public.products p
set public_slug = bs.public_slug
from public.business_settings bs
where bs.seller_id = p.seller_id
  and p.public_slug is distinct from bs.public_slug;

create function public.set_product_public_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select bs.public_slug into new.public_slug
  from public.business_settings bs
  where bs.seller_id = new.seller_id;
  return new;
end;
$$;

create trigger products_set_public_slug
before insert or update on public.products
for each row execute function public.set_product_public_slug();

create function public.sync_products_public_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.products
  set public_slug = new.public_slug
  where seller_id = new.seller_id
    and public_slug is distinct from new.public_slug;
  return new;
end;
$$;

create trigger business_settings_sync_products_public_slug
after insert or update of public_slug on public.business_settings
for each row execute function public.sync_products_public_slug();

drop policy if exists "Public can read seller profile fields" on public.business_settings;
create policy "Public can read seller profile fields"
on public.business_settings for select to anon
using (true);

drop policy if exists "Public can read available products" on public.products;
create policy "Public can read available products"
on public.products for select to anon
using (public_slug is not null and is_active and available_for_orders);

drop policy if exists "Public can read images for available products" on public.product_images;
create policy "Public can read images for available products"
on public.product_images for select to anon
using (exists (
  select 1
  from public.products p
  where p.id = product_images.product_id
    and p.public_slug is not null
    and p.is_active
    and p.available_for_orders
));

revoke all on table public.business_settings, public.products, public.product_images from public, anon;
grant select (public_slug, business_name, description, category)
  on table public.business_settings to anon;
grant select (id, public_slug, name, short_description, estimated_minutes, price_type, base_price, sort_order, is_active, available_for_orders)
  on table public.products to anon;
grant select (product_id, storage_path, position)
  on table public.product_images to anon;

alter view public.public_seller_profiles
  set (security_invoker = true, security_barrier = true);
alter view public.public_catalog_products
  set (security_invoker = true, security_barrier = true);
alter view public.public_catalog_product_images
  set (security_invoker = true, security_barrier = true);

create or replace view public.public_catalog_products
with (security_invoker = true, security_barrier = true)
as
select
  p.public_slug,
  p.id,
  p.name,
  p.short_description,
  p.estimated_minutes,
  p.price_type,
  p.base_price,
  p.sort_order
from public.products p
where p.public_slug is not null
  and p.is_active
  and p.available_for_orders;

create or replace view public.public_catalog_product_images
with (security_invoker = true, security_barrier = true)
as
select p.public_slug, p.id as product_id, pi.storage_path, pi.position
from public.product_images pi
join public.products p on p.id = pi.product_id
where p.public_slug is not null
  and p.is_active
  and p.available_for_orders;
