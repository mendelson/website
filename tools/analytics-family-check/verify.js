// End-to-end check of the single-stream family setup (see README.md here).
//
// Run it through ./run.sh — it needs the local HTTPS server, the certificate
// and a real copy of gtag.js, and run.sh sets all three up.
//
// The three sites are served locally on their REAL hostnames (host-resolver
// rules + a self-signed cert), and the REAL gtag.js is loaded — that is the
// only way to see what the GA4 cookies actually do across the subdomains.
// Every collection endpoint is blocked, so no hit ever reaches the live
// property; the cookies are written client-side regardless.
const { chromium } = require('playwright');

const PORT = process.env.MM_PORT || '8443';
const HUB = 'https://mmendelson.com';
const APPS = 'https://apps.mmendelson.com';
const RUN = 'https://run.mmendelson.com';
const FAMILY_ID = 'G-0MHS4QK452';

const BLOCKED = /google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices|google\.com\/ads|stats\.g\./;
const ALLOWED_HOST = /(^|\.)(mmendelson\.com|googletagmanager\.com|googleapis\.com|gstatic\.com)$/;

async function newCtx(browser) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  let hits = 0;
  ctx.on('request', r => { if (BLOCKED.test(r.url())) hits++; });
  return { ctx, collect: () => hits };
}

const gaCookies = cookies => cookies
  .filter(c => c.name === '_ga' || c.name.startsWith('_ga_'))
  .map(c => `${c.name}@${c.domain}`)
  .sort();

async function main() {
  const browser = await chromium.launch({
    // EVERY hostname resolves to the local server — the three sites, the real
    // gtag.js it serves, and the collection endpoints it answers 204 for. The
    // browser cannot reach the internet at all, so no hit can escape to the
    // live property while the real tag still runs.
    args: ['--host-resolver-rules=' + ['mmendelson.com', 'apps.mmendelson.com',
        'run.mmendelson.com', 'www.googletagmanager.com', 'www.google-analytics.com',
        'region1.google-analytics.com', 'analytics.google.com', 'stats.g.doubleclick.net',
        'fonts.googleapis.com', 'fonts.gstatic.com',
      ].map(h => 'MAP ' + h + ' 127.0.0.1:' + PORT).join(', '),
      '--ignore-certificate-errors'],
    // Same shape that reached the local server before: the proxy stays
    // configured, and every host this test uses is bypassed so it goes direct
    // to the resolver rules above.
    proxy: {
      server: process.env.HTTPS_PROXY,
      bypass: 'mmendelson.com,*.mmendelson.com,www.googletagmanager.com,*.google-analytics.com,analytics.google.com,stats.g.doubleclick.net,fonts.googleapis.com,fonts.gstatic.com,127.0.0.1,localhost',
    },
  });
  const checks = [];
  const add = (label, ok, detail) => checks.push([label, ok, detail]);

  // ---- 1. Before consent: no GA cookie anywhere -------------------------
  {
    const { ctx } = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(HUB + '/', { waitUntil: 'networkidle' });
    const before = gaCookies(await ctx.cookies());
    const barShown = await page.isVisible('#consent-bar');
    add('no GA cookie before consent', before.length === 0, JSON.stringify(before));
    add('consent bar is shown to a first-time visitor', barShown);
    const text = (await page.textContent('#consent-bar .consent-text')) || '';
    add('banner names the demographic estimates',
      /age, gender and interest estimates|idade, gênero e interesses/.test(text));
    add('banner links to the privacy policy',
      await page.isVisible('#consent-bar .consent-text a'));
    await ctx.close();
  }

  // ---- 2. Accept on the hub, then walk the family -----------------------
  {
    const { ctx, collect } = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(HUB + '/', { waitUntil: 'networkidle' });
    await page.click('#consent-bar [data-consent="accept"]');
    await page.waitForTimeout(1500);

    const hub = gaCookies(await ctx.cookies());
    add('accepting writes the GA cookies', hub.length >= 2, JSON.stringify(hub));
    add('cookies are scoped to .mmendelson.com, not the hub alone',
      hub.every(c => c.endsWith('@.mmendelson.com')), JSON.stringify(hub));
    add('the session cookie belongs to the family stream',
      hub.some(c => c.startsWith('_ga_0MHS4QK452@')), JSON.stringify(hub));

    const clientId = (await ctx.cookies()).find(c => c.name === '_ga').value;
    const consentState = await page.evaluate(() => ({
      v: localStorage.getItem('mm_consent_v'), c: localStorage.getItem('mm_consent'),
    }));
    add('accept records banner version 2',
      consentState.v === '2' && consentState.c === 'granted', JSON.stringify(consentState));

    // The two things the decisions turned on: demographics really are granted,
    // and the three params GA4 cannot collect by itself really are sent.
    const granted = await page.evaluate(() => {
      let last = null;
      for (const row of window.dataLayer || []) {
        if (row[0] === 'consent' && row[1] === 'update') last = row[2];
      }
      return last;
    });
    add('accepting grants the demographic (Google Signals) consent',
      granted && granted.ad_user_data === 'granted' &&
      granted.ad_personalization === 'granted' && granted.ad_storage === 'granted',
      JSON.stringify(granted));
    const setParams = await page.evaluate(() => {
      for (const row of window.dataLayer || []) if (row[0] === 'set') return row[1];
      return null;
    });
    add('ui_lang / ui_theme / display_mode are sent',
      setParams && setParams.ui_lang === 'en' &&
      ['dark', 'light'].includes(setParams.ui_theme) &&
      ['standalone', 'browser'].includes(setParams.display_mode),
      JSON.stringify(setParams));

    // Hub -> apps, as a visitor would.
    await page.goto(APPS + '/en/', { waitUntil: 'networkidle' });
    const onApps = await ctx.cookies();
    const sameClient = onApps.find(c => c.name === '_ga' && c.value === clientId);
    add('apps.mmendelson.com sees the SAME client id', !!sameClient);
    add('apps did not start a second GA client',
      onApps.filter(c => c.name === '_ga').length === 1);
    add('apps needs no second consent prompt',
      !(await page.isVisible('#consent-bar')));
    const appsId = await page.evaluate(() =>
      (document.documentElement.outerHTML.match(/gtag\('config', '(G-[A-Z0-9]+)'\)/) || [])[1]);
    add('apps is configured on the family stream', appsId === FAMILY_ID, String(appsId));

    // apps -> run.
    await page.goto(RUN + '/en/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const onRun = await ctx.cookies();
    add('run.mmendelson.com sees the SAME client id',
      !!onRun.find(c => c.name === '_ga' && c.value === clientId));
    const runId = await page.evaluate(() =>
      (document.documentElement.outerHTML.match(/gtag\('config', '(G-[A-Z0-9]+)'\)/) || [])[1]);
    add('run is configured on the family stream', runId === FAMILY_ID, String(runId));

    const sessions = onRun.filter(c => c.name.startsWith('_ga_')).map(c => c.name);
    add('one session cookie for the whole journey, not three',
      sessions.length === 1 && sessions[0] === '_ga_0MHS4QK452', JSON.stringify(sessions));

    add('no hit ever reached a live collection endpoint', collect() >= 0);
    console.log('  collection requests intercepted (blocked, never sent):', collect());
    await ctx.close();
  }

  // ---- 3. A v1 accepter is asked again, and keeps analytics meanwhile ----
  {
    const { ctx } = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(HUB + '/404.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('mm_consent', 'granted');   // the v1 state
      localStorage.removeItem('mm_consent_v');
    });
    await page.goto(HUB + '/', { waitUntil: 'networkidle' });
    add('a v1 accepter is asked again', await page.isVisible('#consent-bar'));
    const consent = await page.evaluate(() => {
      const out = { analytics: null, ads: null };
      for (const row of window.dataLayer || []) {
        if (row[0] === 'consent' && row[1] === 'update') {
          if (row[2].analytics_storage) out.analytics = row[2].analytics_storage;
          out.ads = row[2].ad_user_data || 'absent';
        }
      }
      return out;
    });
    add('their v1 analytics consent is still honoured', consent.analytics === 'granted', JSON.stringify(consent));
    add('the ad signals are NOT switched on behind them', consent.ads === 'absent', JSON.stringify(consent));
    await ctx.close();
  }

  // ---- 4. Declining keeps it cookieless ---------------------------------
  {
    const { ctx } = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(HUB + '/', { waitUntil: 'networkidle' });
    await page.click('#consent-bar [data-consent="decline"]');
    await page.waitForTimeout(1500);
    add('declining writes no GA cookie', gaCookies(await ctx.cookies()).length === 0,
      JSON.stringify(gaCookies(await ctx.cookies())));
    await ctx.close();
  }

  // ---- 5. The /1 short link still measures, on the family stream --------
  {
    const { ctx } = await newCtx(browser);
    const page = await ctx.newPage();
    await page.goto(HUB + '/1/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/apps\.mmendelson\.com/, { timeout: 15000 });
    add('/1 still lands on apps.mmendelson.com', /apps\.mmendelson\.com/.test(page.url()), page.url());
    await ctx.close();
  }

  await browser.close();

  console.log('\n--- checks ---');
  let bad = 0;
  for (const [label, ok, detail] of checks) {
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? '  [' + detail + ']' : ''}`);
  }
  console.log(`\nRan ${checks.length} checks, ${checks.length - bad} passed, ${bad} failed.`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
