create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  short_description text not null default '' check (char_length(short_description) <= 500),
  estimated_minutes integer not null check (estimated_minutes between 1 and 10080),
  price_type text not null check (price_type in ('fixed', 'from', 'consultation')),
  base_price numeric(10,2),
  available_for_orders boolean not null default true,
  notes text not null default '' check (char_length(notes) <= 2000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_valid check (
    (price_type in ('fixed', 'from') and base_price is not null and base_price >= 0)
    or (price_type = 'consultation' and base_price is null)
  ),
  constraint products_id_seller_unique unique (id, seller_id)
);

create index products_seller_sort_idx on public.products (seller_id, sort_order, created_at);

create function public.set_product_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_product_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  constraint product_images_product_position_unique unique (product_id, position)
);

create index product_images_product_idx on public.product_images (product_id, position);

create function public.enforce_product_image_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  image_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.product_id::text, 0));
  select count(*) into image_count
  from public.product_images
  where product_id = new.product_id;

  if image_count >= 4 then
    raise exception 'A product can have at most four images.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger product_images_enforce_limit
before insert on public.product_images
for each row execute function public.enforce_product_image_limit();

alter table public.products enable row level security;
alter table public.product_images enable row level security;

revoke all on table public.products from anon, authenticated;
revoke all on table public.product_images from anon, authenticated;
grant select, insert, update on table public.products to authenticated;
grant select, insert, delete on table public.product_images to authenticated;

create policy "Sellers can read their own products"
on public.products for select to authenticated
using ((select auth.uid()) is not null and seller_id = (select auth.uid()));

create policy "Sellers can create their own products"
on public.products for insert to authenticated
with check ((select auth.uid()) is not null and seller_id = (select auth.uid()));

create policy "Sellers can update their own products"
on public.products for update to authenticated
using ((select auth.uid()) is not null and seller_id = (select auth.uid()))
with check ((select auth.uid()) is not null and seller_id = (select auth.uid()));

create policy "Sellers can read images of their own products"
on public.product_images for select to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_id and p.seller_id = (select auth.uid())
));

create policy "Sellers can add images to their own products"
on public.product_images for insert to authenticated
with check (exists (
  select 1 from public.products p
  where p.id = product_id and p.seller_id = (select auth.uid())
));

create policy "Sellers can remove images from their own products"
on public.product_images for delete to authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_id and p.seller_id = (select auth.uid())
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Sellers can view their own product image files"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = (select auth.uid())
  )
);

create policy "Sellers can upload files to their own products"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = (select auth.uid())
  )
);

create policy "Sellers can remove files from their own products"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[2]
      and p.seller_id = (select auth.uid())
  )
);
