drop policy if exists "Sellers can view their own product image files" on storage.objects;
drop policy if exists "Sellers can upload files to their own products" on storage.objects;
drop policy if exists "Sellers can remove files from their own products" on storage.objects;

create policy "Sellers can view their own product image files"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.seller_id = (select auth.uid())
  )
);

create policy "Sellers can upload files to their own products"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.seller_id = (select auth.uid())
  )
);

create policy "Sellers can remove files from their own products"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(storage.objects.name))[2]
      and p.seller_id = (select auth.uid())
  )
);
