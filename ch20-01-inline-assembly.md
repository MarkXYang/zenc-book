# 20.1 Inline Assembly and Volatile

In operating system kernels, device drivers, real-time control loops, and performance-critical DSP routines, software frequently needs to execute specific CPU instructions that cannot be represented in portable high-level language constructs.

Zen C provides first-class support for **inline assembly** through `asm { ... }` blocks and **volatile barriers** via `asm volatile { ... }`. Unlike raw string concatenation in standard C, Zen C's inline assembly allows direct interpolation of local variables using `{var}` syntax with automatic register constraint mapping.

---

## 1. Basic Assembly Blocks

The simplest form of inline assembly contains pure machine instructions without input or output operands:

```zenc
fn cpu_pause() {
    asm { pause }
}

fn memory_barrier() {
    asm volatile {
        mfence
    }
}
```

- **`asm { ... }`**: Emits an inline assembly instruction. The compiler optimizer may reorder or eliminate the instruction if it determines that its outputs are unused.
- **`asm volatile { ... }`**: Guarantees that the compiler will **never reorder, hoist, or eliminate** the assembly block during optimization. This is essential for memory barriers (`mfence`, `dmb`), MMIO registers, and cache flushes.

---

## 2. Extended Assembly with Operands and Variable Binding

When your assembly routine reads from or writes to Zen C variables, specify the operands after colons (`:`) using `out(...)`, `in(...)`, `inout(...)`, and `clobber(...)`:

```zenc
fn add_fast(a: int, b: int) -> int {
    let result: int;
    asm {
        "mov {a}, {result}"
        "add {b}, {result}"
        : out(result)
        : in(a), in(b)
        : clobber("cc")
    }
    return result;
}
```

### Operand Sections:

1. **Output Operands (`: out(var)`)**: Specifies variables written by the assembly snippet. The compiler maps this to an output register (`"=r"`).
2. **Input Operands (`: in(var)`)**: Specifies variables read by the assembly snippet (`"r"`).
3. **In-Out Operands (`: inout(var)`)**: Specifies variables that serve as both input and output, modified in-place (`"+r"`).
4. **Clobber List (`: clobber(...)`)**: Informs the compiler which hardware resources or status flags were modified:
   - `"cc"`: Condition code register (flags modified by `add`, `cmp`, `sub`).
   - `"memory"`: Signals that assembly reads/writes arbitrary memory, forcing a compiler optimization fence.

---

## 3. 🔍 Peek at the C: How `zc` Lowers Inline Assembly

When you run `zc transpile` on `add_fast`, `zc` automatically transforms the `{var}` references into positional GCC/Clang operand numbers (`%0`, `%1`, `%2`):

```c
int32_t add_fast(int32_t a, int32_t b) {
    int32_t result;
    __asm__(
        "mov %1, %0\n"
        "add %2, %0\n"
        : "=r"(result)
        : "r"(a), "r"(b)
        : "cc"
    );
    return result;
}
```

This design combines the safety of named variable binding with the raw speed and zero-overhead lowering of GCC/Clang inline assembly.

---

## 4. Complete Example: Listing 20-1

Listing 20-1 demonstrates basic pause instructions, volatile memory fences, extended input/output operand binding, and in-place variable modification.

**Listing 20-1**: `list20-1.zc` — Inline assembly and volatile barriers (`examples/ch20/ch20-01-inline-assembly/main.zc`)

```zenc
// File: examples/ch20/ch20-01-inline-assembly/main.zc

// 1. Basic assembly block: CPU pause instruction in spinlock or delay
fn cpu_pause() {
    asm { pause }
}

// 2. Volatile memory barrier: prevent compiler and CPU memory reordering
fn memory_barrier() {
    asm volatile {
        mfence
    }
}

// 3. Extended inline assembly with inputs, outputs, and condition code clobber
fn add_fast(a: int, b: int) -> int {
    let result: int;
    asm {
        "mov {a}, {result}"
        "add {b}, {result}"
        : out(result)
        : in(a), in(b)
        : clobber("cc")
    }
    return result;
}

// 4. Inout constraint: modifying a variable in-place via register (+r)
fn double_in_place(x: int) -> int {
    let val = x;
    asm {
        "shl $1, {val}"
        : inout(val)
        :
        : clobber("cc")
    }
    return val;
}

fn main() {
    println "Testing inline assembly in Zen C...";

    cpu_pause();
    memory_barrier();

    let sum = add_fast(40, 2);
    println "add_fast(40, 2) = {sum}";
    assert(sum == 42, "add_fast failed");

    let doubled = double_in_place(21);
    println "double_in_place(21) = {doubled}";
    assert(doubled == 42, "double_in_place failed");

    println "Inline assembly executed successfully!";
}
```

Run and verify Listing 20-1 with `zc run -q`:

```console
$ zc run -q examples/ch20/ch20-01-inline-assembly/main.zc
Testing inline assembly in Zen C...
add_fast(40, 2) = 42
double_in_place(21) = 42
Inline assembly executed successfully!
```

---

## Summary

- Use `asm { ... }` for processor-specific instructions that can be optimized or moved.
- Use `asm volatile { ... }` for hardware fences, memory barriers, and MMIO accesses that must never be reordered or eliminated.
- Use `{variable_name}` inside assembly strings to bind variables cleanly without error-prone manual numeric registers.
- Use `out(...)`, `in(...)`, `inout(...)`, and `clobber(...)` to declare data flow and register clobber constraints to the compiler.
