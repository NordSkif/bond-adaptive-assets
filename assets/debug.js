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
    function killViewAll() {
        // 1) Снимаем сам режим попапа
        var row = document.querySelector('.screener__filters-row');
        if (row) row.classList.remove('view-all');

        // 2) Глушим кнопки (десктоп и моб, если обе есть)
        var btnIds = ['show_all_filters', 'show_all_filters_mobile'];
        btnIds.forEach(function (id) {
            var btn = document.getElementById(id);
            if (!btn) return;

            // снимаем jQuery-обработчики, если jQuery есть
            if (window.jQuery) window.jQuery(btn).off('click');

            // и добиваем нативно
            btn.onclick = function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return false;
            };

            btn.classList.remove('expanded');
            btn.setAttribute('aria-expanded', 'false');
        });
    }

    // Запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', killViewAll);
    } else {
        killViewAll();
    }

    // 3) Последняя линия обороны: блокируем клики по кнопкам в capture-фазе
    document.addEventListener(
        'click',
        function (e) {
            var t = e.target && e.target.closest
                ? e.target.closest('#show_all_filters, #show_all_filters_mobile')
                : null;

            if (!t) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            killViewAll();
        },
        true
    );

    // 4) Если класс все равно прилетает откуда-то, сразу снимаем
    var mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
            if (m.type !== 'attributes' || m.attributeName !== 'class') return;
            var el = m.target;
            if (!el.classList) return;
            if (el.classList.contains('screener__filters-row') && el.classList.contains('view-all')) {
                el.classList.remove('view-all');
            }
        });
    });

    mo.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
    });
})();
