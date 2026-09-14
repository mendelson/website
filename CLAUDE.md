# CLAUDE.md

Facts about **this** repo — its layout, its build quirks, and the findings that
cost someone a day. Nothing here is an account-wide policy: this is a website,
not one of the Garmin app repos, so it is not governed by `AI-Instructions`.

## This repo

`mmendelson.com` — the hub of the three-site family (hub / `apps-website` /
`corridas`). A **generated** static site: `build.py` (Python standard library,
no packages, no npm) wraps the HTML fragments in `content/` with
`templates/base.html` and writes `public/`, which is **git-ignored and rebuilt
on every deploy**. Never edit `public/`; edit the generator or the fragment.

- **Three registries near the top of `build.py` decide every URL**: `PAGES`
  (renders a page), `REDIRECTS` (bounce stub, in-site or off-site) and
  `TRACKED_SHORT_LINKS` (bounce stub that records the hit first). They write
  into one output tree, so the build refuses a slug claimed by two of them —
  a short link silently overwritten by a page would report zero forever.
- **`CUSTOM_DOMAIN` at the top of `build.py` controls the whole URL shape.**
  Set (`"mmendelson.com"`) → `BASE = ""` and a `CNAME` is emitted; empty →
  `BASE = "/website"` for the `mendelson.github.io/website` project URL and no
  `CNAME`, because a `CNAME` file would make Pages redirect the project URL to
  the custom domain.
- **i18n is one URL per page, not `/xx/` folders** — unlike the two sister
  sites. Five languages (`de en es fr pt`) ship inline in every page as
  `<span class="t"><span lang="xx">…</span>…</span>`, and CSS shows only the
  one matching `<html lang>`, which a `<head>` script sets before first paint
  from `localStorage.mm_lang` → `navigator.language` → `en`. Adding a sixth
  language means touching every `.t` group, the CSS rule, the `langs` array
  and the globe menu — the README lists the four places.
- **`GA_MEASUREMENT_ID` in `build.py` is the ONE definition of the GA4 id**
  `templates/base.html` and the short-link stubs both receive it
  through `{{GA_ID}}`; the id is not written literally in any committed HTML.
  It is the **family** id — apps.mmendelson.com and run.mmendelson.com send to
  the same one, which is what makes a visit across the three a single session.
  Changing it here changes only this site; the other two carry their own copies
  of the same head block, so all three move together or not at all.
- **Consent is a cookie on `.mmendelson.com`, not `localStorage`.** The head
  block defines `mmConsentGet`/`mmConsentSet` and `assets/js/site.js` uses
  them. localStorage is per ORIGIN, so the hub, apps and run each had their own
  copy: the visitor was asked three times, and after the stream was unified the
  other two went on sending in *denied* mode while the hub's `_ga` cookie sat
  right there. `mm_consent_v` is the banner version answered — only `2` may
  grant the ad/demographic signals.
- **`tools/analytics-family-check/run.sh` is the only thing that can check any
  of that**, because it depends on what a browser does across three hostnames.
  It serves all three repos on their real names over local HTTPS and runs
  Google's real `gtag.js`. Needs the sibling repos checked out; not in CI.
- **The 404 page is built twice over** — `build()` renders `content/404.html`
  if it exists and otherwise falls back to an inline copy that repeats the
  `.replace()` chain. There is no `content/404.html` today, so **the fallback
  branch is the live one**: a placeholder added to the template has to be
  substituted in *both* places or the 404 ships it raw. That is exactly how
  `{{GA_ID}}` almost shipped literal.
- **`python3 tools/check_build.py` is the gate**, and the deploy workflow runs
  the same command, so local and CI cannot drift: it builds, then asserts the *output* — no
  leftover `{{PLACEHOLDER}}`, every registered page/redirect/short link
  present, no URL claimed twice, and every tracked short link still carrying
  its GA id, its `short_link_click` event and its code. Counts are printed and
  a zero count fails — a checker that checked nothing is the worst possible pass.
- **CI runs on `main` only.** `deploy.yml` fires on push to `main` and
  `workflow_dispatch`; nothing runs on `pull_request`, so a PR here is verified
  by the local gate above, and the PR body should say which gates ran.
  `preflight.yml` is a diagnostic left from the WordPress cutover and
  deploys nothing.
- **Short-link codes are permanent.** `TRACKED_SHORT_LINKS` slugs (`/1/`, …)
  go on paper and into QR codes; re-pointing one makes its history a lie.
  Retire a code, never reuse it — append new ones.
- **Redirect stubs that must keep the query string** are listed in
  `PRESERVE_QUERY_REDIRECTS`, not inferred: the watch-generated
  `/tracker/?trackId=…` links break silently without it.
