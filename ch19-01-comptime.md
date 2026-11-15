# Compile-Time Execution (`comptime`)

Zen C includes a built-in compile-time evaluator triggered by `comptime { ... }` blocks and `@comptime` functions. Instead of computing constants or boilerplate manually—or relying on fragile C preprocessor macros—you can write ordinary Zen C logic that executes during compilation and injects generated code directly into the transpiled output.

## Top-Level and Local `comptime` Blocks

A `comptime` block can appear either at the top level of a file (emitting constants, types, or functions) or inside a function body (emitting local statements). Inside a `comptime` block, you call `yield("...")` with a string of valid Zen C code to splice that code into the program:

```zenc
// File: examples/ch19/ch19-01-comptime/main.zc

// 1. Top-level comptime block generating compile-time constants
comptime {
    yield("def COMPTIME_MAGIC = 1024;");
    yield("def COMPTIME_TAG = \"v1-gen\";");
}

// 2. @comptime function evaluated at compile time
@comptime
fn factorial(n: int) -> int {
    let acc = 1;
    let i = 2;
    while i <= n {
        acc = acc * i;
        i = i + 1;
    }
    return acc;
}

// 3. Compile-time invariant guard using compile_error(...)
comptime {
    let f5 = factorial(5);
    if f5 != 120 {
        compile_error("Compile-time factorial(5) invariant failed!");
    }
}

fn main() {
    println "Testing Compile-Time Execution (comptime)...";
    println "COMPTIME_MAGIC = {COMPTIME_MAGIC}, TAG = {COMPTIME_TAG}";
    assert(COMPTIME_MAGIC == 1024, "Expected COMPTIME_MAGIC == 1024");

    let fact5 = factorial(5);
    println "factorial(5) = {fact5}";
    assert(fact5 == 120, "factorial(5) must be 120");

    // 4. Local comptime block emitting statements into main()
    let generated_sum = 0;
    comptime {
        yield("generated_sum = 10 + 20 + 30;");
    }
    println "generated_sum = {generated_sum}";
    assert(generated_sum == 60, "generated_sum must be 60");

    println "All comptime checks passed!";
}
```

<span class="caption">Listing 19-1: Top-level `comptime`, `@comptime` functions, `compile_error`, and local `yield`</span>

Run it with:

```sh
zc run -q examples/ch19/ch19-01-comptime/main.zc
```

## `@comptime` Functions and `compile_error`

Annotating a function with `@comptime` marks it for compile-time evaluation. Notice two important rules when writing `@comptime` functions:

1. **Prefer iterative loops over recursion inside `@comptime` functions.** The current compile-time interpreter evaluates local variables in a flat scope per call; writing iterative `while` or `for` loops (as in `factorial` above) is reliable and fast.
2. **Use `compile_error("message")` to enforce build-time invariants.** If a `comptime` block detects an invalid configuration or broken mathematical invariant, calling `compile_error(...)` aborts compilation immediately with a clear diagnostic message before any C code is compiled.

> ### 🔍 Peek at the C
>
> Everything emitted via `yield(...)` is parsed as Zen C and lowered into standard C declarations or statements before the C compiler runs. By the time `gcc` or `clang` sees the output, `COMPTIME_MAGIC` is a normal compile-time constant and `generated_sum = 10 + 20 + 30;` is a plain C assignment—zero runtime interpreter overhead.
