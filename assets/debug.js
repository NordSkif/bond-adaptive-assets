(function () {
    'use strict';

    function waitForElement(selector, cb, timeoutMs) {
        var start = Date.now();
        (function tick() {
            var el = document.querySelector(selector);
            if (el) return cb(el);
            if (timeoutMs && (Date.now() - start) > timeoutMs) return;
            requestAnimationFrame(tick);
        })();
    }

    function initTableLimiter(table, limit) {
        if (!table || table.dataset.limitInited === '1') return;
        var tbody = table.tBodies && table.tBodies[0];
        if (!tbody) return;

        table.dataset.limitInited = '1';

        var state = { expanded: false };

        // создаем контрол под таблицей
        var wrap = document.createElement('div');
        wrap.className = 'table-more-wrap';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'table-more-btn';
        btn.setAttribute('aria-expanded', 'false');

        wrap.appendChild(btn);
        table.insertAdjacentElement('afterend', wrap);

        function getRows() {
            // чаще всего у строк есть data-isin, так точнее и безопаснее
            var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
            var isinRows = rows.filter(function (tr) { return tr.hasAttribute('data-isin'); });
            return isinRows.length ? isinRows : rows;
        }

        function apply() {
            var rows = getRows();
            var total = rows.length;

            if (total <= limit) {
                rows.forEach(function (tr) { tr.classList.remove('is-hidden-by-limit'); });
                wrap.hidden = true;
                state.expanded = false;
                btn.setAttribute('aria-expanded', 'false');
                return;
            }

            wrap.hidden = false;

            if (state.expanded) {
                rows.forEach(function (tr) { tr.classList.remove('is-hidden-by-limit'); });
                btn.textContent = 'Скрыть';
                btn.setAttribute('aria-expanded', 'true');
            } else {
                rows.forEach(function (tr, idx) {
                    if (idx >= limit) tr.classList.add('is-hidden-by-limit');
                    else tr.classList.remove('is-hidden-by-limit');
                });
                btn.textContent = 'Показать больше (' + (total - limit) + ')';
                btn.setAttribute('aria-expanded', 'false');
            }
        }

        btn.addEventListener('click', function () {
            state.expanded = !state.expanded;
            apply();

            // при сворачивании удобно вернуть к началу таблицы
            if (!state.expanded) {
                table.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        });

        // если таблицу сортируют/фильтруют и tbody меняется - пересчитать
        var raf = 0;
        var mo = new MutationObserver(function () {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(function () {
                raf = 0;
                apply();
            });
        });

        mo.observe(tbody, { childList: true });

        apply();
    }

    document.addEventListener('DOMContentLoaded', function () {
        waitForElement('#screenerTable', function (table) {
            initTableLimiter(table, 20);
        }, 8000);
    });
})();

(function () {
    if (document.getElementById('kill-viewall-popup-style')) return;

    var css = `
    @media (max-width: 767px) {
      .screener__filters-row.view-all {
        position: relative;
        inset: auto;
        z-index: 1;
        padding: 0;
        background: transparent;
        overflow: visible;
        display: flex;
        justify-content: space-between;
        margin-bottom: 24px;
      }

      .screener__filters-row.view-all .filters-header { display: none; }
      .screener__filters-row.view-all .filters-body,
      .screener__filters-row.view-all .filters-footer {
        background: transparent;
        box-shadow: none;
        padding: 0;
        margin: 0;
        max-height: none;
        overflow: visible;
        border-radius: 0;
      }

      .screener__filters-row.view-all .filters-popup__close { display: none !important; }
    }
  `;

    var style = document.createElement('style');
    style.id = 'kill-viewall-popup-style';
    style.textContent = css;
    document.head.appendChild(style);
})();


(() => {
    // Fix: Yandex Share2 can translate the widget out of viewport on mobile (inline transform like translateX(-84px)).
    // We avoid observing the whole document and only track widgets inside .share-buttons.
    const PAD = 12;

    const getViewport = () => {
        const vv = window.visualViewport;
        return vv
            ? { w: vv.width, h: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop }
            : { w: window.innerWidth, h: window.innerHeight, ox: 0, oy: 0 };
    };

    const active = new Set();
    const observed = new WeakSet();
    let raf = 0;

    function ensureTransform(el) {
        const t = el.style.transform || '';
        if (t.includes('var(--cb-shift-x')) return;
        const base = (t && t !== 'none') ? (t + ' ') : '';
        el.style.transform = base + 'translateX(var(--cb-shift-x, 0px))';
    }

    function fixYaShare(el) {
        if (!el || el.nodeType !== 1) return;

        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
            active.delete(el);
            el.style.removeProperty('--cb-shift-x');
            return;
        }

        ensureTransform(el);

        const { w: vw, ox } = getViewport();
        const r = el.getBoundingClientRect();

        let dx = 0;
        if (r.left < PAD) dx += (PAD - r.left);
        if (r.right > vw - PAD) dx -= (r.right - (vw - PAD));

        dx += ox;

        el.style.setProperty('--cb-shift-x', `${Math.round(dx)}px`);
        active.add(el);
    }

    function scheduleActiveFix() {
        if (!active.size) return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            raf = 0;
            active.forEach(fixYaShare);
        });
    }

    function observeShare(el) {
        if (!el || observed.has(el)) return;
        observed.add(el);

        fixYaShare(el);

        const mo = new MutationObserver(() => fixYaShare(el));
        mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    function init() {
        const roots = document.querySelectorAll('.share-buttons');
        if (!roots.length) return;

        roots.forEach(root => {
            root.querySelectorAll('.ya-share2').forEach(observeShare);

            const mo = new MutationObserver(muts => {
                for (const m of muts) {
                    if (m.type !== 'childList') continue;
                    m.addedNodes.forEach(n => {
                        if (n.nodeType !== 1) return;
                        if (n.matches?.('.ya-share2')) observeShare(n);
                        n.querySelectorAll?.('.ya-share2').forEach(observeShare);
                    });
                }
            });

            mo.observe(root, { subtree: true, childList: true });
        });

        window.addEventListener('resize', scheduleActiveFix, { passive: true });
        window.addEventListener('scroll', scheduleActiveFix, { passive: true });
        window.visualViewport?.addEventListener('resize', scheduleActiveFix, { passive: true });
        window.visualViewport?.addEventListener('scroll', scheduleActiveFix, { passive: true });

        // one initial pass
        roots.forEach(root => root.querySelectorAll('.ya-share2').forEach(fixYaShare));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();



(() => {
    // Fix: tooltips can be positioned out of viewport on mobile (negative left).
    // Previous implementation observed the whole document for style/class mutations and caused heavy jank on resize.
    // This version hooks into tooltip triggers and only tracks active tooltips.
    const PAD = 12;

    const active = new Set();
    const observed = new WeakSet();
    let raf = 0;

    function viewportWidth() {
        return window.visualViewport ? window.visualViewport.width : window.innerWidth;
    }

    function fixTip(tip) {
        if (!tip || tip.nodeType !== 1) return;

        // fast path: most tooltips are hidden
        // (we still use computed style, but only for active/observed nodes)
        const cs = getComputedStyle(tip);
        if (cs.visibility !== 'visible' || cs.display === 'none') {
            active.delete(tip);

            // restore transform if we changed it before
            if (tip.dataset.baseTransform) {
                tip.style.transform = tip.dataset.baseTransform;
                delete tip.dataset.baseTransform;
            }
            return;
        }

        const r = tip.getBoundingClientRect();
        const vw = viewportWidth();

        let dx = 0;
        if (r.left < PAD) dx += (PAD - r.left);
        if (r.right > vw - PAD) dx -= (r.right - (vw - PAD));

        if (!tip.dataset.baseTransform) tip.dataset.baseTransform = tip.style.transform || '';

        if (dx !== 0) {
            tip.style.transform = `${tip.dataset.baseTransform} translateX(${Math.round(dx)}px)`.trim();
        } else {
            tip.style.transform = tip.dataset.baseTransform;
            delete tip.dataset.baseTransform;
        }

        active.add(tip);
    }

    function scheduleActiveFix() {
        if (!active.size) return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            raf = 0;
            active.forEach(fixTip);
        });
    }

    function getTipFromTrigger(trigger) {
        if (!trigger) return null;

        // Most common markup on CorpBonds pages:
        // <span class="tooltip">?</span><span class="tooltip-content">...</span>
        const next = trigger.nextElementSibling;
        if (next && next.classList && next.classList.contains('tooltip-content')) return next;

        // fallback: search in same parent
        const parent = trigger.parentElement;
        if (!parent) return null;

        // try closest tooltip-content nearby
        const alt = parent.querySelector('.tooltip-content');
        return alt || null;
    }

    function observeTip(tip) {
        if (!tip || observed.has(tip)) return;
        observed.add(tip);

        // Observe only this tooltip for style/class changes (position updates).
        const mo = new MutationObserver(() => fixTip(tip));
        mo.observe(tip, { attributes: true, attributeFilter: ['style', 'class'] });

        // run once (in case it's already visible)
        fixTip(tip);
    }

    function activateFromEvent(e) {
        const trigger = e.target && e.target.closest ? e.target.closest('.tooltip') : null;
        if (!trigger) return;

        const tip = getTipFromTrigger(trigger);
        if (!tip) return;

        observeTip(tip);
        fixTip(tip);
    }

    // Activate on user interaction. This avoids observing the entire DOM.
    document.addEventListener('mouseover', activateFromEvent, true);
    document.addEventListener('focusin', activateFromEvent, true);
    document.addEventListener('click', activateFromEvent, true);
    document.addEventListener('touchstart', activateFromEvent, { passive: true, capture: true });

    // Re-clamp visible tooltips on viewport changes.
    window.addEventListener('resize', scheduleActiveFix, { passive: true });
    window.addEventListener('scroll', scheduleActiveFix, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleActiveFix, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleActiveFix, { passive: true });
})();

