# Conditional Compilation & C Macros

Cross-platform systems code often needs to select different implementations depending on feature flags, build modes, or target platforms. Zen C provides `@cfg(...)` attributes for structured conditional compilation alongside full support for C preprocessor directives (`#define`, `#ifdef`, `#endif`).

## Feature Flags with `//> define:` and `@cfg(...)`

You can declare compile-time feature flags directly in a source file with `//> define: FLAG_NAME` (or pass `-DFLAG_NAME` to the compiler), then conditionally compile functions or types using `@cfg(FLAG_NAME)` and `@cfg(not(FLAG_NAME))`.

Because Zen C transpiles to C, you can also use standard C preprocessor macros (`#define`, function-like macros, and `#ifdef` blocks) whenever you need C header compatibility or token-level macro expansion:

```zenc
// File: examples/ch19/ch19-04-conditional-macros/main.zc
//> define: ENABLE_METRICS

#define BUFFER_CAP 64
#define SQUARE(x) ((x) * (x))

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

    #ifdef ENABLE_METRICS
    println "Preprocessor #ifdef ENABLE_METRICS is active";
    #endif

    let cap = BUFFER_CAP;
    let sq = SQUARE(5);
    println "BUFFER_CAP = {cap}, SQUARE(5) = {sq}";
    assert(cap == 64, "BUFFER_CAP must be 64");
    assert(sq == 25, "SQUARE(5) must be 25");

    println "All conditional & macro checks passed!";
}
```

<span class="caption">Listing 19-4: Combining `@cfg(...)` conditional functions with `#define` and `#ifdef`</span>

## Choosing Between `@cfg`, `comptime`, and `#define`

| Mechanism | Best Used For | Key Advantage |
| :--- | :--- | :--- |
| `@cfg(...)` | Platform/feature function variants | Keeps function signatures clean and readable. |
| `comptime` | Generating constants, repetitive code, build assertions | Full Zen C syntax and type-safe compile-time logic. |
| `#define` / `#ifdef` | C header interop and simple constant/macro wrappers | 100% compatible with existing C libraries and headers. |

> ### 🔍 Peek at the C
>
> `@cfg(FLAG)` declarations are filtered during Zen C's compilation pass—only the matching branch is emitted into the generated `.c` file. Meanwhile, `#define` and `#ifdef` directives are passed through to the C preprocessor, so both Zen C's conditional attributes and standard C headers work together seamlessly.

## Summary

Metaprogramming in Zen C stays true to the language's philosophy: zero hidden runtime cost, direct lowering to C11, and seamless interoperability with C toolchains. You now know how to generate code with `comptime`, shape layout and behavior with `@` attributes and `@derive`, embed static assets with `embed`, and gate feature flags with `@cfg`.
