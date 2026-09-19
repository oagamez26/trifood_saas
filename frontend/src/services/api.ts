import { API_URL } from "../config/env";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    let msg = payload.message || "No se pudo completar la solicitud.";
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const first = payload.detail[0];
      const loc = first.loc || [];
      const field = loc[loc.length - 1] || "";
      const fieldTranslations: Record<string, string> = {
        name: "nombre del producto",
        internal_code: "código interno / SKU",
        description: "descripción",
        current_price: "precio",
        price: "precio",
        category_id: "categoría",
        recommended_people: "porciones / personas",
        is_active: "estado activo",
        is_available: "disponibilidad",
      };
      const cleanField = fieldTranslations[String(field)] || field;
      if (first.type === "extra_forbidden") {
        msg = `El campo '${cleanField}' no está permitido en esta operación.`;
      } else if (first.type?.includes("greater_than") || first.type?.includes("gt")) {
        msg = `El valor de ${cleanField} debe ser mayor a 0.`;
      } else if (first.type === "missing") {
        msg = `El campo '${cleanField}' es obligatorio.`;
      } else if (first.type === "string_too_short") {
        msg = `El campo '${cleanField}' no puede estar vacío.`;
      } else if (first.type?.includes("int") || first.type?.includes("decimal")) {
        msg = `El campo '${cleanField}' debe ser un valor numérico válido.`;
      }
    }
    throw new ApiError(
      msg,
      response.status,
      payload.code ?? "HTTP_ERROR",
    );
  }
  return payload as T;
}
export function csrfToken() {
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("csrf_refresh_token="))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  );
}

export async function downloadAuthenticatedBlob(
  path: string,
  accessToken?: string,
  defaultFilename: string = "documento.pdf",
): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError(
      errorText || "Error al descargar el archivo.",
      response.status,
      "DOWNLOAD_ERROR",
    );
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

