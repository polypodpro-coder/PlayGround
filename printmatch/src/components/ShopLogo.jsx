import { Factory } from "lucide-react";

const SIZES = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

export default function ShopLogo({ src, alt, size = "md", className = "" }) {
  const sizeClass = SIZES[size] ?? SIZES.md;

  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy/40 ${sizeClass} ${className}`}
      >
        <Factory size={size === "lg" ? 24 : size === "sm" ? 15 : 18} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`shrink-0 rounded-full object-cover ring-1 ring-black/5 ${sizeClass} ${className}`}
    />
  );
}
