drop policy if exists "Public can view available product images" on storage.objects;

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
