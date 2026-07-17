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
