-- Keep one narrow public RPC for submission, image completion, and cleanup.
create function public.submit_public_order_request(
  p_request_id uuid default null,
  p_seller_slug uuid default null,
  p_buyer_name text default null,
  p_buyer_phone text default null,
  p_desired_date date default null,
  p_description text default null,
  p_items jsonb default null,
  p_reference_image_path text default null,
  p_action text default 'submit'
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
  if p_action = 'complete_image' then
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
    if found then return p_request_id; end if;
    return null;
  elsif p_action = 'discard_incomplete' then
    delete from public.order_requests r
    where r.id = p_request_id and r.reference_image_path = p_reference_image_path
      and not r.reference_image_uploaded
      and r.created_at > pg_catalog.now() - interval '30 minutes';
    if found then return p_request_id; end if;
    return null;
  elsif p_action <> 'submit' then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

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

revoke all on function public.submit_public_order_request(uuid, uuid, text, text, date, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.submit_public_order_request(uuid, uuid, text, text, date, text, jsonb, text, text) to anon;
drop function public.submit_public_order_request(uuid, uuid, text, text, date, text, jsonb, text);
drop function public.complete_public_order_request_image(uuid, text);
drop function public.discard_incomplete_public_order_request(uuid, text);
