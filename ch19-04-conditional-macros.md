# Conditional Compilation and C Macros

Cross-platform systems code often needs to select different implementations depending on feature flags, build modes, or target platforms. Zen C provides `@cfg(...)` attributes for structured conditional compilation, `def` for compile-time constants, and access to macros defined by C headers.

## Feature Flags with `//> define:` and `@cfg(...)`

You can declare compile-time feature flags directly in a source file with `//> define: FLAG_NAME` (or pass `-DFLAG_NAME` to the compiler), then conditionally compile functions or types using `@cfg(FLAG_NAME)` and `@cfg(not(FLAG_NAME))`.

For constants, use `def` instead of `#define`, and for small helpers, use an `@inline` function instead of a function-like macro. Both are type-checked by Zen C. Macros that come from C headers (such as `INT_MAX` from `<limits.h>`) remain available after an `include`:

```zenc
// File: examples/ch19/ch19-04-conditional-macros/main.zc
//> define: ENABLE_METRICS

include <limits.h>

def BUFFER_CAP = 64;

@inline
fn square(x: int) -> int {
    return x * x;
}

@cfg(ENABLE_METRICS)
fn report_mode() {
    println "Mode: Metrics ENABLED";
}

@cfg(not(ENABLE_METRICS))
fn report_mode() {
    println "Mode: Metrics DISABLED";
}

fn main() {
    println "Testing Conditional Compilation & C Macros...";
    report_mode();

    let cap = BUFFER_CAP;
    let sq = square(5);
    println "BUFFER_CAP = {cap}, square(5) = {sq}";
    assert(cap == 64, "BUFFER_CAP must be 64");
    assert(sq == 25, "square(5) must be 25");

    // INT_MAX is a macro defined by the C header <limits.h>
    let max: int = INT_MAX;
    println "INT_MAX = {max}";
    assert(max > 0, "INT_MAX must be positive");

    println "All conditional & macro checks passed!";
}
```

<span class="caption">Listing 19-4: `@cfg(...)` conditional functions, `def` constants, and a macro from a C header</span>

> [!WARNING]
> Writing `#define` or `#include` directly in Zen C source is deprecated: the compiler warns `Preprocessor directive '#define' is deprecated. Use 'def' instead.` Use `def`, `@inline` functions, `@cfg`, and `include`/`import` instead.

## Choosing Between `@cfg`, `comptime`, and `def`

| Mechanism | Best Used For | Key Advantage |
| :--- | :--- | :--- |
| `@cfg(...)` | Platform/feature function variants | Keeps function signatures clean and readable. |
| `comptime` | Generating constants, repetitive code, build assertions | Full Zen C syntax and type-safe compile-time logic. |
| `def` | Named compile-time constants | Type-checked replacement for `#define` constants. |
| C header macros | Values and flags defined by existing C libraries | Available after `include <header.h>` with no wrapper. |

> ### 🔍 Peek at the C
>
> `@cfg(FLAG)` declarations are emitted inside `#if defined(ZC_CFG_FLAG)` guards, and `//> define: FLAG` emits `#define ZC_CFG_FLAG 1`, so only the matching variant is compiled. A `def` constant becomes a `const` global, and `include <limits.h>` becomes `#include <limits.h>` in the generated file, which is how `INT_MAX` reaches your code.

## Summary

Metaprogramming in Zen C stays true to the language's philosophy: zero hidden runtime cost, direct lowering to C11, and seamless interoperability with C toolchains. You now know how to generate code with `comptime`, shape layout and behavior with `@` attributes and `@derive`, embed static assets with `embed`, and gate feature flags with `@cfg`.
