# 14.2 Raw Function Pointers (`fn*`)

In [Section 14.1](ch14-01-lambdas.md), we saw that Zen C closures (`fn(T) -> R`) carry an environment pointer (`void* ctx`) so they can capture local variables. However, two common systems programming scenarios require a **stateless, single-word machine code pointer** without an environment struct:

1. **Zero-Overhead C Interoperability**: C library functions such as `<stdlib.h>`'s `qsort`, `<signal.h>`'s `signal`, POSIX `pthread_create`, and GUI/game-engine callback hooks expect a native C function pointer (`R (*)(Args)`).
2. **Compact Dispatch Tables and State Machines**: Static lookup tables, instruction decoders, and hardware interrupt vectors often store arrays of function pointers where every entry is a top-level function with zero captured state.

For these scenarios, Zen C provides **raw function pointers** using the **`fn*`** type syntax.

---

## 1. Declaring and Using `fn*` Types

While `fn(int, int) -> int` is a closure type, adding `*` after `fn`—written **`fn*(int, int) -> int`**—declares a raw C function pointer.

Compare Zen C's clean left-to-right `fn*` syntax against traditional C's "spiral rule" declarator syntax:

| Meaning | Zen C Syntax | Equivalent C11 Syntax |
| :--- | :--- | :--- |
| Pointer to function taking `int` and returning `void` | `cb: fn*(int)` | `void (*cb)(int32_t)` |
| Pointer to function taking `(int, int)` and returning `int` | `op: fn*(int, int) -> int` | `int32_t (*op)(int32_t, int32_t)` |
| Function returning a raw function pointer | `fn select(c: char) -> fn*(int, int) -> int` | `int32_t (*select(char c))(int32_t, int32_t)` |
| Pointer to a raw function pointer (`fn**`) | `pptr: fn**(int, int) -> int` | `int32_t (**pptr)(int32_t, int32_t)` |

### Passing and Returning `fn*`

Any top-level Zen C function (`fn`) with a matching parameter and return signature can be assigned to a `fn*` variable, passed as a `fn*` argument, or returned from a function returning `fn*`:

```zenc
fn add(a: int, b: int) -> int { return a + b; }
fn sub(a: int, b: int) -> int { return a - b; }
fn mul(a: int, b: int) -> int { return a * b; }

// Accepting a raw function pointer
fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int {
    return op(x, y);
}

// Returning a raw function pointer
fn select_op(symbol: char) -> fn*(int, int) -> int {
    if symbol == '+' { return add; }
    if symbol == '-' { return sub; }
    return mul;
}
```

---

## 2. Building Struct Dispatch Tables with `fn*`

You can embed `fn*` fields directly inside structs to build table-driven command dispatchers, state machines, or plugin registries:

```zenc
struct OpEntry {
    symbol: char,
    label: string,
    handler: fn*(int, int) -> int,
}

let table: OpEntry[3] = [
    OpEntry { symbol: '+', label: "Add",      handler: add },
    OpEntry { symbol: '-', label: "Subtract", handler: sub },
    OpEntry { symbol: '*', label: "Multiply", handler: mul },
];
```

Because each `handler` field is a raw 8-byte C function pointer, `table` is a plain contiguous C array of structs with zero heap allocation.

---

## 3. Passing `fn*` Callbacks to C Libraries (`qsort`)

One of the best demonstrations of `fn*` is calling C's standard `qsort` function from `<stdlib.h>`, which sorts an arbitrary array in place using a caller-supplied comparator callback:

```c
// Standard C signature in <stdlib.h>:
void qsort(void *base, size_t nmemb, size_t size,
           int (*compar)(const void *, const void *));
```

In Zen C, we declare `qsort` with `compar: fn*(const void*, const void*) -> c_int` and pass a normal Zen C function directly:

```zenc
include <stdlib.h>

extern fn qsort(
    base: void*,
    nmemb: usize,
    size: usize,
    compar: fn*(const void*, const void*) -> c_int
);

fn cmp_ints_asc(a: const void*, b: const void*) -> c_int {
    let va: int = *(int*)a;
    let vb: int = *(int*)b;
    if va < vb { return -1; }
    if va > vb { return 1; }
    return 0;
}
```

---

## 4. Complete Runnable Example

Here is the complete program (`examples/ch14/ch14-02-fn-pointers/main.zc`) combining a `fn*` struct dispatch table, a function returning `fn*`, a double function pointer (`fn**`), and C's `qsort`:

**Listing 14-2: `list14-2.zc` — Dispatch tables, higher-order `fn*`, and C `qsort` interop**

```zenc
// File: examples/ch14/ch14-02-fn-pointers/main.zc
include <stdlib.h>

// Binding C's standard qsort with a typed raw function pointer `fn*`
extern fn qsort(
    base: void*,
    nmemb: usize,
    size: usize,
    compar: fn*(const void*, const void*) -> c_int
);

fn add(a: int, b: int) -> int { return a + b; }
fn sub(a: int, b: int) -> int { return a - b; }
fn mul(a: int, b: int) -> int { return a * b; }

// 1. Accepting a raw C function pointer (`fn*`)
fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int {
    return op(x, y);
}

// 2. Returning a raw C function pointer (`fn*`)
fn select_op(symbol: char) -> fn*(int, int) -> int {
    if symbol == '+' { return add; }
    if symbol == '-' { return sub; }
    return mul;
}

// 3. Storing raw function pointers in a struct (dispatch table)
struct OpEntry {
    symbol: char,
    label: string,
    handler: fn*(int, int) -> int,
}

// 4. C ABI comparator function for libc's `qsort`
fn cmp_ints_asc(a: const void*, b: const void*) -> c_int {
    let va: int = *(int*)a;
    let vb: int = *(int*)b;
    if va < vb { return -1; }
    if va > vb { return 1; }
    return 0;
}

fn main() {
    let table: OpEntry[3] = [
        OpEntry { symbol: '+', label: "Add",      handler: add },
        OpEntry { symbol: '-', label: "Subtract", handler: sub },
        OpEntry { symbol: '*', label: "Multiply", handler: mul },
    ];

    for i in 0..3 {
        let entry = table[i];
        let h = entry.handler;
        let res = h(12, 4);
        println "{entry.label} (12 {entry.symbol} 4) = {res}";
    }

    let op_ptr = select_op('*');
    let prod = execute_op(op_ptr, 7, 6);
    println "execute_op(select_op('*'), 7, 6) = {prod}";
    assert(prod == 42, "7 * 6 must equal 42");

    // Pointer-to-function-pointer (`fn**`)
    let pptr: fn**(int, int) -> int = &op_ptr;
    let deref_op = *pptr;
    assert(deref_op(9, 5) == 45, "Dereferenced fn** should call mul(9, 5)");

    // Passing `cmp_ints_asc` directly to C's `qsort`
    let nums: int[5] = [42, 7, 19, 3, 25];
    qsort(&nums[0], 5, sizeof(int), cmp_ints_asc);
    println "Sorted via C qsort: [{nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}, {nums[4]}]";
    assert(nums[0] == 3 && nums[1] == 7 && nums[4] == 42, "Array must be sorted ascending");
}
```

Run the example with `zc run`:

```bash
$ zc run -q examples/ch14/ch14-02-fn-pointers/main.zc
Add (12 + 4) = 16
Subtract (12 - 4) = 8
Multiply (12 * 4) = 48
execute_op(select_op('*'), 7, 6) = 42
Sorted via C qsort: [3, 7, 19, 25, 42]
```

---

## 🔍 Peek at the C

When `zc` transpiles `examples/ch14/ch14-02-fn-pointers/main.zc`, notice how `select_op`, `execute_op`, and `struct OpEntry` emit standard C11 function pointer declarators with zero wrapper glue:

```c
typedef struct OpEntry {
    char symbol;
    string label;
    int32_t (*handler)(int32_t, int32_t);
} OpEntry;

// Emitted from `fn select_op(symbol: char) -> fn*(int, int) -> int`:
ZC_FUNC int32_t (*select_op(char symbol))(int32_t, int32_t)
{
    if ((symbol == '+')) { return add; }
    if ((symbol == '-')) { return sub; }
    return mul;
}

// Emitted from `fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int`:
ZC_FUNC int32_t execute_op(int32_t (*op)(int32_t, int32_t), int32_t x, int32_t y)
{
    return op(x, y);
}
```

Next, let's combine closures with sequence processing in **[14.3 Processing Items with Iterators](ch14-03-iterators.md)**!
