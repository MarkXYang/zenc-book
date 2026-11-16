# Embedding Zen C in C Programs

In [Chapter 12](ch12-00-using-c-libraries.md), we explored calling existing C libraries from Zen C.

Equally important in enterprise and systems development is the reverse: **calling compiled Zen C functions from an existing C, C++, or Rust host program**. You might want to write new, safety-verified subsystems or high-performance algorithms in Zen C while maintaining a legacy C application harness.

Because Zen C transpiles directly to clean, dependency-free C11, embedding Zen C into any C build pipeline is straightforward and requires zero runtime initialization.

---

## 1. Exporting C-Compatible Functions (`@export` & `@link_name`)

By default, Zen C namespaces internal functions with name mangling (e.g. `_impl_...` or module prefixes). To expose a function with a stable, exact C linkage name, use two attributes:

1. **`@export`**: Marks the symbol with public visibility (`__attribute__((visibility("default")))`).
2. **`@link_name("custom_name")`**: Overrides the generated C symbol name so the C compiler and linker see the exact identifier you specify:

```zenc
@export
@link_name("zenc_add")
fn add(a: int, b: int) -> int {
    return a + b;
}
```

Transpiling this snippet produces a standard C function:

```c
int32_t zenc_add(int32_t a, int32_t b) {
    return a + b;
}
```

---

## 2. Compilation Workflows

You can integrate Zen C into a C project using either object files or shared libraries:

### Method A: Static Object Compilation (`.o`)
1. Transpile the Zen C module to an object file:
   ```bash
   zc transpile zenc_math.zc -o zenc_math.c
   gcc -c zenc_math.c -O2 -o zenc_math.o
   ```
2. Link the object directly into your C program:
   ```bash
   gcc main.c zenc_math.o -o my_app
   ```

### Method B: Shared Dynamic Library (`.so` / `.dylib` / `.dll`)
Compile the Zen C module with `-shared`:
```bash
zc build zenc_math.zc -shared -o libzenc_math.so
gcc main.c -L. -lzenc_math -Wl,-rpath,. -o my_app
```

---

## 3. Complete Example: Listing 20-5

Listing 20-5 shows a high-performance math module written in Zen C and the companion C host application that invokes it.

### Part 1: The Zen C Module (`zenc_math.zc`)

**Listing 20-5A**: Exported Zen C math library (`examples/ch20/ch20-05-embedding-zc/zenc_math.zc`)

```zenc
// File: examples/ch20/ch20-05-embedding-zc/zenc_math.zc

@export
@link_name("zenc_add")
fn add(a: int, b: int) -> int {
    return a + b;
}

@export
@link_name("zenc_fibonacci")
fn fibonacci(n: int) -> int {
    if n <= 1 {
        return n;
    }
    let a = 0;
    let b = 1;
    for _ in 2..=n {
        let temp = a + b;
        a = b;
        b = temp;
    }
    return b;
}

@export
@link_name("zenc_dot_product")
fn dot_product(a: f32*, b: f32*, len: int) -> f32 {
    let sum: f32 = 0.0;
    for i in 0..len {
        sum += a[i] * b[i];
    }
    return sum;
}
```

### Part 2: The Host C Program (`main.c`)

**Listing 20-5B**: Host C application calling Zen C (`examples/ch20/ch20-05-embedding-zc/main.c`)

```c
// File: examples/ch20/ch20-05-embedding-zc/main.c
#include <stdio.h>
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>

// Declarations of exported Zen C functions
int zenc_add(int a, int b);
int zenc_fibonacci(int n);
float zenc_dot_product(const float *a, const float *b, int len);

int main(void) {
    printf("Embedding Zen C in a C Application\n");

    int sum = zenc_add(15, 27);
    printf("zenc_add(15, 27) = %d\n", sum);
    assert(sum == 42);

    int fib10 = zenc_fibonacci(10);
    printf("zenc_fibonacci(10) = %d\n", fib10);
    assert(fib10 == 55);

    float vec_a[] = {1.0f, 2.0f, 3.0f};
    float vec_b[] = {4.0f, 5.0f, 6.0f};
    float dot = zenc_dot_product(vec_a, vec_b, 3);
    printf("zenc_dot_product = %.1f\n", dot);
    assert(dot == 32.0f);

    printf("Successfully embedded Zen C module into native C host!\n");
    return 0;
}
```

---

## 4. Building and Running the Embedded Application

Compile and execute the host C application:

```console
$ zc transpile examples/ch20/ch20-05-embedding-zc/zenc_math.zc -o /tmp/zenc_math.c
$ gcc -c /tmp/zenc_math.c -O2 -o /tmp/zenc_math.o
$ gcc examples/ch20/ch20-05-embedding-zc/main.c /tmp/zenc_math.o -o /tmp/host_app
$ /tmp/host_app
Embedding Zen C in a C Application
zenc_add(15, 27) = 42
zenc_fibonacci(10) = 55
zenc_dot_product = 32.0
Successfully embedded Zen C module into native C host!
```

Because Zen C functions link as standard C symbols, there is **zero glue code**, no runtime initialization function (like `init_runtime()`), and zero foreign function overhead.

---

## Summary of Chapter 20

In this chapter, you learned how Zen C delivers elite systems and safety-critical capabilities:

- **Inline Assembly (`20.1`)**: Emitting hardware-specific instructions with `asm { ... }`, volatile optimization fences with `asm volatile { ... }`, and binding register inputs/outputs via `{variable}`.
- **SIMD Vectorization (`20.2`)**: Accelerating parallel data processing using 128-bit and 256-bit vector types from `std/simd.zc` with hardware-accelerated operators (`+`, `-`, `*`, `&`).
- **MISRA C:2012 Compliance Mode (`20.3`)**: Enforcing strict aerospace/automotive safety guidelines using `zc --misra`, with static boolean validation and single-exit function lowering.
- **Polyglot Interoperability (`20.4`)**: Emitting clean C++17 (`--cpp`), NVIDIA CUDA (`--cuda`), and Apple Objective-C (`--objc`) for cross-language projects.
- **Embedding Zen C (`20.5`)**: Exporting unmangled C ABI functions with `@export` and `@link_name` to seamlessly enhance legacy C codebases.

Next, in **[Chapter 21: Final Project: Building a Multithreaded Web Server](ch21-00-final-project.md)**, we will synthesize everything you have learned across the book to construct a complete, high-performance, multithreaded HTTP server from scratch!
