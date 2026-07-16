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
