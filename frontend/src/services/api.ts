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
  if (!response.ok)
    throw new ApiError(
      payload.message ?? "No se pudo completar la solicitud.",
      response.status,
      payload.code ?? "HTTP_ERROR",
    );
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

