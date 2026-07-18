// Teaching page: open + scroll the discipline matching the URL hash.
// No-op on pages without matching <details id="…"> elements.
(function () {
  function openFromHash() {
    var id = decodeURIComponent(location.hash.replace('#', ''));
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName.toLowerCase() === 'details') {
      el.setAttribute('open', '');
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 76,
        behavior: 'smooth'
      });
    }
  }

  // The § anchor inside a <summary> must not toggle the accordion.
  document.querySelectorAll('.disc-anchor').forEach(function (a) {
    a.addEventListener('click', function (e) { e.stopPropagation(); });
  });

  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();

// Manual language switch (🌐 globe dropdown, same pattern as the sister
// sites): overrides the automatic browser-language detection (set inline in
// <head>, before paint) without changing the URL. The choice persists in
// localStorage so it survives reloads and other pages.
(function () {
  var globe = document.querySelector('.lang-globe');
  if (!globe) return;
  var btn = globe.querySelector('.lang-globe-btn');
  var options = globe.querySelectorAll('[data-lang]');

  function sync() {
    var current = document.documentElement.lang;
    options.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === current);
    });
  }

  function close() {
    globe.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = globe.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', close);

  options.forEach(function (b) {
    b.addEventListener('click', function () {
      var lang = b.getAttribute('data-lang');
      document.documentElement.lang = lang;
      try { localStorage.setItem('mm_lang', lang); } catch (e) { /* privacy mode */ }
      sync();
      close();
    });
  });

  sync();
})();

// ---------------------------------------------------------------------------
// Analytics — GA4 event tracking + consent bar (see ANALYTICS_TRACKING.md).
// track(name, params) is the single wrapper; callers pass only bucketed,
// non-PII params. Events do nothing until gtag exists; GA respects Consent
// Mode (cookieless until the visitor accepts below).
// ---------------------------------------------------------------------------
(function () {
  function track(name, params) {
    try { if (typeof gtag === 'function') gtag('event', name, params || {}); } catch (e) {}
  }
  var FAMILY = /(^|\.)mmendelson\.com$/i;

  // Consent bar ------------------------------------------------------------
  var bar = document.getElementById('consent-bar');
  if (bar) {
    var stored;
    try { stored = localStorage.getItem('mm_consent'); } catch (e) {}
    if (!stored) bar.hidden = false;
    function setConsent(v) {
      try { localStorage.setItem('mm_consent', v); } catch (e) {}
      if (v === 'granted') { try { gtag('consent', 'update', { analytics_storage: 'granted' }); } catch (e) {} }
      bar.hidden = true;
    }
    bar.querySelector('[data-consent="accept"]').addEventListener('click', function () { setConsent('granted'); });
    bar.querySelector('[data-consent="decline"]').addEventListener('click', function () { setConsent('denied'); });
  }
  document.querySelectorAll('[data-consent="reset"]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); if (bar) bar.hidden = false; });
  });

  // Family site switch (header + footer) -----------------------------------
  function siteOf(href) {
    if (/run\.mmendelson\.com/.test(href)) return 'run';
    if (/apps\.mmendelson\.com/.test(href)) return 'apps';
    return 'home';
  }
  document.querySelectorAll('.site-switch a, .foot-switch a').forEach(function (a) {
    if (a.classList.contains('active')) return;
    var where = a.closest('.foot-switch') ? 'footer' : 'header';
    a.addEventListener('click', function () {
      track('site_switch_click', { to_site: siteOf(a.getAttribute('href') || ''), location: where });
    });
  });

  // Language change (globe) ------------------------------------------------
  document.querySelectorAll('.lang-globe [data-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      track('language_change', { to_lang: b.getAttribute('data-lang'), method: 'globe' });
    });
  });

  // Home: project cards, CV, socials, contact ------------------------------
  // (mark handled links so the generic outbound catch-all below skips them)
  document.querySelectorAll('.card[href]').forEach(function (c) {
    c.dataset.tracked = '1';
    c.addEventListener('click', function () {
      track('project_card_click', { project: siteOf(c.getAttribute('href') || '') });
    });
  });
  document.querySelectorAll('.btn-cv .btn-cv-single').forEach(function (a) {
    a.dataset.tracked = '1';
    a.addEventListener('click', function () { track('cv_click', { cv_lang: a.getAttribute('lang') || '' }); });
  });
  document.querySelectorAll('.foot-social a').forEach(function (a) {
    a.dataset.tracked = '1';
    a.addEventListener('click', function () { track('social_click', { network: (a.textContent || '').trim() }); });
  });
  document.querySelectorAll('.foot-contact a, a[href^="mailto:"]').forEach(function (a) {
    a.dataset.tracked = '1';
    a.addEventListener('click', function () { track('contact_click', {}); });
  });

  // Teaching discipline links + section "more" links -----------------------
  document.querySelectorAll('.disc-link').forEach(function (a) {
    a.addEventListener('click', function () {
      track('teaching_discipline_click', { discipline: (a.getAttribute('href') || '').split('#')[1] || '' });
    });
  });
  document.querySelectorAll('.more-link').forEach(function (a) {
    a.addEventListener('click', function () {
      var href = a.getAttribute('href') || '';
      track('more_link_click', { section: href.indexOf('publication') >= 0 ? 'publications' : 'teaching' });
    });
  });

  // Generic outbound (non-family absolute links not already handled above) --
  document.querySelectorAll('a[href^="http"]').forEach(function (a) {
    if (a.dataset.tracked) return;
    var host;
    try { host = new URL(a.href, location.href).hostname; } catch (e) { return; }
    if (FAMILY.test(host)) return;
    a.addEventListener('click', function () { track('outbound_click', { host: host }); });
  });

  // Scroll depth (25/50/75/100) --------------------------------------------
  var marks = [25, 50, 75, 100], hit = {};
  window.addEventListener('scroll', function () {
    var h = document.documentElement, sc = h.scrollHeight - h.clientHeight;
    if (sc <= 0) return;
    var pct = Math.round((h.scrollTop || window.scrollY) / sc * 100);
    marks.forEach(function (m) { if (pct >= m && !hit[m]) { hit[m] = 1; track('scroll_depth', { percent: m }); } });
  }, { passive: true });
})();
