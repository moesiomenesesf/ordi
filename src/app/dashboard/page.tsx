import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) redirect("/login");

  const userMetadata = claims.user_metadata as { full_name?: string } | undefined;
  const name = userMetadata?.full_name || (typeof claims.email === "string" ? claims.email : "seller");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-neutral-500">Ordi · Área do seller</p>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/products" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100">Meus Produtos</Link>
            <Link href="/dashboard/business" className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100">Configurar negócio</Link>
            <LogoutButton />
          </div>
        </div>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Olá, {name}!</h1>
        <p className="mt-3 text-neutral-600">Sua autenticação está funcionando. Esta é a área privada inicial.</p>
      </section>
    </main>
  );
}
