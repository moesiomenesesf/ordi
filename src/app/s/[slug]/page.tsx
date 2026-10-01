import Link from "next/link";
import { PublicCatalog, type PublicCatalogProduct } from "@/components/public-catalog";
import type { ProductImage } from "@/lib/products";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/products";
import { createPublicServerClient } from "@/lib/supabase/public-server";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function CatalogMessage({ title, message }: { title: string; message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-12"><section className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-neutral-500">Ordi</p><h1 className="mt-3 text-2xl font-semibold">{title}</h1><p className="mt-3 text-neutral-600">{message}</p></section></main>;
}

export default async function PublicSellerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!uuidPattern.test(slug)) return <CatalogMessage title="Negócio não encontrado" message="Confira se o link recebido está correto." />;

  try {
    const supabase = createPublicServerClient();
    const { data: seller, error: sellerError } = await supabase.from("public_seller_profiles").select("public_slug,business_name,description,category").eq("public_slug", slug).maybeSingle();
    if (sellerError) throw sellerError;
    if (!seller) return <CatalogMessage title="Negócio não encontrado" message="Confira se o link recebido está correto." />;

    const { data: rows, error: productsError } = await supabase.from("public_catalog_products").select("id,name,short_description,price_type,base_price,sort_order").eq("public_slug", slug).order("sort_order").order("name");
    if (productsError) throw productsError;
    const products = (rows ?? []) as Omit<PublicCatalogProduct, "product_images">[];
    const { data: imageRows, error: imagesError } = await supabase.from("public_catalog_product_images").select("product_id,storage_path,position").eq("public_slug", slug).order("position");
    if (imagesError) throw imagesError;

    const imagesByProduct = new Map<string, ProductImage[]>();
    for (const [index, image] of (imageRows ?? []).entries()) {
      const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(image.storage_path, 900);
      if (error) throw error;
      const current = imagesByProduct.get(image.product_id) ?? [];
      current.push({ id: `${image.product_id}-${index}`, product_id: image.product_id, storage_path: image.storage_path, position: image.position, signed_url: data.signedUrl });
      imagesByProduct.set(image.product_id, current);
    }

    const productsWithImages = products.map((product) => ({ ...product, product_images: imagesByProduct.get(product.id) ?? [] }));
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 rounded-3xl bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
            <p className="text-sm font-semibold text-neutral-500">{seller.category} · Ordi</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{seller.business_name}</h1>
            {seller.description && <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-neutral-600">{seller.description}</p>}
          </header>
          {productsWithImages.length ? <PublicCatalog products={productsWithImages} sellerSlug={slug} /> : (
            <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"><h2 className="text-xl font-semibold">Nenhum produto disponível no momento</h2><p className="mt-2 text-neutral-600">Volte mais tarde para conferir o catálogo.</p></section>
          )}
          <footer className="py-10 text-center text-xs text-neutral-400">Catálogo criado com Ordi</footer>
        </div>
      </main>
    );
  } catch {
    return <CatalogMessage title="Não foi possível carregar o catálogo" message="Tente atualizar esta página em instantes." />;
  }
}
