import { apiRequest } from "../../services/api";
export type Category = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
};
export type PublicProduct = {
  name: string;
  description: string;
  current_price: string;
  currency: "COP";
  category_name: string;
  recommended_people: number | null;
  is_available: boolean;
  image_reference: string;
};
export type PublicCategory = { name: string; products: PublicProduct[] };
export type AdminProduct = Omit<PublicProduct, "category_name"> & {
  id: number;
  internal_code: string;
  category_id: number;
  category: Category;
  is_active: boolean;
  price_version: number;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type History = {
  id: number;
  previous_price: string | null;
  new_price: string;
  changed_at: string;
  changed_by: number;
};
export async function fetchPublicMenu() {
  const result = await apiRequest<{ categories: PublicCategory[] }>(
    "/public/menu",
    { cache: "no-store" },
  );
  return result.categories;
}
export async function fetchProducts(token: string, search = "") {
  return (
    await apiRequest<Page<AdminProduct>>(
      `/catalog/products?q=${encodeURIComponent(search)}`,
      {},
      token,
    )
  ).items;
}
export const catalogApi = {
  categories: (token: string) =>
    apiRequest<Category[]>("/catalog/categories", {}, token),
  products: (token: string, query: URLSearchParams, signal?: AbortSignal) =>
    apiRequest<Page<AdminProduct>>(
      `/catalog/products?${query}`,
      { signal },
      token,
    ),
  mutate: <T>(token: string, path: string, data?: unknown, method = "POST") =>
    apiRequest<T>(
      `/catalog/${path}`,
      { method, body: data === undefined ? undefined : JSON.stringify(data) },
      token,
    ),
  product: (token: string, id: number) =>
    apiRequest<AdminProduct>(`/catalog/products/${id}`, {}, token),
  history: (token: string, id: number) =>
    apiRequest<Page<History>>(
      `/catalog/products/${id}/price-history`,
      {},
      token,
    ),
  image: (token: string, id: number, data: FormData) =>
    apiRequest<AdminProduct>(
      `/catalog/products/${id}/image`,
      { method: "POST", body: data },
      token,
    ),
  deleteImage: (token: string, id: number) =>
    apiRequest<AdminProduct>(
      `/catalog/products/${id}/image`,
      { method: "DELETE" },
      token,
    ),
};

