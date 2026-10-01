import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="mx-auto w-full max-w-xl text-center">
        <p className="mb-3 text-sm font-medium tracking-wide text-neutral-500">Ordi · Área do seller</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Acesse sua conta
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-600">
          Entre ou crie sua conta de seller para continuar.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700" href="/login">Entrar</Link>
          <Link className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium hover:bg-neutral-100" href="/signup">Criar conta</Link>
        </div>
      </section>
    </main>
  );
}
