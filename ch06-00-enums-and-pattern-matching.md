# Enums and Pattern Matching

In [Chapter 5](ch05-00-structs.md), we explored structs, which allow you to bundle multiple related fields together into a single composite type. Structs are *Product Types* ($A \times B$): an instance of a struct contains field $A$ **and** field $B$.

However, real-world systems programming frequently requires modeling values that can be one of several possible alternatives at any given time. For example:
- A network connection is either **Connecting**, **Connected**, **Idle**, or **Closed**.
- An HTTP response returns either a **Success** payload or an **Error** code.
- A user interface event is either a **Mouse Click** with coordinates, a **Key Press** with a character code, or a **Quit** request.

To represent these data structures safely and expressively, Zen C provides **Enums** (*Sum Types* or *Tagged Unions*).

---

## What Makes Zen C Enums Unique?

In traditional C, an `enum` is simply a set of named integer constants:

```c
// Traditional C: Just named integers, no type safety, cannot hold data
enum Status { IDLE, RUNNING, ERROR };
```

To associate data with an error in C, you must write a manual `union` paired with a separate integer tag, leaving memory safety, initialization, and validation entirely to the programmer. Forgetting to check the tag before accessing a union field results in undefined behavior and security exploits.

In Zen C, enums are **first-class algebraic data types (Tagged Unions)**:

- **Variants Can Hold Data**: Each variant can independently hold no data, a single value, multiple values (tuples), or complex structs.
- **Type-Safe Access**: You cannot access a variant's data without pattern matching on it, preventing uninitialized memory reads.
- **C11 Memory Efficiency**: Enums compile directly to an optimized C11 discriminant tag byte alongside an overlapping `union` for the payload, ensuring zero heap allocation overhead and minimal memory footprint.
- **Methods on Enums**: You can attach methods and constructors directly to enums using `impl` blocks.
- **Exhaustive Pattern Matching**: The `match` construct requires handling every possible variant, guaranteeing that unhandled cases are caught at compile time.

```zenc
enum WebEvent {
    PageLoad,
    KeyPress(char),
    Click(int, int),
    Paste(string),
}
```

---

## Foundation for Safe Error Handling

Zen C's standard error handling system relies entirely on enums. Instead of returning error codes or using unsafe `NULL` pointers, the standard library provides:

- **`Option<T>`**: Represents an optional value that is either `Some(T)` or `None`.
- **`Result<T, E>`**: Represents a computation that either succeeded with `Ok(T)` or failed with `Err(E)`.

Mastering enums and pattern matching in this chapter will give you the foundation needed to understand robust error handling in [Chapter 9](ch09-00-error-handling.md).

---

## Chapter Roadmap

This chapter is organized into two sections:

1. **[Defining an Enum](ch06-01-defining-an-enum.md)**: How to declare enums, attach payloads to variants (unit, single, and tuple payloads), understand the underlying tagged union memory layout, and define methods on enums using `impl` blocks.
2. **[The match Control Flow Construct](ch06-02-match.md)**: How to process enums with `match`, perform exhaustive matching, destructure payloads, inspect values by reference using `ref`, and match multiple patterns.

Let's begin by defining our first enum!
