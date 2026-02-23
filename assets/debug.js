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

        var state = { expanded: false, forced: false };

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


        function hasMobilePager() {
            // Если на мобильном включена постраничная пагинация (adaptive.js),
            // лимитер на N строк конфликтует: скрытые классом строки ломают страницы после 20-й.
            // Признаки: таблица внутри .screener__table-wrapper и на ней появился .common-pager / класс is-mobile.
            var wrap = table.closest && table.closest('.screener__table-wrapper');
            if (!wrap) return false;

            if (wrap.classList && wrap.classList.contains('is-mobile')) return true;

            var hasPager = !!(wrap.querySelector && wrap.querySelector('.common-pager'));
            if (!hasPager) return false;

            // ширина как в adaptive.js (vw <= 768)
            if (window.matchMedia) {
                return window.matchMedia('(max-width: 768px)').matches;
            }

            var vw = window.innerWidth || document.documentElement.clientWidth || 0;
            return vw <= 768;
        }


        function apply() {
            var rows = getRows();
            var total = rows.length;

            // На мобильном с постраничной пагинацией (adaptive.js) выключаем лимитер полностью,
            // иначе скрытые по лимиту строки ломают переходы (после 5-й страницы пусто).
            if (hasMobilePager()) {
                rows.forEach(function (tr) { tr.classList.remove('is-hidden-by-limit'); });
                wrap.hidden = true;
                state.forced = true;
                state.expanded = true;
                btn.setAttribute('aria-expanded', 'true');
                btn.textContent = 'Скрыть';
                return;
            }

            // если ранее форсировали expanded для мобильной пагинации, при выходе из неё возвращаем дефолт
            if (state.forced) {
                state.forced = false;
                state.expanded = false;
            }

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


/* --- CorpBonds: FIX "Показать все" в issuer-history на мобиле (portrait <=576px)
   Причина: adaptive.css скрывает строки через display:none!important (nth-child(n+4...)),
   из-за чего штатный expand-скрипт не может корректно управлять количеством строк.
   Решение: на <=576px управляем видимостью строк сами и перебиваем adaptive.css через inline display !important,
   но при этом сохраняем "родной" display строк (grid/table-row и т.п.), чтобы не ломать верстку.
--- */
(() => {
    const MQ = window.matchMedia ? window.matchMedia('(max-width: 576px)') : { matches: false };
    const ART_SEL = 'article.bond-table.issuer-history';
    const TBODY_SEL = 'tbody[data-tabs-target="events"]';
    const EXPAND_SEL = 'a[data-expand="events"]';
    const TAB_BTN_SEL = '.tabs[data-tabs="events"] [data-tab]';

    function getActiveTab(article) {
        const active = article.querySelector('.tabs[data-tabs="events"] [data-tab].active');
        return (active && active.getAttribute('data-tab')) || 'past';
    }

    function ensureSaved(tr) {
        if (tr.dataset.cbDispSaved === '1') return;
        tr.dataset.cbDispSaved = '1';
        tr.dataset.cbDispVal = tr.style.getPropertyValue('display') || '';
        tr.dataset.cbDispPrio = tr.style.getPropertyPriority('display') || '';
    }

    function setDisplayImportant(tr, value) {
        ensureSaved(tr);
        tr.style.setProperty('display', value, 'important');
    }

    function restoreDisplay(tr) {
        if (tr.dataset.cbDispSaved !== '1') return;
        const val = tr.dataset.cbDispVal || '';
        const pr = tr.dataset.cbDispPrio || '';
        if (!val) tr.style.removeProperty('display');
        else tr.style.setProperty('display', val, pr);

        delete tr.dataset.cbDispSaved;
        delete tr.dataset.cbDispVal;
        delete tr.dataset.cbDispPrio;
    }

    function restoreAll(article) {
        const tbody = article.querySelector(TBODY_SEL);
        if (!tbody) return;
        tbody.querySelectorAll('tr[data-cb-disp-saved="1"]').forEach(restoreDisplay);
    }

    function getNativeRowDisplay(article, activeTab) {
        const tbody = article.querySelector(TBODY_SEL);
        if (!tbody) return 'table-row';

        // берем ПЕРВУЮ строку активного таба, которая не скрыта табами.
        const first = Array.from(tbody.querySelectorAll(`tr[data-on-tab="${activeTab}"]`))
            .find((tr) => tr.style.getPropertyValue('display') !== 'none');

        if (!first) return 'table-row';

        // временно убираем inline display (наш или чужой), чтобы увидеть реальный computed display
        const prevVal = first.style.getPropertyValue('display');
        const prevPr  = first.style.getPropertyPriority('display');
        first.style.removeProperty('display');

        const disp = getComputedStyle(first).display;

        // восстанавливаем
        if (prevVal) first.style.setProperty('display', prevVal, prevPr);

        if (!disp || disp === 'none') return 'table-row';
        return disp;
    }

    function isExpanded(expand) {
        // у них это класс + иногда aria-expanded
        return expand.classList.contains('expanded') || expand.getAttribute('aria-expanded') === 'true';
    }

    function apply(article) {
        if (!article) return;

        const tbody = article.querySelector(TBODY_SEL);
        const expand = article.querySelector(EXPAND_SEL);
        if (!tbody || !expand) return;

        // На ширине >576px откатываем наши inline-override и отдаем управление штатной логике/верстке
        if (!MQ.matches) {
            restoreAll(article);
            return;
        }

        // На мобиле хотим стартово показывать свернутый список (даже если сервер/скрипт оставили expanded)
        if (expand.dataset.cbInitCollapsed !== '1') {
            expand.dataset.cbInitCollapsed = '1';
            expand.classList.remove('expanded');
            expand.setAttribute('aria-expanded', 'false');
            var bt = expand.querySelector('.button-text');
            if (bt && bt.dataset && bt.dataset.text1) bt.textContent = bt.dataset.text1;
        }


        const startCount = 3; // mobile: show 3 items before expand
        const activeTab = getActiveTab(article);

        const rowsAll = Array.from(tbody.querySelectorAll('tr[data-on-tab]'));
        const rows = rowsAll.filter((tr) => tr.getAttribute('data-on-tab') === activeTab);

        // если строк мало - просто покажем все и спрячем кнопку (если она есть)
        const expanded = isExpanded(expand);
        const nativeDisp = getNativeRowDisplay(article, activeTab);

        rows.forEach((tr, idx) => {
            if (expanded) {
                setDisplayImportant(tr, nativeDisp);
                return;
            }

            if (idx < startCount) setDisplayImportant(tr, nativeDisp);
            else setDisplayImportant(tr, 'none');
        });

        // неактивные табы не трогаем (но если мы их трогали раньше — восстановим)
        rowsAll.forEach((tr) => {
            const tab = tr.getAttribute('data-on-tab') || '';
            if (tab !== activeTab) restoreDisplay(tr);
        });
    }

    function scanAndApply() {
        document.querySelectorAll(ART_SEL).forEach(apply);
    }

    // клики по expand и табам — применяем после штатной логики (1-2 RAF, чтобы дать отработать табам)
    document.addEventListener('click', (e) => {
        const expand = e.target.closest?.(EXPAND_SEL);
        if (expand) {
            const art = expand.closest?.(ART_SEL);
            if (art) requestAnimationFrame(() => requestAnimationFrame(() => apply(art)));
            return;
        }

        const tabBtn = e.target.closest?.(TAB_BTN_SEL);
        if (tabBtn) {
            const art = tabBtn.closest?.(ART_SEL);
            if (art) requestAnimationFrame(() => requestAnimationFrame(() => apply(art)));
        }
    }, { passive: true });

    // ресайз/поворот — пересчитать/откатить
// matchMedia change
    try {
        if (MQ && typeof MQ.addEventListener === 'function') MQ.addEventListener('change', scanAndApply);
        else if (MQ && typeof MQ.addListener === 'function') MQ.addListener(scanAndApply);
    } catch (e) {}

    // старт: после DOMContentLoaded и еще раз после полной отрисовки (часто табы инициализируются позже)
    const boot = () => {
        scanAndApply();
        setTimeout(scanAndApply, 0);
        setTimeout(scanAndApply, 50);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { passive: true });
    } else {
        boot();
    }
})();

/* --- CorpBonds: RESTORE full screener table on desktop (undo adaptive.js prune/merge)
   Проблема:
   - adaptive.js удаляет колонки (deleteCell) и склеивает "Срок/Дюрация" ВСЕГДА, даже на десктопе.
   - На десктопе в итоге пропадают M-spread / G-spread / Ликвидность, а дюрация скрывается.

   Ограничение:
   - правим только debug.*

   Решение:
   - На ширине >768px (и без force mobile) подтягиваем исходную верстку таблицы через fetch текущей страницы,
     собираем карту значений по data-isin и восстанавливаем недостающие ячейки/заголовки.
   - Дополнительно расклеиваем "Срок/Дюрация" и показываем отдельную дюрацию.
   - На мобиле ничего не ломаем: adaptive.js как и раньше делает "карточный" режим.
--- */
(() => {
    const FORCE_MOBILE = /[?#&](mobile=1|mobile)(?:$|&)/i.test(location.search + location.hash);
    const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;

    const state = {
        cache: null,
        cachePromise: null,
        raf: 0,
        mo: null,
        booted: false,
    };

    function isMobileNow() {
        if (FORCE_MOBILE) return true;
        if (mqMobile) return mqMobile.matches;
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        return vw <= 768;
    }

    function throttle() {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = requestAnimationFrame(() => {
            state.raf = 0;
            run();
        });
    }

    function safeText(el) {
        return (el && el.textContent ? el.textContent : '').trim();
    }

    function currentUrlNoHash() {
        return location.origin + location.pathname + location.search;
    }

    async function ensureCache() {
        if (state.cache) return state.cache;
        if (state.cachePromise) return state.cachePromise;

        state.cachePromise = (async () => {
            const url = currentUrlNoHash();
            const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
            if (!res.ok) throw new Error('fetch failed: ' + res.status);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const srcTable = doc.getElementById('screenerTable');
            if (!srcTable) return null;

            const headTr = (srcTable.tHead && srcTable.tHead.rows && srcTable.tHead.rows[0])
                ? srcTable.tHead.rows[0]
                : srcTable.querySelector('thead tr');

            const th = {
                mSpread: headTr ? (headTr.querySelector('th.mSpread') && headTr.querySelector('th.mSpread').outerHTML) : null,
                gSpread: headTr ? (headTr.querySelector('th.gSpread') && headTr.querySelector('th.gSpread').outerHTML) : null,
                liquidity: headTr ? (headTr.querySelector('th.liquidity') && headTr.querySelector('th.liquidity').outerHTML) : null,
            };

            const rows = new Map();
            srcTable.querySelectorAll('tbody tr[data-isin]').forEach((tr) => {
                const isin = tr.getAttribute('data-isin') || '';
                if (!isin) return;

                const m = tr.querySelector('td.mSpread') ? tr.querySelector('td.mSpread').outerHTML : null;
                const g = tr.querySelector('td.gSpread') ? tr.querySelector('td.gSpread').outerHTML : null;
                const l = tr.querySelector('td.liquidity') ? tr.querySelector('td.liquidity').outerHTML : null;
                const term = safeText(tr.querySelector('td.term'));
                const dur = safeText(tr.querySelector('td.duration'));

                rows.set(isin, {
                    mSpreadHTML: m,
                    gSpreadHTML: g,
                    liquidityHTML: l,
                    termText: term,
                    durationText: dur,
                });
            });

            return { th, rows };
        })();

        try {
            state.cache = await state.cachePromise;
        } catch (e) {
            state.cache = null;
        } finally {
            state.cachePromise = null;
        }

        return state.cache;
    }

    function fallbackTh(cls) {
        const label = {
            mSpread: 'М-спрэд, %',
            gSpread: 'G/[Z]-спрэд, %',
            liquidity: 'Ликвидность',
        }[cls] || cls;

        return `<th class="${cls}" data-field="${cls}"><div>${label}</div></th>`;
    }

    function fallbackTd(cls) {
        const isNum = (cls === 'mSpread' || cls === 'gSpread');
        return `<td class="${cls}${isNum ? ' xls_num' : ''}"></td>`;
    }

    function ensureHeader(table, cache) {
        const headTr = (table.tHead && table.tHead.rows && table.tHead.rows[0])
            ? table.tHead.rows[0]
            : table.querySelector('thead tr');
        if (!headTr) return;

        const thYtm = headTr.querySelector('th.ytm');
        const thDur = headTr.querySelector('th.duration');

        if (thYtm && !headTr.querySelector('th.mSpread')) {
            thYtm.insertAdjacentHTML('afterend', (cache && cache.th && cache.th.mSpread) ? cache.th.mSpread : fallbackTh('mSpread'));
        }

        const thM = headTr.querySelector('th.mSpread');
        if (thM && !headTr.querySelector('th.gSpread')) {
            thM.insertAdjacentHTML('afterend', (cache && cache.th && cache.th.gSpread) ? cache.th.gSpread : fallbackTh('gSpread'));
        }

        if (thDur && !headTr.querySelector('th.liquidity')) {
            thDur.insertAdjacentHTML('afterend', (cache && cache.th && cache.th.liquidity) ? cache.th.liquidity : fallbackTh('liquidity'));
        }
    }

    function unmergeTermDuration(tr, cacheRow) {
        const termTd = tr.querySelector('td.term');
        const durTd = tr.querySelector('td.duration');
        if (!termTd || !durTd) return;

        durTd.style.removeProperty('display');

        if (cacheRow) {
            if (cacheRow.termText) termTd.textContent = cacheRow.termText;
            if (cacheRow.durationText) durTd.textContent = cacheRow.durationText;
            return;
        }

        const t = safeText(termTd);
        if (!t) return;
        if (t.indexOf('/') === -1) return;

        const parts = t.split('/').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
            termTd.textContent = parts[0];
            if (!safeText(durTd)) durTd.textContent = parts[1];
        }
    }

    function ensureRowCells(tr, cacheRow) {
        const tdYtm = tr.querySelector('td.ytm');
        const tdTerm = tr.querySelector('td.term');
        const tdDur = tr.querySelector('td.duration');

        if (!tdYtm || !tdTerm || !tdDur) return;

        if (!tr.querySelector('td.mSpread')) {
            tdYtm.insertAdjacentHTML('afterend', cacheRow && cacheRow.mSpreadHTML ? cacheRow.mSpreadHTML : fallbackTd('mSpread'));
        }

        const tdM = tr.querySelector('td.mSpread') || tdYtm;
        if (!tr.querySelector('td.gSpread')) {
            tdM.insertAdjacentHTML('afterend', cacheRow && cacheRow.gSpreadHTML ? cacheRow.gSpreadHTML : fallbackTd('gSpread'));
        }

        if (!tr.querySelector('td.liquidity')) {
            tdDur.insertAdjacentHTML('afterend', cacheRow && cacheRow.liquidityHTML ? cacheRow.liquidityHTML : '<td class="liquidity"></td>');
        }

        unmergeTermDuration(tr, cacheRow);
    }

    async function repairDesktopTable() {
        if (isMobileNow()) return;

        const table = document.getElementById('screenerTable');
        if (!table || !table.tBodies || !table.tBodies[0]) return;

        const cache = await ensureCache();

        ensureHeader(table, cache);

        const tbody = table.tBodies[0];
        Array.from(tbody.rows || []).forEach((tr) => {
            const isin = tr.getAttribute && tr.getAttribute('data-isin');
            const cacheRow = (isin && cache && cache.rows) ? cache.rows.get(isin) : null;
            ensureRowCells(tr, cacheRow);
        });
    }

    function attachObservers() {
        if (state.booted) return;
        state.booted = true;

        window.addEventListener('resize', throttle, { passive: true });
        try {
            if (mqMobile && typeof mqMobile.addEventListener === 'function') mqMobile.addEventListener('change', throttle);
            else if (mqMobile && typeof mqMobile.addListener === 'function') mqMobile.addListener(throttle);
        } catch (e) {}

        const moBoot = () => {
            const table = document.getElementById('screenerTable');
            const tbody = table && table.tBodies && table.tBodies[0];
            if (!tbody) return false;

            if (state.mo) state.mo.disconnect();
            state.mo = new MutationObserver(throttle);
            state.mo.observe(tbody, { childList: true });
            return true;
        };

        let attempts = 0;
        (function wait() {
            attempts++;
            const ok = moBoot();
            throttle();
            if (ok) return;
            if (attempts < 180) requestAnimationFrame(wait);
        })();
    }

    async function run() {
        if (isMobileNow()) return;
        try {
            await repairDesktopTable();
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachObservers, { once: true });
    } else {
        attachObservers();
    }
})();