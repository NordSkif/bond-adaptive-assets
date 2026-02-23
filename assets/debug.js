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

        mo.observe(tbody, { childList: true, subtree: true, attributes: true });

        apply();
    }

    document.addEventListener('DOMContentLoaded', function () {
        waitForElement('#screenerTable', function (table) {
            // Важно: на странице "Скринер" мобильная пагинация (adaptive.js) сама управляет видимостью строк.
            // Лимитер на 20 строк конфликтует с пагинацией и делает страницы после 20-й строки пустыми.
            var art = table.closest && table.closest('article');
            if (art && art.matches && art.matches('article.screener.start-content:not(.bond):not(.issuer-tables)')) {
                return;
            }

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
    const PAD = 12; // отступ от края

    const getViewport = () => {
        const vv = window.visualViewport;
        return vv
            ? { w: vv.width, h: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop }
            : { w: window.innerWidth, h: window.innerHeight, ox: 0, oy: 0 };
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

    function fixYaShare(el) {
        if (!el || el.nodeType !== 1) return;

        // если блок скрыт, не трогаем
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;

        // 1) "инструментируем" transform ровно один раз
        // Share2 может переписать transform позже, поэтому проверка по маркеру
        const t = el.style.transform || "";
        if (!t.includes("--cb-shift-x")) {
            const base = (t && t !== "none") ? t + " " : "";
            el.style.transform = base + "translateX(var(--cb-shift-x, 0px))";
        }

        // 2) считаем, насколько вылезли за экран
        // важно: rect после текущего transform
        const { w: vw, ox } = getViewport();
        const r = el.getBoundingClientRect();

        let dx = 0;
        if (r.left < PAD) dx += (PAD - r.left);
        if (r.right > vw - PAD) dx -= (r.right - (vw - PAD));

        // визуальный viewport offset (на мобиле/зуме бывает не 0)
        dx += ox;

        el.style.setProperty("--cb-shift-x", `${Math.round(dx)}px`);
    }

    function scan() {
        document.querySelectorAll(".share-buttons .ya-share2").forEach(fixYaShare);
    }

    // ловим моменты, когда Share2 выставляет transform/показывает блок
    const mo = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === "attributes") {
                const el = m.target;
                if (el.matches?.(".share-buttons .ya-share2")) fixYaShare(el);
            } else if (m.type === "childList") {
                m.addedNodes.forEach((n) => {
                    if (n.nodeType === 1) {
                        if (n.matches?.(".share-buttons .ya-share2")) fixYaShare(n);
                        else n.querySelectorAll?.(".share-buttons .ya-share2").forEach(fixYaShare);
                    }
                });
            }
        }
    });

    mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style", "class"]
    });

    window.addEventListener("resize", scan, { passive: true });
    window.addEventListener("scroll", scan, { passive: true });
    window.visualViewport?.addEventListener("resize", scan, { passive: true });
    window.visualViewport?.addEventListener("scroll", scan, { passive: true });

    scan();
})();


(() => {
    const PAD = 12;

    function viewportWidth() {
        return window.visualViewport ? window.visualViewport.width : window.innerWidth;
    }

    function fixTip(tip) {
        if (!tip || tip.nodeType !== 1) return;

        // фикс только когда реально показан
        const cs = getComputedStyle(tip);
        if (cs.visibility !== 'visible' || cs.display === 'none') return;

        const r = tip.getBoundingClientRect();
        const vw = viewportWidth();

        let dx = 0;
        if (r.left < PAD) dx += (PAD - r.left);
        if (r.right > vw - PAD) dx -= (r.right - (vw - PAD));

        // запоминаем исходный inline transform и добавляем сдвиг
        if (!tip.dataset.baseTransform) tip.dataset.baseTransform = tip.style.transform || '';

        if (dx !== 0) {
            tip.style.transform = `${tip.dataset.baseTransform} translateX(${Math.round(dx)}px)`.trim();
        } else {
            tip.style.transform = tip.dataset.baseTransform;
            delete tip.dataset.baseTransform;
        }
    }

    function scanAndFix(root = document) {
        root.querySelectorAll('.tooltip-content').forEach(fixTip);
    }

    // ловим любые изменения стилей/классов и появление новых тултипов
    const mo = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === 'attributes') fixTip(m.target);
            if (m.type === 'childList') {
                m.addedNodes.forEach((n) => {
                    if (n.nodeType === 1) {
                        if (n.matches?.('.tooltip-content')) fixTip(n);
                        else scanAndFix(n);
                    }
                });
            }
        }
    });

    mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    window.addEventListener('resize', () => scanAndFix(), { passive: true });
    window.addEventListener('scroll', () => scanAndFix(), { passive: true });

    scanAndFix();
})();