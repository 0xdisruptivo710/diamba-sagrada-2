/* ==========================================================================
   DIAMBA SAGRADA — i18n (PT/EN) for the static site
   --------------------------------------------------------------------------
   Self-contained, dependency-free. Portuguese is the default visible text.
   Each translatable element carries the English in attributes:
     • data-en="..."            → swaps element innerHTML
     • data-en-placeholder="…"  → swaps the placeholder attribute
     • data-en-aria-label="…"   → swaps aria-label
     • data-en-alt="…"          → swaps alt
     • data-en-title="…"        → swaps title
     • data-en-content="…"      → swaps content (e.g. <meta name="description">)
   The original PT value is captured at runtime, so toggling back is lossless.
   Choice persists in localStorage('ds-lang') and updates <html lang>.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'ds-lang';
  var original = new WeakMap(); // el -> { html, attrs: { name: value } }

  var ATTR_MAP = [
    ['data-en-placeholder', 'placeholder'],
    ['data-en-aria-label', 'aria-label'],
    ['data-en-alt', 'alt'],
    ['data-en-title', 'title'],
    ['data-en-content', 'content'],
  ];

  function currentLang() {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'pt';
  }

  function remember(el) {
    var rec = original.get(el);
    if (rec) return rec;
    rec = { html: el.innerHTML, attrs: {} };
    ATTR_MAP.forEach(function (pair) {
      if (el.hasAttribute(pair[0])) rec.attrs[pair[1]] = el.getAttribute(pair[1]);
    });
    original.set(el, rec);
    return rec;
  }

  function apply(lang) {
    var en = lang === 'en';

    document.querySelectorAll('[data-en]').forEach(function (el) {
      var rec = remember(el);
      el.innerHTML = en ? el.getAttribute('data-en') : rec.html;
    });

    ATTR_MAP.forEach(function (pair) {
      document.querySelectorAll('[' + pair[0] + ']').forEach(function (el) {
        var rec = remember(el);
        el.setAttribute(pair[1], en ? el.getAttribute(pair[0]) : (rec.attrs[pair[1]] || ''));
      });
    });

    document.documentElement.setAttribute('lang', en ? 'en' : 'pt-BR');

    document.querySelectorAll('.lang-toggle__btn').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('lang-toggle__btn--active', active);
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage blocked */ }
  }

  function init() {
    apply(currentLang());
    document.querySelectorAll('.lang-toggle__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-lang') === 'en' ? 'en' : 'pt');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
