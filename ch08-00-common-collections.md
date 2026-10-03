# Common Collections

Most primitive types in Zen C—such as integers, floating-point numbers, runes, and fixed-size arrays (`[T; N]`)—represent fixed-size values known at compile time. Fixed-size arrays are allocated directly on the stack or embedded inside structs. While stack allocation is blisteringly fast, it comes with a fundamental constraint: the size of the array must be a compile-time constant, and it cannot grow or shrink during program execution.

Real-world systems programming problems often require storing collections of data whose sizes cannot be determined until runtime:
- Reading an unknown number of lines from a configuration file or network socket.
- Building a list of connected network clients that dynamically join and disconnect.
- Accumulating word tokens during document parsing.
- Indexing records in memory using associative keys for $O(1)$ lookups.

To solve these problems safely and efficiently, Zen C's standard library provides **Common Collections**.

---

## What Makes Zen C Collections Unique?

Unlike traditional C where dynamic structures require manually juggling `malloc`, `realloc`, and pointer arithmetic, Zen C collections provide modern high-level abstractions without sacrificing low-level performance or memory transparency:

1. **First-Class Generics**: Collections such as `Vec<T>` and `Set<T>` are generic over any type `T`, eliminating the need for `void*` casts or unsafe type punning.
2. **RAII and Automatic Cleanup (`Drop`)**: Every standard collection implements the `Drop` trait (`impl Drop for Vec`, `impl Drop for String`, `impl Drop for Map`, `impl Drop for Set`). When a collection variable exits its enclosing scope, its allocated heap buffer is automatically freed, eliminating manual `free()` calls and memory leaks.
3. **Move Semantics & Ownership**: Passing a collection by value transfers ownership. You can make an explicit deep copy using `.clone()` or prevent automatic deallocation using `.forget()`.
4. **Operator Overloading**: Natural syntax for common operations—concatenation with `+` and `+=`, stream pushing and popping with `<<` and `>>`, indexing with `[]`, and structural equality checks with `==` and `!=`.
5. **Functional Iterators & Combinators**: In addition to standard `for` loops, collections offer high-performance iterator pipelines (`filter`, `fold`, `find`, `forEach`).
6. **Zero-Overhead C Compatibility**: Standard `String` ensures null-termination, enabling direct, zero-cost passing to C library functions via `.c_str()`.

---

## Stack Arrays vs. Dynamic Collections

The following table summarizes the key trade-offs between fixed-size stack arrays and dynamic heap collections:

| Feature | Fixed-Size Array (`[T; N]`) | Dynamic Collection (`Vec<T>`, `String`, etc.) |
| :--- | :--- | :--- |
| **Storage Location** | Stack (or struct inline) | Heap (pointer on stack, data on heap) |
| **Size Known** | Compile time | Runtime (dynamic) |
| **Resizability** | Fixed, cannot grow | Dynamic (grows automatically via `realloc`) |
| **Allocation Cost** | Zero (stack pointer bump) | Heap allocation (`malloc` / `realloc`) |
| **Cleanup Mechanism** | Automatic stack pop | Automatic RAII (`Drop` trait frees heap buffer) |
| **Best Used For** | Small, fixed buffers (e.g. coordinates, fixed packet headers) | Unbounded data, text manipulation, associative lookup |

---

## The Three Core Collections

This chapter focuses on the three most versatile and widely used collection types in Zen C:

### 1. Vectors (`Vec<T>`)
A contiguous, growable array stored on the heap. Vectors allow fast random access ($O(1)$) by index and efficient element appending at the back ($O(1)$ amortized).

**Listing 8-1: `list8-1.zc`**

```zenc
import "std/vec.zc";

fn main() {
    let numbers = Vec<int>::new();
    numbers.push(10);
    numbers.push(20);
    numbers.push(30);

    println "Vector length: {numbers.length()}";
    println "First element: {numbers.first()}";
    println "Element at index 1: {numbers[1]}";
}
```

Output:
```text
Vector length: 3
First element: 10
Element at index 1: 20
```

### 2. Growable Strings (`String`)
A heap-allocated, UTF-8-aware string type wrapping `Vec<char>`. It provides string manipulation methods (concatenation, trimming, case conversion, splitting, substring extraction) while maintaining null-termination for seamless C interoperability.

**Listing 8-2: `list8-2.zc`**

```zenc
import "std/string.zc";

fn main() {
    let greeting = String::from("Hello");
    let target = String::from(" Zen C!");
    greeting.append(&target);

    println "{greeting.c_str()}";
    println "Character count: {greeting.utf8_len()}";
}
```

Output:
```text
Hello Zen C!
Character count: 12
```

### 3. Hash Maps (`Map<V>`) and Sets (`Set<T>`)
Associative containers powered by high-performance open-addressing hash tables:
- **`Map<V>`**: Maps string keys to values of type `V` with average $O(1)$ lookups, insertions, and removals.
- **`Set<T>`**: Stores unique values of type `T`, automatically discarding duplicate additions.

**Listing 8-3: `list8-3.zc`**

```zenc
import "std/map.zc";

fn main() {
    let inventory = Map<int>::new();
    inventory.put("apples", 15);
    inventory.put("oranges", 8);

    let count = inventory.get("apples");
    if count.is_some() {
        println "Apples in stock: {count.unwrap()}";
    }
}
```

Output:
```text
Apples in stock: 15
```

---

## Chapter Roadmap

This chapter is organized into three sections:

1. **[Vectors (Vec)](ch08-01-vectors.md)**: Explore dynamic arrays in depth—creating vectors, appending, inserting, indexing, reference iteration, operator overloads, and functional iterator combinators.
2. **[Strings](ch08-02-strings.md)**: Master Zen C's growable `String` type—understanding string literals vs. `String`, Unicode rune handling, transformations, splitting, and C string interop.
3. **[Hash Maps and Sets](ch08-03-hash-maps.md)**: Store and look up data associatively—using `Map<V>` for key-value relationships, `Set<T>` for unique collections, and combining all collections in a capstone text analysis project.

Let's begin by mastering Vectors!
