// A stand-in for Safari on iOS 12, the last iOS of the iPad mini 2 that judges still use, in the
// tests' Chromium. Not WebKit 12 itself, which no longer runs on today's computers: the pages are
// served as Safari 12 reads them, and the browser is made to lack what Safari 12 lacks:
// - the CSS that Safari 12 does not know is taken out of the stylesheets and <style> blocks, as
//   it drops it: properties (inset, aspect-ratio...), values (cqw, subgrid, clamp()...), rules
//   whose selectors it cannot read (:focus-visible, :is()...), @container rules, and the
//   unprefixed spellings of what it knows only prefixed (position: -webkit-sticky...); and
//   @supports is answered as Safari 12 would; so are the styles the scripts set (ng-style)
// - the gaps of flex boxes, which it does not know either but Chromium cannot be kept from
//   drawing, are taken away by legacy_browsers.js, told it is on such a browser
//   (RV_LEGACY_BROWSER), which then puts them back as margins as it does on iOS 12
// - there are no pointer events (window.PointerEvent), as on iOS 12; touches come as touch events
// What Safari 12 draws differently from Chromium (its own bugs) is not seen here.
const postcss = require('postcss');

/** The iPad mini 2 in portrait, with Safari 12's user agent. For test.use(). */
const IPAD_MINI_2 = {
  viewport: { width: 768, height: 1024 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 12_5_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
};

// Properties Safari 12 does not know
const UNKNOWN_PROPERTIES = /^(inset|inset-(block|inline)(-start|-end)?|aspect-ratio|container|container-type|container-name|overscroll-behavior(-x|-y)?|translate|scale|rotate|accent-color|content-visibility)$/;
// Values it does not know, in any property
const UNKNOWN_VALUES = /\d(cq[whib]|cqmin|cqmax)\b|\bclamp\(|\bcolor-mix\(|\d[dsl]v[hw]\b|\bsubgrid\b/;
// Selectors it cannot read: the whole rule is dropped
const UNKNOWN_SELECTORS = /:focus-visible|:has\(|:is\(|:where\(|::backdrop|:user-invalid/;
// At-rules it does not know, with what is in them
const UNKNOWN_AT_RULES = /^(container|layer|property|scope)$/;
// Known only with -webkit-: the unprefixed spelling is taken out where the rule has no prefixed one
// (with one, the result is the same in both browsers, and Chromium knows the unprefixed one only)
const PREFIX_ONLY = [
  { prop: /^position$/, value: /^sticky$/, prefixed: (d) => d.prop === 'position' && d.value === '-webkit-sticky' },
  { prop: /^clip-path$/, prefixed: (d) => d.prop === '-webkit-clip-path' },
  { prop: /^backdrop-filter$/, prefixed: (d) => d.prop === '-webkit-backdrop-filter' },
  { prop: /^(width|height|min-width|max-width)$/, value: /^fit-content$/, prefixed: (d, decl) => d.prop === decl.prop && d.value === '-webkit-fit-content' },
];

function knownTouchAction(value) {
  return value === 'auto' || value === 'manipulation';
}

/** Whether Safari 12 knows a declaration, as @supports asks: (prop: value). */
function knowsDeclaration(condition) {
  const m = /^\(\s*([a-z-]+)\s*:\s*(.+?)\s*\)$/.exec(condition.trim());
  if (!m) return null;
  return !(UNKNOWN_PROPERTIES.test(m[1]) || UNKNOWN_VALUES.test(m[2]));
}

const downgrade = () => ({
  postcssPlugin: 'safari12',
  AtRule(atRule) {
    if (UNKNOWN_AT_RULES.test(atRule.name)) return atRule.remove();
    // @supports as Safari 12 answers it (for one declaration, with or without not): its rules
    // apply or not whatever Chromium knows
    if (atRule.name === 'supports') {
      const not = /^not\s+/.test(atRule.params.trim());
      const known = knowsDeclaration(atRule.params.trim().replace(/^not\s+/, ''));
      if (known === null) return undefined;
      if (known !== not) atRule.replaceWith(atRule.nodes);
      else atRule.remove();
    }
    return undefined;
  },
  Rule(rule) {
    if (UNKNOWN_SELECTORS.test(rule.selector)) rule.remove();
  },
  Declaration(decl) {
    const value = decl.value.replace(/\s*!important$/, '').trim();
    if (UNKNOWN_PROPERTIES.test(decl.prop) || UNKNOWN_VALUES.test(value)) return decl.remove();
    if (decl.prop === 'touch-action' && !knownTouchAction(value)) return decl.remove();
    for (const p of PREFIX_ONLY) {
      if (!p.prop.test(decl.prop) || (p.value && !p.value.test(value))) continue;
      const siblings = decl.parent.nodes.filter((n) => n.type === 'decl');
      if (!siblings.some((d) => p.prefixed(d, decl))) decl.remove();
      return undefined;
    }
    return undefined;
  },
});
downgrade.postcss = true;

/** A stylesheet as Safari 12 reads it. */
function downgradeCss(css, from) {
  return postcss([downgrade]).process(css, { from }).css;
}

/** A page's <style> blocks as Safari 12 reads them. */
function downgradeHtml(html) {
  return html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => open + downgradeCss(css) + close);
}

/**
 * Make the page, from its next load, a stand-in for Safari 12 (with test.use(IPAD_MINI_2) for
 * the screen). Requests the test routes itself after this go to its own handlers first.
 */
async function emulateSafari12(page) {
  await page.addInitScript(({ properties, values }) => {
    window.RV_LEGACY_BROWSER = true;
    delete window.PointerEvent;
    // Styles set by the page's scripts (ng-style...) are dropped as the stylesheets' are: taken
    // out of the element as soon as they are set, before the page is laid out again
    const unknownProperty = new RegExp(properties);
    const unknownValue = new RegExp(values);
    const clean = (e) => {
      const style = e.style;
      if (!style) return;
      for (let i = style.length - 1; i >= 0; i--) {
        const name = style[i];
        if (unknownProperty.test(name) || unknownValue.test(style.getPropertyValue(name))) style.removeProperty(name);
      }
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') clean(r.target);
        for (const n of r.addedNodes || []) {
          if (n.nodeType !== 1) continue;
          clean(n);
          for (const e of n.querySelectorAll('[style]')) clean(e);
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  }, { properties: UNKNOWN_PROPERTIES.source, values: UNKNOWN_VALUES.source });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const type = request.resourceType();
    if (type !== 'stylesheet' && type !== 'document') return route.fallback();
    const response = await route.fetch();
    const contentType = response.headers()['content-type'] || '';
    if (type === 'stylesheet' && contentType.includes('css')) {
      return route.fulfill({ response, body: downgradeCss(await response.text(), request.url()) });
    }
    if (type === 'document' && contentType.includes('html')) {
      return route.fulfill({ response, body: downgradeHtml(await response.text()) });
    }
    return route.fulfill({ response });
  });
}

/** Draw a stroke on an element with one finger, as touch events (there are no pointer events). */
async function touchStroke(page, locator, from, to, steps = 8) {
  const box = await locator.boundingBox();
  const client = await page.context().newCDPSession(page);
  const at = (t) => [{ x: box.x + from.x + (to.x - from.x) * t, y: box.y + from.y + (to.y - from.y) * t, id: 1 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let i = 1; i <= steps; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / steps) });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

module.exports = { IPAD_MINI_2, emulateSafari12, downgradeCss, touchStroke };
