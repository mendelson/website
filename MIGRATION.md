# Cutover runbook: WordPress → GitHub Pages for mmendelson.com

Live state was captured on **2026-07-09** by the *Migration preflight checks*
workflow (`.github/workflows/preflight.yml`) — re-run it any time to get a
fresh snapshot (Actions → Migration preflight checks → Run workflow).

## Current state (pre-cutover)

| Record | Value | TTL |
|---|---|---|
| `mmendelson.com` A | `198.71.190.114` (GoDaddy WP hosting) | 600 |
| `www` CNAME | `mmendelson.com` | 1800 |
| `apps` CNAME | `mendelson.github.io` (already on Pages!) | 1800 |
| `run` CNAME | `corridas.pages.dev` (Cloudflare Pages) | 1800 |
| `api` CNAME | `strava-backend-pf47.onrender.com` | 600 |
| Nameservers | `ns41/ns42.domaincontrol.com` (GoDaddy DNS) | — |

Serving the apex today: **WordPress 6.9.4** behind GoDaddy's gateway cache.
The static replacement is live and healthy at
<https://mendelson.github.io/website/>.

## 🔙 Rollback card

At GoDaddy DNS, restore the apex record:

```
mmendelson.com.  A  198.71.190.114   (TTL 600)
```

WordPress is back within ~10 minutes (TTL is 600 s). Nothing else needs to
change — `www` chains off the apex, and the subdomains are never touched.

## Cutover steps (in order)

Only the **apex A record** changes at GoDaddy. Leave `www`, `apps`, `run`,
`api`, MX and every other record alone (change `www` only in step 5,
optionally).

1. **Verify the domain** (one-time, zero-risk): GitHub → profile
   **Settings → Pages → Verified domains → Add** `mmendelson.com`, create the
   `_github-pages-challenge-mendelson` TXT record it gives you at GoDaddy,
   wait for the green check.
2. **Merge the migration branch to `main`.** This deploys the build with
   `CUSTOM_DOMAIN = "mmendelson.com"`: root-relative links, apex canonical
   URLs. ⚠️ From this moment the project URL
   `mendelson.github.io/website/` has broken nav links (they point at the
   domain root), so proceed to the next steps right away.
3. **Bind the domain**: repo **Settings → Pages → Custom domain** →
   `mmendelson.com` → Save. (This repo deploys via a GitHub Actions
   workflow, so the `CNAME` file in the build artifact is ignored — this
   settings field is the authoritative binding.)
4. **Flip the apex** at GoDaddy DNS — replace the single A record with
   GitHub Pages' four:

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

5. *(Optional but recommended)* change `www` CNAME from `mmendelson.com` to
   `mendelson.github.io` — the form GitHub's docs expect. The existing
   CNAME-to-apex also lands on Pages IPs and GitHub redirects www → apex
   either way.
6. **Wait for the TLS certificate** in Settings → Pages (minutes up to ~1 h),
   then tick **Enforce HTTPS**. Do not enable it before the cert is issued.
7. **Verify**: re-run the preflight workflow and browse
   `https://mmendelson.com/`, `https://www.mmendelson.com/`, plus a few deep
   URLs (`/teaching/`, `/cv/`, `/uni/`, `/tracker/`).

## After the cutover

- **Stale browser caches**: the WordPress site served
  `cache-control: max-age=2678400` (31 days). Returning visitors may see the
  cached WordPress pages for a while; a hard refresh fixes it. New visitors
  get the new site immediately.
- **Keep the GoDaddy WordPress hosting alive ~2 weeks** as the rollback
  target, then export a final backup (Tools → Export in wp-admin, plus a
  files/DB snapshot) and cancel it. Keep the domain + GoDaddy **DNS** —
  only the WordPress *hosting* is being retired.
- Delete `.github/workflows/preflight.yml` and this file once you're
  confident.
