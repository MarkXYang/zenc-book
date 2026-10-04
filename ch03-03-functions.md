# Functions and Lambdas

Functions are the fundamental building blocks of executable code in Zen C. Zen C provides modern function syntax, named arguments, read-only parameters, default arguments, closures (lambdas), C-compatible raw function pointers (`fn*`), and native C variadic functions.

---

## Defining Functions & Named Arguments

Functions are declared using the `fn` keyword. Parameters use `name: Type` annotations, and return types are specified after the arrow (`->`).

```zenc
fn add(a: int, b: int) -> int {
    return a + b;
}
```

### Named Arguments

When calling functions, you can explicitly pass argument names for clarity:

```zenc
let sum = add(a: 10, b: 20);
```

> [!NOTE]
> **Strict Parameter Order**: Named arguments must strictly follow the defined parameter order in the function signature. For example, `add(b: 20, a: 10)` is invalid.

---

## Const Arguments

Function parameters can be marked with the `const` type qualifier to enforce read-only semantics within the function body:

```zenc
fn print_val(v: const int) {
    // v = 10; // Error: Cannot assign to const variable
    println "{v}";
}
```

This guarantees at compile-time that the function will not mutate the passed argument value.

---

## Default Arguments

Functions can define default values for trailing parameters. Default values can be literals, expressions evaluated at the call site, or complex initializers like struct constructors:

**Listing 3-4: `list3-4.zc`**

```zenc
 1 | // 1. Literal default value
 2 | fn increment(val: int, amount: int = 1) -> int {
 3 |     return val + amount;
 4 | }
 5 |
 6 | // 2. Expression default value (evaluated at call site)
 7 | fn offset(val: int, pad: int = 10 * 2) -> int {
 8 |     return val + pad;
 9 | }
10 |
11 | // 3. Struct default value
12 | struct Config {
13 |     debug: bool;
14 | }
15 |
16 | fn init_app(cfg: Config = Config { debug: true }) {
17 |     if cfg.debug {
18 |         println "Debug Mode Enabled";
19 |     }
20 | }
21 |
22 | fn main() {
23 |     println "{increment(10)}";  // Uses amount = 1 -> 11
24 |     println "{offset(5)}";     // Uses pad = 20 -> 25
25 |     init_app();               // Uses default Config struct -> Prints "Debug Mode Enabled"
26 | }
```

Output:
```text
11
25
Debug Mode Enabled
```

---

---

## Summary

In this section, you learned:
- How to define functions using `fn` with parameter and return type annotations.
- How to pass named arguments for enhanced readability at call sites.
- How to enforce read-only parameters using `const` arguments.
- How to specify default values for trailing function parameters.

> [!NOTE]
> - Anonymous closures (lambdas) and C-compatible raw function pointers (`fn*`) are covered in [Chapter 14: Functional Features](ch14-00-functional-features.md).
> - Variadic functions (`...` and `va_list`) are covered in [Chapter 12: Using C Libraries](ch12-00-using-c-libraries.md).

Next, let's explore Comments, Printing and String Interpolation in Zen C!
