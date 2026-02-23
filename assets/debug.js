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


/* === Mobile fix: issuer-history "Показать все / Свернуть" (data-expand) ===
   На <=576px в adaptive.css есть правило, которое всегда скрывает строки начиная с 4-й:
   tr:nth-child(n+4 ...) { display:none !important; }
   Из-за !important штатный JS не может показать все строки в портретной ориентации.
   Здесь мы на мобиле перехватываем клик и принудительно выставляем inline display с !important. */
(function () {
    'use strict';

    var MOBILE_MAX = 576;

    function isMobile() {
        return window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
    }

    function asInt(v, fallback) {
        var n = parseInt(v, 10);
        return isFinite(n) ? n : fallback;
    }

    function getDisplayToShow(tr) {
        // Для table rows корректнее всего table-row
        if (tr && tr.closest && tr.closest('table')) return 'table-row';
        return 'block';
    }

    function savePrevDisplay(tr) {
        if (!tr || tr.dataset.cbPrevDisplaySaved === '1') return;
        tr.dataset.cbPrevDisplaySaved = '1';
        tr.dataset.cbPrevDisplayValue = tr.style.getPropertyValue('display') || '';
        tr.dataset.cbPrevDisplayPriority = tr.style.getPropertyPriority('display') || '';
    }

    function restorePrevDisplay(tr) {
        if (!tr || tr.dataset.cbPrevDisplaySaved !== '1') return;

        var prevVal = tr.dataset.cbPrevDisplayValue || '';
        var prevPr = tr.dataset.cbPrevDisplayPriority || '';

        if (prevVal) {
            tr.style.setProperty('display', prevVal, prevPr);
        } else {
            tr.style.removeProperty('display');
        }

        delete tr.dataset.cbPrevDisplaySaved;
        delete tr.dataset.cbPrevDisplayValue;
        delete tr.dataset.cbPrevDisplayPriority;
    }

    function setBtnText(link, expanded) {
        var span = link.querySelector('.button-text');
        var t1 = span && span.dataset && span.dataset.text1 ? span.dataset.text1 : null;
        var t2 = span && span.dataset && span.dataset.text2 ? span.dataset.text2 : null;

        if (span) {
            span.textContent = expanded ? (t2 || 'Свернуть') : (t1 || 'Показать все');
        } else {
            link.textContent = expanded ? (t2 || 'Свернуть') : (t1 || 'Показать все');
        }

        link.classList.toggle('expanded', expanded);
        link.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function applyExpand(link) {
        if (!link) return;

        var scope = link.closest('.bond-table.issuer-history');
        if (!scope) return;

        // На десктопе/ландшафте не вмешиваемся и чистим то, что могли поставить на мобиле
        if (!isMobile()) {
            var tbodies = scope.querySelectorAll('tbody');
            tbodies.forEach(function (tbody) {
                Array.prototype.forEach.call(tbody.querySelectorAll('tr'), restorePrevDisplay);
            });
            return;
        }

        var group = link.dataset.expand || 'events';
        var startCount = asInt(link.dataset.startVisibleCount, 10);
        var expanded = link.classList.contains('expanded');

        var tbody = scope.querySelector('tbody[data-tabs-target="' + group + '"]') || scope.querySelector('tbody');
        if (!tbody) return;

        var tabs = scope.querySelector('.tabs[data-tabs="' + group + '"]');
        var activeTabEl = tabs ? tabs.querySelector('[data-tab].active') : null;
        var tabName = activeTabEl ? activeTabEl.getAttribute('data-tab') : null;

        var allRows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
        var hasTabs = !!(tabName && allRows.some(function (tr) { return tr.hasAttribute('data-on-tab'); }));

        var activeRows = hasTabs
            ? allRows.filter(function (tr) { return tr.getAttribute('data-on-tab') === tabName; })
            : allRows;

        // 1) Инактивные табы прячем (важно, если ранее мы ставили inline !important)
        if (hasTabs) {
            allRows.forEach(function (tr) {
                var onTab = tr.getAttribute('data-on-tab');
                if (onTab && onTab !== tabName) {
                    savePrevDisplay(tr);
                    tr.style.setProperty('display', 'none', 'important');
                }
            });
        }

        // 2) Активный таб: expanded => показать все; collapsed => только первые startCount
        var showDisp = activeRows.length ? getDisplayToShow(activeRows[0]) : 'table-row';

        activeRows.forEach(function (tr, idx) {
            savePrevDisplay(tr);

            if (expanded) {
                tr.style.setProperty('display', showDisp, 'important');
            } else {
                if (idx < startCount) tr.style.setProperty('display', showDisp, 'important');
                else tr.style.setProperty('display', 'none', 'important');
            }
        });

        setBtnText(link, expanded);
    }

    function init() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.bond-table.issuer-history a[data-expand]'));
        if (!links.length) return;

        links.forEach(function (link) {
            if (link.dataset.cbExpandInited === '1') return;
            link.dataset.cbExpandInited = '1';

            // синхронизируем текст по текущему состоянию (класс expanded может быть проставлен сервером)
            applyExpand(link);

            // Перехватываем клик НА МОБИЛЕ, чтобы !important из adaptive.css не ломал поведение
            link.addEventListener('click', function (e) {
                if (!isMobile()) return; // на ширине >576 пусть работает штатный код

                e.preventDefault();
                e.stopImmediatePropagation();

                // toggle
                link.classList.toggle('expanded');
                applyExpand(link);
            }, true);

            // При клике по табам просто пере-применяем после штатной логики (без stop)
            var scope = link.closest('.bond-table.issuer-history');
            var group = link.dataset.expand || 'events';
            var tabs = scope ? scope.querySelector('.tabs[data-tabs="' + group + '"]') : null;

            if (tabs) {
                tabs.addEventListener('click', function (e) {
                    if (!isMobile()) return;
                    var tabBtn = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
                    if (!tabBtn) return;
                    // Даем штатному обработчику переключить .active и inline display
                    setTimeout(function () { applyExpand(link); }, 0);
                }, true);
            }
        });

        // Реагируем на повороты/resize: на десктопе чистим inline !important, на мобиле применяем
        var raf = 0;
        function onResize() {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(function () {
                raf = 0;
                links.forEach(applyExpand);
            });
        }

        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onResize, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

