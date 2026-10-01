import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createPublicServerClient } from "@/lib/supabase/public-server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mimeExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxImageBytes = 3 * 1024 * 1024;
const maxBodyBytes = 4 * 1024 * 1024;

type SubmittedItem = { product_id: string; quantity: number };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return mimeType === "image/webp" && bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

function saoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  const today = new Date(`${saoPauloToday()}T00:00:00.000Z`);
  const date = new Date(`${value}T00:00:00.000Z`);
  const daysAhead = (date.getTime() - today.getTime()) / 86_400_000;
  return daysAhead >= 0 && daysAhead <= 365;
}

export async function POST(request: Request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return errorResponse("Origem inválida.", 403);
    } catch {
      return errorResponse("Origem inválida.", 403);
    }
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && (!/^\d+$/.test(contentLengthHeader) || Number(contentLengthHeader) > maxBodyBytes)) {
    return errorResponse("A imagem deve ter no máximo 3 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await readBoundedFormData(request);
  } catch (error) {
    if (error instanceof Error && error.message === "payload_too_large") return errorResponse("A imagem deve ter no máximo 3 MB.", 413);
    return errorResponse("Não foi possível ler os dados enviados.", 400);
  }

  const sellerSlug = String(formData.get("seller_slug") ?? "");
  const buyerName = String(formData.get("buyer_name") ?? "").trim();
  const buyerPhone = String(formData.get("buyer_phone") ?? "").trim();
  const desiredDate = String(formData.get("desired_date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const itemsValue = String(formData.get("items") ?? "");

  if (!uuidPattern.test(sellerSlug)) return errorResponse("Este link de negócio não é válido.", 400);
  if (buyerName.length < 2 || buyerName.length > 120) return errorResponse("Informe seu nome (entre 2 e 120 caracteres).", 400);
  if (buyerPhone.length < 8 || buyerPhone.length > 30 || buyerPhone.replace(/\D/g, "").length < 10 || buyerPhone.replace(/\D/g, "").length > 15) return errorResponse("Informe um WhatsApp ou telefone válido.", 400);
  if (!isValidDate(desiredDate)) return errorResponse("Escolha uma data entre hoje e os próximos 365 dias.", 400);
  if (!description || description.length > 3000) return errorResponse("Descreva o que você deseja (até 3.000 caracteres).", 400);

  let items: SubmittedItem[];
  try {
    const parsed: unknown = JSON.parse(itemsValue);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) return errorResponse("Selecione entre 1 e 20 produtos.", 400);
    items = parsed as SubmittedItem[];
  } catch {
    return errorResponse("A seleção de produtos é inválida.", 400);
  }
  if (items.some((item) => !item || typeof item !== "object" || !uuidPattern.test(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
    return errorResponse("Confira os produtos e as quantidades selecionados.", 400);
  }
  if (new Set(items.map(({ product_id }) => product_id)).size !== items.length) return errorResponse("Cada produto deve aparecer uma única vez na seleção.", 400);

  const imageValue = formData.get("reference_image");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
  if (image && (!mimeExtensions[image.type] || image.size > maxImageBytes)) return errorResponse("A imagem deve ser JPG, PNG ou WebP e ter no máximo 3 MB.", 400);
  const imageBytes = image ? Buffer.from(await image.arrayBuffer()) : null;
  if (image && imageBytes && !validImageSignature(imageBytes, image.type)) return errorResponse("O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WebP válida.", 400);

  const requestId = randomUUID();
  const referencePath = image ? `${sellerSlug}/${requestId}.${mimeExtensions[image.type]}` : null;
  const supabase = createPublicServerClient();
  const { data: createdId, error: submitError } = await supabase.rpc("submit_public_order_request", {
    p_request_id: requestId,
    p_seller_slug: sellerSlug,
    p_buyer_name: buyerName,
    p_buyer_phone: buyerPhone,
    p_desired_date: desiredDate,
    p_description: description,
    p_items: items,
    p_reference_image_path: referencePath,
  });

  if (submitError || createdId !== requestId) {
    const errorCode = submitError?.code;
    if (errorCode === "22023") {
      const message = submitError?.message ?? "invalid_submission";
      if (message.includes("seller_not_found")) return errorResponse("Este negócio não foi encontrado.", 404);
      if (message.includes("product_unavailable")) return errorResponse("Um produto da seleção não está mais disponível. Atualize o catálogo e tente novamente.", 409);
      if (message.includes("invalid_phone")) return errorResponse("Informe um WhatsApp ou telefone válido.", 400);
      return errorResponse("Confira os dados e produtos selecionados e tente novamente.", 400);
    }
    return errorResponse("Não foi possível registrar sua solicitação. Tente novamente em instantes.", 503);
  }

  if (image && imageBytes && referencePath) {
    const { error: uploadError } = await supabase.storage.from("order-reference-images").upload(referencePath, imageBytes, {
      contentType: image.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      await discardIncompleteRequest(supabase, requestId, referencePath);
      return errorResponse("Não foi possível salvar a imagem. Tente novamente ou remova a imagem e envie a solicitação sem ela.", 503);
    }

    const { data: imageCompleted, error: completeError } = await supabase.rpc("submit_public_order_request", {
      p_request_id: requestId,
      p_reference_image_path: referencePath,
      p_action: "complete_image",
    });
    if (completeError || imageCompleted !== requestId) {
      await discardIncompleteRequest(supabase, requestId, referencePath);
      return errorResponse("Não foi possível confirmar a imagem. Tente enviar a solicitação novamente.", 503);
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

async function discardIncompleteRequest(supabase: ReturnType<typeof createPublicServerClient>, requestId: string, referencePath: string) {
  const { error: removeError } = await supabase.storage.from("order-reference-images").remove([referencePath]);
  if (removeError) return;
  await supabase.rpc("submit_public_order_request", {
    p_request_id: requestId,
    p_reference_image_path: referencePath,
    p_action: "discard_incomplete",
  });
}

async function readBoundedFormData(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new FormData();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel();
      throw new Error("payload_too_large");
    }
    chunks.push(value);
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: Buffer.concat(chunks),
  });
  return boundedRequest.formData();
}
