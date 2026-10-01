-- Public catalog access is intentionally exposed through narrow, read-only
-- views. The underlying seller settings and catalog tables remain private.
alter table public.business_settings
  add column public_slug uuid not null default gen_random_uuid();

create unique index business_settings_public_slug_idx
  on public.business_settings (public_slug);

create view public.public_seller_profiles
with (security_barrier = true)
as
select public_slug, business_name, description, category
from public.business_settings;

create view public.public_catalog_products
with (security_barrier = true)
as
select
  bs.public_slug,
  p.id,
  p.name,
  p.short_description,
  p.estimated_minutes,
  p.price_type,
  p.base_price,
  p.sort_order
from public.products p
join public.business_settings bs on bs.seller_id = p.seller_id
where p.is_active and p.available_for_orders;

create view public.public_catalog_product_images
with (security_barrier = true)
as
select bs.public_slug, p.id as product_id, pi.storage_path, pi.position
from public.product_images pi
join public.products p on p.id = pi.product_id
join public.business_settings bs on bs.seller_id = p.seller_id
where p.is_active and p.available_for_orders;

comment on view public.public_seller_profiles is
  'Read-only public projection. Deliberately excludes seller IDs, email, availability and payment settings.';
comment on view public.public_catalog_products is
  'Read-only public projection of active products available for orders; excludes seller IDs, notes and internal status.';
comment on view public.public_catalog_product_images is
  'Paths for images belonging only to active products available for orders.';

revoke all on public.public_seller_profiles,
  public.public_catalog_products,
  public.public_catalog_product_images from public, anon, authenticated;
grant select on public.public_seller_profiles,
  public.public_catalog_products,
  public.public_catalog_product_images to anon;

-- A private bucket stays private. Anonymous signed-image requests are allowed
-- only for paths present in the filtered public catalog projection, and the
-- operation helper prevents anonymous listing of the bucket.
create policy "Public can view available product images"
on storage.objects for select to anon
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.public_catalog_product_images public_image
    where public_image.storage_path = storage.objects.name
  )
  and storage.allow_any_operation(array['storage.object.sign'])
);
