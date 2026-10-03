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
  its GA id, its `short_link_click` event, its code and its POST to the
  counter (with a real `/exec` URL and a real `SCRIPT_ID` pin — the
  placeholders fail it). `node tools/test_counter.js` and `node
  tools/test_stub.js` run beside it in `deploy.yml`. Counts are printed and
  a zero count fails — a checker that checked nothing is the worst possible pass.
- **CI runs on `main` only.** `deploy.yml` fires on push to `main` and
  `workflow_dispatch`; nothing runs on `pull_request`, so a PR here is verified
  by the local gate above, and the PR body should say which gates ran.
  `preflight.yml` is a diagnostic left from the WordPress cutover and
  deploys nothing.
- **The short-link COUNT lives in Apps Script, not in GA4.** Every tracked
  stub POSTs `{code, to, lang, type, os, browser, tz}` to
  `SHORT_LINK_COUNTER_URL` (build.py), the Web App in `apps-script/`, which
  appends a row to the tab **Acessos** of its spreadsheet ("Short links -
  mmendelson.com", folder *Garmin spreadsheets* in the owner's Drive;
  **Resumo** sums it per code, type, OS, browser, estimated country, language
  and day). GA4 cannot do this job: the
  stub shows no consent banner, a first-time visitor's hit goes out as
  `gcs=G100`, and GA4 leaves denied hits out of its reports below the
  behavioral-modeling threshold — measured on the live `/1/` on 2026-10-02.
  Read the counts in the sheet; read the journey (for consenting visitors) in
  GA4.
- **The counter is container-bound with scope `spreadsheets.currentonly`** —
  it can write its own sheet and nothing else. Being bound is also why
  `deploy-appsscript.yml` pins `SCRIPT_ID`: `clasp list-scripts` cannot see
  bound scripts. `DEPLOYMENT_ID` is derived from the URL in `build.py` and
  stored nowhere.
- **`doGet` is read-only by contract; only `doPost` writes**, and it refuses a
  code that is not 1–4 digits. `test=1` writes to the **Teste** tab instead of
  Acessos — use it to prove the path end to end without adding a count. The
  tab **Teste resumo** carries the same summary over Teste's rows, so a test
  POST also proves the formulas against real data.
- **What a hit records is deliberately coarse, and the owner chose it**: the
  page reduces the user agent to a device type, an OS family and a browser
  family (no versions, no device model), plus the device's time zone; the
  counter keeps type/OS/browser only if they are on its closed lists
  (`TYPES`/`OSES`/`BROWSERS` in Code.js) and turns the zone into an
  ESTIMATED country through `apps-script/Zones.js`. No IP, no third-party
  lookup. `check_build.py` fails if the stub starts sending a field beyond
  `code, to, lang, type, os, browser, tz` — a new field about the visitor
  has to be added on purpose. Gender cannot be observed by a page at all.
- **Each hit's time is in the sheet twice**: column A on the sheet's clock
  (the owner's, `America/Sao_Paulo`), column J on the visitor's, which the
  counter derives from the zone in H — the stub does not send it. A cell
  keeps a bare serial (the Date converted through the SHEET's zone when it is
  written), so `localTime_` shifts the instant by the offset difference.
  Only for zones in `Zones.js` (plus `UTC`): `Utilities.formatDate` silently
  reads an unknown zone id as GMT. J went last so adding it moved no column
  the Resumo QUERYs read; setup fills J for older rows that have a zone.
- **`apps-script/Zones.js` is generated** (`node tools/gen_zones.js`, from the
  machine's tzdata `zone.tab` + link aliases, country names from Node's ICU
  in pt-BR). Do not edit it by hand.
- **`setup()` runs itself.** Every POST checks a developer-metadata marker on
  Resumo against `SETUP_VERSION`; on a mismatch (or no Resumo) it runs setup
  AFTER the row is written, so a setup failure never costs a hit. To change
  the tabs or formulas: edit `setup()`, bump `SETUP_VERSION`, deploy — the next
  POST (a `test=1` is enough) applies it to the live sheet. No editor run.
- **Three things the live sheet taught, each cost a deploy:** (1) the sheet is
  pt_BR and `setFormula` with `,` came back `#ERROR!` in all three cells, so
  `writeFormula_` tries `,` and falls back to `;` outside the quoted query;
  (2) QUERY over an empty Acessos is an error for the per-day pivot, hence the
  `IFERROR(…, "Ainda sem acessos")`; (3) a Drive-created sheet starts on
  Pacific time and QUERY's `format` clause did not reach the cells — setup sets
  the sheet's zone from the script's (`America/Sao_Paulo`) and formats the day
  column itself.
- **The stub skips the counter under `navigator.webdriver`**, so automated
  browsers (`tools/analytics-family-check`, a Playwright run) are not counted
  as people. A Playwright test of the POST has to override it.
- **`node tools/test_counter.js`** runs `apps-script/` (Zones.js + Code.js)
  against a mocked SpreadsheetApp, including the upgrade of a v4 sheet; **`node
  tools/test_stub.js`** runs the BUILT `/1/` stub against real user agents
  (build first). Both live in `tools/`, not `apps-script/`, on purpose: `clasp
  push` uploads every `.js` under `apps-script/` as server code.
- **Short-link codes are permanent.** `TRACKED_SHORT_LINKS` slugs (`/1/`, …)
  go on paper and into QR codes; re-pointing one makes its history a lie.
  Retire a code, never reuse it — append new ones.
- **Redirect stubs that must keep the query string** are listed in
  `PRESERVE_QUERY_REDIRECTS`, not inferred: the watch-generated
  `/tracker/?trackId=…` links break silently without it.
