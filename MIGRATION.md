# Step-by-step: moving mmendelson.com from WordPress to GitHub Pages

**What this migration actually is:** the new static site is already built and
already running at <https://mendelson.github.io/website/>. WordPress (hosted
at GoDaddy) is still running too. "Migrating" means one thing: telling the
domain name `mmendelson.com` to stop pointing at the GoDaddy WordPress server
and start pointing at GitHub's servers. WordPress is never modified, so you
can undo everything in ~10 minutes at any point.

**You will use exactly two websites:**

| Platform | Where | What you do there |
|---|---|---|
| **GitHub** | github.com | Merge one pull request; type the domain into two settings pages |
| **GoDaddy** | dcc.godaddy.com | Edit DNS records for mmendelson.com |

**How to verify any step:** this repo has an automated checker
(Actions tab → *"Migration preflight checks"*). Every run prints a
**CUTOVER PROGRESS REPORT** with numbered lines telling you exactly what is
done and what isn't. You can also ask Claude to run it and read it for you.

---

## PART A — Preparation (do anytime; changes nothing visible)

### Step A1 — Tell GitHub you own the domain

*Why: prevents anyone else from claiming mmendelson.com on GitHub Pages.*

1. Go to **github.com**, log in as `mendelson`.
2. Click your **avatar (top-right) → Settings**.
3. In the left sidebar, click **Pages**.
4. Click **Add a domain**, type `mmendelson.com`, click **Add domain**.
5. GitHub now shows you a TXT record — a **hostname** like
   `_github-pages-challenge-mendelson.mmendelson.com` and a **value** (random
   letters/numbers). **Keep this tab open.**

### Step A2 — Add that TXT record at GoDaddy

1. In a new tab go to **dcc.godaddy.com**, log in.
2. Open **Domain Portfolio → mmendelson.com → DNS** (the DNS records page —
   the one listing rows of A / CNAME / TXT records).
3. Click **Add New Record** and fill in:
   - **Type:** `TXT`
   - **Name:** `_github-pages-challenge-mendelson`  *(GoDaddy adds the
     ".mmendelson.com" part itself — don't type it)*
   - **Value:** paste the random string from the GitHub tab
4. Click **Save**.

### Step A3 — Confirm

1. Wait ~10 minutes.
2. Back in the GitHub tab from A1, click **Verify**.
3. ✅ **Success looks like:** the domain appears with a green **Verified** badge.
4. Automated check: run the progress report — line **[1]** should say `DONE`.

---

## PART B — Cutover day (steps B1–B4 in one sitting, ~30–60 min)

### Step B1 — Merge the pull request (GitHub)

*This deploys the version of the site built for `mmendelson.com` instead of
the `/website` test address.*

1. Go to **github.com/mendelson/website → Pull requests** and open the
   migration PR (ask Claude to open it if it doesn't exist yet).
2. Click **Merge pull request → Confirm merge**.
3. ✅ **Success looks like:** the **Actions** tab shows a "Build and deploy"
   run turning green (~1 minute).
4. ⚠️ Heads-up: from now until B3 is done, the old test address
   `mendelson.github.io/website` will have broken menu links. That's
   expected — finish the remaining steps and it resolves itself.

### Step B2 — Bind the domain to the repository (GitHub)

1. Go to **github.com/mendelson/website → Settings** (tab at the top of the
   repo) **→ Pages** (left sidebar, under "Code and automation").
2. Find the **Custom domain** box, type `mmendelson.com`, click **Save**.
3. ✅ **Success looks like:** the page shows "DNS check in progress" or a
   ⚠️ "improperly configured" warning. **A warning here is normal and
   expected** — DNS still points at GoDaddy's WordPress. It turns green
   after step B3.

### Step B3 — Point the domain at GitHub (GoDaddy) ← the real cutover

1. Go to **dcc.godaddy.com → Domain Portfolio → mmendelson.com → DNS**.
2. Find the row: **Type `A` | Name `@` | Value `198.71.190.114`**.
   *(📸 Write this value down — it is your undo button.)*
3. Click the ✏️ **edit** icon on that row, change the value to
   `185.199.108.153`, save.
4. Click **Add New Record** three times to add three more A records
   (GitHub uses four servers):
   - Type `A` | Name `@` | Value `185.199.109.153`
   - Type `A` | Name `@` | Value `185.199.110.153`
   - Type `A` | Name `@` | Value `185.199.111.153`
5. Find the row **Type `CNAME` | Name `www` | Value `mmendelson.com`** and
   edit its value to `mendelson.github.io` (recommended by GitHub's docs).
6. **Do NOT touch any other row** — `apps`, `run`, `api`, TXT, MX, NS rows
   all stay exactly as they are.
7. ✅ **Success looks like (after ~10 min):** the progress report shows
   **[2] DONE** and **[4] GITHUB PAGES is serving the domain**.
   Or manually: open a **private/incognito window** (important — your normal
   browser has the old site cached for up to a month) and load
   `https://mmendelson.com` — you should see the new site.

### Step B4 — Turn on HTTPS enforcement (GitHub)

1. Go back to **github.com/mendelson/website → Settings → Pages**.
2. Wait until the custom-domain section shows the DNS check **green** and
   stops saying the TLS certificate is being provisioned (a few minutes up
   to ~1 hour — refresh occasionally).
3. Tick the **Enforce HTTPS** checkbox (it's greyed-out until the
   certificate is ready — if you can't tick it yet, wait and refresh).
4. ✅ **Success looks like:** progress report shows **[5] VALID** and every
   line of **[6]** is `200`. That's the finish line. 🎉

---

## 🔙 UNDO (rollback to WordPress, any time, ~10 minutes)

1. Go to **dcc.godaddy.com → Domain Portfolio → mmendelson.com → DNS**.
2. Delete the four `185.199.x.x` A records.
3. Add back: **Type `A` | Name `@` | Value `198.71.190.114`**.
4. If you changed `www` in B3.5, set its value back to `mmendelson.com`.
5. Within ~10 minutes WordPress is serving again. (GitHub-side settings can
   stay as they are; they do nothing while DNS points elsewhere.)

---

## PART C — After the cutover

- **Old site showing up?** Browsers that visited the WordPress site cache it
  for up to 31 days. Incognito always shows the truth. No action needed.
- **Keep the GoDaddy WordPress hosting for ~2 weeks** as a safety net. Then:
  log into wp-admin → **Tools → Export → All content** for a final content
  backup, download it, and cancel the WordPress *hosting* plan.
- **Never cancel** the domain registration or GoDaddy DNS — only the
  WordPress hosting is being retired.
- Once confident, delete `.github/workflows/preflight.yml` and this file.
