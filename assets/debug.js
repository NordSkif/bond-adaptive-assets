(() => {
    function wrapTextAndTipIfFlex(tip) {
        const p = tip.parentElement;
        if (!p || p.nodeType !== 1) return;
        if (p.hasAttribute('data-tip-wrapped')) return;

        const cs = getComputedStyle(p);
        if (cs.display !== 'flex' && cs.display !== 'inline-flex') return;

        const wrap = document.createElement('span');
        wrap.className = 'tooltip-inline-wrap';
        wrap.style.minWidth = '0'; // важно для переноса текста внутри flex-item

        // переносим в wrap все ноды до и включая сам tip
        let node = p.firstChild;
        while (node) {
            const next = node.nextSibling;
            wrap.appendChild(node);
            if (node === tip) break;
            node = next;
        }

        p.insertBefore(wrap, p.firstChild);
        p.setAttribute('data-tip-wrapped', '1');
    }

    function fixTooltips(root = document) {
        root.querySelectorAll('span.tooltip:not([data-nbsp-fixed])').forEach(tip => {
            // 1) NBSP в хвост текста перед tip
            const prev = tip.previousSibling;
            if (prev && prev.nodeType === Node.TEXT_NODE) {
                prev.nodeValue = prev.nodeValue.replace(/[ \t\r\n]+$/, '') + '\u00A0';
            } else {
                tip.parentNode.insertBefore(document.createTextNode('\u00A0'), tip);
            }
            tip.setAttribute('data-nbsp-fixed', '1');

            // 2) если родитель flex, делаем text+tip одним flex-item
            wrapTextAndTipIfFlex(tip);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => fixTooltips(), { once: true });
    } else {
        fixTooltips();
    }

    const mo = new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n && n.nodeType === 1) fixTooltips(n);
            }
        }
    });
    mo.observe(document.body, { childList: true, subtree: true });
})();
