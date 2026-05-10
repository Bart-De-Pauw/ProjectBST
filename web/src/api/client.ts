/** Empty → same-origin `/api/...` (Vite proxy in dev; nginx in prod). */
const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return `/api${p}`;
  }
  return `${base.replace(/\/$/, "")}${p}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}

/** Go encodes a nil slice as JSON `null`; use before `.map()` on list endpoints. */
export function jsonArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}
