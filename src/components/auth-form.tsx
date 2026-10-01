"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = { mode: "login" | "signup" };

const inputClass =
  "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: String(formData.get("name")).trim(),
              business_name: String(formData.get("businessName")).trim(),
              business_category: String(formData.get("category")),
            },
          },
        });

        if (authError) throw authError;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage("Cadastro iniciado. Confira seu email para confirmar a conta e depois faça login.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {isSignup && (
        <>
          <label className="block text-sm font-medium">
            Nome
            <input className={inputClass} name="name" type="text" autoComplete="name" required minLength={2} />
          </label>
          <label className="block text-sm font-medium">
            Nome do negócio
            <input className={inputClass} name="businessName" type="text" required minLength={2} />
          </label>
          <label className="block text-sm font-medium">
            Categoria
            <select className={inputClass} name="category" required defaultValue="">
              <option value="" disabled>Selecione uma categoria</option>
              <option value="Confeitaria">Confeitaria</option>
              <option value="Tatuagem">Tatuagem</option>
              <option value="Outra">Outra</option>
            </select>
          </label>
        </>
      )}

      <label className="block text-sm font-medium">
        Email
        <input className={inputClass} name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input className={inputClass} name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={6} />
      </label>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <button className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white transition hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={loading}>
        {loading ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
      </button>
    </form>
  );
}
