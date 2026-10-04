# Ownership, Pointers and Cleanup

Memory management is one of the most critical aspects of systems programming. Traditional C gives programmers total freedom over memory allocation (`malloc`/`free`), but at the cost of frequent bugs: memory leaks, double frees, and use-after-free vulnerabilities. On the other hand, managed languages rely on a Garbage Collector (GC), introducing non-deterministic execution pauses and memory overhead.

Zen C takes a different approach: **Manual Memory Management with Ergonomic Safety and Move Semantics**.

In Zen C, you retain complete C-level control and performance with zero runtime garbage collection overhead. However, the language provides powerful features to eliminate memory bugs:

- **Stack vs Heap & Move Semantics**: Types owning resources cannot be duplicated accidentally; assignment moves ownership by default, eliminating double-free errors at compile time.
- **Pointers as Borrows**: Ergonomic pointers (`T*`, `&x`) allow borrowing access to data without moving ownership. Zen C features uniform dot syntax (`ptr.field`), auto-dereferencing, safe navigation (`?.`), and null coalescing (`??`).
- **Slices**: Pass contiguous views of memory (`std/slice.zc`) without heap allocations or buffer copying.
- **Deterministic Cleanup**: Scope-based `defer` (LIFO execution), `autofree` for raw pointers, custom destructors with the `Drop` trait, and `.forget()` for disarming cleanup during ownership handoffs.

---

## Chapter Roadmap

This chapter is organized into four sections:

1. **[Stack, Heap and Move Semantics](ch04-01-move-semantics.md)**: How resource types move by default on assignment and function calls, explicit `.clone()`, and `@derive(Copy)`.
2. **[Pointers as Borrows](ch04-02-pointers.md)**: Borrowing with `&` and `T*`, auto-dereference, safe navigation (`?.`), null coalescing (`??`), and how Zen C differs from Rust's borrow checker.
3. **[Slices](ch04-03-slices.md)**: Zero-copy views over arrays and buffers.
4. **[Deterministic Cleanup](ch04-04-cleanup.md)**: Using `defer`, `autofree`, RAII with `Drop`, and disarming cleanup with `forget()`.

Let's begin by exploring Stack, Heap and Move Semantics!
