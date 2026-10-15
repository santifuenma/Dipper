export const enc = new TextEncoder();

export function json(data, status = 200, headers) {
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (headers) for (const [k, v] of headers) h.append(k, v);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
}

export function randomToken(size = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function sha256(text) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
