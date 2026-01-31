function fixTooltipNbsp(root = document) {
    root.querySelectorAll('section.bond span.tooltip:not([data-nbsp-fixed])').forEach(tip => {
        const prev = tip.previousSibling;

        if (prev && prev.nodeType === Node.TEXT_NODE) {
            prev.nodeValue = prev.nodeValue.replace(/\s*$/, '\u00A0');
        } else {
            tip.parentNode.insertBefore(document.createTextNode('\u00A0'), tip);
        }

        tip.setAttribute('data-nbsp-fixed', '1');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fixTooltipNbsp();

    const host = document.querySelector('section.bond');
    if (!host) return;

    const mo = new MutationObserver(() => fixTooltipNbsp(host));
    mo.observe(host, { childList: true, subtree: true });
});
