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

function placeTooltip(triggerEl, tooltipEl, opts = {}) {
    const gap = opts.gap ?? 8;
    const padding = opts.padding ?? 12;

    // делаем измеряемым
    const prevVis = tooltipEl.style.visibility;
    const prevDisp = tooltipEl.style.display;

    tooltipEl.style.position = 'fixed';
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.display = 'block';
    tooltipEl.style.left = '0px';
    tooltipEl.style.top = '0px';

    const tipW = tooltipEl.offsetWidth;
    const tipH = tooltipEl.offsetHeight;
    const tr = triggerEl.getBoundingClientRect();

    // базово: по центру иконки
    let left = tr.left + tr.width / 2 - tipW / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tipW - padding));

    // базово: снизу
    let top = tr.bottom + gap;

    // если не влезает снизу - ставим сверху
    if (top + tipH > window.innerHeight - padding) {
        top = tr.top - gap - tipH;
    }
    top = Math.max(padding, Math.min(top, window.innerHeight - tipH - padding));

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.visibility = prevVis || 'visible';
    tooltipEl.style.display = prevDisp || 'block';
}

// пример хука на показ
function showTooltip(triggerEl) {
    const tip = triggerEl.querySelector('.tooltip-content') || document.querySelector('.tooltip-content');
    if (!tip) return;
    tip.style.visibility = 'visible';
    placeTooltip(triggerEl, tip);
}

// полезно пере-позиционировать на resize/scroll
window.addEventListener('resize', () => {
    document.querySelectorAll('.tooltip-content[style*="visibility: visible"]').forEach(tip => {
        const trigger = tip.closest('[data-tooltip-trigger]') || tip.parentElement;
        if (trigger) placeTooltip(trigger, tip);
    });
}, { passive: true });

window.addEventListener('scroll', () => {
    document.querySelectorAll('.tooltip-content[style*="visibility: visible"]').forEach(tip => {
        const trigger = tip.closest('[data-tooltip-trigger]') || tip.parentElement;
        if (trigger) placeTooltip(trigger, tip);
    });
}, { passive: true });