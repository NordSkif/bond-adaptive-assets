(() => {
    function glueTooltips(root = document) {
        root.querySelectorAll('span.tooltip:not([data-glued])').forEach(tip => {
            const p = tip.parentElement;
            if (!p) return;

            const cs = getComputedStyle(p);
            if (cs.display !== 'flex' && cs.display !== 'inline-flex') return;

            // создаем враппер-строку (один flex-item)
            const wrap = document.createElement('span');
            wrap.className = 'tooltip-glue';
            wrap.style.minWidth = '0';

            // переносим в wrap текстовые ноды/инлайны ДО tooltip и сам tooltip
            let node = p.firstChild;
            while (node) {
                const next = node.nextSibling;
                wrap.appendChild(node);
                if (node === tip) break;
                node = next;
            }

            // вставляем wrap обратно
            p.insertBefore(wrap, p.firstChild);

            // если после tooltip есть tooltip-content и он должен оставаться рядом - тоже можно внутрь wrap:
            const nextEl = wrap.nextSibling;
            if (nextEl && nextEl.nodeType === 1 && nextEl.classList.contains('tooltip-content')) {
                wrap.appendChild(nextEl);
            }

            tip.dataset.glued = '1';
        });
    }

    const run = () => glueTooltips(document);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }

    new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
            if (n && n.nodeType === 1) glueTooltips(n);
        }
    }).observe(document.body, { childList: true, subtree: true });
})();
