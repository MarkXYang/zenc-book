/* Zen C Playground Runner for mdBook */
(function() {
    'use strict';

    var PLAYGROUND_URL = window.ZENC_PLAYGROUND_URL || 'http://127.0.0.1:8787/run';

    function cleanCode(raw) {
        return raw.replace(/^\s*\d+\s*\|\s?/gm, '').trim();
    }

    function isRunnable(codeEl, text) {
        if (codeEl.classList.contains('no_run') || codeEl.classList.contains('ignore')) {
            return false;
        }
        return /(^|\n)\s*(fn\s+main\s*\(|test\s+")/.test(text);
    }

    function detectMode(text) {
        var hasMain = /(^|\n)\s*fn\s+main\s*\(/.test(text);
        var hasTest = /(^|\n)\s*test\s+"/.test(text);
        return (!hasMain && hasTest) ? 'test' : 'run';
    }

    function ensureButtonsContainer(pre) {
        var existing = pre.querySelector('.buttons');
        if (existing) return existing;
        var div = document.createElement('div');
        div.className = 'buttons';
        pre.insertBefore(div, pre.firstChild);
        return div;
    }

    function getOrCreateOutput(pre) {
        var next = pre.nextElementSibling;
        if (next && next.classList.contains('zenc-output-wrap')) {
            return next;
        }
        var wrap = document.createElement('div');
        wrap.className = 'zenc-output-wrap';
        wrap.innerHTML =
            '<div class="zenc-output-header">' +
                '<span class="zenc-output-status"></span>' +
                '<button type="button" class="zenc-output-close" title="Close output">&times;</button>' +
            '</div>' +
            '<pre class="zenc-output-body"></pre>';
        wrap.querySelector('.zenc-output-close').addEventListener('click', function() {
            wrap.remove();
        });
        pre.parentNode.insertBefore(wrap, pre.nextSibling);
        return wrap;
    }

    function renderOutput(pre, ok, statusText, bodyText) {
        var wrap = getOrCreateOutput(pre);
        var statusEl = wrap.querySelector('.zenc-output-status');
        var bodyEl = wrap.querySelector('.zenc-output-body');
        statusEl.textContent = statusText;
        statusEl.className = 'zenc-output-status ' + (ok ? 'zenc-output-status-ok' : 'zenc-output-status-err');
        bodyEl.textContent = bodyText || '(no output)';
    }

    function attachPlayground(codeEl) {
        var pre = codeEl.closest('pre');
        if (!pre || pre.dataset.zencPlaygroundAttached) return;

        var originalCode = cleanCode(codeEl.textContent || '');
        if (!isRunnable(codeEl, originalCode)) return;

        pre.dataset.zencPlaygroundAttached = '1';
        var buttons = ensureButtonsContainer(pre);

        var editor = null;

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'zenc-edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.title = 'Edit this Zen C snippet';

        var runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'zenc-run-btn';
        runBtn.textContent = 'Run';
        runBtn.title = 'Compile and run with Zen C';

        editBtn.addEventListener('click', function() {
            if (!editor) {
                editor = document.createElement('textarea');
                editor.className = 'zenc-editor';
                editor.value = originalCode;
                editor.rows = Math.min(28, Math.max(6, originalCode.split('\n').length + 1));
                codeEl.style.display = 'none';
                pre.appendChild(editor);
                editBtn.textContent = 'Reset';
            } else {
                editor.remove();
                editor = null;
                codeEl.style.display = '';
                editBtn.textContent = 'Edit';
            }
        });

        runBtn.addEventListener('click', function() {
            var codeToRun = editor ? editor.value : originalCode;
            var mode = detectMode(codeToRun);

            runBtn.disabled = true;
            runBtn.textContent = 'Running...';
            renderOutput(pre, true, 'Compiling and running...', '');

            fetch(PLAYGROUND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeToRun, mode: mode })
            })
            .then(function(resp) {
                return resp.json().then(function(data) {
                    return { httpOk: resp.ok, data: data };
                });
            })
            .then(function(res) {
                var d = res.data || {};
                var combined = '';
                if (d.stdout) combined += d.stdout;
                if (d.stderr) combined += (combined ? '\n--- stderr ---\n' : '') + d.stderr;
                var ms = typeof d.elapsed_ms === 'number' ? ' (' + d.elapsed_ms + ' ms)' : '';
                var statusLabel = d.ok
                    ? 'Exited 0' + ms
                    : 'Failed (exit ' + (d.exit_code !== undefined ? d.exit_code : '?') + ')' + ms;
                renderOutput(pre, Boolean(d.ok), statusLabel, combined);
            })
            .catch(function(err) {
                renderOutput(
                    pre,
                    false,
                    'Playground server unreachable',
                    'Could not connect to ' + PLAYGROUND_URL + '.\n' +
                    'Start the local runner with:\n  python3 playground/server.py\n\n(' + err.message + ')'
                );
            })
            .finally(function() {
                runBtn.disabled = false;
                runBtn.textContent = 'Run';
            });
        });

        buttons.appendChild(editBtn);
        buttons.appendChild(runBtn);
    }

    function initPlayground() {
        var blocks = document.querySelectorAll('pre > code.language-zenc');
        for (var i = 0; i < blocks.length; i++) {
            attachPlayground(blocks[i]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPlayground);
    } else {
        initPlayground();
    }
})();
