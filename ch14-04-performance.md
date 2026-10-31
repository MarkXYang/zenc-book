# 14.4 Comparing Performance: Loops vs Iterators

A natural question for any systems programmer is: **what is the runtime cost of using iterators and closures compared to a hand-written C index loop?**

Because Zen C transpiles the entire program and its imported standard library modules into a **single C11 translation unit** before invoking your backend C compiler (`gcc` or `clang`), we can answer this question with complete precision by examining both the generated C11 code and how C optimizers transform it.

---

## 1. Four Ways to Process a Vector

Let's compare four ways to compute the exact same result—summing `val * 3` for all even numbers in a `Vec<int>` of `100,000` elements:

1. **`sum_indexed_loop`**: A traditional index loop (`for i in 0..n`) reading `(*v).data[i]` directly.
2. **`sum_for_in_ref`**: A reference iterator loop (`for ptr in (*v).iter_ref()`) yielding `int*` pointers via `VecIterRef<int>`.
3. **`sum_for_in_val`**: A value iterator loop (`for val in *v`) yielding `Option<int>` copies via `VecIter<int>`.
4. **`sum_closure_forEach`**: A higher-order combinator (`(*v).iterator().forEach(fn[&](val: int) { ... })`) invoking a reference-capturing closure on each element.

**Listing 14-4: `list14-4.zc` — Comparing four iteration strategies on `100,000` integers**

```zc
// File: examples/ch14/ch14-04-performance/main.zc
import "std/vec.zc"
import "std/time.zc"

def NUM_ITEMS = 100000;

// 1. Direct indexed loop over contiguous memory
fn sum_indexed_loop(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    let n = (*v).length();
    for i in 0..n {
        let val = (*v).data[i];
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 2. Reference iterator (`VecIterRef<T>`) yielding `int*` pointers
fn sum_for_in_ref(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    for ptr in (*v).iter_ref() {
        let val = *ptr;
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 3. Value iterator (`VecIter<T>`) yielding `Option<int>` copies
fn sum_for_in_val(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    for val in *v {
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 4. Higher-order closure combinator (`VecIter::forEach`)
fn sum_closure_forEach(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    (*v).iterator().forEach(fn[&](val: int) {
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    });
    return total;
}

fn main() {
    let data = Vec<int>::with_capacity(NUM_ITEMS);
    for i in 0..NUM_ITEMS {
        data.push(i + 1);
    }

    let s1 = sum_indexed_loop(&data);
    let s2 = sum_for_in_ref(&data);
    let s3 = sum_for_in_val(&data);
    let s4 = sum_closure_forEach(&data);

    println "Indexed loop sum:       {s1}";
    println "for-in ref (&vec) sum:  {s2}";
    println "for-in val (vec) sum:   {s3}";
    println "VecIter::forEach sum:   {s4}";

    assert(s1 == 7500150000, "Expected sum of even numbers * 3 in 1..100000");
    assert(s1 == s2 && s2 == s3 && s2 == s4, "All four approaches must produce identical results");
}
```

Run the example with `zc run`:

```bash
$ zc run -q examples/ch14/ch14-04-performance/main.zc
Indexed loop sum:       7500150000
for-in ref (&vec) sum:  7500150000
for-in val (vec) sum:   7500150000
VecIter::forEach sum:   7500150000
```

---

## 2. 🔍 Peek at the C: What the Compiler Actually Emits

Let's compare the transpiled C11 code for `sum_for_in_val`, `sum_for_in_ref`, and `sum_closure_forEach` to see why `for ... in` loops are zero-cost at `--release` (`-O3`) and when closure combinators have a small trade-off.

### `for val in *v` and `for ptr in (*v).iter_ref()`: Zero-Cost After Inlining

In the generated C11 file, `sum_for_in_val` and `sum_for_in_ref` call `VecIter__int32_t__next` and `VecIterRef__int32_t__next`:

```c
// Generated for `sum_for_in_ref`:
VecIterRef__int32_t __it = Vec__int32_t__iter_ref(v);
for (; 1; ) {
    VecIterResult__int32_t __opt = VecIterRef__int32_t__next(&__it);
    if (VecIterResult__int32_t__is_none(&__opt)) {
        break;
    }
    int32_t* ptr = VecIterResult__int32_t__unwrap(&__opt);
    int32_t val = (*ptr);
    if (((val & 1) == 0)) {
        total += (int64_t)(val * 3);
    }
}
```

Because `VecIterRef__int32_t__next`, `is_none`, and `unwrap` are tiny static/inline-eligible C functions defined in the **exact same `.c` translation unit**:
- At `-O2` or `--release` (`-O3`), `gcc` and `clang` inline all three calls completely.
- Scalar Replacement of Aggregates (SROA) eliminates the `VecIterRef__int32_t` and `VecIterResult__int32_t` structs, turning `__it.idx` and `__it.count` into CPU registers.
- The resulting machine code is **instruction-for-instruction identical** to `sum_indexed_loop` (including SIMD auto-vectorization)!

### `VecIter::forEach` / `filter` / `fold`: Closure Dispatch Trade-offs

Now look at what `sum_closure_forEach` emits in C11:

```c
VecIter__int32_t__forEach(
    (VecIter__int32_t[]){ Vec__int32_t__iterator(v) },
    ({
        struct Lambda_0_Ctx *_z_ctx_0 = malloc(sizeof(struct Lambda_0_Ctx));
        _z_ctx_0->total = &total;
        (z_closure_T){ .func = _lambda_0, .ctx = _z_ctx_0, .drop = _lambda_0_drop };
    })
);
```

Notice two architectural characteristics of closure combinators in Zen C:
1. **One-Time Context Allocation**: When a closure captures variables (`[=]` or `[&]`), `zc` allocates a small context struct (`malloc(sizeof(struct Lambda_0_Ctx))`) **once** before entering the combinator and frees it automatically when the combinator returns.
2. **Per-Item Function Pointer Call**: Inside `VecIter<T>::forEach`, `f(self.data[self.idx])` invokes `_c.func(_c.ctx, item)` through the `z_closure_T` function pointer. Unless the backend C compiler inlines `VecIter__int32_t__forEach` and devirtualizes `_c.func` into a direct call to `_lambda_0` (which `gcc`/`clang` frequently do at `-O3` when the combinator is in the same translation unit), calling through a function pointer prevents SIMD auto-vectorization of the loop body.
3. **Intermediate Allocations in `filter`**: Because `VecIter<T>::filter(...)` returns a freshly materialized `Vec<T>` rather than a lazy adapter struct, chaining `.filter(...).iterator().fold(...)` allocates a temporary `Vec<T>` for the filtered elements.

---

## 3. Practical Performance Guidelines in Zen C

| Idiom | Heap Allocations | Inlined / Auto-Vectorized at `-O2`/`-O3`? | When to Choose It |
| :--- | :--- | :--- | :--- |
| **`for i in 0..n`** | **0** | **Yes** | Tight numerical kernels, matrix/SIMD math, or when you need random access to neighboring indices (`data[i - 1]`, `data[i + 1]`). |
| **`for ptr in &vec`** (`VecIterRef<T>`) | **0** | **Yes** | **Default choice** for iterating over `Vec<String>` or large structs without copying elements. |
| **`for val in vec`** (`VecIter<T>`) | **0** | **Yes** | Cleanest choice for iterating over small value types (`int`, `f64`, pointers) or custom generator structs (`Fibonacci`). |
| **`vec.iterator().fold(...)` / `.find(...)` / `.any(...)`** | **1** tiny context struct (if capturing) | Often devirtualized at `-O3` | Expressive data queries, configuration filtering, and application logic where readability outweighs nanosecond loop overhead. |
| **`vec.iterator().filter(...)`** | **1** new `Vec<T>` (+ 1 context struct) | Allocates filtered `Vec<T>` | When you actually want a new `Vec<T>` containing only the matching items! |

---

## Summary of Chapter 14

In this chapter, you mastered Zen C's functional programming toolkit:
- **Lambdas and Closures (`14.1`)**: Writing concise arrow lambdas (`x -> expr`) and block lambdas (`fn(x: T) -> R { ... }`), capturing environment state by value (`[=]`) or reference (`[&]`), and passing `fn(T) -> R` closures with automatic RAII context cleanup.
- **Raw Function Pointers (`14.2`)**: Using `fn*(Args) -> Ret` for stateless, 8-byte C ABI function pointers in dispatch tables and C library callbacks like `qsort`.
- **Iterators (`14.3`)**: Using `VecIter<T>` and `VecIterRef<T>`, chaining functional combinators (`filter`, `fold`, `find`, `any`, `all`, `forEach`), and building custom zero-allocation iterators with `.iterator()` and `.next()`.
- **Performance (`14.4`)**: Understanding how `for ... in` loops monomorphize and inline into zero-overhead C loops under `--release`, and knowing when to reach for `for ptr in &vec` vs. `VecIter<T>` combinators.

Next, in **[Chapter 15: The `zc` Toolchain and Compiler Backends](ch15-00-toolchain.md)**, we will explore how `zc` orchestrates `gcc`, `clang`, `tcc`, and Zig CC, how to inspect generated C11 code, and how to build Actually Portable Executables (APE)!
