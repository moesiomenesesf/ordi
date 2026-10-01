import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductList } from "@/components/product-list";
import { PRODUCT_IMAGES_BUCKET, type Product, type ProductImage } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const sellerId = claimsData?.claims?.sub;
  if (authError || !sellerId) redirect("/login");

  const { data, error } = await supabase.from("products").select("*").eq("seller_id", sellerId).order("sort_order").order("created_at");
  if (error) throw new Error(`Não foi possível carregar seus produtos: ${error.message}`);
  const products = (data ?? []) as Product[];
  const productIds = products.map(({ id }) => id);
  const imagesByProduct = new Map<string, ProductImage[]>();
  if (productIds.length) {
    const { data: images, error: imagesError } = await supabase.from("product_images").select("*").in("product_id", productIds).order("position");
    if (imagesError) throw new Error(`Não foi possível carregar as imagens: ${imagesError.message}`);
    for (const image of (images ?? []) as ProductImage[]) {
      const { data: signed } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(image.storage_path, 3600);
      const group = imagesByProduct.get(image.product_id) ?? [];
      group.push({ ...image, signed_url: signed?.signedUrl });
      imagesByProduct.set(image.product_id, group);
    }
  }
  const productsWithImages = products.map((product) => ({ ...product, product_images: imagesByProduct.get(product.id) ?? [] }));

  return <main className="min-h-screen bg-neutral-50 px-5 py-10 sm:px-8"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-950">← Voltar ao início</Link>
    <header className="mb-8 mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-neutral-500">Ordi · Área do seller</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Meus Produtos</h1><p className="mt-2 text-neutral-600">Cadastre e organize o catálogo do seu negócio.</p></div><Link href="/dashboard/products/new" className="rounded-xl bg-neutral-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-neutral-700">Adicionar produto</Link></header>
    {products.length === 0 ? <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center"><h2 className="text-xl font-semibold">Você ainda não cadastrou produtos</h2><Link href="/dashboard/products/new" className="mt-5 inline-flex rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700">Adicionar produto</Link></section> : <ProductList products={productsWithImages} />}
  </div></main>;
}
