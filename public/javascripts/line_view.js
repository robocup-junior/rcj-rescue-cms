// Shared by the Rescue Line view and sign pages (views/view/common/line_2026.pug)

// The chips of the score equation jump to their cards. Scrolled from here, since Angular
// would take the #hash links for its own routes
document.querySelectorAll('[data-jump]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    event.preventDefault();
    document.querySelector(link.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
  });
});

// The score and time in the bar would repeat the summary, so show them only once it has scrolled away
(function () {
  var bar = document.querySelector('.rv-topbar');
  var summary = document.querySelector('.rv-summary');
  if (!bar || !summary || !('IntersectionObserver' in window)) return;
  bar.classList.add('stats-follow-summary');
  new IntersectionObserver(function (entries) {
    bar.classList.toggle('show-stats', !entries[0].isIntersecting);
  }, { rootMargin: '-' + bar.offsetHeight + 'px 0px 0px 0px' }).observe(summary);
})();
