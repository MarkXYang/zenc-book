/* Automatically strip line numbers (e.g. " 1 | ") when copying code in mdBook */
(function() {
    'use strict';

    function initClipboardFilter() {
        // 1. Hook mdBook's built-in copy button handler
        if (typeof window.playground_text === 'function') {
            const originalPlaygroundText = window.playground_text;
            window.playground_text = function(playground, hidden) {
                const raw = originalPlaygroundText(playground, hidden);
                if (!raw) return raw;
                return raw.replace(/^\s*\d+\s*\|\s?/gm, '');
            };
        }

        // 2. Hook manual selection copy (Ctrl+C / Cmd+C / Right-click Copy)
        document.addEventListener('copy', function(e) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const anchorNode = selection.anchorNode;
            if (!anchorNode) return;
            const element = anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement;
            if (!element) return;

            const pre = element.closest('pre');
            if (!pre) return;

            const selectedText = selection.toString();
            if (/^\s*\d+\s*\|/m.test(selectedText)) {
                const cleaned = selectedText.replace(/^\s*\d+\s*\|\s?/gm, '');
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', cleaned);
                    e.preventDefault();
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClipboardFilter);
    } else {
        initClipboardFilter();
    }
})();
