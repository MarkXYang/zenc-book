# Automatic Cleanup and Drop

Zen C provides automatic cleanup mechanisms that eliminate manual tracking of resource lifetimes while avoiding the cost of a garbage collector.

---

## The `defer` Statement

The `defer` statement schedules a statement or block to be executed automatically when the enclosing scope exits (whether via `return`, reaching the end of the block, or early exit).

```zenc
fn process_file() {
    let f = fopen("data.txt", "r");
    if f == 0 {
        return;
    }
    defer fclose(f); // Guaranteed to run when process_file() exits

    // Perform file operations...
}
```

### LIFO Execution Order

Multiple `defer` statements inside the same scope are executed in **LIFO (Last-In, First-Out)** order:

**Listing 4-1: `list4-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "Start";
 3 |
 4 |     defer println "Third (First deferred)";
 5 |     defer println "Second (Second deferred)";
 6 |     defer println "First (Last deferred)";
 7 |
 8 |     println "End";
 9 | }
```

Output:
```text
Start
End
First (Last deferred)
Second (Second deferred)
Third (First deferred)
```

> [!WARNING]
> **No Control Flow in Defer**: To prevent undefined behavior, control flow jump statements (`return`, `break`, `continue`, `goto`) are **not allowed** inside a `defer` block.

---

## Automatic Memory Management with `autofree`

For heap-allocated pointers created with `malloc`, qualifying a local variable declaration with `autofree` automatically injects a `free()` call when the variable goes out of scope:

```zenc
fn process_buffer() {
    autofree let buffer = malloc(1024); // Automatically freed on scope exit

    // Use buffer safely without explicit free(buffer)
}
```

Under the hood, `autofree` binds the pointer to the scope using compiler-level cleanup attributes, ensuring memory is reclaimed even if the function exits early.

---

## Destructors and RAII (`Drop` Trait)

Resource Acquisition Is Initialization (RAII) is a pattern where resources (heap memory, socket connections, thread handles) are tied to object lifetimes.

In Zen C, custom structs implement the `Drop` trait to define automatic destruction logic:

**Listing 4-2: `list4-2.zc`**

```zenc
 1 | struct CustomBuffer {
 2 |     data: void*;
 3 |     size: usize;
 4 | }
 5 |
 6 | impl Drop for CustomBuffer {
 7 |     fn drop(self) {
 8 |         println "Dropping CustomBuffer (releasing {self.size} bytes)";
 9 |         if self.data != 0 {
10 |             free(self.data);
11 |         }
12 |     }
13 | }
14 |
15 | fn create_and_use() {
16 |     let buf = CustomBuffer {
17 |         data: malloc(512),
18 |         size: 512,
19 |     };
20 |
21 |     // Use buf...
22 | } // buf goes out of scope here: CustomBuffer.drop(buf) is called automatically
23 |
24 | fn main() {
25 |     create_and_use();
26 | }
```

Output:
```text
Dropping CustomBuffer (releasing 512 bytes)
```

### Key Benefits of `Drop`

1. **Automatic Memory Cleanup**: No risk of forgetting `free()`.
2. **Exception & Early Exit Safety**: Cleanup is guaranteed regardless of how scope is exited.
3. **Encapsulation**: Callers using `CustomBuffer` don't need to know its internal teardown steps.

---

## Disarming Destructors: The `forget()` Method

While RAII and `Drop` protect against memory leaks by automatically reclaiming resources, there are situations where you want to **prevent `drop()` from running**:
1. **Transferring Ownership to External / C APIs**: Passing a raw heap buffer to a C library function that takes responsibility for freeing it. If the Zen C wrapper struct's `drop()` executes, it will cause a double-free crash.
2. **Moving Resources Across Custom Containers**: In standard collections like `Vec<T>` and `String`, when appending or transferring elements out of a container, the source container's memory buffer is detached using `.forget()` so its destructor does not deallocate the transferred memory.

In Zen C, the standard convention is to implement a `forget(self)` method on the resource type. The `forget()` method zeroes out or nullifies internal pointers and resource handles:

**Listing 4-3: `list4-3.zc`**

```zenc
 1 | struct CustomBuffer {
 2 |     data: void*;
 3 |     size: usize;
 4 | }
 5 |
 6 | impl CustomBuffer {
 7 |     // Detaches the underlying resource, disarming Drop
 8 |     fn forget(self) {
 9 |         self.data = NULL;
10 |         self.size = 0;
11 |     }
12 | }
13 |
14 | impl Drop for CustomBuffer {
15 |     fn drop(self) {
16 |         if self.data != NULL {
17 |             println "Drop: freeing {self.size} bytes";
18 |             free(self.data);
19 |         } else {
20 |             println "Drop: buffer was forgotten, skipping deallocation";
21 |         }
22 |     }
23 | }
24 |
25 | fn transfer_to_c_api(raw_ptr: void*, size: usize) {
26 |     println "C API taking ownership of {size} bytes";
27 |     // Simulated C API freeing the buffer
28 |     free(raw_ptr);
29 | }
30 |
31 | fn main() {
32 |     println "=== Normal Drop ===";
33 |     {
34 |         let buf = CustomBuffer { data: malloc(64), size: 64 };
35 |     } // buf dropped here -> frees 64 bytes
36 |
37 |     println "\n=== Disarming Drop with forget() ===";
38 |     {
39 |         let buf = CustomBuffer { data: malloc(128), size: 128 };
40 |         let raw = buf.data;
41 |         let size = buf.size;
42 |
43 |         // Disarm buf's destructor before passing to C API
44 |         buf.forget();
45 |
46 |         transfer_to_c_api(raw, size);
47 |     } // buf dropped here, but data is NULL so no double free!
48 | }
```

Output:
```text
=== Normal Drop ===
Drop: freeing 64 bytes

=== Disarming Drop with forget() ===
C API taking ownership of 128 bytes
Drop: buffer was forgotten, skipping deallocation
```

> [!TIP]
> Standard library types like `Vec<T>`, `String`, `Option<T>`, and `Result<T, E>` all provide `.forget()` methods to support manual ownership transfers and zero-cost resource handoffs.

---

Next, let's explore **Resource Semantics, Move by Default, and Borrowing**!
