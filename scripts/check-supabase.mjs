const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!projectUrl || !publishableKey) {
  console.error(
    "Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local.",
  );
  process.exit(1);
}

let healthUrl;

try {
  healthUrl = new URL("/auth/v1/health", projectUrl);
  if (healthUrl.protocol !== "https:") {
    throw new Error("A URL do projeto Supabase precisa usar HTTPS.");
  }
} catch (error) {
  console.error(`NEXT_PUBLIC_SUPABASE_URL inválida: ${error.message}`);
  process.exit(1);
}

try {
  const response = await fetch(healthUrl, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(
      `Supabase respondeu com HTTP ${response.status}. Confira o URL e a chave publicável.`,
    );
    process.exit(1);
  }

  const health = await response.json();
  if (health.name !== "GoTrue") {
    console.error("O endpoint respondeu, mas não parece ser a API Auth do Supabase.");
    process.exit(1);
  }

  console.log(`Conexão Supabase confirmada (${health.name} ${health.version}).`);
} catch (error) {
  console.error(`Não foi possível conectar ao Supabase: ${error.message}`);
  process.exit(1);
}
