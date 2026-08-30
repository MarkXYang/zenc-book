# Understanding Memory Management

Memory management is one of the most critical aspects of systems programming. Traditional C gives programmers total freedom over memory allocation (`malloc`/`free`), but at the cost of frequent bugs: memory leaks, double frees, and use-after-free vulnerabilities. On the other hand, managed languages rely on a Garbage Collector (GC), introducing non-deterministic execution pauses and memory overhead.

Zen C takes a different approach: **Manual Memory Management with Ergonomic Safety**.

In Zen C, you retain complete C-level control and performance with zero runtime garbage collection overhead. However, the language provides powerful features to eliminate memory bugs:

- **Scope-based Defer (`defer`)**: Guarantees cleanup execution (e.g., closing file handles, releasing mutex locks) when leaving a block.
- **Automatic Heap Cleanup (`autofree`)**: Automatically calls `free()` on heap allocations when variables go out of scope.
- **Resource Semantics & Move-by-Default**: Types owning resources cannot be duplicated accidentally, eliminating double-free errors at compile time.
- **Destructors & RAII (`Drop` Trait)**: Allows custom types to define automatic teardown behavior when dropped.
- **Opt-in Value Duplication (`Copy` Trait)**: Small value types can explicitly opt into implicit copying.

Let's begin by examining scope-based automatic cleanup constructs in Zen C!
