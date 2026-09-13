<!-- ai-instructions:reference — rule 19. Do not replace with copied rules. -->

## Authoritative instructions — read them, they are NOT here

The account-wide rules live in **[`mendelson/AI-Instructions`](https://github.com/mendelson/AI-Instructions)**
and that repo is the single source of truth. **Read its `README.md` at the start
of every session**, before planning work in this repo. If the session does not
have it attached, attach it first (`add_repo` → `mendelson/AI-Instructions`);
the rules are not optional context.

Start with `README.md` (the rules themselves), then the `docs/` page for
whatever you are touching — build, tests, localization, warnings, tiering,
Apps Script, verification method.

**This file does not restate those rules, and must never be edited to.** A copy
here is correct the day it is written and silently wrong afterwards, because
nothing keeps it in sync — that is rule 19, and it was written after a repo's
mirrored copy quietly dropped a rule and ran a whole session without it.

What belongs here instead: **facts about THIS repo** — its layout, its build
quirks, the findings that cost someone a day, and *how* a rule lands here
(naming a rule and pointing at the file it applies to is a reference; explaining
what the rule is, is a copy).

**If this file ever contains restated rules, or is missing this header, fix it
in the session you notice** — do not file it as future work. Procedure:
`AI-Instructions/docs/INSTRUCTIONS-SOURCING.md`.

---

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
- **`GA_MEASUREMENT_ID` in `build.py` is the ONE definition of the hub's GA4
  id** (rule 6). `templates/base.html` and the short-link stubs both receive it
  through `{{GA_ID}}`; the id is not written literally in any committed HTML.
  The three streams (hub/apps/run) are mapped in `ANALYTICS_TRACKING.md`.
- **The 404 page is built twice over** — `build()` renders `content/404.html`
  if it exists and otherwise falls back to an inline copy that repeats the
  `.replace()` chain. There is no `content/404.html` today, so **the fallback
  branch is the live one**: a placeholder added to the template has to be
  substituted in *both* places or the 404 ships it raw. That is exactly how
  `{{GA_ID}}` almost shipped literal.
- **`python3 tools/check_build.py` is the gate**, and the deploy workflow runs
  the same command (rule 12): it builds, then asserts the *output* — no
  leftover `{{PLACEHOLDER}}`, every registered page/redirect/short link
  present, no URL claimed twice, and every tracked short link still carrying
  its GA id, its `short_link_click` event and its code. Counts are printed and
  a zero count fails (rule 7).
- **CI runs on `main` only.** `deploy.yml` fires on push to `main` and
  `workflow_dispatch`; nothing runs on `pull_request`, so a PR here is verified
  by the local gate above and the PR body says so (rule 1's no-CI carve-out).
  `preflight.yml` is a diagnostic left from the WordPress cutover and
  deploys nothing.
- **Short-link codes are permanent.** `TRACKED_SHORT_LINKS` slugs (`/1/`, …)
  go on paper and into QR codes; re-pointing one makes its history a lie.
  Retire a code, never reuse it — append new ones.
- **Redirect stubs that must keep the query string** are listed in
  `PRESERVE_QUERY_REDIRECTS`, not inferred: the watch-generated
  `/tracker/?trackId=…` links break silently without it.
