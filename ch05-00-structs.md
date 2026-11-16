# Structs and Composition

A *struct*, or structure, is a custom compound data type that allows you to package together and name multiple related values into a single meaningful unit. If you are familiar with traditional C, structs in Zen C fulfill the same foundational role of defining structured data in memory. However, Zen C modernizes structs by pairing high-performance, predictable C11 memory layouts with ergonomic features familiar from modern languages:

- **Clean Struct Definitions**: Declare fields with type-first clarity and idiomatic Zen C syntax.
- **Strict Initialization**: Prevent uninitialized memory bugs with mandatory complete field initialization or explicit zero-initialization (`Struct{}`).
- **Ergonomic Field Access**: Unified dot (`.`) syntax across both direct struct values and struct pointers.
- **Pattern Matching & Destructuring**: Extract struct fields directly into local variables with shorthand or renaming syntax.
- **Composition & Mixins (`use`)**: Embed structs via named composition or mixin flattening with automatic method forwarding.
- **Method Syntax & `impl` Blocks**: Associate behaviors, read-only methods (`const self`), mutating methods (`self`), and constructors (`Struct::new()`) directly with your types.

---

## Chapter Roadmap

This chapter is divided into four sections:

1. **[Defining and Instantiating Structs](ch05-01-defining-structs.md)**: How to define struct types, instantiate them with struct literals, access and update fields, and destructure fields into variables.
2. **[An Example Program Using Structs](ch05-02-example-structs.md)**: A hands-on geometric calculation program (`Rectangles`) demonstrating structs in practice.
3. **[Method Syntax and impl Blocks](ch05-03-method-syntax.md)**: Attaching methods to structs using `impl` blocks, read-only vs mutating receivers, self shorthand (`.field`), and associated constructors.
4. **[Composition with use](ch05-04-composition.md)**: Struct mixin flattening, named composition, and automatic method forwarding.

> [!NOTE]
> Hardware-level memory control (bitfields, `@packed`, and `@align(N)`) is covered in [Chapter 16: Advanced Memory Management](ch16-00-advanced-memory-management.md). Operator overloading on structs is covered in [Chapter 10](ch10-00-generics-and-traits.md).

Let's begin by defining our first struct!
