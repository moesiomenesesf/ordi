import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessSettingsForm } from "@/components/business-settings-form";
import type { BusinessSettings } from "@/lib/business-settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (authError || !claims?.sub) redirect("/login");

  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("seller_id", claims.sub)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar as configurações do negócio: ${error.message}`);
  }

  const metadata = claims.user_metadata as { business_name?: string; business_category?: string } | undefined;
  const settings = data as BusinessSettings | null;

  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/dashboard" className="text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-950">← Voltar ao início</Link>
        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold text-neutral-500">Ordi · Configurações</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{settings ? "Editar negócio" : "Configure seu negócio"}</h1>
          <p className="mt-2 text-neutral-600">{settings ? "Atualize os dados, disponibilidade e modelo de pagamento." : "Preencha as informações básicas para configurar seu negócio."}</p>
        </header>
        {settings?.public_slug && <p className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Sua página pública: <Link href={`/s/${settings.public_slug}`} target="_blank" className="font-semibold underline underline-offset-4">/s/{settings.public_slug}</Link></p>}
        <BusinessSettingsForm
          sellerId={claims.sub}
          settings={settings}
          sellerDefaults={{ businessName: metadata?.business_name, category: metadata?.business_category }}
        />
      </div>
    </main>
  );
}
