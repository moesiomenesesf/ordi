import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sellerId = data?.claims?.sub;
  if (error || !sellerId) redirect("/login");
  return <main className="min-h-screen bg-neutral-50 px-5 py-10 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/dashboard/products" className="text-sm font-medium text-neutral-600 underline underline-offset-4">← Meus Produtos</Link><header className="mb-8 mt-6"><p className="text-sm font-semibold text-neutral-500">Ordi · Catálogo</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Adicionar produto</h1><p className="mt-2 text-neutral-600">Preencha os detalhes do produto.</p></header><ProductForm sellerId={sellerId} /></div></main>;
}
