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

```zenc
fn main() {
    println "Start";

    defer println "Third (First deferred)";
    defer println "Second (Second deferred)";
    defer println "First (Last deferred)";

    println "End";
}
/* Output:
   Start
   End
   First (Last deferred)
   Second (Second deferred)
   Third (First deferred)
*/
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
```

### Key Benefits of `Drop`

1. **Automatic Memory Cleanup**: No risk of forgetting `free()`.
2. **Exception & Early Exit Safety**: Cleanup is guaranteed regardless of how scope is exited.
3. **Encapsulation**: Callers using `CustomBuffer` don't need to know its internal teardown steps.

Next, let's explore **Resource Semantics, Move by Default, and Borrowing**!
