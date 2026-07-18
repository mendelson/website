# Analytics & event tracking — mmendelson.com family

**Status: IN PROGRESS — code shipped on all three sites (2026-07-18); account-side GA setup + verification pending.** A cross-repo plan to bring detailed,
*consistent* analytics to all three sites — `website` (hub), `apps-website`
(apps.mmendelson.com) and `corridas` (run.mmendelson.com). Companion to
[`BRAND_STANDARDIZATION.md`](BRAND_STANDARDIZATION.md); same resumable format —
re-read this file, find the first unchecked box, continue.

This file governs all three repos. When work lands, tick the box in the same
PR so the doc never drifts from reality.

## Why / what triggered this

"Detailed tracking everywhere." Today the three sites are wildly inconsistent:

- **apps** already has **GA4 (`G-0MHS4QK452`) with ten rich custom events** —
  `payment_method_click`, `featured_slide_view`, `search`, `card_click`,
  `ciq_click` (the store-click conversion), `app_version_click`, `tooltip_open`,
  `contact_click`, `scroll_depth`, `featured_cta_click`. It is the reference
  implementation. Gaps: GA is present only on `index.html` + `/tracker/`, not on
  `/live_tracker/`, `/404.html`, or `/privacy_policy/*`; and there is **no
  consent gate**.
- **hub** has **no analytics at all.**
- **run** has **no analytics at all** (it is on Cloudflare Pages).
- **Privacy**: the apps privacy policy covers *Garmin app* data only — it does
  **not** disclose website analytics or cookies, and GA is already running.
  hub and run have **no** privacy/cookie notice at all. Adding tracking to a
  worldwide (EU-inclusive) audience makes a consent + disclosure layer
  mandatory, and it is *already* a latent gap on apps today.

The goal: every meaningful user action, on every site, captured under **one
consistent event schema**, so cross-site funnels (hub → apps / run, and the
in-app conversions) are answerable — done privately and compliantly.

## Decisions to confirm before implementation (Phase 1 depends on these)

### Decision 1 — analytics tool. **Recommended: extend the existing GA4** (with Consent Mode v2), not a rip-and-replace.

apps is already deeply wired to GA4 with a good custom-event pattern. Three options were weighed:

| Option | Detailed custom events | No cookie banner needed | Cost / ops | Verdict |
|---|---|---|---|---|
| **A — GA4 everywhere (chosen)** | ✅ (already proven on apps) | ⚠️ needs Consent Mode v2 + a minimal banner in the EU | Free | **Recommended** — reuses proven infra; one property → cross-site funnels; the consent work is needed anyway to fix the current apps gap |
| B — Plausible / Umami (privacy-first) | ✅ | ✅ (cookieless, no banner) | Plausible ~$9/mo, or Umami self-hosted (server + DB to run) | Cleaner privacy, but throws away apps' working GA and adds cost or ops |
| C — Cloudflare Web Analytics | ❌ limited custom events | ✅ | Free (run already on CF) | Fails the "detailed" requirement — pageviews, not rich events |

**Recommendation A.** One **GA4 property**, three **web data streams** (hub /
apps / run), **cross-domain measurement** enabled across the three domains so a
hub → run/apps journey is one session. `G-0MHS4QK452` becomes the apps stream;
add hub + run streams under the same property. Nothing below depends on the
exact tool except the loader + consent mechanics (Phase 1) — the **event
taxonomy is tool-agnostic**, so switching to B later is a Phase-1-only rework.

### Decision 2 — consent model. **Recommended: GA4 Consent Mode v2 + a slim banner.**

Load gtag with `analytics_storage: 'denied'` by default → GA sends **cookieless
pings** (aggregate, no identifiers) until the visitor accepts. A small,
dismissible banner (Accept / Decline) flips consent; the choice persists in
`localStorage`. Decline keeps cookieless pings only. This is GDPR-defensible
*and* still yields usable numbers pre-consent. (If Decision 1 → B, no banner is
needed and this decision is moot.)

### Decision 3 — one shared event schema, one tiny helper per repo.

Every site ships a minimal `track(event, params)` wrapper over `gtag` (or the
Plausible API) so event **names and parameter keys are identical everywhere**
and consent is checked in one place. No raw `gtag('event', …)` scattered around
— apps' existing calls get routed through the helper during Phase 2.

## Shared event taxonomy (tool-agnostic)

`snake_case` names; small, **non-PII** parameter sets (never log full search
strings, emails, or `trackId`/`user` values — see the privacy rules below).

### Universal — every site

| Event | Params | Fires when |
|---|---|---|
| `page_view` | (automatic) | page load |
| `site_switch_click` | `to_site` (home/apps/run), `location` (header/footer) | family switcher clicked |
| `language_change` | `to_lang`, `method` (globe/auto) | language switched |
| `outbound_click` | `host` (domain only, no full URL/query) | any non-family external link |
| `scroll_depth` | `percent` (25/50/75/100) | scroll milestones |

### Hub (`website`)

| Event | Params |
|---|---|
| `project_card_click` | `project` (apps/run) |
| `cv_click` | `cv_lang` (en/pt) |
| `social_click` | `network` |
| `teaching_discipline_click` | `discipline` |
| `more_link_click` | `section` (teaching/publications) |
| `contact_click` | — |

### Apps (`apps-website`) — mostly exists; standardize + fill gaps

Keep the existing ten events (rename only for schema consistency where noted),
route them through the helper, and add the universal set. Key conversion:
**`ciq_click`** (Connect IQ store). Existing: `payment_method_click`,
`featured_slide_view`, `search` (log `query_length`, not the query),
`card_click`, `ciq_click`, `app_version_click`, `tooltip_open`, `contact_click`,
`scroll_depth`, `featured_cta_click`. Add: `nav_click` `{target}`,
`site_switch_click`, `language_change`. Tracker sub-apps: `track_submit`
`{has_trackid: bool}` (never the id itself).

### Run (`corridas`) — all new

| Event | Params | Note |
|---|---|---|
| `search` | `query_length` | never the query text |
| `filter_change` | `filter_type` (distance/state/source), `value` | the core interaction |
| `card_expand` | `event_id` | opaque id only |
| `registration_click` | `source`, `host` | **key conversion** — the `btn-inscricao` outbound |
| `source_button_click` | `source` | which fonte the user picked |
| `geo_detect` | `method`, `country` | IP-geo pipeline outcome (country only) |
| `gallery_view` | — | on `/gallery` |

## Per-site implementation notes

- **Hub** (`build.py` / `templates/base.html`): add the loader + consent to the
  base template so all pages inherit it; wire hub events in `assets/js/site.js`
  (it already handles the lang globe and nav). Single-URL i18n means the lang
  event is a JS hook, not a navigation.
- **Apps** (`index.html` head + `assets/js/script.js`): GA is already here —
  add Consent Mode init *before* the config, add the missing pages
  (`live_tracker`, `404`, privacy stubs), and route existing `gtag('event',…)`
  through the shared helper. `gen-index-pages.js` propagates head changes to the
  five language copies; keep the loader in `index.html` so it does.
- **Run** (`web/{lang}/index.html` + `web/app.js`): add the loader/consent to
  all five shells (and `gallery/index.html`) and a `track()` helper in `app.js`;
  instrument the filter bar, search, card expand, the registration button
  (`app.js:~1717`), source buttons, and the geo pipeline. Respect the PWA:
  the loader must not block first paint (async, after the loading screen).

## Privacy & consent (mandatory — also fixes a current gap)

1. **Disclose analytics.** Extend the apps privacy policy with an "Analytics &
   cookies" section (what GA4 collects, why, opt-out); add a short cookie/
   analytics notice to hub and run (they have none today). Regenerate the apps
   policy via `scripts/gen-privacy-policy.js`; add the notice to the hub base
   template and the run shells.
2. **Consent gate** (Decision 2): Consent Mode v2 default-denied + slim banner
   on all three; persist choice in `localStorage`; provide a "reset consent"
   link in each privacy notice.
3. **No PII, ever.** Never send search text, emails, `trackId`, LiveTrack
   `user`, or full outbound URLs with query strings. Parameters are bucketed
   (`query_length`, `host`, `country`, `percent`) — enforce this in the helper.
4. IP anonymization is on by default in GA4; keep Google Signals **off** unless
   separately justified and disclosed.

## Phase checklist (resumable — tick as it lands)

> **Remaining (account-side, only the owner can do):** verify in GA4
> **DebugView** and the Rich Results / consent checks in Phase 6.

One GA4 property ("Motionforge", account-level), three distinct web streams —
each site now reports under its own Measurement ID (2026-07-18):

| Site | Stream | Measurement ID |
|---|---|---|
| Hub (`mmendelson.com`) | mmendelson.com | `G-V6JSLPQV66` |
| Apps (`apps.mmendelson.com`) | Motionforge Apps | `G-0MHS4QK452` |
| Run (`run.mmendelson.com`) | run.mmendelson.com | `G-C9QHPB8WZR` |

### Phase 0 — this doc + decisions
- [x] Commit this file.
- [x] Confirm Decisions 1–3 (tool, consent model, shared-helper approach).
- [x] Create/point the GA4 property + three data streams; run/hub measurement
      IDs noted above.
- [ ] `TaskCreate` entries mirroring Phases 1–5.

### Phase 1 — shared tracking helper + consent (all repos, one small module each)
- [x] `track(event, params)` wrapper with identical API in each repo; strips/
      buckets params so no PII can leave; no-ops until consent (or cookieless
      per Consent Mode).
- [x] Consent Mode v2 default-denied init + slim Accept/Decline banner,
      `localStorage`-persisted, with a reset hook. (Skip the banner if Decision
      1 → privacy-first tool.)

### Phase 2 — apps (reference; least new work)
- [x] Add Consent Mode init before the existing GA config.
- [x] Add GA + helper to `live_tracker/`, `404.html`, `privacy_policy/*`.
- [x] Consent Mode makes the ten existing events consent-aware; added
      `site_switch_click`, `language_change`, `nav_click` via the shared
      helper (existing calls left in place — they already work). `track_submit` deferred.
- [x] Cache-buster bump; `gen-index-pages.js` re-run for the five copies.

### Phase 3 — run (all new)
- [x] Loader + consent in the five shells + `gallery/index.html`.
- [x] `web/analytics.js` (shared `mmTrack`) instruments search, `filter_change`,
      `card_expand`, **`registration_click`**, `gallery_view` + universal events
      via delegation. `source_button_click` folded into `registration_click`;
      `geo_detect` deferred (avoids touching the geo pipeline).

### Phase 4 — hub (all new)
- [x] Loader + consent in `templates/base.html`.
- [x] Hub events in `assets/js/site.js`: project cards, cv, social, teaching,
      more-links, contact, `site_switch_click`, `language_change`, scroll_depth.

### Phase 5 — privacy/consent + docs
- [x] apps privacy policy: "Website analytics & cookies" section (regenerated, 18 Jul 2026).
- [x] hub + run: consent bar (the notice) + footer "Cookies" reset link.
- [ ] Update this doc's final "event map" table with anything added during
      implementation; cross-link from each repo README.

### Phase 6 — verification
- [ ] GA4 **DebugView** shows each event firing on each site.
- [ ] Cross-domain: a hub → run/apps click is one session (funnel works).
- [ ] Consent: pre-accept = cookieless pings only; decline stays cookieless;
      accept sets cookies. Banner persists the choice.
- [ ] PII audit: inspect outgoing hits — no query text, emails, ids, or full
      URLs. `registration_click` / `ciq_click` conversions register.

## How to resume if a session drops mid-phase
1. Read this file top to bottom.
2. Find the first unchecked `[ ]`.
3. Check that phase's target repo for a half-finished branch/PR before starting.
4. Continue; tick boxes in the same PR as the code so the doc never drifts.
