# Using Structs to Structure Data

A *struct*, or structure, is a custom compound data type that allows you to package together and name multiple related values into a single meaningful unit. If you are familiar with traditional C, structs in Zen C fulfill the same foundational role of defining structured data in memory. However, Zen C modernizes structs by pairing high-performance, predictable C11 memory layouts with ergonomic features familiar from modern languages:

- **Clean Struct Definitions**: Declare fields with type-first clarity and idiomatic Zen C syntax.
- **Strict Initialization**: Prevent uninitialized memory bugs with mandatory complete field initialization or explicit zero-initialization.
- **Ergonomic Field Access**: Unified dot (`.`) syntax across both direct struct values and struct pointers.
- **Pattern Matching & Destructuring**: Extract struct fields directly into local variables with shorthand or renaming syntax.
- **Composition & Mixins (`use`)**: Embed structs via named composition or mixin flattening with automatic method forwarding.
- **Low-Level Control**: Fine-tune binary representation with bitfields, `@packed`, and `@align(N)` attributes.
- **Method Syntax & `impl` Blocks**: Associate behaviors, read-only methods (`const self`), mutating methods (`self`), and constructors (`Struct::new()`) directly with your types.
- **Clean Operator Overloading**: Implement arithmetic, comparison, and indexing operators on structs with intuitive methods (`add`, `eq`, `get`, etc.).

---

## Why Structs?

In earlier chapters, we worked with primitive scalar types (such as `int`, `f64`, and `bool`) and tuples. While tuples allow grouping multiple values without defining a new type, they are anonymous: you must refer to components by their positional index (like `coord.v0` and `coord.v1`). For complex domain models, positional indexing quickly becomes error-prone and ambiguous.

Structs solve this by giving each piece of data an explicit name and type. Comparing the two approaches:

```zenc
// Using a tuple: ambiguous and easy to confuse indices
let user_tuple: (string, string, u64, bool) = ("mark", "mark@example.com", 1, true);
let email = user_tuple.v1; // What was index 1 again?

// Using a struct: clear, self-documenting, and robust
struct User {
    username: string;
    email: string;
    sign_in_count: u64;
    active: bool;
}

let user = User {
    username: "mark",
    email: "mark@example.com",
    sign_in_count: 1,
    active: true,
};
let email = user.email; // Immediately obvious and safe!
```

---

## Zero-Cost Abstraction & Memory Guarantees

Zen C transpiles directly to standard GNU C11. Every struct you declare in Zen C maps directly to a native C `struct` with standard ABI compatibility. There is **zero runtime overhead**, no hidden heap allocations, and no hidden virtual method dispatch tables (vtables) for standard struct methods.

When you pass a struct or borrow its pointer, Zen C enforces the resource and ownership rules introduced in [Chapter 4](ch04-00-understanding-memory-management.md):
- Plain data structs can explicitly opt into implicit copying via `impl Copy for StructName {}`.
- Structs that manage external resources (heap buffers, file descriptors, sockets) move by default, ensuring automatic cleanup without double-free vulnerabilities.

---

## Chapter Roadmap

This chapter is divided into two sections:

1. **[Defining and Instantiating Structs](ch05-01-defining-structs.md)**: How to define struct types, instantiate them with struct literals, access and update fields, destructure fields into variables, use mixins and composition (`use`), configure bitfields, and apply `@packed` / `@align` attributes.
2. **[Method Syntax and impl Blocks](ch05-02-method-syntax.md)**: How to attach methods to structs using `impl` blocks, distinguish between read-only (`const self`) and mutating (`self`) methods, create associated constructor functions (`Type::new()`), organize code with multiple `impl` blocks, and overload operators for custom types.

Let's begin by defining our first struct!
