// The browser's own back (and forward) on a judge's page, asked first as the page's back button
// asks: an entry of the page's own is put in the history, in front of the page, for back to come
// to instead of leaving. Coming to it, the page is asked (hold()); held, the entry is put back,
// and the page shows its sheet; not held, the browser goes on back, as it was told.
// The entry leaves nothing after it, so there is no forward from the page either.
// Put only once the page has been touched (or clicked, or a key pressed): Chrome skips, going back,
// the entries a page put without the user's doing, and there is nothing to lose before that.
(function () {
    'use strict';

    function atGuard() {
        return !!(history.state && history.state.rvGuard);
    }

    function put() {
        if (!atGuard()) history.pushState({ rvGuard: true }, '', location.href);
    }

    /** hold(): true when the page asks first (and shows its sheet), false to let the browser go. */
    window.guardHistory = function (hold) {
        if (!window.history || !history.pushState) return;
        ['pointerdown', 'touchend', 'mousedown', 'keydown'].forEach(function (type) {
            document.addEventListener(type, put, true);
        });
        window.addEventListener('popstate', function () {
            // Forward to the entry again: nothing to ask
            if (atGuard()) return;
            if (hold()) put();
            else history.back();
        });
    };
})();
