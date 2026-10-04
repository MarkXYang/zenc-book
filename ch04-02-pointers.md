# Pointers as Borrows

In [Section 4.1](ch04-01-move-semantics.md), we saw that passing a resource-owning value into a function or assigning it to another variable **moves** ownership. Once moved, the original variable can no longer be used.

However, in real-world programs, functions frequently need to read or mutate a resource without taking full ownership of it. In Zen C, you borrow access to values using **Pointers** (`T*`).

---

## Referencing and Pointer Types

To create a reference (borrow) to a variable, use the address-of operator (`&`). The type of a pointer to `T` is written as `T*`:

```zenc
struct Buffer {
    data: int*;
    len: int;
}

fn inspect_buffer(buf: Buffer*) {
    // Borrows buf without taking ownership
    println "Buffer length: {buf.len}";
}

fn main() {
    let my_buf = Buffer { data: 0, len: 1024 };
    inspect_buffer(&my_buf); // Borrowing via &
    // my_buf is still valid here because ownership was NOT moved!
}
```

---

## Auto-Dereference Feature

In standard C, accessing a struct member through a pointer requires verbose arrow syntax (`ptr->field`) or explicit dereferencing (`(*ptr).field`).

In Zen C, field access (`ptr.field`) and method calls (`ptr.method()`) **automatically dereference** the pointer:

```zenc
struct Node {
    value: int;
}

impl Node {
    fn display(self) {
        println "Node value: {self.value}";
    }
}

fn process_node(ptr: Node*) {
    // Automatically dereferences pointer (equivalent to (*ptr).value)
    println "Value: {ptr.value}";

    // Automatically dereferences for method calls
    ptr.display();
}

fn main() {
    let n = Node { value: 42 };
    process_node(&n);
}
```

---

## Safe Navigation (`?.`) and Null Coalescing (`??`)

Zen C provides ergonomic syntactic sugar operators for working with potentially `NULL` pointers safely:

### 1. Safe Navigation Operator (`?.`)
Safely accesses a field through a pointer. If the pointer is `NULL`, the expression short-circuits to `NULL` / zero without crashing:

```zenc
struct Session {
    id: int;
}

fn print_session(s: Session*) {
    let sess_id = s?.id; // Returns 0 / NULL if s is NULL
}
```

### 2. Null Coalescing Operator (`??`)
Evaluates to a fallback value if a pointer is `NULL`:

```zenc
let user_ptr = active_profile ?? &default_profile;
```

### 3. Null Assignment Operator (`??=`)
Assigns a fallback pointer only if the target is currently `NULL`:

```zenc
app_cfg ??= &fallback_cfg;
```

---

## Zen C Pointers vs. Rust's Borrow Checker

> [!IMPORTANT]
> **Contrast with Rust**:
> In Rust, the compiler enforces a compile-time Borrow Checker with lifetime annotations (`&'a T`), preventing references from outliving their targets.
> In Zen C:
> - Pointers are native C pointers under the hood (`T*`), giving **zero runtime overhead** and 100% C ABI compatibility.
> - Zen C protects against double-frees via Move Semantics. However, avoiding dangling pointers (e.g. returning the address of a local stack variable) remains the programmer's responsibility, just as in modern C and C++.
> - Use pointers for borrowing down the call stack, and use `defer` / `Drop` for deterministic cleanup at the end of scope.

Next, let's explore Slices in Zen C!
