// Acceso: usuario + contraseña, y Face ID mediante passkeys (WebAuthn).
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { seedCategories } from "./categories.js";
import { b64url, enc, fromB64url, getCookie, json, randomToken, readJson, sha256 } from "./util.js";

const COOKIE = "dipper_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000; // máximo que admite Workers
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
const BAD_LOGIN = "Correo o contraseña incorrectos.";

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return new Uint8Array(bits);
}

// La sesión llega en la cookie (PWA) o como "Authorization: Bearer <token>" (app nativa).
function sessionToken(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return getCookie(request, COOKIE);
}

// La app nativa se identifica con "X-Dipper-Client: app": recibe el token en la respuesta para
// guardarlo en el llavero del iPhone. La web no lo recibe nunca (solo la cookie HttpOnly).
const wantsToken = (request) => (request.headers.get("x-dipper-client") || "").toLowerCase() === "app";

async function sessionResponse(env, url, user, status = 200, method = "password", request = null) {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at, method) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(token), user.id, now + SESSION_DAYS * 86400000, now, method)
    .run();
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const cookie = `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`;
  const body = { user: publicUser(user) };
  if (request && wantsToken(request)) body.token = token;
  return json(body, status, [["set-cookie", cookie]]);
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

export async function currentUser(request, env) {
  const token = sessionToken(request);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.id, u.name, u.email, s.method AS authMethod, s.token_hash AS sessionHash
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256(token), Date.now())
    .first();
}

// Cambiar contraseña. Si se entró con Face ID no hace falta la actual (Face ID ya acredita al dueño).
async function changePassword(request, env, user) {
  const { current, next } = await readJson(request);
  if (typeof next !== "string" || next.length < 8) return json({ error: "La contraseña nueva necesita mínimo 8 caracteres." }, 400);

  const row = await env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").bind(user.id).first();
  if (user.authMethod !== "passkey") {
    const hash = await hashPassword(String(current || ""), fromB64url(row.password_salt));
    if (!crypto.subtle.timingSafeEqual(hash, fromB64url(row.password_hash))) {
      return json({ error: "La contraseña actual no es correcta." }, 401);
    }
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(next, salt);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(b64url(hash), b64url(salt), user.id),
    // Cierra las demás sesiones abiertas; esta se mantiene.
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, user.sessionHash),
    env.DB.prepare("DELETE FROM login_failures WHERE email = ?").bind(user.email),
  ]);
  return json({ ok: true });
}

async function saveChallenge(env, challenge, userId = null) {
  const id = randomToken(16);
  await env.DB.prepare("DELETE FROM challenges WHERE expires_at < ?").bind(Date.now()).run();
  await env.DB.prepare("INSERT INTO challenges (id, challenge, user_id, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, challenge, userId, Date.now() + CHALLENGE_MS)
    .run();
  return id;
}

async function takeChallenge(env, id) {
  if (typeof id !== "string") return null;
  const row = await env.DB.prepare("SELECT * FROM challenges WHERE id = ? AND expires_at > ?").bind(id, Date.now()).first();
  await env.DB.prepare("DELETE FROM challenges WHERE id = ?").bind(id).run();
  return row;
}

async function register(request, env, url) {
  const { name, email, password } = await readJson(request);
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanName || cleanName.length > 60) return json({ error: "Escribe tu nombre." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return json({ error: "Ese correo no parece válido." }, 400);
  if (typeof password !== "string" || password.length < 8) return json({ error: "La contraseña necesita mínimo 8 caracteres." }, 400);

  // Con REGISTRO_ABIERTO = "si" (entorno de pruebas, y la app pública cuando llegue) cualquiera puede
  // crear su cuenta; si no, solo la primera, como en la app personal de hoy.
  if (env.REGISTRO_ABIERTO !== "si") {
    const { c } = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
    if (c > 0) return json({ error: "Ya hay una cuenta creada. Entra con ella." }, 403);
  }
  const taken = await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(cleanEmail).first();
  if (taken) return json({ error: "Ya hay una cuenta con ese correo. Entra con ella." }, 409);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const res = await env.DB.prepare(
    "INSERT INTO users (name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(cleanName, cleanEmail, b64url(hash), b64url(salt), Date.now())
    .run();
  const userId = res.meta.last_row_id;
  await seedCategories(env, userId);
  return sessionResponse(env, url, { id: userId, name: cleanName, email: cleanEmail }, 201, "password", request);
}

async function login(request, env, url) {
  const { email, password } = await readJson(request);
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || typeof password !== "string") return json({ error: BAD_LOGIN }, 401);

  const since = Date.now() - FAILURE_WINDOW_MS;
  const { c } = await env.DB.prepare("SELECT COUNT(*) AS c FROM login_failures WHERE email = ? AND at > ?")
    .bind(cleanEmail, since)
    .first();
  if (c >= MAX_FAILURES) return json({ error: "Demasiados intentos. Espera 15 minutos." }, 429);

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(cleanEmail).first();
  const salt = user ? fromB64url(user.password_salt) : new Uint8Array(16);
  const hash = await hashPassword(password, salt);
  const expected = user ? fromB64url(user.password_hash) : new Uint8Array(32);

  if (!user || !crypto.subtle.timingSafeEqual(hash, expected)) {
    await env.DB.prepare("INSERT INTO login_failures (email, at) VALUES (?, ?)").bind(cleanEmail, Date.now()).run();
    return json({ error: BAD_LOGIN }, 401);
  }
  await env.DB.prepare("DELETE FROM login_failures WHERE email = ?").bind(cleanEmail).run();
  return sessionResponse(env, url, user, 200, "password", request);
}

// Borrar la cuenta (lo exige el App Store): todo lo del usuario desaparece. Pide la contraseña,
// salvo si se entró con Face ID, igual que al cambiarla.
async function deleteAccount(request, env, user) {
  const { password } = await readJson(request);
  if (user.authMethod !== "passkey") {
    const row = await env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").bind(user.id).first();
    const hash = await hashPassword(String(password || ""), fromB64url(row.password_salt));
    if (!crypto.subtle.timingSafeEqual(hash, fromB64url(row.password_hash))) {
      return json({ error: "La contraseña no es correcta." }, 401);
    }
  }
  // Tabla a tabla y en orden, sin depender de que la base aplique los ON DELETE CASCADE.
  const id = user.id;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM charges WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM merchant_rules WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM merchant_names WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM cards WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM categories WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM passkeys WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM challenges WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id),
    env.DB.prepare("DELETE FROM login_failures WHERE email = ?").bind(user.email),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);
  return json({ ok: true }, 200, [["set-cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`]]);
}

async function logout(request, env) {
  const token = sessionToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  return json({ ok: true }, 200, [["set-cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`]]);
}

async function passkeyRegisterOptions(env, url, user) {
  const existing = await env.DB.prepare("SELECT id, transports FROM passkeys WHERE user_id = ?").bind(user.id).all();
  const options = await generateRegistrationOptions({
    rpName: "Dipper",
    rpID: url.hostname,
    userName: user.email,
    userDisplayName: user.name,
    userID: enc.encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existing.results.map((p) => ({
      id: p.id,
      transports: p.transports ? JSON.parse(p.transports) : undefined,
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
  });
  const challengeId = await saveChallenge(env, options.challenge, user.id);
  return json({ challengeId, options });
}

async function passkeyRegisterVerify(request, env, url, user) {
  const { challengeId, response } = await readJson(request);
  const ch = await takeChallenge(env, challengeId);
  if (!ch || ch.user_id !== user.id) return json({ error: "La solicitud ha caducado. Vuelve a intentarlo." }, 400);

  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: url.origin,
    expectedRPID: url.hostname,
    requireUserVerification: true,
  });
  if (!verified) return json({ error: "No se pudo activar Face ID." }, 400);

  const { credential } = registrationInfo;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO passkeys (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(credential.id, user.id, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports || []), Date.now())
    .run();
  return json({ ok: true });
}

async function passkeyLoginOptions(env, url) {
  const options = await generateAuthenticationOptions({ rpID: url.hostname, userVerification: "required" });
  const challengeId = await saveChallenge(env, options.challenge);
  return json({ challengeId, options });
}

async function passkeyLoginVerify(request, env, url) {
  const { challengeId, response } = await readJson(request);
  const ch = await takeChallenge(env, challengeId);
  if (!ch) return json({ error: "La solicitud ha caducado. Vuelve a intentarlo." }, 400);
  if (!response || typeof response.id !== "string") return json({ error: "No se reconoce este Face ID." }, 401);

  const pk = await env.DB.prepare("SELECT * FROM passkeys WHERE id = ?").bind(response.id).first();
  if (!pk) return json({ error: "No se reconoce este Face ID." }, 401);

  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: url.origin,
    expectedRPID: url.hostname,
    requireUserVerification: true,
    credential: {
      id: pk.id,
      publicKey: fromB64url(pk.public_key),
      counter: pk.counter,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    },
  });
  if (!verified) return json({ error: "No se reconoce este Face ID." }, 401);

  await env.DB.prepare("UPDATE passkeys SET counter = ? WHERE id = ?").bind(authenticationInfo.newCounter, pk.id).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(pk.user_id).first();
  return sessionResponse(env, url, user, 200, "passkey", request);
}

export async function handleAuth(request, env, url) {
  const route = `${request.method} ${url.pathname.slice("/api/auth".length)}`;

  switch (route) {
    case "POST /register": return register(request, env, url);
    case "POST /login": return login(request, env, url);
    case "POST /logout": return logout(request, env);
    case "POST /passkey/login/options": return passkeyLoginOptions(env, url);
    case "POST /passkey/login/verify": return passkeyLoginVerify(request, env, url);
  }

  const user = await currentUser(request, env);
  if (!user) return json({ error: "Tienes que entrar primero." }, 401);

  switch (route) {
    case "GET /me": return json({ user: publicUser(user), authMethod: user.authMethod });
    case "POST /password": return changePassword(request, env, user);
    case "POST /delete-account": return deleteAccount(request, env, user);
    case "POST /passkey/register/options": return passkeyRegisterOptions(env, url, user);
    case "POST /passkey/register/verify": return passkeyRegisterVerify(request, env, url, user);
  }
  return json({ error: "No encontrado." }, 404);
}
