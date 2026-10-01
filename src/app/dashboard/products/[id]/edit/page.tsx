import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { PRODUCT_IMAGES_BUCKET, type Product, type ProductImage } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: PageProps<"/dashboard/products/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const sellerId = claimsData?.claims?.sub;
  if (authError || !sellerId) redirect("/login");
  const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("seller_id", sellerId).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o produto: ${error.message}`);
  if (!data) notFound();
  const { data: imageData, error: imageError } = await supabase.from("product_images").select("*").eq("product_id", id).order("position");
  if (imageError) throw new Error(`Não foi possível carregar as imagens: ${imageError.message}`);
  const images = await Promise.all(((imageData ?? []) as ProductImage[]).map(async (image) => {
    const { data: signed } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUrl(image.storage_path, 3600);
    return { ...image, signed_url: signed?.signedUrl };
  }));
  return <main className="min-h-screen bg-neutral-50 px-5 py-10 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/dashboard/products" className="text-sm font-medium text-neutral-600 underline underline-offset-4">← Meus Produtos</Link><header className="mb-8 mt-6"><p className="text-sm font-semibold text-neutral-500">Ordi · Catálogo</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Editar produto</h1><p className="mt-2 text-neutral-600">Atualize os dados e as imagens do produto.</p></header><ProductForm sellerId={sellerId} product={{ ...(data as Product), product_images: images }} /></div></main>;
}
