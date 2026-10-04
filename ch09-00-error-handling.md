# Error Handling

Errors are a fact of life in software engineering. Disk drives fill up, network connections drop, configuration files contain syntax errors, and invalid inputs arrive from untrusted clients. How a programming language approaches error handling directly impacts the reliability, maintainability, and security of its software.

In traditional C, error handling relies heavily on ad-hoc conventions:
- **Sentinel return values**: Returning `-1`, `0`, or `NULL` to signify failure. If the caller forgets to inspect the return code, invalid data flows unchecked into subsequent calculations, often causing silent corruption or catastrophic crashes.
- **Global state (`errno`)**: Inspecting a thread-local integer flag after a failure occurs, which is easy to overlook and prone to being overwritten by subsequent library calls.
- **`goto cleanup` ladders**: Manually jumping over failure points to release resources, producing fragile code where missing a label leads to memory leaks or double frees.

Modern high-level languages like C++ and Java introduced **exceptions** (`try`/`catch`/`throw`). While exceptions automate error propagation, they impose non-deterministic runtime costs, introduce hidden control flow paths, complicate destructor unwinding, and are forbidden in embedded, kernel, and safety-critical domains.

Zen C takes a modern systems approach: **Explicit, Type-Safe, Zero-Cost Error Handling**.

---

## The Zen C Philosophy: Recoverable vs. Unrecoverable Errors

Zen C groups errors into two distinct categories:

1. **Unrecoverable Errors (`panic`)**:
   These represent catastrophic failures or invariant violations where the program cannot meaningfully continue execution—such as internal corruption, impossible state transitions, or contract violations. Zen C handles unrecoverable errors with **`panic`**, which prints diagnostic details and aborts execution immediately.

2. **Recoverable Errors (`Result<T>` and `Option<T>`)**:
   These represent expected conditions that a well-written application can anticipate and handle gracefully—such as a file failing to open, a network timeout, or an optional value being absent. Zen C models these conditions using the standard **`Result<T>`** and **`Option<T>`** types, paired with the concise **`?`** try operator.

Zen C does not have hidden exception runtimes or dynamic stack unwinding tables. Every error path is explicitly typed, visible in function signatures, and transpiles directly to efficient, predictable GNU C11 branches.

---

## Chapter Roadmap

This chapter explores Zen C's error handling system from foundational primitives to production idioms:

1. **[Unrecoverable Errors with panic](ch09-01-panic.md)**: When and how to abort with `panic`, compiler diagnostic output, and the `!"msg"` error shorthand.
2. **[Recoverable Errors with Result and Option](ch09-02-option-and-result.md)**: Working with `Option<T>` (`Some`/`None`) and `Result<T>` (`Ok`/`Err`), inspecting outcomes, unwrap methods, and the **`?`** try operator.
3. **[Cleanup on Error Paths with defer](ch09-03-defer-cleanup.md)**: Guaranteeing resource deallocation along early exit error paths with `defer`.
4. **[Bridging C Return Codes and errno](ch09-04-c-errors.md)**: Wrapping legacy C APIs and POSIX system calls into safe, idiomatic `Result<T>` abstractions.
5. **[To panic or Not to panic](ch09-05-panic-guidelines.md)**: Guidelines and heuristics for choosing between unrecoverable panics and recoverable `Result` returns.

Let's begin by examining unrecoverable errors with `panic`!
