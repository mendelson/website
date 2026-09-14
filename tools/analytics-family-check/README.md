# Family analytics check

Answers one question the three repos cannot answer separately: **does a visit
that walks `mmendelson.com` → `apps.mmendelson.com` → `run.mmendelson.com`
stay one measured journey, and does consent behave the way the banner
promises?**

```bash
bash tools/analytics-family-check/run.sh
```

## Why it is built this way

The answer depends on what the *browser* does with cookies across the three
hostnames, and a browser decides that by hostname — there is no way to fake it
from `localhost`. So the check serves all three sites over HTTPS from one
local process, routed by `Host` header, and points Chromium at it with
`--host-resolver-rules`. The pages believe they are on the real domains.

It runs **Google's actual `gtag.js`** (fetched once into `tagmanager/`), because
a stub cannot tell you what the real tag does with `cookie_domain`. Every
collection host resolves to the same local server, which answers `204` and
appends the request to `collected.log` — so a hit can be *seen* without ever
reaching the live property. `run.sh` prints that log at the end, and the
browser-side counter in the output says how many hits the tag attempted; an
empty log with a non-zero counter just means they died before the stub.

## What it asserts

- No GA cookie exists before consent; declining leaves it that way.
- Accepting writes `_ga` and `_ga_<stream>` **on `.mmendelson.com`**, not on
  the hub alone — that scope is the whole mechanism.
- apps and run see the **same client id**, and there is **one** session cookie
  for the journey rather than one per site.
- All three pages configure the same family measurement ID.
- Accepting grants the demographic (Google Signals) consent; a visitor who
  accepted the **v1** banner is asked again and keeps analytics-only until
  they answer — the ad signals are never switched on behind them.
- `ui_lang`, `ui_theme` and `display_mode` are sent (the three things GA4 does
  not collect by itself).
- Consent given on one site is honoured on the other two without a second
  prompt. **This is the check that earned the tool**: consent used to live in
  `localStorage`, which is per-origin, so apps and run silently ignored a
  choice made on the hub and kept sending in cookieless mode while the shared
  `_ga` cookie sat right there.
- `/1` still redirects to apps.

## Requirements

`python3`, `node` with `playwright` (set `NODE_PATH` for a global install),
`openssl`, `curl`, and the three repos checked out side by side — `website`,
`apps-website`, `corridas`. Point `MM_SITE_ROOTS` at them if they live
elsewhere: `MM_SITE_ROOTS='apps.mmendelson.com=/path/apps-website,...'`.

Not wired into CI: CI checks out this repo alone, and the whole point is the
other two.
