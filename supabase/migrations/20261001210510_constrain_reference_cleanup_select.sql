-- Storage.remove performs a row lookup before DELETE. Permit that SELECT only
-- during object deletion, and only while the associated upload is incomplete.
create policy "Buyers can locate only an incomplete reference for deletion"
on storage.objects for select to anon
using (
  bucket_id = 'order-reference-images'
  and private.can_upload_order_reference(name)
  and storage.allow_any_operation(array[
    'storage.object.delete',
    'storage.object.delete_many'
  ])
);
