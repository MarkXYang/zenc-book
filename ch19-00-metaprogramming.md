# Chapter 19: Compile-Time Execution & Metaprogramming

One of Zen C's core strengths is that it transpiles directly to clean, readable C11. Metaprogramming in Zen C builds directly on that architecture: instead of inventing a separate, opaque preprocessor macro language, Zen C gives you structured compile-time tools that emit or configure C code before the C compiler ever runs.

In this chapter, you will learn how to:

- Run Zen C code at compile time with `comptime` blocks and `@comptime` functions, and emit generated declarations or statements with `yield(...)`.
- Control memory layout, inlining, lifecycle hooks, and automatic trait generation with attributes (`@packed`, `@align`, `@inline`, `@constructor`) and `@derive(...)`.
- Embed binary and text assets directly into your executable with `embed`, and extend the transpiler itself with native compiler plugins.
- Gate platform-specific code with `@cfg(...)` and `//> define:` directives alongside traditional C preprocessor macros (`#define`, `#ifdef`).

Every runnable example in this chapter lives under `examples/ch19/` and can be executed directly with `zc run -q`.
