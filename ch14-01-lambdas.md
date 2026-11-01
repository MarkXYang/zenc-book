# 14.1 Lambdas and Closure Capture

A **lambda** (or **closure**) is an anonymous function you can bind to a variable or pass directly as an argument to another function. Unlike ordinary top-level `fn` declarations, a closure can **capture** variables from the lexical scope in which it is defined.

---

## 1. Arrow Syntax vs. Block Syntax

Zen C provides two complementary syntaxes for writing closures depending on whether your lambda body is a single expression or a multi-statement block:

### Concise Arrow Syntax (`x -> expr` and `(a, b) -> expr`)

For single-expression lambdas, list the parameter name (or parenthesized parameter list) followed by `->` and the return expression:

```zenc
let factor = 3;

// Single parameter arrow lambda
let triple = x -> x * factor;

// Multi-parameter arrow lambda
let weighted_sum = (a, b) -> (a * factor) + b;
```

### Explicit Block Syntax (`fn(x: T) -> R { ... }`)

When your closure requires explicit parameter/return type annotations, multiple statements, local variables, or early `return` branches, use the `fn(...) -> R { ... }` block syntax:

```zenc
let factor = 3;

let triple_block = fn(x: int) -> int {
    let scaled = x * factor;
    return scaled;
};
```

---

## 2. Capturing the Environment: By Value (`[=]`) vs. By Reference (`[&]`)

When a lambda references a variable from an enclosing function, how is that variable stored inside the closure? Zen C gives you explicit control with two capture modes:

| Capture Mode | Arrow Syntax | Block Syntax | Semantics |
| :--- | :--- | :--- | :--- |
| **By Value (Default)** | `x -> x + offset` or `[=] x -> x + offset` | `fn(x: int) -> int { ... }` or `fn[=](x: int) -> int { ... }` | Copies the current value of each captured variable into the closure's context at creation time. |
| **By Reference** | `[&] x -> total += x` | `fn[&](x: int) { total += x; }` | Stores a pointer (`T*`) to each captured variable so mutations inside the closure update the outer variable directly. |

### Capture by Value (`[=]`)

By default (or when prefixed with `[=]`), a closure takes an independent **snapshot** of any outer variable it uses. Mutating the outer variable *after* the closure is created does not change the value seen inside the closure:

```zenc
let offset = 10;
let add_snapshot = [=] x -> x + offset;

offset = 999; // Does NOT affect `add_snapshot`
println "{add_snapshot(5)}"; // Prints 15 (5 + 10)
```

### Capture by Reference (`[&]`)

When you want a closure to accumulate state or mutate a variable in the surrounding scope, prefix an arrow lambda with `[&]` or a block lambda with `fn[&]`:

```zenc
let running_total = 0;

// Arrow syntax with reference capture:
let add_to_total = [&] x -> running_total += x;
add_to_total(10);
add_to_total(25); // running_total is now 35

// Block syntax with reference capture:
let accumulate_pair = fn[&](a: int, b: int) -> int {
    running_total += (a + b);
    return running_total;
};
accumulate_pair(3, 4); // running_total is now 42
```

---

## 3. Higher-Order Functions Accepting Closures (`fn(T) -> R`)

To write a function that accepts a closure as a parameter, annotate the parameter with `fn(ParamTypes) -> ReturnType` (or `fn(ParamTypes)` when the closure returns `void`):

```zenc
fn apply_twice(f: fn(int) -> int, x: int) -> int {
    return f(f(x));
}
```

You can then pass any lambda expression—including one that captures local variables—directly into `apply_twice`:

```zenc
let base = 4;
let result = apply_twice([=] x -> x + base, 10); // (10 + 4) + 4 = 18
```

---

## 4. Complete Runnable Example

Here is a complete example (`examples/ch14/ch14-01-lambdas/main.zc`) demonstrating arrow and block lambdas, value snapshots (`[=]`), higher-order closure parameters (`fn(int) -> int`), and reference mutation (`[&]` and `fn[&]`):

**Listing 14-1: `list14-1.zc` — Lambdas, closure capture modes, and higher-order functions**

```zenc
// File: examples/ch14/ch14-01-lambdas/main.zc

// Higher-order function accepting a Zen C closure `fn(int) -> int`
fn apply_twice(f: fn(int) -> int, x: int) -> int {
    return f(f(x));
}

fn main() {
    // 1. Concise arrow syntax vs. explicit block syntax
    let factor = 3;
    let triple_arrow = x -> x * factor;
    let triple_block = fn(x: int) -> int { return x * factor; };

    println "triple_arrow(7) = {triple_arrow(7)}";
    println "triple_block(7) = {triple_block(7)}";
    assert(triple_arrow(7) == 21 && triple_block(7) == 21, "Both lambdas should return 21");

    // 2. Capture by value (default / `[=]`): snapshots `offset` at creation time
    let offset = 10;
    let add_snapshot = [=] x -> x + offset;
    offset = 999; // Mutating `offset` later does NOT affect `add_snapshot`
    let snap_res = add_snapshot(5);
    println "add_snapshot(5) (captured offset=10) = {snap_res}";
    assert(snap_res == 15, "Value capture must use the snapshot (10), not 999");

    // 3. Passing a closure inline to a higher-order function
    let base = 4;
    let twice_res = apply_twice([=] x -> x + base, 10);
    println "apply_twice(x + 4, 10) = {twice_res}";
    assert(twice_res == 18, "10 + 4 + 4 should equal 18");

    // 4. Capture by reference (`[&]`): mutates outer variables directly
    let running_total = 0;
    let add_to_total = [&] x -> running_total += x;
    add_to_total(10);
    add_to_total(25);
    println "running_total after arrow [&] calls = {running_total}";
    assert(running_total == 35, "10 + 25 should equal 35");

    // Block syntax with reference capture `fn[&](...)`
    let accumulate_pair = fn[&](a: int, b: int) -> int {
        running_total += (a + b);
        return running_total;
    };
    let final_total = accumulate_pair(3, 4);
    println "running_total after block fn[&] call = {final_total}";
    assert(running_total == 42 && final_total == 42, "35 + (3 + 4) should equal 42");
}
```

Run the example with `zc run`:

```bash
$ zc run -q examples/ch14/ch14-01-lambdas/main.zc
triple_arrow(7) = 21
triple_block(7) = 21
add_snapshot(5) (captured offset=10) = 15
apply_twice(x + 4, 10) = 18
running_total after arrow [&] calls = 35
running_total after block fn[&] call = 42
```

---

## 🔍 Peek at the C: How Closures Compile to C11

Standard C11 does not have closures. How does `zc` compile a capturing lambda into portable C11 with deterministic memory management?

1. **The Runtime Closure Struct (`z_closure_T`)**:
   In the Zen C runtime preamble, every closure value is represented by a 3-pointer struct:
   ```c
   typedef struct z_closure_T {
       void *func;            // Pointer to the generated C function
       void *ctx;             // Pointer to the captured environment struct
       void (*drop)(void*);   // Destructor to free `ctx` when the closure is dropped
   } z_closure_T;
   ```
2. **Generated Context Struct and Trampoline Function**:
   For a value-capturing lambda (`[=] x -> x + base`), `zc` generates a context struct holding a copy of `base` (`int32_t base;`), whereas for a reference-capturing lambda (`fn[&](a: int, b: int)`), `zc` generates a context struct holding a pointer (`int32_t* running_total;`):
   ```c
   struct Lambda_4_Ctx {
       int32_t* running_total;
   };

   static void _lambda_4_drop(void* _ctx) {
       free(_ctx);
   }

   int32_t _lambda_4(void* _ctx, int32_t a, int32_t b) {
       struct Lambda_4_Ctx* ctx = (struct Lambda_4_Ctx*)_ctx;
       ((*ctx->running_total) = ((*ctx->running_total) + (a + b)));
       return (*ctx->running_total);
   }
   ```
3. **RAII Cleanup of Closure Contexts**:
   When `apply_twice(z_closure_T f, int32_t x)` finishes executing, `zc` automatically invokes `if (__z_drop_flag_f && f.drop) f.drop(f.ctx);` before returning, freeing the closure's heap context automatically!

What if you need to pass a callback to a C library function (like `qsort` or `signal`) that expects a single 8-byte C function pointer with no `void* _ctx` parameter? Let's explore **`fn*` raw function pointers** in **[14.2 Raw Function Pointers (`fn*`)](ch14-02-fn-pointers.md)**!
