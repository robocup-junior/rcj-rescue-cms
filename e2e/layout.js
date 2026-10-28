// Rule-based checks for broken layouts, run in the page: no baseline images needed.

/**
 * Problems on the page as it is now rendered:
 * - the page scrolls sideways
 * - visible elements stick out past the right edge of the window (inside no scrolling box)
 * - Angular bindings ({{ }}) or translation keys (home.enterLeague) shown as text
 */
async function findLayoutProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const vw = document.documentElement.clientWidth;

    /** A short CSS-like path for an element, to tell which one is wrong. */
    const describe = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
        let part = e.tagName.toLowerCase();
        if (e.id) part += `#${e.id}`;
        else if (typeof e.className === 'string' && e.className.trim()) part += `.${e.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const isVisible = (el) => {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    /** Inside a box that scrolls or clips sideways, such as .table-responsive */
    const isClipped = (el) => {
      for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
        const { overflowX } = getComputedStyle(e);
        if (overflowX !== 'visible') return true;
      }
      return false;
    };

    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth > vw + 1) problems.push(`page scrolls sideways: ${scrollWidth}px content in a ${vw}px window`);

    // Report only the outermost offender of each overflowing subtree
    const reported = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(el.tagName)) continue;
      if (reported.some((r) => r.contains(el))) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right <= vw + 1 || rect.left >= vw) continue;
      if (getComputedStyle(el).position === 'fixed' && rect.left >= 0 && rect.right <= vw + 1) continue;
      if (!isVisible(el) || isClipped(el)) continue;
      reported.push(el);
      problems.push(`sticks out ${Math.round(rect.right - vw)}px past the right edge: ${describe(el)}`);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    // (file names, as in a list of files, are not)
    const translationKey = /^[a-z][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;
    const fileName = /\.(png|jpe?g|gif|svg|webp|mp4|webm|pdf|html?|txt|csv|zip|cms|json)$/i;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName) || !isVisible(parent)) continue;
      if (/\{\{|\}\}/.test(text)) problems.push(`unrendered binding "${text.slice(0, 60)}": ${describe(parent)}`);
      else if (translationKey.test(text) && !fileName.test(text)) problems.push(`untranslated key "${text}": ${describe(parent)}`);
    }
    return problems;
  });
}

module.exports = { findLayoutProblems };
