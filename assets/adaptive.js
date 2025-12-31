(function () {
  const FORCE_MOBILE = /[?#&](mobile=1|mobile)(?:$|&)/i.test(location.search + location.hash);
  const PAGE_SIZE    = 4;

  const q  = (root, sel) => (root || document).querySelector(sel);
  const qa = (root, sel) => Array.from((root || document).querySelectorAll(sel));

  function boot() {
    const wrap  = q(document, '.screener.bond .screener__table-wrapper')
               || q(document, '.screener__table-wrapper');
    const table = wrap && (q(wrap, '#screenerTable') || document.getElementById('screenerTable'));
    if (!wrap || !table) return false;

    // === Определяем, карточный ли сейчас режим ===
    function isMobile() {
      if (FORCE_MOBILE) return true;

      // единственный источник правды — ширина вьюпорта,
      // как в CSS @media (max-width: 798px)
      const vw =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        document.body.clientWidth ||
        wrap.clientWidth ||
        0;

      return vw <= 768;
    }

    // ===== Пейджер =====
    let pager = q(wrap, '.common-pager');
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'common-pager';
      pager.innerHTML =
        '<div class="rows-count-text">Показано строк: ' +
          '<span class="rows-count-visible">—</span> из ' +
          '<span class="rows-count-all">—</span></div>' +
        '<div class="pager"><div class="wrap"></div></div>';
      wrap.appendChild(pager);
    }

    const pagerWrap     = q(pager, '.pager .wrap');
    const rowsVisibleEl = q(pager, '.rows-count-visible');
    const rowsAllEl     = q(pager, '.rows-count-all');

    const tbody = table.tBodies && table.tBodies[0];
    if (!tbody) return false;

    const getRows = () => Array.from(tbody.rows || []);

    // ===== 1. Удаляем лишние колонки =====
    // Оставляем: Цена (2), YTM (3), Срок (6), Дюрация (7)
    // Удаляем: M-спрэд (4), G-спрэд (5), Ликвидность (8)
    const REMOVE_COL_INDEXES = [8, 5, 4]; // по убыванию индексов

    function pruneRow(tr) {
      if (!tr.cells || !tr.cells.length) return;
      if (tr.dataset.pruned === '1') return;

      REMOVE_COL_INDEXES.forEach(idx => {
        if (idx >= 0 && idx < tr.cells.length) {
          tr.deleteCell(idx);
        }
      });

      tr.dataset.pruned = '1';
    }

    function pruneColumns() {
      const thead = table.tHead;
      if (thead && !thead.dataset.pruned) {
        Array.from(thead.rows || []).forEach(pruneRow);
        thead.dataset.pruned = '1';
      }
      getRows().forEach(pruneRow);
    }

    // ===== 2. Склейка "Срок / Дюрация" =====
    function mergeTermAndDuration() {
      getRows().forEach(tr => {
        if (tr.dataset.mergedTermDur === '1') return;

        const termTd = tr.querySelector('td.term.xls_num');
        const durTd  = tr.querySelector('td.duration.xls_num');
        if (!termTd || !durTd) return;

        const termText = (termTd.textContent || '').trim();
        const durText  = (durTd.textContent  || '').trim();
        if (!durText) return;

        termTd.textContent = termText
          ? termText + ' / ' + durText
          : durText;

        // саму дюрацию прячем
        durTd.style.display = 'none';

        tr.dataset.mergedTermDur = '1';
      });
    }

    // ===== 3. Пагинация =====
    function ensurePagerFrame() {
      if (!pagerWrap) return null;

      let nums = pagerWrap.querySelector('.wrap.pg-numbers');
      const prev = pagerWrap.querySelector('.pg-prev');
      const next = pagerWrap.querySelector('.pg-next');
      if (nums && prev && next) return nums;

      pagerWrap.innerHTML = '';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'pagination-style pg-prev';
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', () => {
        const cur = +pagerWrap.dataset.page || 1;
        if (cur > 1) showPage(cur - 1);
      });

      nums = document.createElement('div');
      nums.className = 'wrap pg-numbers';

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'pagination-style pg-next';
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', () => {
        const cur   = +pagerWrap.dataset.page || 1;
        const pages = Math.max(1, Math.ceil(getRows().length / PAGE_SIZE));
        if (cur < pages) showPage(cur + 1);
      });

      pagerWrap.append(prevBtn, nums, nextBtn);
      return nums;
    }

    function renderPager(current, pages) {
      if (!pagerWrap || !isMobile() || pages <= 1) {
        if (pagerWrap) pagerWrap.innerHTML = '';
        return;
      }

      const nums = ensurePagerFrame();
      if (!nums) return;
      nums.innerHTML = '';

      const makeBtn = (p, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pagination-style pg-num';
        b.textContent = label || p;
        b.addEventListener('click', () => showPage(p));
        if (p === current) b.classList.add('is-active');
        return b;
      };

      const makeEll = () => {
        const s = document.createElement('span');
        s.className = 'pg-ellipsis';
        s.textContent = '…';
        return s;
      };

      if (pages <= 7) {
        for (let i = 1; i <= pages; i++) nums.append(makeBtn(i));
      } else if (current <= 5) {
        for (let i = 1; i <= 5; i++) nums.append(makeBtn(i));
        nums.append(makeEll(), makeBtn(pages));
      } else if (current >= pages - 4) {
        nums.append(makeBtn(1), makeEll());
        for (let i = pages - 4; i <= pages; i++) nums.append(makeBtn(i));
      } else {
        nums.append(
          makeBtn(1), makeEll(),
          makeBtn(current - 1), makeBtn(current), makeBtn(current + 1),
          makeEll(), makeBtn(pages)
        );
      }

      const prev = pagerWrap.querySelector('.pg-prev');
      const next = pagerWrap.querySelector('.pg-next');
      if (prev) prev.disabled = current <= 1;
      if (next) next.disabled = current >= pages;

      pagerWrap.dataset.page = String(current);
    }

    function showPage(p) {
      const rows   = getRows();
      const total  = rows.length;
      const mobile = isMobile();
      const pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page   = Math.min(Math.max(1, p || 1), pages);

      if (!mobile) {
        rows.forEach(tr => { tr.style.display = ''; });
        if (pagerWrap) pagerWrap.innerHTML = '';
        if (rowsVisibleEl) rowsVisibleEl.textContent = String(total);
        if (rowsAllEl)     rowsAllEl.textContent     = String(total);
        return;
      }

      const start = (page - 1) * PAGE_SIZE;
      const end   = page * PAGE_SIZE;

      rows.forEach((tr, i) => {
        tr.style.display = (i >= start && i < end) ? '' : 'none';
      });

      if (rowsAllEl)     rowsAllEl.textContent     = String(total);
      if (rowsVisibleEl) rowsVisibleEl.textContent = String(
        Math.min(PAGE_SIZE, Math.max(0, total - start))
      );

      renderPager(page, pages);
    }

    // ===== 4. Иконки inline в заголовке (для карточек) =====
    function injectParamsInline() {
      if (!isMobile()) return;

      getRows().forEach(tr => {
        const titleDiv = tr.querySelector('td.title > div');
        const paramsTd = tr.querySelector('td.params');
        if (!titleDiv || !paramsTd) return;

        if (titleDiv.querySelector('.params-inline')) return;

        const icons = paramsTd.querySelectorAll('img');
        if (!icons.length) return;

        const span = document.createElement('span');
        span.className = 'params-inline';

        icons.forEach(icon => {
          span.appendChild(icon.cloneNode(true));
        });

        const plusBlock = titleDiv.querySelector('.icons');
        titleDiv.insertBefore(span, plusBlock || null);
      });
    }

    // ===== 5. Основное применение =====
    function apply() {
      pruneColumns();
      mergeTermAndDuration();

      const rows   = getRows();
      const total  = rows.length;
      const mobile = isMobile();
      const pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));

      wrap.classList.toggle('is-mobile', !!mobile);

      if (mobile) {
        injectParamsInline();
        const current = Math.min(
          Math.max(1, +((pagerWrap && pagerWrap.dataset.page) || 1)),
          pages
        );
        showPage(current);
      } else {
        showPage(1);
      }
    }

    // Наблюдаем за изменениями строк
    const moRows = new MutationObserver(() => scheduleApply());
    moRows.observe(tbody, { childList: true });

    let rafId = null;
    function scheduleApply() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        apply();
      });
    }

    // Реагируем на ресайз
    window.addEventListener('resize', scheduleApply, { passive: true });

    // Первый запуск
    scheduleApply();
    return true;
  }

  // ===== Ленивая инициализация, если таблицу подгружают позже =====
  if (!boot()) {
    const root = document.getElementById('screener_results_wrap')
              || document.getElementById('screener_results')
              || document.body;

    const mo = new MutationObserver(() => {
      if (boot()) mo.disconnect();
    });

    mo.observe(root, { subtree: true, childList: true });

    document.addEventListener('DOMContentLoaded', () => {
      boot();
    });
  }
})();