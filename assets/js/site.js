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

// Manual EN/PT language switch: overrides the automatic browser-language
// detection (set inline in <head>, before paint) without changing the URL.
// The choice persists in localStorage so it survives reloads and other pages.
(function () {
  var buttons = document.querySelectorAll('.lang-switch [data-lang]');
  if (!buttons.length) return;

  function sync() {
    var current = document.documentElement.lang;
    buttons.forEach(function (b) {
      var active = b.getAttribute('data-lang') === current;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var lang = b.getAttribute('data-lang');
      document.documentElement.lang = lang;
      try { localStorage.setItem('mm_lang', lang); } catch (e) { /* privacy mode */ }
      sync();
    });
  });

  sync();
})();
