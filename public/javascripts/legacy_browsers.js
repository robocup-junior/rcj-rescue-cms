// What browsers from before 2021 do not know of the pages' CSS, done the old way. Judges still use
// iPads that stay on iOS 12 (the iPad mini 2), whose Safari knows neither:
// - the gaps of flex boxes (gap, row-gap, column-gap on display: flex; Safari 14.1): the gaps are
//   given to the items as margins instead
// - sizes in parts of a container (cqw) and container queries (Safari 16): the containers (map
//   tiles) get their width in --rv-cqw, which the CSS uses where cqw is not known
//   (line_view.css), and rv-cq-small when as narrow as @container (max-width: 48px) asks
// Elsewhere this does nothing. Loaded on every page (views/includes/common_component.pug).
// The pages change as they run (AngularJS), so all is done again after each change of the page
// and of the window's size.
(function () {
    'use strict';

    function flexGapKnown() {
        var box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
        box.appendChild(document.createElement('div'));
        box.appendChild(document.createElement('div'));
        document.body.appendChild(box);
        var known = box.scrollHeight === 1;
        document.body.removeChild(box);
        return known;
    }

    function cqwKnown() {
        return !!(window.CSS && CSS.supports && CSS.supports('width', '1cqw'));
    }

    // For the e2e tests' stand-in for iOS 12 (e2e/safari12.js), which runs this on a browser that
    // knows both
    var forced = window.RV_LEGACY_BROWSER === true;

    function start() {
        var doGaps = forced || !flexGapKnown();
        var doCqw = forced || !cqwKnown();
        if (!doGaps && !doCqw) return;
        document.documentElement.classList.add('rv-legacy');

        // Read again whenever the stylesheets have changed: a page's own come after this script,
        // and may not be loaded yet when it starts
        var gapSelectors = '';
        var marginRules = { Top: [], Right: [], Bottom: [], Left: [] };
        var readRules = -1;
        var resized = false;
        var CONTAINERS = '.run-view .slot, .rv-mz-tile, .rv-mz-over';

        // ---- Gaps ----
        // The items given a margin keep their own inline margins from before in data-rv-margins
        // (top|right|bottom|left), which is copied with them: AngularJS copies elements (ng-if,
        // ng-repeat) with what was given them
        var SIDES = ['Top', 'Right', 'Bottom', 'Left'];

        function px(value) {
            var n = parseFloat(value);
            return isNaN(n) ? 0 : n;
        }

        function ownMargins(el) {
            return el.getAttribute('data-rv-margins').split('|');
        }

        function undoGaps() {
            var spaced = document.querySelectorAll('[data-rv-margins]');
            for (var i = 0; i < spaced.length; i++) {
                var own = ownMargins(spaced[i]);
                for (var s = 0; s < 4; s++) spaced[i].style['margin' + SIDES[s]] = own[s];
                spaced[i].removeAttribute('data-rv-margins');
            }
        }

        // An auto margin (which pushes the item along) is left as it is; a margin of the item's
        // own is kept, with the gap added to it. Whether the margin is auto is what the rule that
        // wins for the element says: the most specific of those that match, the last of equals
        function isAuto(el, side) {
            if (el.style['margin' + side]) return el.style['margin' + side] === 'auto';
            var winner = null;
            marginRules[side].forEach(function (rule) {
                for (var i = 0; i < rule.parts.length; i++) {
                    var part = rule.parts[i];
                    if (winner && compare(part.specificity, winner.specificity) < 0) continue;
                    if (winner && compare(part.specificity, winner.specificity) === 0 && rule.order < winner.order) continue;
                    var matches = false;
                    try {
                        matches = el.matches(part.selector);
                    } catch (e) {
                        // A selector the browser does not know
                    }
                    if (matches) winner = { specificity: part.specificity, order: rule.order, auto: rule.auto };
                }
            });
            return !!winner && winner.auto;
        }

        function giveMargin(el, side, gap) {
            var prop = 'margin' + side;
            var own = px(getComputedStyle(el)[prop]);
            // With no margin there is nothing to keep: an auto one with no room is none, and the
            // gap would be given before it
            if (own !== 0 && isAuto(el, side)) return;
            if (!el.hasAttribute('data-rv-margins')) {
                el.setAttribute('data-rv-margins', SIDES.map(function (s) {
                    return el.style['margin' + s];
                }).join('|'));
            }
            el.style[prop] = (own + gap) + 'px';
        }

        function takeMargin(el, side) {
            if (el.hasAttribute('data-rv-margins')) el.style['margin' + side] = ownMargins(el)[SIDES.indexOf(side)];
        }

        // The items of a flex box: its elements in the flow, and its text (each run of text is an
        // item of its own, as an icon's label beside it)
        function flexItems(box) {
            var items = [];
            for (var i = 0; i < box.childNodes.length; i++) {
                var child = box.childNodes[i];
                if (child.nodeType === 3) {
                    if (/\S/.test(child.nodeValue)) items.push(child);
                    continue;
                }
                if (child.nodeType !== 1) continue;
                var style = getComputedStyle(child);
                if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') continue;
                items.push(child);
            }
            return items;
        }

        var OPPOSITE = { Top: 'Bottom', Bottom: 'Top', Left: 'Right', Right: 'Left' };

        // The box's gaps as its CSS gives them. In the test's stand-in, the browser's own gaps are
        // taken away, once read (and kept in data-rv-gaps), so the margins are what is seen
        function gapsOf(box, style) {
            var kept = box.getAttribute('data-rv-gaps');
            if (kept) {
                kept = kept.split(',');
                return { row: px(kept[0]), column: px(kept[1]) };
            }
            var gaps = { row: px(style.getPropertyValue('row-gap')), column: px(style.getPropertyValue('column-gap')) };
            if (forced && (gaps.row || gaps.column)) {
                box.setAttribute('data-rv-gaps', gaps.row + ',' + gaps.column);
                box.style.setProperty('row-gap', '0px');
                box.style.setProperty('column-gap', '0px');
            }
            return gaps;
        }

        function spaceBox(box) {
            var style = getComputedStyle(box);
            if (style.display !== 'flex' && style.display !== 'inline-flex') return;
            var gaps = gapsOf(box, style);
            if (!gaps.row && !gaps.column) return;
            var items = flexItems(box);
            if (items.length < 2) return;

            var column = style.flexDirection.indexOf('column') === 0;
            var reverse = style.flexDirection.indexOf('reverse') > 0;
            // Each item after the first is spaced from the one before it, on the side it faces;
            // in a box that wraps, the lines after the first are spaced from the line before
            var along = column ? (reverse ? 'Bottom' : 'Top') : (reverse ? 'Right' : 'Left');
            var across = column ? 'Left' : 'Top';
            var alongGap = column ? gaps.row : gaps.column;
            var acrossGap = column ? gaps.column : gaps.row;

            // Text takes no margin: the element before it gives the gap on its other side
            if (alongGap) {
                items.forEach(function (item, i) {
                    if (i === 0) return;
                    if (item.nodeType === 1) giveMargin(item, along, alongGap);
                    else if (items[i - 1].nodeType === 1) giveMargin(items[i - 1], OPPOSITE[along], alongGap);
                });
            }
            if (style.flexWrap === 'nowrap') return;
            items = items.filter(function (item) { return item.nodeType === 1; });
            if (items.length < 2) return;

            // The items that start a line (now that the items have their margins: one that is not
            // further along than the one before it) take no margin along it; the lines after the
            // first are spaced from the line before
            var position = column ? 'offsetTop' : 'offsetLeft';
            var laterLines = [];
            var line = 0;
            items.forEach(function (item, i) {
                if (i > 0) {
                    var before = items[i - 1][position];
                    var wrapped = reverse ? item[position] >= before : item[position] <= before;
                    if (wrapped) {
                        line++;
                        takeMargin(item, along);
                    }
                }
                if (line > 0) laterLines.push(item);
            });
            if (!acrossGap) return;
            laterLines.forEach(function (item) {
                giveMargin(item, across, acrossGap);
            });
        }

        function doAllGaps() {
            undoGaps();
            var rules = countRules();
            if (rules !== readRules || resized) {
                readRules = rules;
                resized = false;
                var read = readSelectors();
                gapSelectors = read.gaps;
                marginRules = read.margins;
            }
            if (!gapSelectors) return;
            var boxes;
            try {
                boxes = document.querySelectorAll(gapSelectors);
            } catch (e) {
                return;
            }
            for (var i = 0; i < boxes.length; i++) spaceBox(boxes[i]);
        }

        // ---- Sizes in parts of a tile ----
        function doAllContainers() {
            var boxes = document.querySelectorAll(CONTAINERS);
            for (var i = 0; i < boxes.length; i++) {
                var width = boxes[i].getBoundingClientRect().width;
                if (!width) continue;
                var value = (width / 100).toFixed(3) + 'px';
                if (boxes[i].style.getPropertyValue('--rv-cqw') !== value) boxes[i].style.setProperty('--rv-cqw', value);
                var small = width <= 48;
                if (boxes[i].classList.contains('rv-cq-small') !== small) boxes[i].classList.toggle('rv-cq-small', small);
            }
        }

        // ---- After each change ----
        var observer;
        var queued = false;

        // While the margins are taken back and given again, no transition: one would be read
        // halfway, and the margins would grow each time
        var still = document.createElement('style');
        still.textContent = 'html.rv-still, html.rv-still * { transition: none !important; }';
        document.head.appendChild(still);

        function run() {
            queued = false;
            if (doCqw) doAllContainers();
            if (doGaps) {
                document.documentElement.classList.add('rv-still');
                doAllGaps();
                document.documentElement.classList.remove('rv-still');
            }
            // The changes made here are not changes to answer
            observer.takeRecords();
        }

        function queue() {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(run);
        }

        observer = new MutationObserver(queue);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        // The rules of other media may apply now
        function onResize() {
            resized = true;
            queue();
        }
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        // Web fonts change the widths of the text
        window.addEventListener('load', queue);
        queue();
    }

    // How many rules the stylesheets have (those loaded and of this site): when it changes, there
    // are rules to read again
    function countRules() {
        var count = 0;
        for (var i = 0; i < document.styleSheets.length; i++) {
            try {
                count += document.styleSheets[i].cssRules.length + 1;
            } catch (e) {
                // Not loaded yet, or another site's
            }
        }
        return count;
    }

    // The selectors of the rules that give a gap: the boxes that may need one (flex or grid; only
    // the flex ones are spaced); and the rules that give a margin, on each side, in the media the
    // page is shown in now, with whether it is auto. The rules of other sites' stylesheets cannot
    // be read
    function readSelectors() {
        var gaps = [];
        var margins = { Top: [], Right: [], Bottom: [], Left: [] };
        var order = 0;
        function walk(rules, applies) {
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule.cssRules && !rule.selectorText) {
                    var inMedia = !rule.media || window.matchMedia(rule.media.mediaText).matches;
                    walk(rule.cssRules, applies && inMedia);
                } else if (rule.style && rule.selectorText) {
                    order++;
                    if (rule.style.getPropertyValue('row-gap') || rule.style.getPropertyValue('column-gap')) {
                        gaps.push(rule.selectorText);
                    }
                    if (!applies) continue;
                    for (var side in margins) {
                        var value = rule.style['margin' + side];
                        if (!value) continue;
                        margins[side].push({ parts: parts(rule.selectorText), order: order, auto: value === 'auto' });
                    }
                }
            }
        }
        for (var i = 0; i < document.styleSheets.length; i++) {
            try {
                walk(document.styleSheets[i].cssRules, true);
            } catch (e) {
                // Another site's stylesheet
            }
        }
        // The gaps given in a style attribute
        gaps.push('[style*="gap"]');
        return { gaps: known(gaps), margins: margins };
    }

    // The selectors of a list, each with its specificity: [ids, classes, elements]
    function parts(list) {
        return list.split(',').map(function (selector) {
            return { selector: selector.trim(), specificity: specificity(selector) };
        });
    }

    function specificity(selector) {
        var s = selector.replace(/::?(before|after|first-line|first-letter|placeholder|selection)\b/g, ' x')
            .replace(/:not\(([^)]*)\)/g, ' $1');
        var ids = (s.match(/#[\w-]+/g) || []).length;
        var classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) || []).length;
        var elements = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
        return [ids, classes, elements];
    }

    function compare(a, b) {
        for (var i = 0; i < 3; i++) {
            if (a[i] !== b[i]) return a[i] - b[i];
        }
        return 0;
    }

    // The selectors the browser knows, as one: one it does not know would hide the others
    function known(selectors) {
        return selectors.filter(function (s) {
            try {
                document.querySelector(s);
                return true;
            } catch (e) {
                return false;
            }
        }).join(',');
    }

    // After AngularJS has started the page (on the same event)
    function later() {
        setTimeout(start, 0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later);
    else later();
})();
