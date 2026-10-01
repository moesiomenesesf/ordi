"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatProductPrice, type Product, type ProductImage } from "@/lib/products";
import { changeProductQuantity } from "@/lib/product-selection";
import { ProductImageGallery } from "@/components/product-image-gallery";

export type PublicCatalogProduct = Pick<Product, "id" | "name" | "short_description" | "price_type" | "base_price" | "sort_order"> & { product_images: ProductImage[] };
type Step = "catalog" | "form" | "review" | "success";
type BuyerDetails = { name: string; phone: string; desiredDate: string; description: string };
const REFERENCE_MAX_BYTES = 3 * 1024 * 1024;
const REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function localDateString() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function PublicCatalog({ products, sellerSlug }: { products: PublicCatalogProduct[]; sellerSlug: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>("catalog");
  const [buyer, setBuyer] = useState<BuyerDetails>({ name: "", phone: "", desiredDate: "", description: "" });
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [sending, setSending] = useState(false);
  const selectedProducts = useMemo(() => products.filter(({ id }) => quantities[id]), [products, quantities]);

  function changeQuantity(id: string, amount: number) {
    setQuantities((current) => changeProductQuantity(current, id, amount));
  }

  function updateBuyer(field: keyof BuyerDetails, value: string) {
    setBuyer((current) => ({ ...current, [field]: value }));
  }

  function reviewForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStep("review");
  }

  function chooseReferenceImage(file: File | null) {
    setErrorMessage("");
    if (!file) {
      setReferenceImage(null);
      return;
    }
    if (!REFERENCE_MIME_TYPES.includes(file.type)) {
      setReferenceImage(null);
      setErrorMessage("Escolha uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > REFERENCE_MAX_BYTES) {
      setReferenceImage(null);
      setErrorMessage("A imagem deve ter no máximo 3 MB.");
      return;
    }
    setReferenceImage(file);
  }

  async function sendRequest() {
    setSending(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.set("seller_slug", sellerSlug);
      formData.set("buyer_name", buyer.name);
      formData.set("buyer_phone", buyer.phone);
      formData.set("desired_date", buyer.desiredDate);
      formData.set("description", buyer.description);
      formData.set("items", JSON.stringify(selectedProducts.map(({ id }) => ({ product_id: id, quantity: quantities[id] }))));
      if (referenceImage) formData.set("reference_image", referenceImage);

      const response = await fetch("/api/public-requests", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar sua solicitação. Confira os dados e tente novamente.");
      setStep("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar sua solicitação. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (step === "success") {
    return <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10"><div aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</div><h2 className="mt-5 text-2xl font-semibold">Solicitação enviada!</h2><p className="mt-3 leading-7 text-neutral-600">O seller irá analisar seu pedido e entrar em contato para confirmar os detalhes.</p></section>;
  }

  if (step === "form" || step === "review") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
        <button type="button" onClick={() => { setErrorMessage(""); setStep("catalog"); }} className="text-sm font-medium text-neutral-600 underline underline-offset-4">← Voltar ao catálogo</button>
        <h2 className="mt-5 text-2xl font-semibold">{step === "form" ? "Seus dados e pedido" : "Revise sua solicitação"}</h2>

        {step === "form" ? (
          <form onSubmit={reviewForm} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium">Nome <span className="text-red-700">*</span><input required minLength={2} maxLength={120} autoComplete="name" value={buyer.name} onChange={(event) => updateBuyer("name", event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal" /></label>
              <label className="block text-sm font-medium">WhatsApp/telefone <span className="text-red-700">*</span><input required type="tel" minLength={10} maxLength={30} autoComplete="tel" placeholder="(11) 99999-9999" value={buyer.phone} onChange={(event) => updateBuyer("phone", event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal" /></label>
            </div>
            <label className="block text-sm font-medium">Data desejada <span className="text-red-700">*</span><input required type="date" min={localDateString()} max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} value={buyer.desiredDate} onChange={(event) => updateBuyer("desiredDate", event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal sm:max-w-xs" /></label>
            <label className="block text-sm font-medium">Descreva o que você deseja <span className="text-red-700">*</span><textarea required maxLength={3000} rows={5} value={buyer.description} onChange={(event) => updateBuyer("description", event.target.value)} className="mt-2 block w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal" /></label>
            <div><label htmlFor="reference-image" className="block text-sm font-medium">Imagem de referência <span className="font-normal text-neutral-500">(opcional, até 3 MB)</span></label><input id="reference-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseReferenceImage(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:font-medium" />{referenceImage && <div className="mt-2 flex items-center gap-3 text-sm text-neutral-600"><span className="truncate">{referenceImage.name}</span><button type="button" onClick={() => { setReferenceImage(null); const input = document.getElementById("reference-image") as HTMLInputElement | null; if (input) input.value = ""; }} className="shrink-0 underline underline-offset-4">Remover</button></div>}</div>
            {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
            <button type="submit" disabled={!selectedProducts.length} className="w-full rounded-xl bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700 sm:w-auto">Revisar solicitação</button>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <section><h3 className="font-semibold">Produtos</h3><ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200 px-4">{selectedProducts.map((product) => <li key={product.id} className="flex items-start justify-between gap-3 py-3 text-sm"><span>{product.name}</span><span className="shrink-0 font-medium">× {quantities[product.id]}</span></li>)}</ul></section>
            <section className="grid gap-4 rounded-xl bg-neutral-50 p-4 text-sm sm:grid-cols-2"><div><p className="text-neutral-500">Nome</p><p className="mt-1 font-medium">{buyer.name}</p></div><div><p className="text-neutral-500">WhatsApp/telefone</p><p className="mt-1 font-medium">{buyer.phone}</p></div><div><p className="text-neutral-500">Data desejada</p><p className="mt-1 font-medium">{buyer.desiredDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${buyer.desiredDate}T12:00:00Z`)) : ""}</p></div><div><p className="text-neutral-500">Imagem de referência</p><p className="mt-1 font-medium">{referenceImage?.name || "Nenhuma imagem"}</p></div><div className="sm:col-span-2"><p className="text-neutral-500">Descrição do pedido</p><p className="mt-1 whitespace-pre-wrap font-medium">{buyer.description}</p></div></section>
            <p className="text-sm text-neutral-500">Os valores são informados no catálogo. O seller confirmará os detalhes ao entrar em contato.</p>
            {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={() => { setErrorMessage(""); setStep("form"); }} disabled={sending} className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium hover:bg-neutral-50">Voltar e editar</button><button type="button" onClick={sendRequest} disabled={sending} className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60">{sending ? "Enviando…" : "Confirmar e enviar"}</button></div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section aria-label="Catálogo de produtos" className="grid gap-5 sm:grid-cols-2">
        {products.map((product) => {
          const quantity = quantities[product.id] ?? 0;
          return (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="p-3"><ProductImageGallery images={product.product_images} label={product.name} /></div>
              <div className="p-5 pt-2">
                <h2 className="text-lg font-semibold">{product.name}</h2>
                {product.short_description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-600">{product.short_description}</p>}
                <div className="mt-4 text-sm"><span className="font-medium text-neutral-900">{formatProductPrice(product)}</span></div>
                {quantity === 0 ? (
                  <button type="button" onClick={() => changeQuantity(product.id, 1)} className="mt-5 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700">Quero encomendar</button>
                ) : (
                  <div className="mt-5 flex items-center justify-between rounded-xl border border-neutral-300 px-3 py-2">
                    <span className="text-sm font-medium">Selecionado</span>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Diminuir quantidade de ${product.name}`} onClick={() => changeQuantity(product.id, -1)} className="size-9 rounded-lg border border-neutral-300 text-lg">−</button>
                      <span aria-live="polite" className="min-w-5 text-center font-semibold">{quantity}</span>
                      <button type="button" aria-label={`Aumentar quantidade de ${product.name}`} onClick={() => changeQuantity(product.id, 1)} className="size-9 rounded-lg border border-neutral-300 text-lg">+</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <aside className="h-fit rounded-2xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-6">
        <h2 className="text-lg font-semibold">Sua seleção</h2>
        {!selectedProducts.length ? <p className="mt-3 text-sm text-neutral-500">Escolha produtos para montar sua solicitação.</p> : (
          <>
            <ul className="mt-4 space-y-3">{selectedProducts.map((product) => <li key={product.id} className="flex items-start justify-between gap-3 text-sm"><span>{product.name}</span><span className="shrink-0 font-medium">× {quantities[product.id]}</span></li>)}</ul>
            <button type="button" onClick={() => setStep("form")} className="mt-5 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-700">Continuar solicitação</button>
          </>
        )}
        <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">Você poderá revisar os dados antes de enviar. A solicitação não confirma a encomenda.</p>
      </aside>
    </div>
  );
}
