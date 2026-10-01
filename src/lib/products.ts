export const productPriceTypes = ["fixed", "from", "consultation"] as const;
export type ProductPriceType = (typeof productPriceTypes)[number];

export type ProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  position: number;
  signed_url?: string;
};

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  short_description: string;
  estimated_minutes: number;
  price_type: ProductPriceType;
  base_price: number | null;
  available_for_orders: boolean;
  notes: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_images?: ProductImage[];
};

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_COUNT = 4;
export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function formatProductionTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export function formatProductPrice(product: Pick<Product, "price_type" | "base_price">) {
  if (product.price_type === "consultation") return "Sob consulta";
  const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.base_price ?? 0);
  return product.price_type === "from" ? `A partir de ${price}` : price;
}

export function getProductionParts(totalMinutes: number) {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
