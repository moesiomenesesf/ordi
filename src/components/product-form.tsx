"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getProductionParts,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  PRODUCT_IMAGE_MIME_TYPES,
  PRODUCT_IMAGES_BUCKET,
  productPriceTypes,
  type Product,
  type ProductPriceType,
} from "@/lib/products";

const fieldClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
const labelClass = "block text-sm font-medium text-neutral-800";
const allowedMimeTypes: readonly string[] = PRODUCT_IMAGE_MIME_TYPES;

function makeImagePath(sellerId: string, productId: string, file: File) {
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  return `${sellerId}/${productId}/${crypto.randomUUID()}.${extension}`;
}

export function ProductForm({ sellerId, product = null }: { sellerId: string; product?: Product | null }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.short_description ?? "");
  const initialTime = getProductionParts(product?.estimated_minutes ?? 60);
  const [hours, setHours] = useState(String(initialTime.hours));
  const [minutes, setMinutes] = useState(String(initialTime.minutes));
  const [priceType, setPriceType] = useState<ProductPriceType>(product?.price_type ?? "fixed");
  const [price, setPrice] = useState(product?.base_price == null ? "" : String(product.base_price));
  const [available, setAvailable] = useState(product?.available_for_orders ?? true);
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const existingImages = product?.product_images ?? [];
  const imageCount = existingImages.length + selectedFiles.length;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const additions = Array.from(files);
    if (imageCount + additions.length > PRODUCT_IMAGE_MAX_COUNT) {
      setError("Cada produto pode ter no máximo 4 imagens.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const invalidType = additions.find((file) => !allowedMimeTypes.includes(file.type));
    if (invalidType) {
      setError("Use arquivos JPG, PNG ou WebP.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const oversized = additions.find((file) => file.size > PRODUCT_IMAGE_MAX_BYTES);
    if (oversized) {
      setError("Cada imagem deve ter no máximo 5 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setError("");
    setSelectedFiles([...selectedFiles, ...additions]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeExistingImage(image: NonNullable<Product["product_images"]>[number]) {
    if (!product) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: removeError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
    if (removeError) {
      setError(`Não foi possível remover a imagem: ${removeError.message}`);
      setLoading(false);
      return;
    }
    const { error: rowError } = await supabase.from("product_images").delete().eq("id", image.id).eq("product_id", product.id);
    if (rowError) {
      setError(`A imagem foi removida do armazenamento, mas não foi possível atualizar o catálogo: ${rowError.message}`);
      setLoading(false);
      return;
    }
    setLoading(false);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const hoursValue = Number(hours);
    const minutesValue = Number(minutes);
    const estimatedMinutes = hoursValue * 60 + minutesValue;
    if (!trimmedName || trimmedName.length > 120) return setError("Informe um nome com até 120 caracteres.");
    if (!Number.isInteger(hoursValue) || hoursValue < 0 || !Number.isInteger(minutesValue) || minutesValue < 0 || minutesValue > 59 || estimatedMinutes < 1 || estimatedMinutes > 10080) {
      return setError("Informe um tempo válido. Minutos devem ficar entre 0 e 59, e o tempo total entre 1 minuto e 7 dias.");
    }
    if (priceType !== "consultation" && (price.trim() === "" || !Number.isFinite(Number(price.replace(",", "."))) || Number(price.replace(",", ".")) < 0)) {
      return setError("Informe um preço válido e igual ou maior que zero.");
    }

    setLoading(true);
    const supabase = createClient();
    let productId = product?.id;
    const uploadedPaths: string[] = [];
    try {
      const productValues = {
        seller_id: sellerId,
        name: trimmedName,
        short_description: description.trim(),
        estimated_minutes: estimatedMinutes,
        price_type: priceType,
        base_price: priceType === "consultation" ? null : Number(price.replace(",", ".")),
        available_for_orders: available,
        notes: notes.trim(),
      };
      if (productId) {
        const { error: updateError } = await supabase.from("products").update(productValues).eq("id", productId);
        if (updateError) throw updateError;
      } else {
        const { data: lastProduct, error: orderError } = await supabase.from("products").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
        if (orderError) throw orderError;
        const { data, error: insertError } = await supabase.from("products").insert({ ...productValues, sort_order: (lastProduct?.sort_order ?? -1) + 1 }).select("id").single();
        if (insertError) throw insertError;
        productId = data.id;
      }

      const occupiedPositions = new Set(existingImages.map((image) => image.position));
      for (const file of selectedFiles) {
        const position = Array.from({ length: PRODUCT_IMAGE_MAX_COUNT }, (_, index) => index).find((index) => !occupiedPositions.has(index));
        if (position == null) throw new Error("Cada produto pode ter no máximo 4 imagens.");
        const path = makeImagePath(sellerId, productId!, file);
        const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { error: imageError } = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, position });
        if (imageError) throw imageError;
        occupiedPositions.add(position);
      }

      router.push("/dashboard/products");
      router.refresh();
    } catch (caughtError) {
      if (uploadedPaths.length) {
        await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(uploadedPaths);
        await supabase.from("product_images").delete().in("storage_path", uploadedPaths);
      }
      if (!product && productId) await supabase.from("products").update({ is_active: false, available_for_orders: false }).eq("id", productId);
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o produto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
        <label className={labelClass}>Nome <span className="text-red-600">*</span><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
        <label className={labelClass}>Descrição curta<textarea className={`${fieldClass} min-h-24 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
        <fieldset>
          <legend className={labelClass}>Tempo estimado de produção <span className="text-red-600">*</span></legend>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <label className="text-sm text-neutral-600">Horas<input className={fieldClass} type="number" min="0" max="168" step="1" value={hours} onChange={(event) => setHours(event.target.value)} required /></label>
            <label className="text-sm text-neutral-600">Minutos<input className={fieldClass} type="number" min="0" max="59" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} required /></label>
          </div>
        </fieldset>
        <label className={labelClass}>Tipo de preço<select className={fieldClass} value={priceType} onChange={(event) => setPriceType(event.target.value as ProductPriceType)}>
          <option value={productPriceTypes[0]}>Preço fixo</option><option value={productPriceTypes[1]}>A partir de</option><option value={productPriceTypes[2]}>Sob consulta</option>
        </select></label>
        {priceType !== "consultation" && <label className={labelClass}>Preço base (R$)<input className={fieldClass} type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>}
        <label className="flex items-center gap-3 text-sm font-medium text-neutral-800"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} className="size-4 accent-neutral-900" />Disponível para encomendas</label>
        <label className={labelClass}>Observações<textarea className={`${fieldClass} min-h-24 resize-y`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></label>
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <div><h2 className="text-lg font-semibold">Imagens</h2><p className="mt-1 text-sm text-neutral-600">Até 4 imagens JPG, PNG ou WebP. Máximo de 5 MB por arquivo.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {existingImages.map((image) => <figure key={image.id} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
            {image.signed_url && <Image src={image.signed_url} alt={`Imagem ${image.position + 1} de ${name || "produto"}`} width={500} height={500} unoptimized className="size-full object-cover" />}
            <button type="button" onClick={() => void removeExistingImage(image)} disabled={loading} className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow disabled:opacity-50">Remover</button>
          </figure>)}
          {selectedFiles.map((file, index) => <figure key={`${file.name}-${index}`} className="relative flex aspect-square flex-col justify-center overflow-hidden rounded-xl bg-neutral-100 p-3 text-center"><span className="truncate text-sm font-medium">{file.name}</span><span className="mt-1 text-xs text-neutral-500">Imagem selecionada</span><button type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, current) => current !== index))} className="mt-3 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium">Remover</button></figure>)}
          {imageCount < PRODUCT_IMAGE_MAX_COUNT && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-600 hover:bg-neutral-50"><span className="text-2xl">+</span>Adicionar imagem<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => handleFiles(event.target.files)} /></label>}
        </div>
        <p className="text-xs text-neutral-500">{imageCount} de {PRODUCT_IMAGE_MAX_COUNT} imagens</p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button disabled={loading} className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60">{loading ? "Salvando…" : product ? "Salvar alterações" : "Cadastrar produto"}</button><Link href="/dashboard/products" className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium hover:bg-neutral-100">Cancelar</Link></div>
    </form>
  );
}
