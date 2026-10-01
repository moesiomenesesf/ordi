import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { formatProductPrice, formatProductionTime, PRODUCT_IMAGES_BUCKET, type Product, type ProductImage } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: PageProps<"/dashboard/products/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const sellerId = claimsData?.claims?.sub;
  if (authError || !sellerId) redirect("/login");
  const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("seller_id", sellerId).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o produto: ${error.message}`);
  if (!data) notFound();
  const product = data as Product;
  const { data: imageData, error: imageError } = await supabase.from("product_images").select("*").eq("product_id", id).order("position");
  if (imageError) throw new Error(`Não foi possível carregar as imagens: ${imageError.message}`);
  const images = await Promise.all(((imageData ?? []) as ProductImage[]).map(async (image) => {
    const { data: signed } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(image.storage_path, 3600);
    return { ...image, signed_url: signed?.signedUrl };
  }));
  return <main className="min-h-screen bg-neutral-50 px-5 py-10 sm:px-8"><article className="mx-auto max-w-3xl"><Link href="/dashboard/products" className="text-sm font-medium text-neutral-600 underline underline-offset-4">← Meus Produtos</Link><header className="mb-7 mt-6"><p className="text-sm font-semibold text-neutral-500">Ordi · Catálogo</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1><span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{product.is_active ? "Ativo" : "Desativado"}</span></div></header>
    {images.length > 0 && <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image, index) => <div key={image.id} className="aspect-square overflow-hidden rounded-2xl bg-neutral-100">{image.signed_url && <Image src={image.signed_url} alt={`${product.name}, imagem ${index + 1}`} width={500} height={500} unoptimized className="size-full object-cover" />}</div>)}</div>}
    <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6"><div><p className="text-sm text-neutral-500">Descrição</p><p className="mt-1 whitespace-pre-wrap">{product.short_description || "Sem descrição"}</p></div><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-neutral-500">Tempo de produção</p><p className="mt-1 font-medium">{formatProductionTime(product.estimated_minutes)}</p></div><div><p className="text-sm text-neutral-500">Preço</p><p className="mt-1 font-medium">{formatProductPrice(product)}</p></div><div><p className="text-sm text-neutral-500">Disponibilidade</p><p className="mt-1 font-medium">{product.available_for_orders ? "Disponível para encomendas" : "Indisponível para encomendas"}</p></div></div><div><p className="text-sm text-neutral-500">Observações</p><p className="mt-1 whitespace-pre-wrap">{product.notes || "Nenhuma observação"}</p></div></section>
    <div className="mt-5"><Link href={`/dashboard/products/${product.id}/edit`} className="inline-flex rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700">Editar produto</Link></div></article></main>;
}
