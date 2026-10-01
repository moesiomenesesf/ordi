"use client";

import { useMemo, useState } from "react";
import { formatProductPrice, formatProductionTime, type Product, type ProductImage } from "@/lib/products";
import { changeProductQuantity } from "@/lib/product-selection";
import { ProductImageGallery } from "@/components/product-image-gallery";

export type PublicCatalogProduct = Pick<Product, "id" | "name" | "short_description" | "estimated_minutes" | "price_type" | "base_price" | "sort_order"> & { product_images: ProductImage[] };

export function PublicCatalog({ products }: { products: PublicCatalogProduct[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const selectedProducts = useMemo(() => products.filter(({ id }) => quantities[id]), [products, quantities]);

  function changeQuantity(id: string, amount: number) {
    setQuantities((current) => changeProductQuantity(current, id, amount));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label="Catálogo de produtos" className="grid gap-5 sm:grid-cols-2">
        {products.map((product) => {
          const quantity = quantities[product.id] ?? 0;
          return (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-3"><ProductImageGallery images={product.product_images} label={product.name} /></div>
              <div className="p-5 pt-2">
                <h2 className="text-lg font-semibold">{product.name}</h2>
                {product.short_description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-600">{product.short_description}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-neutral-900">{formatProductPrice(product)}</span>
                  <span className="text-neutral-500">{formatProductionTime(product.estimated_minutes)}</span>
                </div>
                {quantity === 0 ? (
                  <button type="button" onClick={() => changeQuantity(product.id, 1)} className="mt-5 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700">Quero encomendar</button>
                ) : (
                  <div className="mt-5 flex items-center justify-between rounded-xl border border-neutral-300 px-3 py-2">
                    <span className="text-sm font-medium">Selecionado</span>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Diminuir quantidade de ${product.name}`} onClick={() => changeQuantity(product.id, -1)} className="size-9 rounded-lg border border-neutral-300 text-lg">−</button>
                      <span aria-live="polite" className="min-w-5 text-center font-semibold">{quantity}</span>
                      <button type="button" aria-label={`Aumentar quantidade de ${product.name}`} onClick={() => changeQuantity(product.id, 1)} className="size-9 rounded-lg border border-neutral-300 text-lg">+</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <aside className="h-fit rounded-2xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold">Sua seleção</h2>
        {!selectedProducts.length ? <p className="mt-3 text-sm text-neutral-500">Escolha produtos para montar sua seleção.</p> : (
          <ul className="mt-4 space-y-3">
            {selectedProducts.map((product) => <li key={product.id} className="flex items-start justify-between gap-3 text-sm"><span>{product.name}</span><span className="shrink-0 font-medium">× {quantities[product.id]}</span></li>)}
          </ul>
        )}
        <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">A seleção ainda não é enviada. Esta página não solicita seus dados pessoais.</p>
      </aside>
    </div>
  );
}
