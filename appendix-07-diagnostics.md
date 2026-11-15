# Appendix G: Compiler Diagnostics & Error Guide

Zen C emits structured, span-highlighted diagnostics with contextual `help:` hints. Passing `--json` outputs machine-readable JSON diagnostics for editors and CI scripts.

## Anatomy of a Zen C Diagnostic

```text
error: Unknown trait 'PartialEq' in @derive
  --> examples/ch19/ch19-02-attributes-derives/main.zc:3:16
   |
3  | @derive(Debug, PartialEq, Copy)
   |                ^ here
   |
   = help: Derivable traits: Clone, Copy, Debug, Eq, FromJson, ToJson
```

## Common Errors & How to Fix Them

### 1. Removed Language Syntax

If you copy code from older prototypes or tutorials, `zc` will point directly to the removed construct:

- **`async` / `await` removed**: Replace with `std/thread.zc` threads or synchronous/callback patterns (see Appendix H).
- **`autofree` removed**: Replace with explicit `defer free(ptr);` or RAII cleanup.
- **`do { ... } while`, `repeat`, `guard`, `unless` removed**: Use `loop { ... if !cond { break; } }`, `while`, or `if !cond { return; }`.

### 2. Assignment Inside Condition (`warn_assign_cond`)

```text
warning: Assignment in condition; did you mean '=='?
```

Zen C warns when `=` is used inside an `if` or `while` condition where `==` was likely intended.

### 3. Unit Enum Variant Calls

In Zen C, enum unit variants are called with parentheses, e.g. `MyOption<int>::None()` rather than `MyOption<int>::None`. If you omit `()`, the compiler reports a type/expression mismatch.

### 4. Unknown `@derive` Trait

Only `Clone`, `Copy`, `Debug`, `Eq`, `FromJson`, and `ToJson` are built-in derivable traits. Use `Eq` instead of `PartialEq`.

### 5. `embed` File Not Found (`error: 404: <path>`)

`embed` resolves paths relative to the working directory where `zc` is invoked. Pass a path relative to your project root (or build from the directory containing the asset).

### 6. Missing C Headers in FFI / Stdlib Calls

When calling C standard library functions directly (such as `time(NULL)` or `srand(...)`), ensure the corresponding C header (`include <time.h>`) is included at the top of the file so the C compiler has full prototypes.

### 7. Custom Diagnostics in `comptime`

You can emit your own compile-time errors from `comptime` blocks using `compile_error("message")` to catch invalid build configurations early.
