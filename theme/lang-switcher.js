/* Language switcher between English (/) and Chinese (/zh/) */
(function() {
    'use strict';

    function buildTargetUrl() {
        var path = window.location.pathname;
        var isZh = /\/zh(\/|$)/.test(path);
        var newPath;
        if (isZh) {
            newPath = path.replace(/\/zh(\/|$)/, '$1');
            if (!newPath) newPath = '/';
        } else {
            var lastSlash = path.lastIndexOf('/');
            if (lastSlash === -1) {
                newPath = '/zh/' + path;
            } else {
                newPath = path.slice(0, lastSlash + 1) + 'zh/' + path.slice(lastSlash + 1);
            }
        }
        return newPath + window.location.search + window.location.hash;
    }

    function initLangSwitcher() {
        var rightButtons = document.querySelector('.right-buttons');
        if (!rightButtons || document.querySelector('.zenc-lang-switch')) return;

        var isZh = /\/zh(\/|$)/.test(window.location.pathname);
        var link = document.createElement('a');
        link.className = 'zenc-lang-switch';
        link.href = buildTargetUrl();
        link.textContent = isZh ? 'English' : '中文';
        link.title = isZh ? 'Switch to English' : '切换到中文版';

        rightButtons.insertBefore(link, rightButtons.firstChild);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLangSwitcher);
    } else {
        initLangSwitcher();
    }
})();
