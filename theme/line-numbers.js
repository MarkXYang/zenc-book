/* Dynamic line numbers for mdBook code blocks */
(function() {
    'use strict';

    function addLineNumbers() {
        const codeBlocks = document.querySelectorAll('pre > code');

        codeBlocks.forEach(function(code) {
            const pre = code.parentElement;
            if (!pre || pre.tagName !== 'PRE') return;

            // Avoid double-processing
            if (pre.classList.contains('has-line-numbers')) return;

            // Skip terminal output blocks
            if (code.classList.contains('language-text') || code.classList.contains('language-console')) {
                return;
            }

            // Get code text
            const text = code.textContent || '';
            if (!text.trim()) return;

            // Count lines
            let lines = text.split('\n');
            // Remove single trailing newline if present (standard pre behavior)
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
            }

            if (lines.length === 0) return;

            // Add class to pre container
            pre.classList.add('has-line-numbers');

            // Build gutter container
            const gutter = document.createElement('div');
            gutter.className = 'line-numbers-gutter';
            gutter.setAttribute('aria-hidden', 'true');

            // Dynamically scale gutter width for 3+ digit code lengths
            if (lines.length >= 1000) {
                gutter.style.minWidth = '4.2rem';
            } else if (lines.length >= 100) {
                gutter.style.minWidth = '3.4rem';
            }

            for (let i = 1; i <= lines.length; i++) {
                const span = document.createElement('span');
                span.className = 'line-number';
                span.textContent = i;
                gutter.appendChild(span);
            }

            // Insert gutter right before the code block
            pre.insertBefore(gutter, code);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addLineNumbers);
    } else {
        addLineNumbers();
    }
})();
