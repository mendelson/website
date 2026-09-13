/**
 * Printed-card redirects for mmendelson.com.
 *
 * A card carries `mmendelson.com/<id>`. Scanning it must land on the app site
 * and leave a row behind, fast, on a saturated 4G connection at an event.
 *
 * Why a root `_middleware.js` and not `functions/[id].js`: this runs in front
 * of the static assets, so it can decide per request whether a single-segment
 * path is a card id or a real page, without a routes manifest that would have
 * to be regenerated every time a page is added.
 *
 * Three things the spec pins down, all visible below:
 *   - 302, never 301. A 301 is cached by the browser forever and would weld
 *     the destination to cards that are already printed.
 *   - `Cache-Control: no-store`, so neither the browser nor an intermediary
 *     serves the hop from cache and hides the scan from the log.
 *   - The log never sits in front of the redirect. It goes out through
 *     `context.waitUntil()`, which keeps the request alive for the write
 *     after the response has already been handed to the visitor.
 */
import { BATCHES, DEFAULT_DESTINATION } from "./batches.generated.js";

/** Lowercase alphanumeric; length is bounded by the QR budget at build time. */
const ID_RE = /^[a-z0-9]{1,10}$/;

const UTM = {
  utm_source: "card",
  utm_medium: "print",
};

export async function onRequest(context) {
  const id = cardId(context.request);

  // Not shaped like a card id (root, nested path, dots, punctuation):
  // nothing to do, hand it to the asset server.
  if (id === null) {
    return context.next();
  }

  // A known batch answers immediately. No asset lookup, no database read —
  // the destination table was compiled into this bundle at build time.
  const destination = BATCHES[id];
  if (destination !== undefined) {
    return redirect(context, id, destination, false);
  }

  // Unknown id. It might still be a real page (`/cv`), so let the site answer
  // first and only treat a genuine 404 as a mis-printed card. Losing the
  // visitor is worse than losing the data, so this never returns a 404.
  const response = await context.next();
  if (response.status !== 404) {
    return response;
  }
  return redirect(context, id, DEFAULT_DESTINATION, true);
}

/**
 * The card id for this request, or null if the path cannot be one.
 * Matching is case-insensitive: `/R` and `/r` are the same card.
 */
function cardId(request) {
  let path = new URL(request.url).pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null; // malformed percent-encoding — not a card
  }
  const segment = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (segment === "" || segment.includes("/")) {
    return null;
  }
  const id = segment.toLowerCase();
  return ID_RE.test(id) ? id : null;
}

function redirect(context, id, destination, invalid) {
  // Fire-and-forget: waitUntil hands the write to the runtime and returns
  // immediately, so the 302 is not waiting on the database.
  context.waitUntil(log(context, id, invalid));

  return new Response(null, {
    status: 302,
    headers: {
      Location: withUtm(destination, id),
      "Cache-Control": "no-store",
    },
  });
}

/**
 * UTMs are attached here rather than printed on the card: the card stays short
 * (QR density) and the campaign tagging can change without a reprint.
 * Existing query parameters on the destination are preserved.
 */
function withUtm(destination, id) {
  const url = new URL(destination);
  for (const [key, value] of Object.entries(UTM)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("utm_campaign", id);
  return url.toString();
}

async function log(context, id, invalid) {
  const db = context.env.SCANS_DB;
  if (!db) {
    return; // binding absent (e.g. a preview deployment) — never break the hop
  }
  const { request, env } = context;
  try {
    await db
      .prepare(
        `INSERT INTO scans
           (batch_id, ts_utc, invalid, user_agent, ip_hash, referrer, country)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        new Date().toISOString(),
        invalid ? 1 : 0,
        request.headers.get("user-agent"),
        await hashIp(request.headers.get("cf-connecting-ip"), env.IP_SALT),
        request.headers.get("referer"),
        request.headers.get("cf-ipcountry")
      )
      .run();
  } catch (err) {
    // A failed write must never surface to the visitor — the response has
    // already gone out. Log it for `wrangler pages deployment tail`.
    console.error("scan log failed", { id, invalid, error: String(err) });
  }
}

/**
 * Salted SHA-256 of the IP, truncated to 128 bits.
 *
 * Salted because IPv4 is small enough to brute-force an unsalted hash back to
 * the address. With no salt configured we store NULL rather than a hash that
 * only looks anonymous — a missing secret should cost data, not privacy.
 */
async function hashIp(ip, salt) {
  if (!ip || !salt) {
    return null;
  }
  const bytes = new TextEncoder().encode(`${salt}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
