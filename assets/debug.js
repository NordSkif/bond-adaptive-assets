document.addEventListener('DOMContentLoaded', () => {
    const scope = document.querySelector('section.bond') || document;

    scope.querySelectorAll('p').forEach(p => {
        const tips = Array.from(p.querySelectorAll(':scope > span.tooltip'));

        tips.forEach((tip, idx) => {
            const content = tip.nextElementSibling;
            const hasContent = content && content.classList.contains('tooltip-content') && content.textContent.trim();

            // нет нормального контента, значит тултип мусорный
            if (!hasContent) {
                tip.remove();
                if (content && content.classList.contains('tooltip-content')) content.remove();
                return;
            }

            // если тултипов несколько, оставляем только первый
            if (idx > 0) {
                tip.remove();
                content.remove();
            }
        });
    });
});
