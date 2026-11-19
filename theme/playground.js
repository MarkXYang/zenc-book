/* Zen C Playground Runner for mdBook (Phone/iPad-ready hybrid: Instant Pre-computed + Optional Live Server) */
(function() {
    'use strict';

    var STORAGE_KEY = 'zenc_playground_url';

    function isLocalHost() {
        var h = window.location.hostname;
        return h === 'localhost' || h === '127.0.0.1' || h === '';
    }

    function getConfiguredServerUrl() {
        try {
            var saved = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
            if (saved && saved.trim()) return saved.trim();
        } catch (e) {}
        if (window.ZENC_PLAYGROUND_URL) return window.ZENC_PLAYGROUND_URL;
        if (isLocalHost()) return 'http://127.0.0.1:8787/run';
        return '';
    }

    function cleanCode(raw) {
        return raw.replace(/^\s*\d+\s*\|\s?/gm, '').trim();
    }

    function fnv1a32Hex(text) {
        var h = 0x811c9dc5;
        for (var i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i) & 0xff;
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ('00000000' + h.toString(16)).slice(-8);
    }

    function lookupPrecomputed(code) {
        var map = window.ZENC_PRECOMPUTED_OUTPUTS;
        if (!map) return null;
        return map[fnv1a32Hex(code)] || null;
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

    function promptServerConfig() {
        var current = getConfiguredServerUrl();
        var input = window.prompt(
            'Enter a live Zen C Playground HTTPS URL (e.g. https://your-app.onrender.com/run), or leave empty to use built-in pre-computed outputs:',
            current
        );
        if (input === null) return;
        try {
            if (input.trim()) {
                window.localStorage.setItem(STORAGE_KEY, input.trim());
            } else {
                window.localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {}
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
                '<span class="zenc-output-actions">' +
                    '<button type="button" class="zenc-output-cfg" title="Configure live playground server URL">&#9881; Server</button>' +
                    '<button type="button" class="zenc-output-close" title="Close output">&times;</button>' +
                '</span>' +
            '</div>' +
            '<pre class="zenc-output-body"></pre>';
        wrap.querySelector('.zenc-output-cfg').addEventListener('click', promptServerConfig);
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

    function formatResultBody(d) {
        var combined = '';
        if (d.stdout) combined += d.stdout;
        if (d.stderr) combined += (combined ? '\n--- stderr ---\n' : '') + d.stderr;
        return combined;
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
        runBtn.title = 'Run Zen C example';

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
            var codeToRun = cleanCode(editor ? editor.value : originalCode);
            var cached = lookupPrecomputed(codeToRun);
            var serverUrl = getConfiguredServerUrl();
            var isEdited = (codeToRun !== originalCode);

            // On GitHub Pages / mobile without a configured live server, serve verified cached output instantly
            if (!serverUrl) {
                if (cached) {
                    var ms = typeof cached.elapsed_ms === 'number' ? ' (' + cached.elapsed_ms + ' ms)' : '';
                    renderOutput(pre, Boolean(cached.ok), 'Verified output (zc)' + ms, formatResultBody(cached));
                    return;
                }
                renderOutput(
                    pre,
                    false,
                    isEdited ? 'Live server needed for edited code' : 'Interactive / external-library example',
                    isEdited
                        ? 'Unmodified book examples run instantly with zero server.\n' +
                          'To execute custom edited code on phone/tablet, deploy playground/Dockerfile (e.g. Render or Fly.io) and click "\u2699 Server" above to set your HTTPS URL.'
                        : 'This example requires interactive stdin or external system libraries (e.g. Raylib / X11) and cannot run in static mode.\n' +
                          'Run it locally with: zc run -q <file.zc>'
                );
                return;
            }

            // Live server configured (local dev or hosted HTTPS playground)
            var mode = detectMode(codeToRun);
            runBtn.disabled = true;
            runBtn.textContent = 'Running...';
            renderOutput(pre, true, 'Compiling and running...', '');

            fetch(serverUrl, {
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
                var ms = typeof d.elapsed_ms === 'number' ? ' (' + d.elapsed_ms + ' ms)' : '';
                var statusLabel = d.ok
                    ? 'Exited 0' + ms
                    : 'Failed (exit ' + (d.exit_code !== undefined ? d.exit_code : '?') + ')' + ms;
                renderOutput(pre, Boolean(d.ok), statusLabel, formatResultBody(d));
            })
            .catch(function(err) {
                if (cached) {
                    renderOutput(
                        pre,
                        Boolean(cached.ok),
                        'Verified output (cached fallback)',
                        formatResultBody(cached)
                    );
                } else {
                    renderOutput(
                        pre,
                        false,
                        'Playground server unreachable',
                        'Could not connect to ' + serverUrl + '.\n' +
                        'Click "\u2699 Server" above to configure a hosted HTTPS playground URL or clear it to use built-in verified outputs.\n\n(' + err.message + ')'
                    );
                }
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
