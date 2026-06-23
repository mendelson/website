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

  // On mobile, allow tapping a parent item to expand its submenu
  var parents = document.querySelectorAll('.primary-nav .has-children > a');
  parents.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 768px)').matches) {
        var sub = a.parentElement.querySelector('.submenu');
        if (sub) {
          e.preventDefault();
          sub.style.display = sub.style.display === 'flex' ? 'none' : 'flex';
        }
      }
    });
  });
})();
