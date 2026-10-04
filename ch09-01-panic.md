# Unrecoverable Errors with panic

Sometimes bad things happen in your code, and there is nothing you can do about it. In these situations, attempting to continue execution would likely corrupt memory, write invalid data to disks, or introduce severe security vulnerabilities.

Zen C provides the **`panic`** function for handling unrecoverable errors. When a panic occurs, your program prints an error message to standard error (`stderr`), displays diagnostic context, and terminates execution with exit code `1`.

---

## When Panics Occur

There are two primary ways a panic is triggered in Zen C:
1. **Explicitly**: Your code explicitly calls `panic("reason")` when an internal invariant is violated.
2. **Standard Library Invariants**: Methods like `Option<T>::unwrap()` or `Result<T>::unwrap()` panic automatically when invoked on unexpected variants (such as unwrapping a `None` or an `Err`).

---

## Explicitly Panicking

To abort your program explicitly, invoke `panic` with an explanation string:

**Listing 9-1: `list9-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "Starting application initialization...";
 3 | 
 4 |     let critical_config_loaded = false;
 5 |     if !critical_config_loaded {
 6 |         panic("Configuration file missing or corrupted! Cannot continue.");
 7 |     }
 8 | 
 9 |     println "This line will never be reached.";
10 | }
```

Running this program with `zc run`:

```text
Starting application initialization...
Panic: Configuration file missing or corrupted! Cannot continue.
```

The message clearly states the failure reason and terminates the process immediately, preventing line 9 from ever executing.

---

## The Error Printing Shorthand (`!`)

Zen C also provides a concise syntax shorthand for emitting messages to standard error (`stderr`): prefixing a string literal with `!`:

```zenc
!"Critical: invalid memory buffer state encountered\n";
```

This shorthand is equivalent to calling `eprintln` and is frequently paired with early exits in diagnostic utilities.

---

> [!TIP]
> ### 🔍 Peek at the C: How `panic` Works Under the Hood
> Zen C has no C++ exception runtime, no RTTI, and no multi-frame stack unwinding tables.
> When you call `panic(msg)`, the `zc` compiler generates a direct call to the core runtime panic handler:
>
> ```c
> ZC_FUNC void __zenc_panic_impl(const char* file, int32_t line, const char* func, const char* msg) {
>     fprintf(stderr, "Panic: %s\n", msg);
>     exit(1);
> }
> ```
>
> Because it compiles directly to `exit(1)`, panicking has **zero runtime overhead** during normal, non-panicking execution paths.

---

## Panicking via `unwrap`

When using `Option<T>` or `Result<T>` (which we will explore in detail in the next section), calling `.unwrap()` asserts that the operation was successful. If the value is `None` or an `Err`, `unwrap()` triggers an immediate panic:

```zenc
let opt = Option<int>::None();
let val = opt.unwrap(); // Panics with: "Panic: unwrap called on None"
```

While `.unwrap()` is convenient for quick prototypes and automated tests, production systems should generally favor recoverable error handling.

Next, let's learn how to handle recoverable errors using `Result` and `Option`!
