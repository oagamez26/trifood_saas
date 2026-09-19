export const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/$/,
  "",
);
export function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/media/")) return path;
  if (path.startsWith("/")) return path;
  return `/media/products/${path}`;
}
export const formatCOP = (value: string | number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
