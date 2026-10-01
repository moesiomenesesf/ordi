"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatProductPrice, formatProductionTime, PRODUCT_IMAGES_BUCKET, type Product } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { ProductImageGallery } from "@/components/product-image-gallery";

export function ProductList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggleActive(product: Product) {
    setBusyId(product.id);
    setError("");
    const { error: updateError } = await createClient().from("products").update({ is_active: !product.is_active }).eq("id", product.id);
    if (updateError) setError(updateError.message);
    else router.refresh();
    setBusyId(null);
  }

  async function move(product: Product, direction: -1 | 1) {
    const ordered = [...products].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const index = ordered.findIndex((item) => item.id === product.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    setBusyId(product.id);
    setError("");
    const supabase = createClient();
    const temporaryOrder = Math.min(-1, ...ordered.map((item) => item.sort_order)) - 1;
    const first = await supabase.from("products").update({ sort_order: temporaryOrder }).eq("id", product.id);
    const second = first.error ? first : await supabase.from("products").update({ sort_order: product.sort_order }).eq("id", neighbor.id);
    const third = second.error ? second : await supabase.from("products").update({ sort_order: neighbor.sort_order }).eq("id", product.id);
    if (third.error) setError(third.error.message);
    else router.refresh();
    setBusyId(null);
  }

  async function duplicate(product: Product) {
    setBusyId(product.id);
    setError("");
    const supabase = createClient();
    const clonedPaths: string[] = [];
    let clonedId: string | null = null;
    try {
      const maxOrder = Math.max(-1, ...products.map((item) => item.sort_order));
      const { data, error: insertError } = await supabase.from("products").insert({
        seller_id: product.seller_id,
        name: `${product.name} (cópia)`.slice(0, 120),
        short_description: product.short_description,
        estimated_minutes: product.estimated_minutes,
        price_type: product.price_type,
        base_price: product.base_price,
        available_for_orders: product.available_for_orders,
        notes: product.notes,
        is_active: product.is_active,
        sort_order: maxOrder + 1,
      }).select("id").single();
      if (insertError) throw insertError;
      clonedId = data.id;

      for (const image of product.product_images ?? []) {
        const { data: file, error: downloadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).download(image.storage_path);
        if (downloadError || !file) throw downloadError ?? new Error("Não foi possível ler uma imagem do produto.");
        const extension = image.storage_path.split(".").pop() ?? "webp";
        const path = `${product.seller_id}/${clonedId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        clonedPaths.push(path);
        const { error: imageError } = await supabase.from("product_images").insert({ product_id: clonedId, storage_path: path, position: image.position });
        if (imageError) throw imageError;
      }
      router.refresh();
    } catch (caughtError) {
      if (clonedPaths.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(clonedPaths);
      if (clonedPaths.length) await supabase.from("product_images").delete().in("storage_path", clonedPaths);
      if (clonedId) await supabase.from("products").update({ is_active: false, available_for_orders: false }).eq("id", clonedId);
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível duplicar o produto.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {products.map((product, index) => <article key={product.id} className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-full sm:w-44 sm:shrink-0"><ProductImageGallery images={product.product_images ?? []} label={product.name} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{product.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.is_active ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>{product.is_active ? "Ativo" : "Desativado"}</span>{product.is_active && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${product.available_for_orders ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}`}>{product.available_for_orders ? "Aceita encomendas" : "Indisponível"}</span>}</div>
            <p className="mt-2 text-sm text-neutral-600">{formatProductionTime(product.estimated_minutes)} · {formatProductPrice(product)}</p>
            {product.short_description && <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{product.short_description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href={`/dashboard/products/${product.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">Visualizar</Link>
              <Link href={`/dashboard/products/${product.id}/edit`} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">Editar</Link>
              <button type="button" onClick={() => void toggleActive(product)} disabled={busyId === product.id} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">{product.is_active ? "Desativar" : "Ativar"}</button>
              <button type="button" onClick={() => void duplicate(product)} disabled={busyId === product.id} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50">{busyId === product.id ? "Aguarde…" : "Duplicar"}</button>
              <div className="ml-auto flex gap-1"><button type="button" aria-label={`Mover ${product.name} para cima`} onClick={() => void move(product, -1)} disabled={index === 0 || busyId === product.id} className="size-9 rounded-lg border border-neutral-300 disabled:opacity-30">↑</button><button type="button" aria-label={`Mover ${product.name} para baixo`} onClick={() => void move(product, 1)} disabled={index === products.length - 1 || busyId === product.id} className="size-9 rounded-lg border border-neutral-300 disabled:opacity-30">↓</button></div>
            </div>
          </div>
        </div>
      </article>)}
    </div>
  );
}
