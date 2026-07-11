// Mobile navigation toggle
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Dropdown parents don't navigate — they only reveal their submenu.
  var parents = document.querySelectorAll('.primary-nav .has-children > a');
  parents.forEach(function (a) {
    var li = a.parentElement;

    function setOpen(open) {
      li.classList.toggle('open', open);
      a.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    a.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(!li.classList.contains('open'));
    });

    a.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setOpen(!li.classList.contains('open'));
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    });
  });

  // Close the mobile menu and any open dropdown when clicking outside of them.
  document.addEventListener('click', function (e) {
    if (nav && nav.classList.contains('open') &&
        !nav.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    if (e.target.closest('.has-children')) return;
    document.querySelectorAll('.primary-nav .has-children.open').forEach(function (li) {
      li.classList.remove('open');
      var a = li.querySelector('a');
      if (a) a.setAttribute('aria-expanded', 'false');
    });
  });
})();
