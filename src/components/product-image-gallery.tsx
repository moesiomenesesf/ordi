import Image from "next/image";
import type { ProductImage } from "@/lib/products";

export function ProductImageGallery({ images, label = "" }: { images: ProductImage[]; label?: string }) {
  const visibleImages = images.slice(0, 4);
  if (visibleImages.length === 0) {
    return <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">Sem imagens</div>;
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {visibleImages.map((image, index) => {
        const single = visibleImages.length === 1;
        const third = visibleImages.length === 3 && index === 2;
        return (
          <div key={image.id} className={`${single ? "col-span-2 aspect-[4/3]" : third ? "col-span-2 aspect-[2/1]" : "aspect-square"} relative overflow-hidden rounded-xl bg-neutral-100`}>
            {image.signed_url ? <Image src={image.signed_url} alt={label ? `${label} — imagem ${index + 1}` : ""} fill unoptimized sizes="(max-width: 640px) 100vw, 320px" className="object-cover" /> : <span className="sr-only">Imagem indisponível</span>}
          </div>
        );
      })}
    </div>
  );
}
