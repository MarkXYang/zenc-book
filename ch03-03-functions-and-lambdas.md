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
// 1. Literal default value
fn increment(val: int, amount: int = 1) -> int {
    return val + amount;
}

// 2. Expression default value (evaluated at call site)
fn offset(val: int, pad: int = 10 * 2) -> int {
    return val + pad;
}

// 3. Struct default value
struct Config {
    debug: bool;
}

fn init_app(cfg: Config = Config { debug: true }) {
    if cfg.debug {
        println "Debug Mode Enabled";
    }
}

fn main() {
    println "{increment(10)}";  // Uses amount = 1 -> 11
    println "{offset(5)}";     // Uses pad = 20 -> 25
    init_app();               // Uses default Config struct -> Prints "Debug Mode Enabled"
}
```

Output:
```text
11
25
Debug Mode Enabled
```

---

## Lambdas (Closures)

Lambdas are anonymous functions that can capture variables from their surrounding scope. Zen C supports both concise **Arrow Syntax** and block-based **Block Syntax**.

### 1. Basic Syntax

```zenc
let factor = 2;

// Concise Arrow Syntax
let doubler = x -> x * factor;

// Full Block Syntax
let full_doubler = fn(x: int) -> int { return x * factor; };
```

### 2. Capture by Value (Default / `[=]`)

By default, variables are captured by value (creating a read-only copy inside the closure):

```zenc
let original = 10;

// Implicit capture by value
let implicit_cb = x -> original + x;

// Explicit capture by value using [=]
let explicit_cb = [=] x -> original + x;

// let fail = x -> original += x; // Error: cannot assign to value-captured variable
```

### 3. Capture by Reference (`[&]`)

To mutate variables in the outer environment, use reference capture (`[&]`):

**Listing 3-5: `list3-5.zc`**

```zenc
fn main() {
    let val = 10;

    // Block syntax capture by reference
    let modify = fn[&]() {
        val += 1;
    };
    modify(); // val is now 11
    println "val after modify: {val}";

    // Arrow syntax capture by reference
    let modify_arrow = [&] x -> val += x;
    modify_arrow(5); // val is now 16
    println "val after modify_arrow: {val}";

    // Arrow syntax with multiple arguments
    let sum_into = [&] (a, b) -> val += (a + b);
    sum_into(2, 2); // val is now 20
    println "val after sum_into: {val}";
}
```

Output:
```text
val after modify: 11
val after modify_arrow: 16
val after sum_into: 20
```

---

## Raw Function Pointers (`fn*`)

For zero-overhead C interop, Zen C provides raw function pointers using the `fn*` syntax. Unlike closures, raw function pointers do not allocate environment state, making them 100% compatible with native C callbacks.

**Listing 3-6: `list3-6.zc`**

```zenc
// Function accepting a raw C function pointer
fn set_callback(cb: fn*(int)) {
    cb(42);
}

fn my_handler(code: int) {
    println "Handler received code: {code}";
}

// Function returning a raw function pointer
fn get_callback() -> fn*(int) {
    return my_handler;
}

fn main() {
    set_callback(my_handler);

    // Pointer to function pointers (fn**) are also supported
    let ptr: fn*(int) = my_handler;
    let pptr: fn**(int) = &ptr;
}
```

Output:
```text
Handler received code: 42
```

---

## Variadic Functions (`...` and `va_list`)

Zen C supports variadic functions (functions that take a variable number of arguments) using standard C `...` syntax and `va_list` helpers:

**Listing 3-7: `list3-7.zc`**

```zenc
fn custom_log(fmt: char*, ...) {
    let ap: va_list;
    va_start(ap, fmt);
    vprintf(fmt, ap); // Uses C stdio vprintf
    va_end(ap);
}

fn main() {
    custom_log("Logging %s with status code %d\n", "HTTP Request", 200);
}
```

Output:
```text
Logging HTTP Request with status code 200
```

---

## Summary

In this section, you learned:
- Function definitions with parameters, return types, and named arguments (`add(a: 10, b: 20)`).
- Read-only parameter enforcement using `const` arguments.
- Default trailing argument values (literals, expressions, struct constructors).
- Anonymous closures with capture by value (`[=]`) and capture by reference (`[&]`).
- Zero-overhead raw C function pointers (`fn*`).
- Native C variadic functions (`...`, `va_list`, `va_start`, `va_end`).

Next, let's explore Control Flow constructs in Zen C!
