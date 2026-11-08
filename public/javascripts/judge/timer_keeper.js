// The timer of a judge's page kept on the device while it runs, for it to run on through a reload
// or the page closed and opened again (the browser cannot be kept from either on iPads): when it
// was started (startUnixTime) and the time before that (prevTime), every second, under the run's
// own key. Taken up again only for the very run it was started for, and only while it is fresh.
// Where the browser keeps nothing (a private window, storage turned off), the timer stops on a
// reload as before.
(function () {
    'use strict';

    var PREFIX = 'rvTimer:';
    // What is older than this is of no run any more, whatever its run's duration
    var STALE = 24 * 60 * 60 * 1000;

    function key(kind, run) {
        return PREFIX + kind + ':' + run;
    }

    function read(k) {
        try {
            return JSON.parse(localStorage.getItem(k));
        } catch (e) {
            return null;
        }
    }

    function remove(k) {
        try {
            localStorage.removeItem(k);
        } catch (e) {
            // nothing kept, nothing to remove
        }
    }

    // Those of runs left running long ago, taken away
    function clearStale() {
        try {
            var now = Date.now();
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(PREFIX) === 0) keys.push(k);
            }
            keys.forEach(function (k) {
                var v = read(k);
                if (!v || typeof v.start !== 'number' || now - v.start > STALE) remove(k);
            });
        } catch (e) {
            // nothing kept
        }
    }

    window.judgeTimer = {
        /** The timer of the run running: started at start (ms), with prev (ms) before. */
        keep: function (kind, run, start, prev) {
            if (!run) return;
            try {
                localStorage.setItem(key(kind, run), JSON.stringify({ run: run, start: start, prev: prev }));
            } catch (e) {
                // not kept: it stops on a reload, as before
            }
        },

        drop: function (kind, run) {
            if (run) remove(key(kind, run));
        },

        /**
         * The timer kept for the run, if it was started for it and is fresh: run, at most, to the
         * run's duration (ms) and a while after, as the time saved for the run (ms, in whole
         * seconds) has it: not from before, nor further on (set by hand, on another device). null
         * if not; what was kept is then dropped.
         */
        kept: function (kind, run, duration, saved) {
            clearStale();
            var v = read(key(kind, run));
            var now = Date.now();
            var ok = !!v && v.run === run && typeof v.start === 'number' && typeof v.prev === 'number' &&
                now >= v.start && v.prev + (now - v.start) <= duration + 10 * 60 * 1000 &&
                saved >= v.prev - 1000 && saved <= v.prev + (now - v.start) + 1000;
            if (!ok) {
                this.drop(kind, run);
                return null;
            }
            return { start: v.start, prev: v.prev };
        }
    };
})();
