import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-neutral-500">Ordi</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-2 mb-8 text-sm leading-6 text-neutral-600">Acesse sua conta de seller.</p>
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-neutral-600">Ainda não tem conta? <Link className="font-semibold text-neutral-900 underline underline-offset-4" href="/signup">Cadastre-se</Link></p>
      </section>
    </main>
  );
}
