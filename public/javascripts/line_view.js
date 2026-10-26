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
// templates of their own, a moment after the data), their images loaded and decoded, so they are
// painted at once, and the tiles sized (resize is the page's sizing function). Called by the
// controller when the run and its map are in; a slow or broken image does not hold the page for
// more than 15 seconds.
function revealRunPage(resize) {
  if (!document.body.classList.contains('rv-is-loading') || revealRunPage.waiting) return;
  revealRunPage.waiting = true;
  var started = Date.now();
  var lastCount = -1;
  var revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    resize();
    // One frame for the new sizes to be drawn
    requestAnimationFrame(function () {
      document.body.classList.remove('rv-is-loading');
    });
  }
  setTimeout(reveal, 15000);

  (function check() {
    var images = Array.prototype.slice.call(document.querySelectorAll('.tilearea img[src]'));
    var complete = images.every(function (img) {
      return img.complete;
    });
    // Loaded when there are images, all complete, and no more came since the last look
    if (!(images.length && complete && images.length == lastCount)) {
      lastCount = images.length;
      return setTimeout(check, 100);
    }
    // Then decoded; a broken image (its decode fails) does not count
    Promise.all(images.map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : null;
    })).then(reveal);
  })();
}
