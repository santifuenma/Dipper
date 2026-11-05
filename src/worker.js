// DIPPER: servidor (Cloudflare Worker). Sirve la app y la API.
import { currentUser, handleAuth } from "./auth.js";
import { handlePayments, ingest } from "./payments.js";
import { handleCards } from "./cards.js";
import { handleCategories } from "./categories.js";
import { handleCharges } from "./charges.js";
import { handleBudget } from "./budget.js";
import { handleOnboarding } from "./onboarding.js";
import { handlePush } from "./push.js";
import { json } from "./util.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      // El atajo de Apple Pay se identifica con el enlace personal, no con la sesión.
      if (url.pathname.startsWith("/api/ingest/")) {
        return await ingest(request, env, url.pathname.slice("/api/ingest/".length), ctx);
      }

      if (request.method === "POST" && !(request.headers.get("content-type") || "").includes("application/json")) {
        return json({ error: "Formato no válido." }, 415);
      }
      if (url.pathname.startsWith("/api/auth/")) return await handleAuth(request, env, url);

      const user = await currentUser(request, env);
      if (!user) return json({ error: "Tienes que entrar primero." }, 401);
      const res =
        (await handlePayments(request, env, url, user, ctx)) ||
        (await handlePush(request, env, url, user)) ||
        (await handleOnboarding(request, env, url, user)) ||
        (await handleCards(request, env, url, user)) ||
        (await handleCategories(request, env, url, user)) ||
        (await handleCharges(request, env, url, user)) ||
        (await handleBudget(request, env, url, user));
      if (res) return res;
      return json({ error: "No encontrado." }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Algo ha fallado. Inténtalo de nuevo." }, 500);
    }
  },
};
