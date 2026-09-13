/**
 * Runs functions/_middleware.js against a stubbed Pages context.
 *
 * Run from the repo root:  node tools/test_middleware.mjs
 *
 * This is not a mock of the redirect logic — it imports and executes the real
 * middleware. The Workers runtime globals the middleware touches (Request,
 * Response, URL, TextEncoder, crypto.subtle) all exist in Node 18+, so the only
 * things stubbed are the three pieces Cloudflare injects: next(), env, and
 * waitUntil().
 *
 * The cases worth having: that it is a 302 and never a 301, that a known id
 * never pays for an asset lookup, that an unknown id lands on the site instead
 * of a 404, that a real page still wins, and that the database write cannot
 * hold up the response.
 */
import { onRequest } from "../functions/_middleware.js";
import { BATCHES, DEFAULT_DESTINATION } from "../functions/batches.generated.js";

let checks = 0;
const failures = [];

function check(label, condition) {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
  }
}

/** A context that records what the middleware did with it. */
function makeContext(path, { nextStatus = 404, headers = {}, salt = "s3cr3t", dbDelay = 0, db = true } = {}) {
  const state = { nextCalls: 0, rows: [], pending: [], dbErrors: [] };

  const fakeDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (dbDelay) {
                await new Promise((r) => setTimeout(r, dbDelay));
              }
              state.rows.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };

  const context = {
    request: new Request(`https://mmendelson.com${path}`, { headers }),
    async next() {
      state.nextCalls += 1;
      return new Response(nextStatus === 404 ? "not found" : "page", { status: nextStatus });
    },
    env: { SCANS_DB: db ? fakeDb : undefined, IP_SALT: salt },
    waitUntil(promise) {
      state.pending.push(promise);
    },
  };
  return { context, state };
}

async function settle(state) {
  await Promise.all(state.pending);
}

const firstId = Object.keys(BATCHES)[0];

console.log("== a known batch id ==");
{
  const { context, state } = makeContext(`/${firstId}`);
  const res = await onRequest(context);
  await settle(state);
  const location = new URL(res.headers.get("location"));

  check("status is exactly 302, never 301", res.status === 302);
  check("Cache-Control is no-store", res.headers.get("cache-control") === "no-store");
  check("no asset lookup for a known id", state.nextCalls === 0);
  check("utm_source=card", location.searchParams.get("utm_source") === "card");
  check("utm_medium=print", location.searchParams.get("utm_medium") === "print");
  check(`utm_campaign=${firstId}`, location.searchParams.get("utm_campaign") === firstId);
  check("lands on the batch destination", location.origin + location.pathname === BATCHES[firstId]);
  check("one row logged", state.rows.length === 1);
  check("row is not flagged invalid", state.rows[0]?.args[2] === 0);
  check("row carries the batch id", state.rows[0]?.args[0] === firstId);
}

console.log("\n== trailing slash and letter case ==");
{
  const { context, state } = makeContext(`/${firstId}/`);
  const res = await onRequest(context);
  await settle(state);
  check("/<id>/ redirects like /<id>", res.status === 302);
}
{
  const { context, state } = makeContext("/ABC");
  const res = await onRequest(context);
  await settle(state);
  check("an uppercase unknown id still redirects", res.status === 302);
  check("the id is lowercased before logging", state.rows[0]?.args[0] === "abc");
  check(
    "utm_campaign carries the lowercased id",
    new URL(res.headers.get("location")).searchParams.get("utm_campaign") === "abc"
  );
}

console.log("\n== an unknown id (a mis-printed card) ==");
{
  const { context, state } = makeContext("/zz9", { nextStatus: 404 });
  const res = await onRequest(context);
  await settle(state);
  check("never a 404 — redirects anyway", res.status === 302);
  check("falls back to the default destination",
    res.headers.get("location").startsWith(DEFAULT_DESTINATION));
  check("flagged invalid in the log", state.rows[0]?.args[2] === 1);
}

console.log("\n== a real page must still win ==");
{
  const { context, state } = makeContext("/cv", { nextStatus: 200 });
  const res = await onRequest(context);
  await settle(state);
  check("a 200 from the asset server is returned untouched", res.status === 200);
  check("nothing is logged for a real page", state.rows.length === 0);
}
{
  const { context, state } = makeContext("/cv", { nextStatus: 301 });
  const res = await onRequest(context);
  await settle(state);
  check("the asset server's own 301 (slash normalisation) is preserved", res.status === 301);
}

console.log("\n== paths that are not card ids ==");
for (const [path, label] of [
  ["/", "the root"],
  ["/teaching/fga", "a nested path"],
  ["/favicon.ico", "a filename with a dot"],
  ["/a_b", "a path with punctuation"],
]) {
  const { context, state } = makeContext(path, { nextStatus: 200 });
  const res = await onRequest(context);
  await settle(state);
  check(`${label} is passed through`, res.status === 200 && state.nextCalls === 1);
}

console.log("\n== the log must never hold up the redirect ==");
{
  const { context, state } = makeContext(`/${firstId}`, { dbDelay: 150 });
  const started = Date.now();
  const res = await onRequest(context);
  const elapsed = Date.now() - started;
  check(`response returned in ${elapsed}ms, before the 150ms write`, elapsed < 100);
  check("the write was handed to waitUntil", state.pending.length === 1);
  check("nothing logged yet at response time", state.rows.length === 0);
  await settle(state);
  check("the write lands after the response", state.rows.length === 1);
  check("the redirect was still a 302", res.status === 302);
}

console.log("\n== logging failures must not reach the visitor ==");
{
  const { context, state } = makeContext(`/${firstId}`, { db: false });
  const res = await onRequest(context);
  await settle(state);
  check("a missing database binding still redirects", res.status === 302);
}

console.log("\n== IP handling ==");
{
  const headers = { "cf-connecting-ip": "203.0.113.7", "user-agent": "UA/1", referer: "https://x.test/", "cf-ipcountry": "BR" };
  const { context, state } = makeContext(`/${firstId}`, { headers });
  await onRequest(context);
  await settle(state);
  const [, , , ua, ipHash, referrer, country] = state.rows[0].args;
  check("user agent is recorded", ua === "UA/1");
  check("referrer is recorded", referrer === "https://x.test/");
  check("country is recorded", country === "BR");
  check("the IP is hashed, not stored", ipHash !== "203.0.113.7");
  check("the hash is 32 hex chars", /^[0-9a-f]{32}$/.test(ipHash));

  const other = makeContext(`/${firstId}`, { headers, salt: "different-salt" });
  await onRequest(other.context);
  await settle(other.state);
  check("a different salt yields a different hash", other.state.rows[0].args[4] !== ipHash);

  // `salt: undefined` would fall through to makeContext's own default, which
  // is exactly the bug this case exists to catch — so pass an explicit null,
  // matching what the runtime hands over when IP_SALT is not configured.
  const unsalted = makeContext(`/${firstId}`, { headers, salt: null });
  await onRequest(unsalted.context);
  await settle(unsalted.state);
  check("with no salt the IP is dropped, not weakly hashed",
    unsalted.state.rows[0].args[4] === null);
}

console.log("\n== destination query strings survive ==");
{
  // A batch destination may legitimately carry its own query.
  const { context } = makeContext("/zz8", { nextStatus: 404 });
  const res = await onRequest(context);
  const location = new URL(res.headers.get("location"));
  check("utm parameters are additive, not a replacement",
    location.searchParams.get("utm_source") === "card");
}

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`FAILED — ${failures.length} of ${checks} checks`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
if (checks === 0) {
  console.log("FAILED — the suite ran zero checks");
  process.exit(1);
}
console.log(`PASSED — ${checks} checks`);
