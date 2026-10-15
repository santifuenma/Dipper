// Face ID mediante passkeys (WebAuthn), sin librerías.
import { api } from "./api.js";

const FLAG = "dipper_faceid";

const toBuf = (s) => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b + "===".slice((b.length + 3) % 4)), (c) => c.charCodeAt(0)).buffer;
};
const toB64 = (buf) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const passkeySupported = () => !!window.PublicKeyCredential;

export function faceIdEnabledHere() {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function rememberFaceId() {
  try {
    localStorage.setItem(FLAG, "1");
  } catch {}
}

export async function enableFaceId() {
  const { challengeId, options: o } = await api("/auth/passkey/register/options", {});
  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        ...o,
        challenge: toBuf(o.challenge),
        user: { ...o.user, id: toBuf(o.user.id) },
        excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
      },
    });
  } catch (err) {
    // Este iPhone ya tiene la passkey (p. ej. tras reinstalar el icono): basta con recordarlo.
    if (err && err.name === "InvalidStateError") {
      rememberFaceId();
      return;
    }
    throw err;
  }
  await api("/auth/passkey/register/verify", {
    challengeId,
    response: {
      id: cred.id,
      rawId: toB64(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment,
      clientExtensionResults: cred.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(cred.response.clientDataJSON),
        attestationObject: toB64(cred.response.attestationObject),
        transports: cred.response.getTransports ? cred.response.getTransports() : [],
      },
    },
  });
  rememberFaceId();
}

export async function loginWithFaceId() {
  const { challengeId, options: o } = await api("/auth/passkey/login/options", {});
  const cred = await navigator.credentials.get({
    publicKey: {
      ...o,
      challenge: toBuf(o.challenge),
      allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
    },
  });
  const r = cred.response;
  const data = await api("/auth/passkey/login/verify", {
    challengeId,
    response: {
      id: cred.id,
      rawId: toB64(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment,
      clientExtensionResults: cred.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(r.clientDataJSON),
        authenticatorData: toB64(r.authenticatorData),
        signature: toB64(r.signature),
        userHandle: r.userHandle ? toB64(r.userHandle) : undefined,
      },
    },
  });
  rememberFaceId();
  return data.user;
}

// Mensaje legible si el usuario cancela o el iPhone no lo permite.
export function faceIdError(err) {
  if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) return "Face ID cancelado.";
  if (err && err.name === "InvalidStateError") return "Face ID ya está activado en este iPhone.";
  return (err && err.message) || "No se pudo usar Face ID.";
}
