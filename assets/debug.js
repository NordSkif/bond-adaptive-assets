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




(function () {
    const GAP = 8;
    const PAD = 12;

    function getViewport() {
        const vv = window.visualViewport;
        if (vv) {
            return {
                w: vv.width,
                h: vv.height,
                ox: vv.offsetLeft,
                oy: vv.offsetTop
            };
        }
        return { w: window.innerWidth, h: window.innerHeight, ox: 0, oy: 0 };
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(v, max));
    }

    function portalToBody(tip) {
        if (tip.__portaled) return;

        tip.__origParent = tip.parentNode;
        tip.__origNext = tip.nextSibling;
        tip.__portaled = true;

        document.body.appendChild(tip);
    }

    function restoreFromBody(tip) {
        if (!tip.__portaled) return;
        const p = tip.__origParent;
        if (!p) return;

        if (tip.__origNext && tip.__origNext.parentNode === p) {
            p.insertBefore(tip, tip.__origNext);
        } else {
            p.appendChild(tip);
        }

        tip.__portaled = false;
    }

    function place(trigger, tip) {
        portalToBody(tip);

        // делаем измеряемым
        tip.style.visibility = 'hidden';
        tip.style.display = 'block';
        tip.style.left = '0px';
        tip.style.top = '0px';

        const { w: vw, h: vh, ox, oy } = getViewport();
        const tr = trigger.getBoundingClientRect();

        const tipW = tip.offsetWidth;
        const tipH = tip.offsetHeight;

        // центрируем относительно триггера
        const centerX = tr.left + tr.width / 2;

        let left = centerX - tipW / 2;
        left = clamp(left, PAD, vw - tipW - PAD);

        // снизу, если не влезает - сверху
        let top = tr.bottom + GAP;
        if (top + tipH > vh - PAD) top = tr.top - GAP - tipH;
        top = clamp(top, PAD, vh - tipH - PAD);

        // с учетом visualViewport offset (важно для мобилы/зум/клавиатура)
        tip.style.left = `${Math.round(left + ox)}px`;
        tip.style.top  = `${Math.round(top + oy)}px`;

        tip.style.visibility = 'visible';
    }

    function hideTip(tip) {
        tip.style.visibility = 'hidden';
        tip.style.display = 'none';
        restoreFromBody(tip);
    }

    // Привязка: показываем по click (для мобилы логичнее, чем hover)
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-tooltip-trigger]');
        const opened = document.querySelector('.tooltip-content[data-opened="1"]');

        // клик вне триггера закрывает открытый тултип
        if (!trigger) {
            if (opened) {
                opened.dataset.opened = "0";
                hideTip(opened);
            }
            return;
        }

        const tip = trigger.querySelector('.tooltip-content');
        if (!tip) return;

        const isOpen = tip.dataset.opened === "1";
        if (opened && opened !== tip) {
            opened.dataset.opened = "0";
            hideTip(opened);
        }

        if (isOpen) {
            tip.dataset.opened = "0";
            hideTip(tip);
        } else {
            tip.dataset.opened = "1";
            place(trigger, tip);
        }
    }, { passive: true });

    // репозиционирование при скролле/ресайзе
    const rep = () => {
        const tip = document.querySelector('.tooltip-content[data-opened="1"]');
        if (!tip) return;
        // триггер у нас — бывший родитель (мы запомнили)
        // но проще найти ближайший активный:
        const trigger = document.querySelector('[data-tooltip-trigger] .tooltip-content[data-opened="1"]')?.closest('[data-tooltip-trigger]');
        // если тултип уже в body, то trigger выше не найдется, поэтому держим ссылку:
        const t = tip.__lastTrigger;
        place(t || trigger, tip);
    };

    window.addEventListener('scroll', rep, { passive: true });
    window.addEventListener('resize', rep, { passive: true });
    window.visualViewport && window.visualViewport.addEventListener('resize', rep, { passive: true });
    window.visualViewport && window.visualViewport.addEventListener('scroll', rep, { passive: true });

    // маленькая доработка: запомним триггер при place
    const _place = place;
    place = function (trigger, tip) {
        tip.__lastTrigger = trigger;
        _place(trigger, tip);
    };
})();