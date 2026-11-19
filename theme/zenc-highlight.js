/* Zen C syntax highlighting grammar for mdBook's highlight.js */
(function() {
    'use strict';

    function registerZenC(hljs) {
        var KEYWORDS =
            'fn let def struct enum union trait impl alias opaque ' +
            'import include use extern export raw asm volatile ' +
            'if else match for in while loop break continue return defer ' +
            'and or not ref comptime embed sizeof test assert expect ' +
            'println print eprintln eprint panic';

        var TYPES =
            'void bool char int uint float double string ' +
            'i8 i16 i32 i64 i128 isize ' +
            'u8 u16 u32 u64 u128 usize ' +
            'f32 f64 ' +
            'Option Result Vec String Slice Map Box Mutex CondVar Thread ' +
            'File JsonValue TcpListener TcpStream Duration Time';

        var LITERALS = 'true false NULL null self Self';

        var INTERPOLATION = {
            className: 'subst',
            begin: /\{/,
            end: /\}/,
            keywords: {
                keyword: KEYWORDS,
                type: TYPES,
                literal: LITERALS
            }
        };

        var STRING_MODE = {
            className: 'string',
            begin: '"',
            end: '"',
            illegal: '\\n',
            contains: [
                hljs.BACKSLASH_ESCAPE,
                INTERPOLATION
            ]
        };

        var CHAR_MODE = {
            className: 'string',
            begin: "'",
            end: "'",
            illegal: '\\n',
            contains: [hljs.BACKSLASH_ESCAPE]
        };

        var BUILD_DIRECTIVE = {
            className: 'meta',
            begin: /\/\/\>.*/,
            relevance: 5
        };

        var ATTRIBUTE = {
            className: 'meta',
            begin: /@[A-Za-z_][A-Za-z0-9_]*/,
            contains: [
                {
                    begin: /\(/,
                    end: /\)/,
                    contains: [STRING_MODE, hljs.C_NUMBER_MODE]
                }
            ]
        };

        var PREPROCESSOR = {
            className: 'meta',
            begin: /#\s*[a-zA-Z_]+/,
            end: /$/,
            contains: [
                STRING_MODE,
                { className: 'meta-string', begin: /<[^>]+>/ }
            ]
        };

        var FN_DECL = {
            className: 'function',
            beginKeywords: 'fn',
            end: /[\(\{<]/,
            excludeEnd: true,
            contains: [
                hljs.inherit(hljs.TITLE_MODE, { begin: /[A-Za-z_][A-Za-z0-9_]*/ })
            ]
        };

        var TYPE_DECL = {
            className: 'class',
            beginKeywords: 'struct enum union trait impl',
            end: /[\{<;]/,
            excludeEnd: true,
            contains: [
                hljs.inherit(hljs.TITLE_MODE, { begin: /[A-Za-z_][A-Za-z0-9_]*/ })
            ]
        };

        return {
            name: 'Zen C',
            aliases: ['zc'],
            keywords: {
                keyword: KEYWORDS,
                type: TYPES,
                literal: LITERALS
            },
            contains: [
                BUILD_DIRECTIVE,
                hljs.C_LINE_COMMENT_MODE,
                hljs.C_BLOCK_COMMENT_MODE,
                PREPROCESSOR,
                ATTRIBUTE,
                STRING_MODE,
                CHAR_MODE,
                FN_DECL,
                TYPE_DECL,
                hljs.C_NUMBER_MODE
            ]
        };
    }

    function highlightZenCBlocks() {
        if (typeof window.hljs === 'undefined') return;

        window.hljs.registerLanguage('zenc', registerZenC);

        var blocks = document.querySelectorAll('pre > code.language-zenc, pre > code.language-zc');
        for (var i = 0; i < blocks.length; i++) {
            var el = blocks[i];
            el.classList.remove('hljs');
            if (typeof window.hljs.highlightElement === 'function') {
                window.hljs.highlightElement(el);
            } else if (typeof window.hljs.highlightBlock === 'function') {
                window.hljs.highlightBlock(el);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', highlightZenCBlocks);
    } else {
        highlightZenCBlocks();
    }
})();
