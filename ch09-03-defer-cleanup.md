# Cleanup on Error Paths with defer

In systems programming, functions frequently acquire resources that must be released before the function returns:
- Allocating memory on the heap.
- Opening file streams and file descriptors.
- Acquiring POSIX mutex locks.
- Opening network sockets.

When an error occurs halfway through a function, returning early without releasing acquired resources creates memory leaks, socket exhaustion, or deadlocks.

In traditional C, developers use the notorious **`goto cleanup`** idiom to handle this:

```c
// Traditional C: Fragile goto ladders
int process_file(const char* path) {
    FILE* f = fopen(path, "r");
    if (!f) return -1;

    char* buf = malloc(1024);
    if (!buf) {
        fclose(f); // Easy to forget!
        return -1;
    }

    if (read_data(f, buf) < 0) {
        goto cleanup; // Jumps to manual cleanup
    }

    // Success path
cleanup:
    free(buf);
    fclose(f);
    return 0;
}
```

`goto cleanup` is notoriously error-prone: forgetting a single `fclose` or jumping to the wrong label causes serious vulnerabilities.

---

## Zen C's Solution: Deterministic `defer`

In Zen C, you solve this problem with **`defer`** (first introduced in [Chapter 4](ch04-00-ownership-pointers-cleanup.md)).

Statements scheduled with `defer` are guaranteed to execute whenever the enclosing scope exits, whether by completing normally or by returning early due to an error.

**Listing 9-3**
```zenc
include <stdio.h>
import "std/result.zc"

fn process_stream(fail_flag: bool) -> Result<int> {
    println "[step 1] Allocating buffer / opening stream...";
    defer println "[cleanup] Stream closed and buffer freed cleanly via defer!";

    if fail_flag {
        println "[step 2] Encountered unexpected protocol error!";
        return Result<int>::Err("Protocol communication failure");
    }

    println "[step 2] Data processed successfully.";
    return Result<int>::Ok(42);
}

fn main() {
    println "=== Scenario A: Error Path ===";
    let r1 = process_stream(true);
    if r1.is_err() {
        println "Received error: {r1.err}";
    }

    println "\n=== Scenario B: Success Path ===";
    let r2 = process_stream(false);
    if r2.is_ok() {
        println "Received value: {r2.unwrap()}";
    }
}
```

Output:
```text
=== Scenario A: Error Path ===
[step 1] Allocating buffer / opening stream...
[step 2] Encountered unexpected protocol error!
[cleanup] Stream closed and buffer freed cleanly via defer!
Received error: Protocol communication failure

=== Scenario B: Success Path ===
[step 1] Allocating buffer / opening stream...
[step 2] Data processed successfully.
[cleanup] Stream closed and buffer freed cleanly via defer!
Received value: 42
```

Notice that `[cleanup]` ran in **both** scenarios, guaranteeing zero resource leaks!

---

## RAII Cleanup with the `Drop` Trait

When working with higher-level types that implement the `Drop` trait (such as `Vec<T>`, `String`, or custom resource wrappers), Zen C's compiler cleans up variables automatically upon scope exit.

If you combine RAII types with early error returns, the compiler automatically calls destructors on all live local variables before the return statement completes.

Next, let's learn how to bridge C's integer return codes and global `errno` into idiomatic `Result<T>`!
