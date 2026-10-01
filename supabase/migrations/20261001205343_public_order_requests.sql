-- Keep production-time estimates internal to the seller, while preserving a
-- server-side snapshot on every requested product.
drop view public.public_catalog_products;
create view public.public_catalog_products
with (security_invoker = true, security_barrier = true)
as
select p.public_slug, p.id, p.name, p.short_description,
       p.price_type, p.base_price, p.sort_order
from public.products p
where p.public_slug is not null and p.is_active and p.available_for_orders;

revoke all on public.public_catalog_products from public, anon, authenticated;
grant select on public.public_catalog_products to anon;

revoke select (estimated_minutes) on public.products from anon;

create table public.order_requests (
  id uuid primary key,
  seller_id uuid not null,
  buyer_name text not null check (char_length(btrim(buyer_name)) between 2 and 120),
  buyer_phone text not null check (char_length(btrim(buyer_phone)) between 8 and 30),
  desired_date date not null,
  description text not null check (char_length(btrim(description)) between 1 and 3000),
  reference_image_path text unique,
  reference_image_uploaded boolean not null default true,
  status text not null default 'pending' check (status in ('pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_requests_reference_state check (
    (reference_image_path is null and reference_image_uploaded)
    or reference_image_path is not null
  )
);

create index order_requests_seller_created_idx on public.order_requests (seller_id, created_at desc);

create table public.order_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.order_requests (id) on delete cascade,
  product_id uuid not null,
  product_name text not null check (char_length(btrim(product_name)) between 1 and 120),
  quantity integer not null check (quantity between 1 and 99),
  estimated_minutes integer not null check (estimated_minutes between 1 and 10080),
  price_type text not null check (price_type in ('fixed', 'from', 'consultation')),
  base_price numeric(10,2),
  created_at timestamptz not null default now(),
  constraint order_request_items_price_snapshot_valid check (
    (price_type in ('fixed', 'from') and base_price is not null and base_price >= 0)
    or (price_type = 'consultation' and base_price is null)
  ),
  constraint order_request_items_product_once unique (request_id, product_id)
);

create index order_request_items_request_idx on public.order_request_items (request_id);

create function public.set_order_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger order_requests_set_updated_at before update on public.order_requests
for each row execute function public.set_order_request_updated_at();

alter table public.order_requests enable row level security;
alter table public.order_request_items enable row level security;
revoke all on public.order_requests, public.order_request_items from public, anon, authenticated;
grant select on public.order_requests, public.order_request_items to authenticated;

create policy "Sellers can read their own order requests"
on public.order_requests for select to authenticated
using (seller_id = (select auth.uid()) and (reference_image_path is null or reference_image_uploaded));

create policy "Sellers can read items in their own order requests"
on public.order_request_items for select to authenticated
using (exists (
  select 1 from public.order_requests r
  where r.id = order_request_items.request_id
    and r.seller_id = (select auth.uid())
    and (r.reference_image_path is null or r.reference_image_uploaded)
));

-- This is the only anonymous write path. It derives the seller from the public
-- slug and snapshots names, production times, and prices from current rows.
create function public.submit_public_order_request(
  p_request_id uuid,
  p_seller_slug uuid,
  p_buyer_name text,
  p_buyer_phone text,
  p_desired_date date,
  p_description text,
  p_items jsonb,
  p_reference_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products%rowtype;
  v_phone_digits text;
  v_item_count integer;
begin
  if p_request_id is null or p_seller_slug is null
    or p_buyer_name is null or p_buyer_phone is null
    or p_desired_date is null or p_description is null
  then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;

  select bs.seller_id into v_seller_id
  from public.business_settings bs where bs.public_slug = p_seller_slug;
  if v_seller_id is null then
    raise exception 'seller_not_found' using errcode = '22023';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_buyer_name)) not between 2 and 120
    or pg_catalog.char_length(pg_catalog.btrim(p_buyer_phone)) not between 8 and 30
    or pg_catalog.char_length(pg_catalog.btrim(p_description)) not between 1 and 3000
    or p_desired_date < (pg_catalog.timezone('America/Sao_Paulo', pg_catalog.now()))::date
    or p_desired_date > (pg_catalog.timezone('America/Sao_Paulo', pg_catalog.now()))::date + 365
  then
    raise exception 'invalid_submission' using errcode = '22023';
  end if;

  v_phone_digits := pg_catalog.regexp_replace(p_buyer_phone, '[^0-9]', '', 'g');
  if pg_catalog.char_length(v_phone_digits) not between 10 and 15 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_items) <> 'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 20
  then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  if p_reference_image_path is not null
    and p_reference_image_path not in (
      p_seller_slug::text || '/' || p_request_id::text || '.jpg',
      p_seller_slug::text || '/' || p_request_id::text || '.png',
      p_seller_slug::text || '/' || p_request_id::text || '.webp'
    )
  then
    raise exception 'invalid_reference_image_path' using errcode = '22023';
  end if;

  select pg_catalog.count(*) into v_item_count
  from (
    select elem.value->>'product_id' as product_id
    from pg_catalog.jsonb_array_elements(p_items) as elem(value)
    group by elem.value->>'product_id'
  ) unique_items;
  if v_item_count <> pg_catalog.jsonb_array_length(p_items) then
    raise exception 'duplicate_products' using errcode = '22023';
  end if;

  insert into public.order_requests (
    id, seller_id, buyer_name, buyer_phone, desired_date, description,
    reference_image_path, reference_image_uploaded, status
  ) values (
    p_request_id, v_seller_id, pg_catalog.btrim(p_buyer_name),
    pg_catalog.btrim(p_buyer_phone), p_desired_date,
    pg_catalog.btrim(p_description), p_reference_image_path,
    p_reference_image_path is null, 'pending'
  );

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'invalid_items' using errcode = '22023';
    end;

    if v_quantity not between 1 and 99 then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    select p.* into v_product
    from public.products p
    where p.id = v_product_id and p.seller_id = v_seller_id
      and p.is_active and p.available_for_orders;
    if not found then
      raise exception 'product_unavailable' using errcode = '22023';
    end if;

    insert into public.order_request_items (
      request_id, product_id, product_name, quantity,
      estimated_minutes, price_type, base_price
    ) values (
      p_request_id, v_product.id, v_product.name, v_quantity,
      v_product.estimated_minutes, v_product.price_type, v_product.base_price
    );
  end loop;

  return p_request_id;
end;
$$;

-- Private predicates allow Storage RLS to inspect request state without
-- granting buyers any read access to the request tables.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create function private.can_upload_order_reference(p_object_name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.order_requests r
    where r.reference_image_path = p_object_name
      and not r.reference_image_uploaded
      and r.created_at > pg_catalog.now() - interval '30 minutes'
  );
$$;

revoke all on function private.can_upload_order_reference(text) from public, anon, authenticated;
grant execute on function private.can_upload_order_reference(text) to anon, authenticated;

create function public.complete_public_order_request_image(
  p_request_id uuid,
  p_reference_image_path text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_requests r
  set reference_image_uploaded = true
  where r.id = p_request_id and r.reference_image_path = p_reference_image_path
    and not r.reference_image_uploaded
    and r.created_at > pg_catalog.now() - interval '30 minutes'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'order-reference-images'
        and o.name = p_reference_image_path
        and o.metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
        and (o.metadata->>'size') ~ '^[0-9]+$'
        and (o.metadata->>'size')::bigint <= 3145728
    );
  return found;
end;
$$;

create function public.discard_incomplete_public_order_request(
  p_request_id uuid,
  p_reference_image_path text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.order_requests r
  where r.id = p_request_id and r.reference_image_path = p_reference_image_path
    and not r.reference_image_uploaded
    and r.created_at > pg_catalog.now() - interval '30 minutes';
  return found;
end;
$$;

revoke all on function public.submit_public_order_request(uuid, uuid, text, text, date, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_public_order_request(uuid, uuid, text, text, date, text, jsonb, text) to anon;
revoke all on function public.complete_public_order_request_image(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_public_order_request_image(uuid, text) to anon;
revoke all on function public.discard_incomplete_public_order_request(uuid, text) from public, anon, authenticated;
grant execute on function public.discard_incomplete_public_order_request(uuid, text) to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-reference-images', 'order-reference-images', false, 3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Buyers can upload the requested reference image"
on storage.objects for insert to anon
with check (bucket_id = 'order-reference-images' and private.can_upload_order_reference(name));

create policy "Buyers can remove an incomplete reference upload"
on storage.objects for delete to anon
using (bucket_id = 'order-reference-images' and private.can_upload_order_reference(name));

create policy "Sellers can read reference images for their requests"
on storage.objects for select to authenticated
using (
  bucket_id = 'order-reference-images'
  and exists (
    select 1 from public.order_requests r
    where r.reference_image_path = name
      and r.seller_id = (select auth.uid())
      and r.reference_image_uploaded
  )
);
