import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-neutral-500">Ordi</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Criar conta seller</h1>
        <p className="mt-2 mb-8 text-sm leading-6 text-neutral-600">Cadastre seus dados para começar.</p>
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-sm text-neutral-600">Já tem uma conta? <Link className="font-semibold text-neutral-900 underline underline-offset-4" href="/login">Entrar</Link></p>
      </section>
    </main>
  );
}
