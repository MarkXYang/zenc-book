# To panic or Not to panic

So how do you decide when you should call `panic` and when you should return `Result`?

Returning `Result` gives the calling code options. The caller can choose to attempt recovery in a way that makes sense for their situation, or they can decide that an `Err` is fatal and call `.unwrap()` to panic. Therefore, **`Result` is the default best choice** when you are defining a function that might fail.

However, in certain situations, panicking is appropriate. Let's explore the guidelines for choosing between them.

---

## When to Use `panic`

You should panic when bad state cannot be recovered from:

1. **Bug in Code (Contract Violations)**:
   If an internal assumption was violated—for example, a private helper function received a negative index when the public interface already validated bounds—it indicates a programmer bug, not a recoverable runtime failure.
2. **Impossible States in Exhaustive Logic**:
   If execution reaches a branch that mathematically should never occur.
3. **Prototypes and Automated Tests**:
   When writing tests (`test "..." { ... }`), panicking on assertion failure is desirable so the test runner immediately flags the regression.

---

## When to Use `Result`

You should return `Result` when failure is an expected possibility in normal operation:

1. **I/O Operations**: Files, network requests, disk reads, and IPC calls can always fail due to external factors outside the application's control.
2. **Parsing & Validation**: Validating user input, deserializing JSON, or parsing command-line flags.
3. **Hardware & Resource Limits**: When an allocation or resource handle fails, returning `Result` allows the caller to gracefully shed load or log an error.

---

## Summary of Chapter 9

In this chapter, you mastered error handling in Zen C:
- **Unrecoverable Errors**: Using `panic("msg")` to terminate on invariant violations with zero runtime overhead.
- **`Option<T>`**: Representing optional values (`Some`/`None`), testing with `is_some()`, and retrieving defaults with `unwrap_or()`.
- **`Result<T>`**: Modeling operations that can succeed (`Ok(v)`) or fail (`Err(msg)`).
- **The Try Operator (`?`)**: Eliminating boilerplate by propagating errors up the call stack with statement expression performance.
- **Deterministic Cleanup**: Using `defer` to guarantee resources are deallocated on all return paths.
- **C Interoperability**: Converting C return codes and `errno` into safe `Result<T>` abstractions.

Now that you know how to write robust, fault-tolerant code, let's move on to **[Chapter 10: Generics, Traits & Operator Overloading](ch10-00-generics-and-traits.md)**!
