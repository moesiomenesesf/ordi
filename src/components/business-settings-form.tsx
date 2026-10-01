"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  businessCategories,
  paymentMethods,
  weekDays,
  type BusinessCategory,
  type BusinessSettings,
  type PaymentMethod,
  type WeekDayKey,
} from "@/lib/business-settings";

type BusinessFormValues = {
  businessName: string;
  description: string;
  category: BusinessCategory | "";
  weeklyHours: Record<WeekDayKey, string>;
  paymentMethod: PaymentMethod;
  depositPercent: string;
};

const initialHours = Object.fromEntries(weekDays.map(({ key }) => [key, "0"])) as Record<WeekDayKey, string>;
const fieldClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";
const labelClass = "block text-sm font-medium text-neutral-800";

function getInitialValues(settings: BusinessSettings | null, sellerDefaults: { businessName?: string; category?: string }): BusinessFormValues {
  if (settings) {
    return {
      businessName: settings.business_name,
      description: settings.description ?? "",
      category: settings.category,
      weeklyHours: Object.fromEntries(weekDays.map(({ key, column }) => [key, String(settings[column])])) as Record<WeekDayKey, string>,
      paymentMethod: settings.payment_method,
      depositPercent: settings.deposit_percent == null ? "" : String(settings.deposit_percent),
    };
  }

  return {
    businessName: sellerDefaults.businessName ?? "",
    description: "",
    category: businessCategories.find((category) => category === sellerDefaults.category) ?? "",
    weeklyHours: initialHours,
    paymentMethod: "full_upfront",
    depositPercent: "",
  };
}

export function BusinessSettingsForm({
  sellerId,
  settings,
  sellerDefaults,
}: {
  sellerId: string;
  settings: BusinessSettings | null;
  sellerDefaults: { businessName?: string; category?: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => getInitialValues(settings, sellerDefaults));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const businessName = values.businessName.trim();
    if (!businessName) {
      setError("Informe o nome do negócio.");
      return;
    }
    if (!businessCategories.includes(values.category as BusinessCategory)) {
      setError("Selecione uma categoria válida.");
      return;
    }
    if (!paymentMethods.includes(values.paymentMethod)) {
      setError("Selecione um modelo de pagamento válido.");
      return;
    }

    const hours: Record<string, number> = {};
    for (const { key, column, label } of weekDays) {
      const amount = Number(values.weeklyHours[key]);
      if (!Number.isFinite(amount) || amount < 0 || amount > 24) {
        setError(`Informe entre 0 e 24 horas para ${label.toLowerCase()}.`);
        return;
      }
      hours[column] = amount;
    }

    let depositPercent: number | null = null;
    if (values.paymentMethod === "deposit_then_final") {
      depositPercent = Number(values.depositPercent);
      if (values.depositPercent.trim() === "" || !Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
        setError("A entrada deve ser um percentual entre 0 e 100.");
        return;
      }
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.from("business_settings").upsert({
        seller_id: sellerId,
        business_name: businessName,
        description: values.description.trim(),
        category: values.category,
        ...hours,
        payment_method: values.paymentMethod,
        deposit_percent: depositPercent,
        updated_at: new Date().toISOString(),
      }, { onConflict: "seller_id" });

      if (saveError) throw saveError;
      setSuccess("Configurações salvas.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar as configurações.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold">Informações do negócio</h2>
          <p className="mt-1 text-sm text-neutral-600">Esses dados podem ser editados depois.</p>
        </div>
        <label className={labelClass}>
          Nome do negócio <span className="text-red-600">*</span>
          <input className={fieldClass} name="businessName" value={values.businessName} onChange={(event) => setValues({ ...values, businessName: event.target.value })} required maxLength={120} />
        </label>
        <label className={labelClass}>
          Descrição
          <textarea className={`${fieldClass} min-h-28 resize-y`} name="description" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} maxLength={1000} />
        </label>
        <label className={labelClass}>
          Categoria <span className="text-red-600">*</span>
          <select className={fieldClass} name="category" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value as BusinessCategory | "" })} required>
            <option value="" disabled>Selecione uma categoria</option>
            {businessCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </section>

      <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold">Disponibilidade de produção</h2>
          <p className="mt-1 text-sm text-neutral-600">Informe as horas disponíveis em cada dia. Use 0 nos dias sem produção.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {weekDays.map(({ key, label }) => (
            <label className={labelClass} key={key}>
              {label}
              <div className="relative mt-2">
                <input className={`${fieldClass} mt-0 pr-12`} name={`${key}Hours`} type="number" inputMode="decimal" min="0" max="24" step="0.25" value={values.weeklyHours[key]} onChange={(event) => setValues({ ...values, weeklyHours: { ...values.weeklyHours, [key]: event.target.value } })} required />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">h</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold">Modelo de pagamento</h2>
          <p className="mt-1 text-sm text-neutral-600">Este modelo descreve a regra padrão do negócio.</p>
        </div>
        <label className={labelClass}>
          Forma de pagamento
          <select className={fieldClass} value={values.paymentMethod} onChange={(event) => setValues({ ...values, paymentMethod: event.target.value as PaymentMethod })}>
            <option value="full_upfront">Pagamento integral antecipado</option>
            <option value="deposit_then_final">Entrada + pagamento final</option>
            <option value="full_on_delivery">Pagamento integral na entrega</option>
          </select>
        </label>
        {values.paymentMethod === "deposit_then_final" && (
          <label className={labelClass}>
            Percentual da entrada
            <div className="relative mt-2">
              <input className={`${fieldClass} mt-0 pr-12`} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={values.depositPercent} onChange={(event) => setValues({ ...values, depositPercent: event.target.value })} required />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">%</span>
            </div>
            <span className="mt-2 block text-xs font-normal text-neutral-500">A entrada é calculada como percentual do valor total.</span>
          </label>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
        {loading ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}
