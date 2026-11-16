# Deterministic Cleanup: `defer` and `Drop`

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

**Listing 4-4**
```zenc
fn main() {
    println "Start";

    defer println "Third (First deferred)";
    defer println "Second (Second deferred)";
    defer println "First (Last deferred)";

    println "End";
}
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

## Freeing Heap Memory with `defer free(...)`

For heap memory you get from `malloc`, put the matching `free()` in a `defer` right after the allocation. The allocation and its cleanup then sit next to each other, and the memory is released on every exit path, including early returns:

```zenc
fn process_buffer() {
    let buffer = malloc(1024);
    defer free(buffer); // Runs when process_buffer returns, however it returns

    // Use buffer without worrying about the free
}
```

When a heap allocation belongs to a struct rather than a single function, implement `Drop` for that struct instead (covered next), so the memory is freed wherever the value goes out of scope.

> **Note:** Earlier versions of Zen C had an `autofree` qualifier (`autofree let p = malloc(n);`). It was removed; the compiler now reports `'autofree' was removed; declare the variable normally and add 'defer free(x)'`.

---

## Destructors and RAII (`Drop` Trait)

Resource Acquisition Is Initialization (RAII) is a pattern where resources (heap memory, socket connections, thread handles) are tied to object lifetimes.

In Zen C, custom structs implement the `Drop` trait to define automatic destruction logic:

**Listing 4-5**
```zenc
struct CustomBuffer {
    data: void*;
    size: usize;
}

impl Drop for CustomBuffer {
    fn drop(self) {
        println "Dropping CustomBuffer (releasing {self.size} bytes)";
        if self.data != 0 {
            free(self.data);
        }
    }
}

fn create_and_use() {
    let buf = CustomBuffer {
        data: malloc(512),
        size: 512,
    };

    // Use buf...
} // buf goes out of scope here: CustomBuffer.drop(buf) is called automatically

fn main() {
    create_and_use();
}
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

**Listing 4-6**
```zenc
struct CustomBuffer {
    data: void*;
    size: usize;
}

impl CustomBuffer {
    // Detaches the underlying resource, disarming Drop
    fn forget(self) {
        self.data = NULL;
        self.size = 0;
    }
}

impl Drop for CustomBuffer {
    fn drop(self) {
        if self.data != NULL {
            println "Drop: freeing {self.size} bytes";
            free(self.data);
        } else {
            println "Drop: buffer was forgotten, skipping deallocation";
        }
    }
}

fn transfer_to_c_api(raw_ptr: void*, size: usize) {
    println "C API taking ownership of {size} bytes";
    // Simulated C API freeing the buffer
    free(raw_ptr);
}

fn main() {
    println "=== Normal Drop ===";
    {
        let buf = CustomBuffer { data: malloc(64), size: 64 };
    } // buf dropped here -> frees 64 bytes

    println "\n=== Disarming Drop with forget() ===";
    {
        let buf = CustomBuffer { data: malloc(128), size: 128 };
        let raw = buf.data;
        let size = buf.size;

        // Disarm buf's destructor before passing to C API
        buf.forget();

        transfer_to_c_api(raw, size);
    } // buf dropped here, but data is NULL so no double free!
}
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
> Standard library types like `Vec<T>`, `String`, `Option<T>`, and `Result<T>` all provide `.forget()` methods to support manual ownership transfers and zero-cost resource handoffs.

---

## Summary of Chapter 4

In Chapter 4, you learned Zen C's ownership and cleanup model:
1. **Move Semantics**: Assigning or passing a resource moves it, which prevents double frees. `.clone()` makes an explicit deep copy, and `Copy` opts small value types into implicit copying.
2. **Pointers as Borrows**: Passing `T*` (with `&x`) lends a value to a function without moving ownership.
3. **Slices**: `Slice<T>` is a non-owning view into contiguous memory.
4. **Scope Cleanup**: `defer` runs cleanup in LIFO order, including `defer free(p)` for heap pointers.
5. **RAII & Destructors**: `impl Drop for Struct` runs teardown logic automatically at the end of scope.
6. **Disarming Cleanup (`forget`)**: `.forget()` detaches a resource so its destructor does not run during an ownership handoff.

In **Chapter 5**, we will learn how to organize complex data using **Structs and Method Syntax**!
