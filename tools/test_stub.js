// Runs the BUILT short-link stub (public/1/index.html) against real user
// agents in a sandbox and checks what it POSTs to the counter.
//   python3 tools/check_build.py && node tools/test_stub.js
// Every value the stub can send for type/os/browser must be on the counter's
// closed lists (apps-script/Code.js), or the server would blank it.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', '1', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const stub = scripts.find((s) => s.includes("getElementById('mm-go')"));
if (!stub) throw new Error('no stub script in public/1/index.html — build first');

const lists = {};
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.js'), 'utf8'), ctx);
  lists.type = ctx.TYPES; lists.os = ctx.OSES; lists.browser = ctx.BROWSERS;
}

function run(ua, opts = {}) {
  const posts = [];
  const ctx = {
    navigator: { userAgent: ua, language: 'pt-BR', maxTouchPoints: opts.touch || 0, webdriver: !!opts.webdriver },
    URLSearchParams,
    Intl: opts.tzThrows
      ? { DateTimeFormat() { throw new Error('no Intl'); } }
      : { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: opts.tz || 'America/Sao_Paulo' }) }) },
    fetch: (url, init) => { posts.push({ url, init }); return Promise.resolve(); },
    document: { getElementById: () => ({ click() {}, href: 'https://apps.mmendelson.com/' }) },
    location: { replace() {} },
    setTimeout: () => 0,
    gtag: () => {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(stub, ctx);
  return posts;
}

let ran = 0, failed = 0;
function t(name, fn) {
  ran++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); }
}

const CASES = [
  ['Android Chrome (reduced UA)', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', {}, ['celular', 'Android', 'Chrome']],
  ['Android tablet Chrome', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', {}, ['tablet', 'Android', 'Chrome']],
  ['Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', {}, ['celular', 'Android', 'Samsung Internet']],
  ['Android Firefox', 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', {}, ['celular', 'Android', 'Firefox']],
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', {}, ['celular', 'iOS', 'Safari']],
  ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1', {}, ['celular', 'iOS', 'Chrome']],
  ['iPhone Instagram in-app', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.31.98 (iPhone15,2; iOS 17_5; pt_BR; pt; scale=3.00; 1179x2556)', {}, ['celular', 'iOS', 'Instagram']],
  ['Android Facebook in-app', 'Mozilla/5.0 (Linux; Android 14; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]', {}, ['celular', 'Android', 'Facebook']],
  ['iPad (desktop-class UA)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', { touch: 5 }, ['tablet', 'iPadOS', 'Safari']],
  ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', {}, ['computador', 'macOS', 'Safari']],
  ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', {}, ['computador', 'Windows', 'Edge']],
  ['Windows Opera', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0', {}, ['computador', 'Windows', 'Opera']],
  ['Linux Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', {}, ['computador', 'Linux', 'Firefox']],
  ['ChromeOS', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', {}, ['computador', 'ChromeOS', 'Chrome']],
  ['empty UA', '', {}, ['computador', 'outro', 'outro']],
];

for (const [name, ua, opts, [type, os, browser]] of CASES) {
  t(name, () => {
    const posts = run(ua, opts);
    if (posts.length !== 1) throw new Error(posts.length + ' POSTs');
    const p = posts[0], body = p.init.body;
    if (p.init.credentials !== 'omit' || p.init.method !== 'POST' || !p.init.keepalive) throw new Error('request shape');
    const got = Object.fromEntries(body.entries());
    const want = { code: '1', to: 'apps', lang: 'pt-BR', type, os, browser, tz: 'America/Sao_Paulo' };
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(JSON.stringify(got) + ' != ' + JSON.stringify(want));
    for (const k of ['type', 'os', 'browser']) {
      if (!lists[k].includes(got[k])) throw new Error(k + ' ' + got[k] + ' is not on the counter\'s list');
    }
  });
}

t('automated browsers (navigator.webdriver) are not counted', () => {
  const posts = run(CASES[0][1], { webdriver: true });
  if (posts.length !== 0) throw new Error(posts.length + ' POSTs');
});

t('no Intl: still counted, time zone empty', () => {
  const posts = run(CASES[0][1], { tzThrows: true });
  if (posts.length !== 1 || posts[0].init.body.get('tz') !== '') throw new Error('tz ' + (posts[0] && posts[0].init.body.get('tz')));
});

console.log(`\nRan ${ran} tests, ${failed} failed.`);
process.exit(ran > 0 && failed === 0 ? 0 : 1);
