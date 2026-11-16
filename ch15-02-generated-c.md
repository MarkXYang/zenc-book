# Inspecting Generated C and Name Mangling

One of Zen C's greatest advantages as a systems programming language is that its intermediate representation is **human-readable GNU C11**. Whenever you want to verify how a high-level feature lowers to C, diagnose a linker error, set a breakpoint in `gdb` or `lldb`, or call a Zen C function from an existing C/C++ project, you can inspect the generated C directly.

---

## 1. Emitting C Code with `zc transpile` and `--emit-c`

Zen C gives you two ways to inspect the generated C code:

1. **Transpile Only (`zc transpile`)**: Generates the `.c` file and stops without invoking the C compiler:
   ```console
   $ zc transpile main.zc -o main.c
   ```
2. **Build and Keep (`--emit-c`)**: Compiles the executable normally *and* preserves the generated `.c` file alongside your binary:
   ```console
   $ zc build main.zc --emit-c -o app
   $ ls app*
   app  app.c
   ```

> [!TIP]
> By default, `zc` includes `#line` preprocessor directives in the generated C so debuggers and compiler diagnostics point back to your `.zc` line numbers. When you want to read the generated C itself without `#line` clutter, pass `-g0`:
> ```console
> $ zc transpile -g0 main.zc -o main_clean.c
> ```

---

## 2. Anatomy of a Generated C File

When you open a `.c` file produced by `zc transpile`, it is organized into four predictable sections from top to bottom:

1. **Standard C Headers & Runtime Preamble**: `#include <stdio.h>`, `<stdint.h>`, `<stdbool.h>`, C11 `_Generic` format helpers (`_z_str`, `_z_arg`), closure fat-pointer types (`z_closure_T`), and bounds-checking helpers.
2. **Forward Struct & VTable Declarations**: `typedef struct ...` declarations for your structs, monomorphized generic structs, and trait fat pointers (`{ void *self; Trait_VTable *vtable; }`).
3. **Function Prototypes & Global Drop Dispatch**: Forward `ZC_FUNC` prototypes for all functions and methods, plus the `_z_drop(x)` macro table.
4. **Function and Method Implementations**: The transpiled bodies of your functions, methods, and `main`.

---

## 3. Zen C Symbol Mangling Rules

Because C has a flat global namespace with no overloading, namespaces, or type parameters, `zc` maps Zen C methods, traits, modules, and generics into unique C identifiers separated by double underscores (`__`).

The mangling rules are designed to be **readable** in debuggers and **injective** (two distinct Zen C declarations never collide):

| Zen C Construct | Declaration | Emitted C Symbol |
| :--- | :--- | :--- |
| **Global function** | `fn zc_area_sum(a: f64, b: f64) -> f64` | `zc_area_sum` *(unmangled!)* |
| **Module function** | `fn sqrt(x: f64) -> f64` in `math` | `math__sqrt` |
| **Struct method / associated fn** | `impl Square { fn new(side: f64) -> Square }` | `Square__new` |
| **Method starting with `_`** | `impl Square { fn _grow(self, k: f64) -> Square }` | `Square___grow` *(3 underscores)* |
| **Trait implementation** | `impl Shape for Square { fn area(self) -> f64 }` | `Square__Shape__area` |
| **Generic struct** | `struct Boxed<T>` instantiated as `Boxed<int>` | `struct Boxed__int32_t` |
| **Generic struct method** | `Boxed<int>::get(self)` | `Boxed__int32_t__get` |
| **Generic function** | `fn largest<T>(a: T, b: T) -> T` | `largest__int32_t`, `largest__double` |
| **`extern fn` / `@link("...")`** | `extern fn qsort(...)` | `qsort` *(verbatim)* |

### Why Three Underscores (`___`) Are Preserved

Notice `Square___grow` in the table above. Why does it have **three** underscores?

- The `Struct` and `Method` segments are joined by `__` (two underscores).
- When a method name itself begins with a leading underscore (`_grow`), joining `Square` + `__` + `_grow` produces `Square___grow` (three underscores).
- Zen C's symbol normalizer collapses runs of **4 or more** underscores down to 2 (`____` $\rightarrow$ `__`), but intentionally **preserves runs of 3 underscores** (`___`) so that `fn _grow(self)` (`Square___grow`) never collides with `fn grow(self)` (`Square__grow`).

---

## 4. Walkthrough: Inspecting Symbols in `shapes.c`

Let's see every mangling rule in action. Listing 15-2 defines a trait (`Shape`), a concrete struct (`Square`) with both `scale` and `_grow` methods, a generic struct (`Boxed<T>`), a generic function (`largest<T>`), and a top-level function (`zc_area_sum`):

**Listing 15-2: Structs, traits, generics, and C symbol mangling**

```zenc
// File: examples/ch15/ch15-02-generated-c/main.zc
//
// Transpile this file and inspect the C symbols that zc emits:
//   zc transpile examples/ch15/ch15-02-generated-c/main.zc -o shapes.c

/// Shared behavior for anything with an area.
trait Shape {
    fn area(self) -> f64;
}

/// A square with a side length.
struct Square {
    side: f64;
}

/// A generic box holding a single value.
struct Boxed<T> {
    value: T;
}

impl Boxed<T> {
    fn get(self) -> T {
        return self.value;
    }
}

impl Square {
    // Associated function (no `self`)   -> Square__new
    fn new(side: f64) -> Square {
        return Square { side: side };
    }

    // Leading underscore is preserved   -> Square___grow (three underscores)
    fn _grow(self, k: f64) -> Square {
        return Square { side: self.side * k };
    }

    // Regular method                    -> Square__scale
    fn scale(self, k: f64) -> Square {
        return self._grow(k);
    }
}

// Trait implementation                  -> Square__Shape__area
impl Shape for Square {
    fn area(self) -> f64 {
        return self.side * self.side;
    }
}

// Generic function, monomorphized       -> largest__int32_t, largest__double
fn largest<T>(a: T, b: T) -> T {
    if a > b { return a; }
    return b;
}

// Plain global function: not mangled, callable from C as `zc_area_sum`.
fn zc_area_sum(a: f64, b: f64) -> f64 {
    return a + b;
}

fn main() {
    let s = Square::new(2.0);
    let big = s.scale(3.0);
    println "small area = {s.area()}";
    println "big area   = {big.area()}";
    println "sum        = {zc_area_sum(s.area(), big.area())}";

    let bi = Boxed<int> { value: 42 };
    println "boxed      = {bi.get()}";
    println "largest    = {largest<int>(7, 3)} / {largest<f64>(1.5, 2.5)}";
}
```

Transpile with `-g0` and inspect the generated declarations in `shapes.c`:

```console
$ zc transpile -q -g0 examples/ch15/ch15-02-generated-c/main.zc -o shapes.c
```

Here is the core excerpt from `shapes.c`:

```c
typedef struct Boxed__int32_t Boxed__int32_t;
typedef struct Square Square;

typedef struct Shape_VTable {
    double (*area)(void* self);
} Shape_VTable;
typedef struct Shape { void *self; Shape_VTable *vtable; } Shape;

struct Boxed__int32_t {
    int32_t value;
};

struct Square {
    double side;
};

ZC_FUNC double largest__double(double a, double b);
ZC_FUNC int32_t largest__int32_t(int32_t a, int32_t b);
ZC_FUNC int32_t Boxed__int32_t__get(Boxed__int32_t* self);
ZC_FUNC int main(void);
ZC_FUNC double zc_area_sum(double a, double b);
ZC_FUNC double Square__Shape__area(Square* self);
ZC_FUNC Square Square__new(double side);
ZC_FUNC Square Square___grow(Square* self, double k);
ZC_FUNC Square Square__scale(Square* self, double k);
Shape_VTable Square__Shape__VTable = {
    .area = (__typeof__(((Shape_VTable*)0)->area))Square__Shape__area
};
```

And if we compile the binary and inspect its symbol table with `nm`, we see the exact same names in the ELF binary:

```console
$ zc build -q examples/ch15/ch15-02-generated-c/main.zc -o shapes
$ nm shapes | grep -E " T (Square|Boxed|largest|zc_area)"
0000000000001b36 T Boxed__int32_t__get
0000000000001e62 T Square__Shape__area
0000000000001e98 T Square___grow
0000000000001e84 T Square__new
0000000000001eb8 T Square__scale
0000000000001aea T largest__double
0000000000001b16 T largest__int32_t
0000000000001e44 T zc_area_sum
```

---

## 5. Calling Zen C Functions from C (`-shared` and `zc transpile`)

Because top-level Zen C functions are **not mangled** (and struct methods follow a deterministic `Struct__method` naming convention), you can compile Zen C modules into shared libraries (`.so` / `.dylib` / `.dll`) or `.c` files and call them directly from C:

```console
$ zc build -shared mathlib.zc -o libzmath.so
$ gcc caller.c -L. -lzmath -Wl,-rpath,. -o caller
$ ./caller
```

---

## 6. Alternative Output Backends (`--backend`)

While GNU C11 (`--backend c`) is the default, `zc transpile` and `zc build` support several additional code-generation and inspection backends via `--backend`:

| Backend | Flag / Shorthand | Output Extension | Purpose |
| :--- | :--- | :---: | :--- |
| **C11** | `--backend c` *(default)* | `.c` | Standard GNU C11 output |
| **C++** | `--backend cpp` (`--cpp`) | `.cpp` | C++11-compatible code (`auto`, explicit `void*` casts) for linking with C++ libraries |
| **CUDA** | `--backend cuda` (`--cuda`) | `.cu` | NVIDIA CUDA C++ kernels (`@global`, `@device`, `launch ... with { grid, block }`) |
| **Objective-C** | `--backend objc` (`--objc`) | `.m` | Objective-C output for macOS/GNUStep frameworks |
| **AST Dump** | `--backend ast-dump` | `.ast` | Human-readable tree view of the parsed and type-checked AST |
| **JSON AST** | `--backend json` (`--json-pretty`) | `.json` | Machine-readable AST for external linters and static analysis tools |
| **Graphviz** | `--backend dot` | `.dot` | Visual AST graph (`dot -Tpng out.dot -o ast.png`) |
| **Common Lisp** | `--backend lisp` | `.lisp` | S-expression transpilation (`sbcl --script`) |

For example, to inspect the type-checked AST of Listing 15-2 in the terminal:

```console
$ zc transpile -q examples/ch15/ch15-02-generated-c/main.zc --backend ast-dump -o shapes.ast
$ head -n 14 shapes.ast
 ROOT
    ├──  TRAIT 'Shape' [7:7]
    │   └──  FUNCTION 'area' [8:8]
    ├──  STRUCT 'Square' :Square [12:8]
    │   └──  FIELD 'side' :double
    ├──  STRUCT 'Boxed' :Boxed [17:8]
    │   └──  FIELD 'value' :T
    ├──  IMPL 'Boxed'
    │   ├──  FUNCTION 'Boxed__get' [22:8]
```

---

## Summary

- Use `zc transpile file.zc -o file.c` (or `zc build --emit-c`) to inspect the C11 code generated by Zen C, and add `-g0` to strip `#line` directives.
- Top-level functions keep their exact name in C (`zc_area_sum`), while methods, traits, and generics use predictable `__`-separated names (`Square__scale`, `Square___grow`, `Square__Shape__area`, `Boxed__int32_t__get`).
- Use `zc build -shared` to build C-callable shared libraries, or `--backend ast-dump` / `--backend json` / `--cpp` / `--cuda` when targeting C++/GPU toolchains or inspecting the AST.
