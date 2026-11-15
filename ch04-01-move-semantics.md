# Ownership & Stack vs Heap

Zen C treats types that manage underlying resources (like heap pointers, file descriptors, or structs implementing `Drop`) as **Resources**. To guarantee memory safety without garbage collection overhead, Zen C enforces strict **Resource Semantics** at compile-time.

---

## Resource Semantics (Move by Default)

In traditional C or C++, copying a struct containing a pointer blindly duplicates the pointer address. When both structs go out of scope, both call `free()`, resulting in a **double-free memory corruption crash**.

Zen C solves this problem with **Move Semantics**:

- **Move by Default**: Assigning a resource-owning variable to another variable transfers ownership. The original variable becomes invalid (**Moved**).
- **Preventing Double Frees**: Because ownership transfers, only the new owner will execute the destructor upon scope exit.

```zenc
let a = CustomBuffer { data: malloc(100), size: 100 };
let b = a; // Ownership moved to 'b'. 'a' is now invalid.

// let c = a; // Compiler Error: Use of moved value 'a'
```

### Native Types vs. Resource Types

> [!NOTE]
> **Native Types Are Always Copied, Never Moved**
> Move semantics apply strictly to **resource-owning types** (structs that manage resources or implement `Drop`).
>
> Primitive scalar types (`u8`–`u128`, `i8`–`i128`, `f32`, `f64`, `bool`, `char`, `rune`) live in CPU registers or on the stack and do not own heap memory or destructors. Duplicating them is a trivial bitwise copy with zero risk of double frees.
>
> Therefore, native types are **implicitly `Copy`**:
>
> ```zenc
> let a: u32 = 42;
> let b = a; // Copied by value
> let c = a; // OK: 'a' was not moved and remains valid!
>
> let x: f64 = 3.14;
> let y = x; // Copied by value
> let z = x; // OK: 'x' was not moved and remains valid!
> ```

### Compiler Diagnostics & Philosophy

> [!IMPORTANT]
> **Understanding "Use of moved value"**
> If you encounter the compiler diagnostic error **`Use of moved value 'x'`**, Zen C is protecting your program:
> *"This type owns a resource (like heap memory or a file handle) and blindly copying it is unsafe."*

Unlike C/C++, Zen C never implicitly duplicates resource-owning values.

| Type Category | Examples | Assignment Behavior | Invalidated on Move? |
| :--- | :--- | :--- | :--- |
| **Native Scalar Types** | `u8`–`u128`, `i8`–`i128`, `f32`, `f64`, `bool`, `char` | **Copy** (implicit bitwise copy) | **No** (remains valid) |
| **Resource Types / RAII** | Structs managing heap buffers, handles, or implementing `Drop` | **Move** (ownership transfer) | **Yes** (original becomes invalid) |
| **Opt-in Stack Structs** | Structs implementing `Copy` (`impl Copy for T`) | **Copy** (opt-in bitwise copy) | **No** (remains valid) |

---

## Passing Resources to Functions

Passing a resource variable into a function follows the exact same ownership rules as variable assignment:

**Listing 4-4: `list4-4.zc`**

```zenc
 1 | struct CustomBuffer {
 2 |     data: void*;
 3 |     size: usize;
 4 | }
 5 |
 6 | fn consume_buffer(buf: CustomBuffer) {
 7 |     println "Consumed buffer of size {buf.size}";
 8 | }
 9 |
10 | fn peek_buffer(buf: CustomBuffer*) {
11 |     println "Peeked buffer of size {buf.size}";
12 | }
13 |
14 | fn main() {
15 |     let my_buf = CustomBuffer { data: malloc(50), size: 50 };
16 |
17 |     peek_buffer(&my_buf); // OK: borrowed reference, my_buf remains valid
18 |
19 |     consume_buffer(my_buf); // OK: moved into function
20 |
21 |     // peek_buffer(&my_buf); // Error: my_buf was moved above!
22 | }
```

Output:
```text
Peeked buffer of size 50
Consumed buffer of size 50
```

---

## Explicit Resource Cloning (`Clone` Trait)

If you explicitly want two independent copies of a resource-owning value, call its `.clone()` method:

```zenc
let a = CustomBuffer { data: malloc(100), size: 100 };
let b = a.clone(); // Explicit duplicate allocation via Clone trait

// Both 'a' and 'b' are valid independent resource owners
```

---

## Opt-in Copy Types (`Copy` Trait)

For small value types that live entirely on the stack and do not own heap resources (such as plain coordinate points or numeric configurations), moving ownership on assignment can be inconvenient.

You can explicitly opt into implicit duplication by implementing `impl Copy for StructName`:

**Listing 4-5: `list4-5.zc`**

```zenc
 1 | struct Point {
 2 |     x: int;
 3 |     y: int;
 4 | }
 5 |
 6 | // Opt-in to implicit value duplication (Copy behavior)
 7 | impl Copy for Point {}
 8 |
 9 | fn main() {
10 |     let p1 = Point { x: 10, y: 20 };
11 |     let p2 = p1; // Copied implicitly because Point implements Copy
12 |
13 |     // Both p1 and p2 remain valid!
14 |     println "p1: ({p1.x}, {p1.y}), p2: ({p2.x}, {p2.y})";
15 | }
```

Output:
```text
p1: (10, 20), p2: (10, 20)
```

---

## Summary of Chapter 4

In Chapter 4, you mastered Zen C's memory management paradigm:
1. **Automatic Scope Cleanup**: Using `defer` (LIFO execution order), including `defer free(p)` for heap pointers.
2. **RAII & Destructors**: Custom teardown logic using `impl Drop for Struct`.
3. **Disarming Cleanup (`forget`)**: Detaching underlying resources via `.forget()` to prevent destructors from running during ownership handoffs.
4. **Resource Semantics**: Move-by-default assignment to eliminate double-free bugs.
5. **Reference Borrowing**: Borrowing structs via pointers (`Struct*`) to avoid moving ownership.
6. **Explicit Cloning & Copy Opt-in**: `.clone()` for explicit deep copies vs `impl Copy` for stack value types.

In **Chapter 5**, we will learn how to organize complex data using **Structs and Method Syntax**!
