export async function api(path, body) {
  const res = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.error || "No hay conexión. Inténtalo de nuevo.");
    err.status = res.status;
    throw err;
  }
  return data;
}
