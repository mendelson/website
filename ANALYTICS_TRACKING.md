# Analytics & event tracking — mmendelson.com family

**Status: IN PROGRESS — code shipped on all three sites (2026-07-18); consolidated onto ONE measurement stream with demographics enabled (2026-09-14); account-side GA setup + verification pending.** A cross-repo plan to bring detailed,
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

**Recommendation A.** One **GA4 property** for all three sites. Nothing below
depends on the exact tool except the loader + consent mechanics (Phase 1) — the
**event taxonomy is tool-agnostic**, so switching to B later is a Phase-1-only
rework.

> **Superseded on 2026-09-14 — read the stream table below before this
> paragraph.** This originally said *three* data streams plus cross-domain
> measurement. Both halves were wrong for this family: three streams mean three
> session cookies and therefore three sessions per journey, and cross-domain
> measurement is for genuinely different domains — these three are subdomains of
> one, where the cookies are shared automatically. The three sites now share a
> single measurement ID.

### Decision 2 — consent model. **Recommended: GA4 Consent Mode v2 + a slim banner.**

Load gtag with `analytics_storage: 'denied'` by default → GA sends **cookieless
pings** (aggregate, no identifiers) until the visitor accepts. A small,
dismissible banner (Accept / Decline) flips consent. Decline keeps cookieless
pings only. This is GDPR-defensible *and* still yields usable numbers
pre-consent. (If Decision 1 → B, no banner is needed and this decision is moot.)

**Banner v2 (2026-09-14) — two changes, both forced by decisions above.**

1. **Accepting now also grants `ad_storage`, `ad_user_data` and
   `ad_personalization`**, because that is what Google Signals needs and
   Signals is what produces the age / gender / interest estimates. The banner
   text on all three sites names those estimates, and links to the family
   privacy policy — consent for something the visitor was not told about is
   not consent. `mm_consent_v` records **which banner version** was answered:
   a visitor who accepted v1 consented to analytics only, so they keep
   analytics and are **asked again**, rather than having the wider scope
   switched on behind them.
2. **The record is a cookie on `.mmendelson.com`, not `localStorage`.**
   localStorage is per **origin**, and the hub, apps and run are three origins
   — so a visitor who accepted on the hub was asked again on apps, and, once
   the three shared one measurement, apps went on sending in *denied* mode
   while the `_ga` cookie the hub had already written sat right there. The
   family check caught exactly this. localStorage stays as the fallback for
   hosts where the family domain cannot be set (a local preview, the
   `github.io` project URL) and for visitors who answered before the change.

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
| `short_link_click` | `code` (the slug, e.g. `1`), `to_site` (apps/run/home or the host) |

`short_link_click` fires on the **tracked short links** (`TRACKED_SHORT_LINKS`
in `build.py`; `/1` → apps.mmendelson.com is the first). Those slugs exist to
be printed, put in a QR code or dropped in a bio, so the question they have to
answer is "how many people came in through *this* one". The stub records a
`page_view` for the slug (referrer, country, device and timestamp come with it)
plus this event for the code, then redirects.

Since the family shares one stream, the hop no longer ends the session: `/1`
becomes the session's **landing page** and everything the visitor then does on
apps is the same session. That is what makes the funnel answerable without
tagging the destination with `utm_*` — and tagging it would actively hurt, by
starting a fresh campaign session at the hop and cutting the journey in two. It waits
for `event_callback` before navigating, capped at 700 ms, with a 1200 ms hard
ceiling if gtag never loads — measured at 102 ms in the normal case. Consent
Mode defaults are the same as every other page, so a pre-consent hit is a
cookieless ping. Mechanics and the measured numbers: the *Tracked short links*
section of [`README.md`](README.md).

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

## What GA4 collects by itself, and what we send

The rule is rule 6: **do not send what the artifact already contains.** Every
custom dimension costs one of a capped 50 and, worse, creates a second source
of truth that can disagree with the first. So the site sends almost nothing
about the visitor — GA4 already derives it from the request:

| Already automatic — do NOT send it | Where it comes from |
|---|---|
| Country, **region/state**, city | IP geolocation |
| Language | browser `Accept-Language` |
| Browser + version, OS + version | user agent |
| Device category, brand, model, screen resolution | user agent / client hints |
| **Which of the three sites** | the `Hostname` dimension |
| Referrer, source / medium / campaign, landing page | the request + `utm_*` |
| First visit vs returning, engagement time, page path | the tag |

Three things it genuinely cannot know, so the head block sends them with every
event via `gtag('set', …)`:

| Param | Why GA4 cannot derive it |
|---|---|
| `ui_lang` | GA4 records the **browser's** language. All three sites let the visitor override it (the hub's globe writes `mm_lang`; apps and run fork by URL), so the language actually **rendered** is a different fact |
| `ui_theme` | `prefers-color-scheme` never reaches the server |
| `display_mode` | whether run's PWA was opened **installed** or as a tab |

**Age and gender are neither.** They come from **Google Signals**, which is an
account-side switch, not code: Google supplies its own estimates for visitors
signed in to a Google account with Ads Personalization on. Three caveats worth
writing down before reading a demographics report:

- they are **Google's inferences**, never anything a visitor told this site;
- they exist only for the signed-in subset **who accepted** the v2 banner;
- GA4 applies **data thresholding** — rows are withheld entirely when the
  numbers are small enough to risk identifying someone. On a personal site's
  traffic, expect the demographics report to be sparse or empty for a while.
  That is the mechanism protecting visitors, not a broken setup.

## Where each answer lives in GA4

| Question | Where |
|---|---|
| Country / region / city | Reports → User → **User attributes → Demographic details**, or any report with the Country/Region/City dimension |
| Browser, OS, device, screen | Reports → Tech → **Tech details** |
| Language (browser) | Reports → User attributes → Demographic details → *Language* |
| Language **rendered** | any report, once `ui_lang` is registered as a custom dimension |
| **Age / gender / interests** | Reports → User → User attributes → **Demographic details** (needs Google Signals ON, and survives thresholding only with enough traffic) |
| How many came through `/1` | Reports → Engagement → **Pages and screens**, page path `/1/`; or the `short_link_click` event |
| Which entry a session came from | Reports → Acquisition → **Traffic acquisition** (source/medium), and the session's **Landing page** — `/1/` for the short link, a Google result for organic, `(direct)` for a typed URL or a QR scan |
| **The journey across the three sites** | Explore → **Path exploration**, node type *Page path* — one session now spans the hub, apps and run, so the path is continuous; add `Hostname` as a breakdown to see the site changes |
| Which buttons a visit clicked | Explore → Path exploration with node type **Event name**, or Reports → Engagement → **Events** filtered by session |
| A single visitor's sequence | Explore → **User explorer** (needs consent; a cookieless visitor has no id to follow) |

**Sessions only exist for visitors who accepted.** Consent Mode denied means
cookieless pings: they are counted, and they are aggregate — no client id, so
no journey, no user explorer, no returning-visitor status. Everything in the
journey rows above is about the accepted subset.

## Account-side steps (only the owner can do these)

Code cannot do any of these, and the data they unlock does not backfill:

1. **Google Signals ON** — Admin → Data collection and modification → Data
   collection. This is what turns on age/gender/interests. The banner and the
   privacy policy already disclose it (Decision 2).
2. **Register the custom dimensions** — Admin → Custom definitions → Create
   custom dimension, event-scoped, one each for `ui_lang`, `ui_theme`,
   `display_mode`, `code` (the short-link slug) and `to_site`. Until a
   parameter is registered it is visible **only** in DebugView and Realtime,
   never in standard reports, and registering it does **not** backfill —
   dimensions only apply from the day they are created.
3. **Data retention → 14 months** — Admin → Data retention. The default is 2
   months for user-level data, which quietly makes any journey older than that
   unexplorable.
4. **Unwanted referrals** — Admin → Data streams → the stream → Configure tag
   settings → List unwanted referrals → add `mmendelson.com`. Stops the family
   from being recorded as its own traffic source.
5. **Rename the stream** — it is still called "Motionforge Apps" but now
   receives all three sites; something like "mmendelson.com (family)" stops the
   next reader from mis-attributing it.
6. **Leave the other two streams alone.** `G-V6JSLPQV66` and `G-C9QHPB8WZR`
   keep what they collected before 2026-09-14. Deleting them deletes that
   history.

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
   on all three; the choice persists in a cookie on `.mmendelson.com` so it is
   answered **once for the family** (localStorage is the fallback); a "reset
   consent" link in each footer.
3. **No PII, ever.** Never send search text, emails, `trackId`, LiveTrack
   `user`, or full outbound URLs with query strings. Parameters are bucketed
   (`query_length`, `host`, `country`, `percent`) — enforce this in the helper.
   Google Signals does not change this: it adds Google's own aggregate
   estimates, and nothing a visitor enters here is ever sent.
4. IP anonymization is on by default in GA4. **Google Signals is ON as of
   2026-09-14**, which is the "separately justified and disclosed" case this
   line always allowed for: justified by wanting audience demographics,
   disclosed in the v2 banner on all three sites and in the family privacy
   policy, and gated behind an explicit Accept that also re-asks anyone who
   only ever answered the v1 banner.

## Phase checklist (resumable — tick as it lands)

> **Remaining (account-side, only the owner can do):** the six steps under
> *Account-side steps* above — Signals, the custom dimensions, 14-month
> retention, unwanted referrals, the stream rename — plus the DebugView and
> consent checks in Phase 6.

**ONE stream for the whole family (2026-09-14).** All three sites send to
`G-0MHS4QK452`:

| Site | Measurement ID |
|---|---|
| Hub (`mmendelson.com`) | `G-0MHS4QK452` |
| Apps (`apps.mmendelson.com`) | `G-0MHS4QK452` |
| Run (`run.mmendelson.com`) | `G-0MHS4QK452` |

**Why the three streams were collapsed into one.** They were always in the same
property, but a property is not a session. GA4 keys the session on a
`_ga_<measurement-id>` cookie, so each site minted its own: a visitor going hub
→ apps → run produced **three sessions**, each attributed to a referral from
the site before it, and no standard report could put the journey back together.
The three sites are subdomains of one domain, so the fix costs nothing —
gtag's default `cookie_domain: 'auto'` puts `_ga` and `_ga_0MHS4QK452` on
`.mmendelson.com`, which all three read. One client id, one session, one
journey, and no cross-domain linker to configure (that is for *different*
domains; these are not).

`G-0MHS4QK452` was kept rather than minting a new id because it is the oldest
stream and carries the conversion history (`ciq_click`). The other two streams
still hold what they collected before this date — nothing was deleted, it is
simply not added to. **Which site a hit came from is the built-in `Hostname`
dimension**, so nothing has to be sent to say so, and it works retroactively
over the old data too (rule 6).

Proof rather than assertion: `tools/analytics-family-check/run.sh` in this repo
serves the three sites on their real hostnames, runs Google's actual `gtag.js`,
and asserts the cookies land on `.mmendelson.com` and that apps and run see the
same client id — 23 checks, no hit ever leaving the machine.

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

### Phase 7 — one family stream + demographics (2026-09-14)
- [x] All three sites configure `G-0MHS4QK452`; the hub's id has one definition
      (`GA_MEASUREMENT_ID` in `build.py`) and reaches every generated page
      through `{{GA_ID}}`.
- [x] Consent moved off per-origin `localStorage` onto a `.mmendelson.com`
      cookie, so it is answered once for the family and apps/run stop ignoring
      a choice made on the hub.
- [x] Banner v2 on all three sites (7 languages on apps, 5 on hub and run):
      names the demographic estimates, links to the privacy policy, grants the
      ad signals on Accept, and re-asks anyone who only answered v1.
- [x] `ui_lang`, `ui_theme`, `display_mode` sent via `gtag('set', …)`.
- [x] Family privacy policy rewritten (7 languages) — covers all three sites,
      discloses Signals, the thresholding and what declining leaves.
- [x] `tools/analytics-family-check/run.sh` — 23 browser checks against the
      real `gtag.js` on the real hostnames, no hit leaving the machine.
- [ ] The six account-side steps above.
- [ ] Confirm in DebugView that one journey = one session, and that the
      demographics report populates (or is thresholded — check which).

## How to resume if a session drops mid-phase
1. Read this file top to bottom.
2. Find the first unchecked `[ ]`.
3. Check that phase's target repo for a half-finished branch/PR before starting.
4. Continue; tick boxes in the same PR as the code so the doc never drifts.
