# Printed-card redirects

Each printed batch of cards gets its own short URL — `mmendelson.com/1`,
`mmendelson.com/2`, … Scanning the QR lands the visitor on the app site and
leaves one row in a scan log, so batches can be compared against each other:
which headline, which layout, which distribution point actually produced scans.

## Why this needs Cloudflare and GitHub Pages cannot do it

GitHub Pages serves files. It runs no code per request, which rules out three
things this needs, all of them non-negotiable in the spec:

| requirement | on GitHub Pages |
| :-- | :-- |
| HTTP **302**, never 301 | impossible — it emits no redirect of its own except the http→https 301 |
| `Cache-Control: no-store` | impossible — headers are not configurable |
| a row per scan | impossible — Pages exposes no access log at all |

This is not theoretical: the site's *existing* redirects (`/r/`, `/g/`, …) are
`redirect_html()` in `build.py` emitting a meta-refresh page with a
`location.replace()` script. They answer **200**, not 302, and they put
JavaScript in the redirect path — exactly what the card spec forbids. That
shape exists because on GitHub Pages there is no alternative.

So the domain has to be served by something that runs code. Cloudflare Pages
serves the same `public/` directory the current deploy produces, and
`functions/_middleware.js` handles the card ids in front of it.

## One-time setup

Steps 1 and 2 are the developer's — they need a Cloudflare login and access to
the domain's DNS.

**1. Point the domain at Cloudflare Pages.** Two shapes, and the code is
identical either way:

- **`mmendelson.com/1`** (the spec'd URL) — the apex must be a Cloudflare zone,
  which means moving the nameservers from GoDaddy to Cloudflare. The domain
  currently carries **MX and SPF records for GoDaddy email**
  (`smtp.secureserver.net`), so check that Cloudflare's import picked those up
  *before* switching the nameservers — Cloudflare shows the imported records
  for review first.
- **`go.mmendelson.com/1`** — a subdomain needs only a CNAME at GoDaddy to the
  `*.pages.dev` hostname. No nameserver move, no email risk. 19 characters, so
  still inside the QR budget.

**2. Create the project and the log.**

```sh
npx wrangler login
npx wrangler d1 create card-scans           # paste the id into ../wrangler.toml
npx wrangler d1 execute card-scans --remote --file=./cards/schema.sql
npx wrangler pages secret put IP_SALT       # any long random string
```

`IP_SALT` is what makes the stored IP hash non-reversible — IPv4 is small
enough to brute-force an unsalted hash straight back to the address. With no
salt configured the middleware stores `NULL` instead of a hash that only looks
anonymous.

Connect the repo to Cloudflare Pages with build command `python3 build.py` and
output directory `public`, which is what the README already documents as the
alternative host. The GitHub Pages workflow can stay as-is until the cutover.

## Adding a batch

Edit `batches.json`, add an object, push. That is the whole procedure.

```json
{
  "id": "2",
  "printed": "2026-10-04",
  "quantity": 500,
  "headline": "the headline printed on this batch",
  "location": "where the batch was handed out",
  "destination": null
}
```

- **`id`** — letters and digits, matched case-insensitively (`/R` and `/r` are
  the same card). Kept short: the printed URL has to stay under 26 characters
  for QR density, which the build enforces.
- **`destination`** — `null` uses `default_destination`. Set an absolute
  `https://` URL to send one batch somewhere else. Changing it is an edit and a
  push; the printed cards never change.
- Everything else is **metadata for your own queries only**. It is never
  compiled into the edge bundle and is not exposed on any public route —
  `tools/check_cards.py` asserts that each field stays out of the bundle.

The build rejects an id that collides with a page the site already serves. That
check is not hypothetical: `/r/`, `/g/`, `/t/`, `/cv/` and eight more
single-letter aliases already exist, and a card printed with one of those ids
would have gone to the wrong place forever.

## Querying the scans

```sh
python3 tools/scans.py summary    # scans per batch, best first, with headlines
python3 tools/scans.py daily      # scans per batch per day
python3 tools/scans.py invalid    # ids scanned that no batch defines
python3 tools/scans.py csv > scans.csv
```

`summary` joins each id against `batches.json`, so the comparison reads as
headlines and places rather than bare numbers, and prints the scan rate against
the quantity printed.

## How the redirect behaves

- **302, never 301.** A 301 is cached permanently by the browser and would weld
  the destination to cards that are already printed. Asserted in the tests.
- **`Cache-Control: no-store`**, so no intermediary serves the hop from cache
  and hides a scan.
- **UTMs are attached server-side** (`utm_source=card`, `utm_medium=print`,
  `utm_campaign=<id>`), keeping the printed URL short and letting the tagging
  change without a reprint.
- **An unknown id still redirects**, to the default destination, flagged
  `invalid` in the log. A mis-printed card loses the data but keeps the
  visitor. One consequence worth knowing: a *typo* of a real page (`/teachng`)
  now redirects to the app site instead of showing the 404 page. Paths with a
  dot, punctuation or more than one segment are untouched.
- **The log never blocks the hop.** The write goes out through
  `context.waitUntil()`; the test suite asserts the response returns before a
  deliberately slowed write completes.
- **No cookies, no third-party tracker, no JavaScript** anywhere in the path.

## Tests

```sh
python3 tools/check_cards.py      # config validity, generated-file sync, and
                                  # that the validator rejects bad input
node tools/test_middleware.mjs    # the real middleware against a stubbed context
```

Both print the number of checks they ran and fail on zero.
