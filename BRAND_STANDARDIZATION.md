# Visual identity standardization — mmendelson.com family

**Status doc for a cross-repo initiative spanning `website` (hub), `apps-website`
(apps.mmendelson.com) and `corridas` (run.mmendelson.com).** This file is the
resumable source of truth: if a session runs out of budget or hits an error
mid-execution, re-read this file, check the phase checklists below, and
continue from the first unchecked item. Each phase is scoped to land as its
own PR (or a few small PRs) in its target repo, independently mergeable.

Owner note: this doc lives in `website` because it's the family hub, but it
governs all three repos. `apps-website/README.md` and `corridas/CLAUDE.md`
carry a one-line pointer back here (see Phase 0).

## Why / what triggered this

The three sites currently share almost nothing visually: three different
favicon mechanisms, three different (or absent) font systems, no consistent
header/footer chrome, and only `website` links to its siblings at all —
neither `apps-website` nor `corridas` link back to the hub. Full audit
findings are in the "Current state audit" section below.

## Decisions made (and the reasoning), so a resumed session doesn't re-litigate them

1. **Two brand tones, not one.** The hub keeps its warm gold identity
   (IBM Plex, `#d3a24f`). The **running context (`corridas`/run.mmendelson.com)
   gets its own distinct tone**, built around the shoe mascot that already
   exists there — per explicit user instruction ("hub would have one tone and
   the running stuff would have another one"). Apps gets a third, quieter
   tone rather than reusing either — see the color decision below.

2. **Color palette — direct answer to "which set is more premium."**
   Run's current palette is a generic sports-orange (`#FF6B35`) plus an
   uncoordinated scatter of one-off hexes (badge gradients, seasonal loading
   colors, plus the `gallery/` sub-page's own *independent* palette that
   doesn't even match the main app). That's the "terrible color set."
   Three candidates were considered:
   - **Candidate A — "Ember" (chosen).** Accent `#e0693a`, a refined
     terracotta/rust pulled directly from a color **already painted on the
     shoe mascot itself** (`shoe-wear.js`'s accent stripe, `#cf7a3e`) —
     background shifts to a cooler near-black (`#0e1013`) matching the
     mascot's own dark canvas. This is the most "premium" option because the
     accent isn't picked from a generic swatch — it's literally the mascot's
     own color, systematized. It also can't collide with Apps' accent (see
     below), whereas keeping orange would (Apps' `/tracker/`, `/live_tracker/`
     and `/privacy_policy/*` pages already hard-code `#f97316`, itself an
     orange).
   - Candidate B — "Slate & Coral" (`#ff5c5c` on a blue-slate bg pulled from
     the shoe's mesh-blue upper). Rejected: coral doesn't come from the
     existing artwork, so it doesn't earn its "premium" claim the way A does.
   - Candidate C — keep `#FF6B35`, just discipline the supporting palette.
     Rejected: doesn't solve the clash with Apps (which already leans orange
     in three of its pages), so the "two tones" instruction wouldn't hold.
   - **Recommendation: Candidate A.** Easy to swap the hex before
     implementation if a different pick is wanted — nothing below depends on
     the exact value, just on it being *one* deliberate accent instead of the
     current scatter.

   Apps gets **`#3b82f6` (blue)** — not invented for this project: it's
   already hard-coded in three of Apps' own pages (`/tracker/`,
   `/live_tracker/`, `/privacy_policy/*`) while the flagship `index.html` has
   no accent token at all today. Promoting it sitewide is the lowest-invention,
   highest-coherence choice.

   | Site | Accent | Source of the color |
   |---|---|---|
   | Hub (mmendelson.com) | `#d3a24f` (gold) | unchanged |
   | Apps (apps.mmendelson.com) | `#3b82f6` (blue) | already latent in 3 of its own pages |
   | Run (run.mmendelson.com) | `#e0693a` (ember/terracotta) | pulled from the shoe mascot's own accent stripe |

3. **Scope of "avoid using urls for each language" — hub only, not a
   migration of Apps/Run's i18n architecture.** This is the one place I'm
   making an explicit judgment call instead of asking again (the last two
   clarifying-question attempts were declined). Reasoning:
   - The sentence immediately follows "add the manual language selector in
     the hub" and reads as elaborating *that* feature: build the hub's new
     manual switch the same no-URL-fork way the hub's existing automatic
     EN/PT switch already works (single URL, `<html lang>` + CSS `:lang()`
     content toggling — this is already shipped in `website`).
   - Reading it instead as "rip out Apps' and Run's `/en/ /pt/ /es/ /de/ /fr/`
     URL-fork architecture" would be an enormous, separate, high-risk
     migration (breaks every existing inbound link, hreflang tags, sitemaps,
     and — for `corridas` specifically — contradicts that repo's own
     `CLAUDE.md`, which states the five-shell-per-language structure as
     foundational, load-bearing architecture, not an implementation detail).
   - **If this reading is wrong, say so and Phase 2/3's i18n work stops
     where it is (chrome/tokens only) until re-scoped** — nothing below
     depends on getting this right except the exact shape of Phase 1.

4. **"Shell only" restyle depth.** Apply shared tokens (fonts, spacing,
   radii, hairline-border discipline) and a shared brand-bar/footer
   *structural pattern* to all three sites, reusing each site's own accent.
   Each site's actual functional UI — Run's filter bar, Apps' carousel/nav,
   the tracker apps' own layouts — keeps its existing structure and menus,
   restyled only where the shared tokens naturally reach it. Per explicit
   instruction: "we must find a way to still allow the menus/sections they
   already have."

5. **Run's manual refresh button is removed**, per explicit instruction.
   Trade-off flagged for visibility: `corridas`'s `web/app.js` has no
   periodic auto-refresh timer today (data loads once on page load), so after
   this change the only way to get fresh data is a full page reload. Explicit
   instruction, so proceeding — flagging the trade-off, not blocking on it.

6. **Shoe as Run's brand icon + animated SVG favicon.** The shoe mascot
   (`corridas/web/gallery/shoe-wear.js` → `ShoeWear.SVG_MARKUP`, currently
   used as the loading-screen star and — already! — injected at runtime as
   the header logo via `SHOE_LOGO` in `app.js`) becomes Run's official brand
   mark. New work is the **favicon**: extract a simplified, static derivative
   (3–4 legible wear-marks, not all ~15 subtle grime layers — too fine to
   read at 16–32px) into a standalone `web/shoe-favicon.svg`, with a `<style>`
   block whose `@keyframes` fades those wear-marks in and out on
   `animation-direction: alternate; animation-iteration-count: infinite`
   (~7s cycle) — "goes back and forth on its use marks." Wired as
   `<link rel="icon" type="image/svg+xml">`, ahead of the existing raster
   `.ico`/`.png` links (kept as fallback).
   **Caveat to set expectations correctly:** animated SVG favicons render in
   current Chrome/Edge/Firefox; Safari's support is inconsistent and will
   likely just show a static first frame. That's a graceful, acceptable
   degrade (still shows the correct brand mark, just not animated) — not a
   blocker, but the user should know going in, since "if possible" was the
   framing.

7. **Manual language selector, hub only — expanded to all 5 languages
   (revised, superseding the original EN/PT-only scope).** Initial build was
   a 2-option `EN | PT` toggle; user clarified mid-build: "they" (apps/run)
   already support all 5 languages (de/en/es/fr/pt) via URL-fork folders —
   *replicate that language coverage into the hub*, using the button
   mechanism (not folders) as the delivery method. Landed as: a `DE EN ES FR
   PT` control in the hub's brand bar. Click sets
   `document.documentElement.lang` and persists the explicit choice
   (`localStorage.mm_lang`); the `<head>` script checks the stored override
   first, else detects from `navigator.language` against the same 5-code
   list apps.mmendelson.com's own i18n.js uses. All hub content translated
   into DE/ES/FR (previously only EN/PT existed) — see decision 3 for the
   explicit scope boundary (hub only; apps/run's existing URL-fork i18n is
   untouched) and `website/README.md`'s "Language support" section for the
   full mechanism + what's deliberately left untranslated (proper nouns,
   publication titles, discipline names, kind-tags, the fga/iesb/projecao
   teaching-institution pages).

8. **The pre-redesign `website` code is deleted, not just disabled.** The
   `SITE_VERSION` build flag (`"new"` vs. `"legacy"`) was built as a rollback
   safety net while the redesign was unproven; user confirmed it can now be
   dropped. Removed: `SITE_VERSION`/`CONTENT_NEW`, the legacy `PAGES`/`NAV`/
   `SOCIAL` tables, `build_legacy()`/`render_page()` (old)/`build_nav()`/
   `build_social()`, `templates/base.html` (old shell), `assets/css/
   style.css` (old styles, since renamed — see below), `assets/js/main.js`,
   and the now-fully-superseded `content/home.html`/`teaching.html`/
   `publications.html`/`extra-resources.html`. Also dropped as a direct,
   mechanical consequence (only ever referenced by the files just removed):
   5 orphaned `cropped-*` image assets and their entries in
   `ASSETS_NEEDED.md`/`tools/fetch_assets.sh`.
   **Renamed** (the "new" design is now the only one, so the `_new` suffix
   stopped meaning anything): `templates/base_new.html` → `templates/
   base.html`, `assets/css/style_new.css` → `assets/css/style.css`,
   `assets/js/site_new.js` → `assets/js/site.js`, `content/new/{home,
   teaching,publications}.html` → `content/{home,teaching,publications}.html`
   (flattened — `content/new/` no longer exists, so `build.py` no longer
   needs a two-tier content lookup). `NEW_PAGES`/`build_new()`/
   `render_new_page()`/`new_content_path()` renamed to `PAGES`/`build()`/
   `render_page()` (dropped `new_content_path()` entirely — direct
   `content/<slug>.html` reads now that there's only one copy). Verified via
   full rebuild + structural diff that output is unchanged apart from the
   intentional asset URL renames.

## Current state audit (source of the facts above — for reference, not re-reading required)

<details>
<summary>corridas / run.mmendelson.com</summary>

- **Shoe mascot**: `web/gallery/shoe-wear.js` — hand-built inline SVG
  (`SVG_MARKUP`, lines ~19–110), blue mesh upper (`#3b6ea3`/`#284f78`), orange
  accent stripe/heel tab (`#cf7a3e`), ~15 wear-layer `<g>` groups controlled by
  a `setProgress(0..1)` API (grime, dents, creases, abrasion, toe tear, etc.),
  exposed as `window.ShoeWear = { SVG_MARKUP, mount }`.
  - Used by `web/loading.js` for the full-page loading-screen animation
    (`setProgress` 0→1 over 8s, plus seasonal weather CSS in
    `web/style.css:1027-1253`).
  - Used by `web/app.js:1-13,1915` as the header logo (`SHOE_LOGO`, a
    string-replace of `SVG_MARKUP` injected into `.app-title`, always clean
    — wear layers never triggered there).
  - The **gallery page** (`web/gallery/index.html`) has its own independent
    palette (`#0f1115` bg, `#E4572E` accent) and its own webfonts
    (Archivo/Spectral) — currently inconsistent with the main app and a
    target for Phase 3's font/color unification.
- **Refresh button**: `<button class="btn-refresh" id="btnRefresh">` in every
  `web/{lang}/index.html` header (e.g. `web/en/index.html:56`). Wired at
  `web/app.js:2029-2035` — wipes `allCorridas`/`filteredCorridas`/card list
  and calls `loadData()`. Spin animation: `.btn-refresh.spinning` +
  `@keyframes spin` in `web/style.css:112-127`. **Verify before deleting**
  that `@keyframes spin` isn't reused elsewhere.
- **Colors** — `:root` in `web/style.css:4-27`: `--color-bg:#0f0f0f`,
  `--color-surface:#1a1a1a`, `--color-surface-2:#242424`,
  `--color-border:#2e2e2e`, `--color-accent:#FF6B35`,
  `--color-accent-dim:rgba(255,107,53,.15)`, `--color-text:#f0f0f0`,
  `--color-text-secondary:#a0a0a0`, `--color-green:#4caf50` (used once, "open"
  tag), `--color-red:#ef5350` (used once, "closed" tag), `--color-gray:#757575`
  (dead/unused), `--color-realized:#9e9e9e` (past-event styling),
  `--color-fotos`/`--color-fotos-dim` (dead/unused). Plus one-off hexes for
  World Athletics badge gradients (platinum/gold/elite/major —
  `style.css:956-972`, encode *real external meaning*, leave alone) and
  loading-screen seasonal weather colors (`style.css:1108-1245`, decorative,
  fine to leave or lightly desaturate to taste).
- **Header** (`web/en/index.html:49-58`): `.app-title` (shoe logo injected at
  runtime) + `.header-actions` = `.btn-apps` (external link to
  apps.mmendelson.com) + `#btnHome` 📍 (geo re-detect) + `#btnLang` 🌐
  (JS-built language dropdown, all 5 locales) + `#btnRefresh` ↻ (to remove).
  **No link to the hub (mmendelson.com) exists anywhere in this repo.**
- **Footer** (`web/en/index.html:271-274`): about blurb +
  `.footer-langs` (static 5-language cross-links, redundant with but
  independent of the header's JS dropdown — keep both, they serve
  no-JS/crawlability).
- **Fonts** — `web/style.css`: `--font-display:'Segoe UI',system-ui,
  -apple-system,sans-serif`, `--font-mono:'Courier New',Courier,monospace`.
  No webfont actually loads (a `<link rel="preconnect">` exists but no
  matching stylesheet link — dead leftover). Gallery loads its own
  Archivo/Spectral instead.
- **Favicon**: `web/favicon.ico` (multi-res ICO) +
  `web/logomendi-favicon.png` (actually a JPEG, 1191×1191, "Mendi" personal
  logo — unrelated to the shoe) + `web/manifest.json`
  (`theme_color:#FF6B35`). Referenced identically in all 5 locale shells +
  gallery.
- **All 5 `web/{lang}/index.html` are hand-maintained, structurally identical
  313-line files** (not generated from a shared template for the shell itself
  — two scripts inject *content* between HTML comment markers:
  `generate_prerender.py` writes the event list + JSON-LD,
  `generate_sitemap.py` writes `sitemap.xml`). Any header/footer/token change
  must be applied to all 5 files (+ gallery, tracker-adjacent pages if any).

</details>

<details>
<summary>apps-website / apps.mmendelson.com</summary>

- **Header** (`index.html:46-75`, byte-identical across all 6 locale
  copies): plain-text `<h1>Garmin Apps</h1>` — **no logo/brand image
  exists at all today.** Has a working 🌐 `.lang-selector` dropdown
  (`assets/js/i18n.js:520-568`) — contradicts an earlier assumption that Apps
  only auto-detects; it has a real manual switcher already, just URL-fork
  based (`/de/ /en/ /es/ /fr/ /pt/`, each a real navigation, not JS swap).
  Then a separate `<nav>` with a hamburger (mobile) + anchor links: Featured,
  Data Fields, Watch Faces, Live Tracker, Run Aggregator, Contact.
- **Footer** (`index.html:465-467`): `© 2026 M. Mendelson — Garmin Apps`,
  one line, **zero CSS rules apply to it anywhere** — a clean slate.
- **Fonts**: `assets/css/visual.css:5-7` — only `font-family: system-ui,
  sans-serif` on `body`, nothing else in the whole stylesheet. `/tracker/`
  and `/live_tracker/` each declare their *own*, different, unrelated font
  stacks inline — three-way inconsistency even within this one repo.
- **Favicon**: single file `assets/favicon.jpg`, referenced with
  **inconsistent MIME types** across pages (`image/png` on main site +
  `/tracker/`, `image/jpeg` on `/policy/ /privacy/ /privacy_policy/*
  /live_tracker/`). `404.html` has no favicon link at all.
- **Colors**: no sitewide token system. Two narrow `:root` blocks exist
  (`--loader-color` for a preloader, `--gym-*` for a decorative illustration)
  — neither is a design-token system. Hardcoded grays throughout
  (`#111` bg, `#1a1a1a` nav, `#eee` text, `#444`/`#555` buttons). The
  `#f97316`/`#3b82f6` pair is *already* hand-declared independently inline in
  `/tracker/index.html`, `/live_tracker/index.html` and all 5
  `/privacy_policy/{lang}/index.html` pages — but is completely absent from
  the flagship `index.html`/`visual.css` that most visitors land on first.
- **No manual refresh button anywhere** (confirmed via repo-wide grep) — both
  tracker apps use timer-only auto-refresh (5 min companion, 30s live map),
  with a passive "Refreshing…" status label, not a clickable control. Nothing
  to remove here.
- **Cross-site links**: exactly one — `index.html:452`, "Run Aggregator"
  section → `run.mmendelson.com`. **No link to the hub anywhere.**
- CNAME: `apps.mmendelson.com`.

</details>

<details>
<summary>website / mmendelson.com (hub — already largely done)</summary>

Already shipped this session, for reference: `templates/base.html` +
`assets/css/style.css` carry the "brandbar" (staircase logo mark, mono
wordmark, sticky/blurred, Home/Apps/Run switcher) and a matching footer
(contact link, social row, site switcher, copyright) — this is the
**structural pattern Phases 2 and 3 below reuse**, just re-accented and
re-logo'd per site. Fonts: IBM Plex Serif/Sans/Mono via Google Fonts,
already the sitewide standard. i18n: automatic 5-language (de/en/es/fr/pt)
via a `<head>` script checking `localStorage.mm_lang` then
`navigator.language` + CSS `:lang()` selectors toggling `<span lang="en">`/
`<span lang="pt">` pairs — Phase 1 extends this with a manual override.

</details>

## Phase checklist (resumable — check items off as they land)

### Phase 0 — this doc + cross-links
- [x] Write and commit this file (`website/BRAND_STANDARDIZATION.md`).
- [x] Add a one-line pointer to it in `apps-website/README.md`.
- [x] Add a one-line pointer to it in `corridas/CLAUDE.md` (its living
      architecture doc — more likely to be read there than a README).
- [x] `TaskCreate` entries mirroring Phases 1–4 below, so task state and this
      doc's checkboxes stay in sync (update both when a phase lands).

### Phase 1 — Hub: manual 5-language selector (`website`) — DONE, pending merge
- [x] Add a `DE EN ES FR PT` control to `.brandbar` (mono font, matches
      `.site-switch` visual language; wraps to its own line below 480px via
      an explicit `flex-basis:100%` break point — plain `flex-wrap` on the
      ancestor alone did not reliably wrap the whole `.brandbar-right` group
      in testing, see the CSS comment).
- [x] `<head>` script: check `localStorage.mm_lang` first, fall back to
      `navigator.language` against `['de','en','es','fr','pt']` (matching
      apps.mmendelson.com's own list), default `en`.
- [x] Click handler: set `document.documentElement.lang`, persist to
      `localStorage.mm_lang`, no navigation/reload (`assets/js/site_new.js`).
- [x] Translate all hub `.t` groups into DE/ES/FR (previously EN/PT only):
      home.html (19 groups), teaching.html (12, incl. 9× "items"),
      publications.html (5), template footer/breadcrumb. Wrapped the small
      legacy prose pages (`off`, `music-sheets`, `a-coxinha`) in `.t` for the
      first time (5 languages each). Left `cv.html` unwrapped (deliberately
      shows both real CV files' own language names, unaffected by UI
      language) and `fga`/`iesb`/`projecao` untouched (turns out already
      English-authored, not Portuguese as assumed — even easier to justify
      leaving as single-language).
- [x] CV button: added a CSS fallback so `de`/`es`/`fr` show the English CV
      link (only EN/PT files exist).
- [x] Verified all 5 language states render correctly (screenshot check,
      dark theme) on home/teaching/publications/a-coxinha; verified
      fga stays in its original language regardless of UI language; verified
      the legacy (`SITE_VERSION=legacy`) build is unaffected.
- [x] Update `website/README.md` (new "Language support" section).
- [ ] Reconcile with `main`, commit, PR → merge → verify live on
      mmendelson.com (all 5 languages + the button UI).

### Phase 2 — Apps: token foundation + shared chrome (`apps-website`)
Split into small PRs per subject, same discipline as prior work in this repo:
- [ ] **2a — Fonts.** Add IBM Plex Serif/Sans/Mono (Google Fonts link) to
      `index.html` + all 5 locale copies + `tracker/index.html` +
      `live_tracker/index.html` + `404.html` + `privacy_policy/*`. Swap
      `body{font-family:system-ui,sans-serif}` → IBM Plex Sans; add IBM Plex
      Serif for the `<h1>` title to match the hub/run serif-display
      convention; IBM Plex Mono anywhere numeric (carousel stats, if any).
- [ ] **2b — Design tokens + accent.** Introduce a sitewide `:root` in
      `visual.css` (`--bg,--bg2,--fg,--muted,--line,--accent:#3b82f6,
      --accent-ink`, light/dark via `prefers-color-scheme`), replacing
      hardcoded `#111/#1a1a1a/#eee/#444/#555` where safe. Reconcile the three
      independently-declared `#f97316`/`#3b82f6` blocks in `/tracker/`,
      `/live_tracker/`, `/privacy_policy/*` to reference the same shared
      values (still self-contained pages, so this may mean keeping local
      `:root` blocks but with values matching the new sitewide standard, not
      necessarily a shared stylesheet — decide during implementation based on
      how much refactor risk touching `live_tracker`'s complex inline styles
      is worth).
- [ ] **2c — Favicon.** Replace `assets/favicon.jpg` (wrong-MIME JPEG) with a
      proper multi-format set (`.ico` + 32/180/192 PNG), same discipline as
      the hub's `favicon.ico`/`favicon-*.png`. Default proposal: reuse the
      hub's staircase mark, recolored to Apps' blue accent (Apps wasn't
      singled out for its own mascot the way Run was) — flag as adjustable.
      Fix the MIME-type mismatches across all pages while touching this.
- [ ] **2d — Brand bar + footer.** Add the shared brand-bar structural
      pattern (logo mark + Home/Apps/Run switcher, Apps' blue accent) above
      or integrated with the existing `<h1>Garmin Apps</h1>` + language
      dropdown + hamburger nav — **keep all three of those intact**, just
      reflow/restyle. Build out the currently-empty footer with the shared
      pattern (social row + site switcher + copyright) — default proposal:
      same social set as the hub for consistency (same person); flag as
      adjustable if a Garmin-apps-specific subset is preferred.
- [ ] Update `apps-website/README.md`: new token doc + full path map
      (all top-level paths: `/`, `/{lang}/`, `/tracker/`, `/live_tracker/`,
      `/policy/`, `/privacy/`, `/privacy_policy/{lang}/`, `/404`).
- [ ] PR(s) → merge → verify live on apps.mmendelson.com.

### Phase 3 — Run: colors + fonts + chrome + refresh removal + shoe favicon (`corridas`)
Biggest phase; split per `corridas`'s strict one-PR-per-subject convention:
- [ ] **3a — Remove the refresh button.** Delete `#btnRefresh` markup from
      all 5 `web/{lang}/index.html`, its `app.js:2029-2035` listener, unused
      `refreshAriaLabel` i18n strings. Verify `@keyframes spin`/
      `.btn-refresh` CSS isn't reused elsewhere before deleting. Note the
      flagged trade-off (decision 5 above) in the PR description.
- [ ] **3b — Fonts.** Add IBM Plex Serif/Sans/Mono to all 5 locale shells +
      `gallery/index.html`. Swap `--font-display` → IBM Plex Sans,
      `--font-mono` → IBM Plex Mono. Decide during implementation whether
      `gallery/`'s Archivo/Spectral editorial pair is unified too (instructed
      as "same font across all systems" — default: yes, unify it) or kept as
      a deliberately distinct sub-experience (flag if keeping).
- [ ] **3c — Ember accent + token cleanup.** Set `--color-accent:#e0693a`
      (or the final agreed hex), shift `--color-bg`/`--color-surface*` to the
      cooler near-black family (`#0e1013`-ish), drop the two confirmed-dead
      vars (`--color-gray`, `--color-fotos*`). Leave World-Athletics badge
      gradients alone (real external meaning). Align `gallery/`'s independent
      `#0f1115`/`#E4572E` palette to the same tokens.
- [ ] **3d — Shared brand-bar chrome.** Add a Home/Apps cross-link pair in
      the new standardized style (Run currently has *no* link to the hub at
      all) alongside the existing 📍/🌐 controls (kept, they're app
      functionality, not chrome) — likely replacing/absorbing the current
      standalone `.btn-apps`. Extend the footer with the shared social-row +
      site-switcher block, **alongside** (not replacing) the existing about
      blurb + `.footer-langs` nav.
- [ ] **3e — Shoe favicon.** Build a small script (Python or Node, alongside
      the existing `scripts/`) that derives a simplified static
      `web/shoe-favicon.svg` from `shoe-wear.js`'s `SVG_MARKUP` (3–4 legible
      wear-marks, not all ~15) with an embedded `<style>`
      `@keyframes`/`alternate infinite` animation (~7s). Wire as
      `<link rel="icon" type="image/svg+xml">` ahead of the existing raster
      favicon links (kept as fallback) in all 5 locale shells + gallery.
      Verify: renders + animates in a headless-Chromium screenshot check;
      document the Safari-static-fallback caveat in the PR + README.
- [ ] Update `corridas/CLAUDE.md` and/or `README.md`: new token values, the
      removed refresh button + trade-off, the favicon mechanism + source
      script, full path map recap (this repo's paths are all within
      `web/{lang}/`, `web/gallery/`, plus the redirect-style ones already
      documented in `data-pipeline`/routing sections if any — confirm there's
      nothing else to map here, since `corridas` doesn't have the
      redirect-table pattern `website` has).
- [ ] Each sub-phase: its own PR, draft-PR-immediately + CI-green +
      auto-merge per this repo's existing workflow rules.

### Phase 4 — Cross-repo path map finalization
- [ ] Once Phases 1–3 are live, add/refresh a consolidated "family path map"
      table here (this file) listing every top-level path across all three
      domains plus the shared token values, so this doc is the definitive
      up-to-date reference (not just the plan).
- [ ] Cross-check the pointers added in Phase 0 still resolve and reflect
      final state.

## How to resume this if a session drops mid-phase

1. Read this file top to bottom (it's short enough).
2. Find the first unchecked `[ ]` box.
3. Check that sub-phase's target repo for any half-finished branch/PR
   (`git status`, `git log`, open PRs) before starting fresh — a previous
   session may have left work mid-flight.
4. Continue from there. Update this file's checkboxes as items land (same
   commit/PR as the code change where practical, so the doc never drifts
   from reality).
