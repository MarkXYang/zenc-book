# Appendix E: MISRA C Compliance Rules Reference

When targeting safety-critical embedded, automotive, aerospace, or industrial systems, passing `--misra` to `zc` enables MISRA C compliance checks and generates MISRA-friendly C11 code.

```sh
zc build --misra main.zc
```

## How Zen C Enforces MISRA C

Zen C's `--misra` mode validates both **MISRA C directives/rules** (Rules 1.x through 22.x and Directives 4.x) and **Zen C-specific safety rules** (`rule_zen_1_*`, `rule_zen_2_*`). Diagnostics pinpoint the exact Zen C source line before C compilation begins.

## Covered Rule Categories

The Zen C test suite (`tests/misra/`) verifies compliance across the following major MISRA C rule groups:

| Rule Group | Focus Area | Examples Checked |
| :--- | :--- | :--- |
| **Dir 4.1 – 4.16** | Design, runtime failures, header hygiene | Parameter validation, overflow/bounds awareness, resource limits. |
| **Rules 1.1 – 3.2** | Standard C conformance & comments | Valid C11 constructs, no nested/ambiguous comments. |
| **Rules 4.1 – 5.10** | Character sets & identifier uniqueness | Escape sequence validity, distinct external/internal identifier names. |
| **Rules 6.1 – 7.4** | Bitfields & literals | Valid bitfield base types, octal/suffix/string-literal rules. |
| **Rules 8.1 – 8.14** | Declarations, linkage & `const`/`restrict` | Explicit types, matching prototypes, single-definition linkage. |
| **Rules 9.1 – 9.5** | Initialization | Reading only initialized variables, complete array/struct initializers. |
| **Rules 10.1 – 10.8** | Essential type model | No implicit signed/unsigned or narrowing arithmetic conversions. |
| **Rules 11.1 – 11.9** | Pointer conversions | No unsafe pointer-to-integer casts, `NULL` pointer conventions. |
| **Rules 12.1 – 12.4** | Precedence & evaluation order | Explicit parentheses in complex expressions, no side-effect ambiguity. |
| **Rules 13.1 – 13.6** | Side effects | No assignment inside conditions, no side effects in `sizeof`. |
| **Rules 14.1 – 14.4** | Control flow & loops | Loop counter discipline, boolean conditions in `if`/`while`. |
| **Rules 15.1 – 15.7** | `goto`, `break`, `return` & `else` | Structured exits, single-purpose branches, `if ... else if ... else` termination. |
| **Rules 16.1 – 16.7** | `switch` / `match` statements | Exhaustive branches and explicit termination. |
| **Rules 17.1 – 17.8** | Functions & recursion | Checking non-void return values (Rule 17.7), avoiding unbounded recursion (Rule 17.2). |
| **Rules 18.1 – 18.8** | Pointers & arrays | Bounds-safe pointer arithmetic, avoiding VLAs (Rule 18.8). |
| **Rules 19.1 – 19.2** | Overlapping storage & `union` | Avoiding unsafe `union` type punning. |
| **Rules 20.1 – 20.14** | Preprocessor directives | Include placement, macro hygiene (`#define` / `#undef` discipline). |
| **Rules 21.1 – 21.12** | Standard library restrictions | Flagging banned C runtime functions (e.g., `atoi`, `malloc` in strict modes, `<setjmp.h>`). |
| **Rules 22.1 – 22.6** | Resource management | Ensuring opened resources (`FILE*`, dynamic handles) are properly released. |

## Practical Tips for `--misra` Builds

1. **Always check return values** (Rule 17.7): assign or explicitly handle results from functions returning `Result<T, E>` or status codes.
2. **Use explicit casts** when converting between signed, unsigned, or different-width integer types (Rules 10.x).
3. **Avoid recursion and dynamic heap allocation** in safety-critical loops (Rules 17.2, 21.3); prefer fixed-size arrays and `defer` cleanup.
4. **Use `--json` with `--misra`** in CI pipelines to collect structured violation reports.
