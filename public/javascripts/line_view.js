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

// Takes the loading screen away once the map is complete: its tiles drawn (they come from
// templates of their own, a moment after the data), their images loaded and the tiles sized
// (resize is the page's sizing function). Called by the controller when the run and its map are
// in; a slow or broken image does not hold the page for more than a few seconds.
function revealRunPage(resize) {
  if (!document.body.classList.contains('rv-is-loading') || revealRunPage.waiting) return;
  revealRunPage.waiting = true;
  var started = Date.now();
  var lastCount = -1;

  function reveal() {
    resize();
    // One frame for the new sizes to be drawn
    requestAnimationFrame(function () {
      document.body.classList.remove('rv-is-loading');
    });
  }

  (function check() {
    var images = document.querySelectorAll('.tilearea img[src]');
    var complete = Array.prototype.every.call(images, function (img) {
      return img.complete;
    });
    // Done when there are images, all loaded, and no more came since the last look
    if ((images.length && complete && images.length == lastCount) || Date.now() - started > 8000) return reveal();
    lastCount = images.length;
    setTimeout(check, 100);
  })();
}
