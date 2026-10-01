"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const { error } = await createClient().auth.signOut();
    setLoading(false);
    if (!error) {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button onClick={handleLogout} disabled={loading} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60">
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}
