(() => {
    function fixTooltipGlue(root) {
        const scope = root && root.querySelectorAll ? root : document;

        const tips = scope.querySelectorAll('span.tooltip:not([data-nbsp-fixed])');
        tips.forEach(tip => {
            // опционально: если tooltip бывает не только "?"
            // if (tip.textContent.trim() !== '?') return;

            const prev = tip.previousSibling;

            if (prev && prev.nodeType === Node.TEXT_NODE) {
                // убираем хвостовые пробелы/переводы строк и добавляем NBSP
                prev.nodeValue = prev.nodeValue.replace(/[ \t\r\n]+$/, '') + '\u00A0';
            } else {
                // если перед tooltip не текст (или вообще ничего), вставляем NBSP отдельной нодой
                tip.parentNode.insertBefore(document.createTextNode('\u00A0'), tip);
            }

            tip.setAttribute('data-nbsp-fixed', '1');
        });
    }

    function boot() {
        fixTooltipGlue(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    // На случай динамической подгрузки/перерендера
    const mo = new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n && n.nodeType === 1) fixTooltipGlue(n);
            }
        }
    });

    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
})();
