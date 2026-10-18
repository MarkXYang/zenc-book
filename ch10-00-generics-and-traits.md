# Generics, Traits & Operator Overloading

Every programming language needs tools to handle duplication of concepts cleanly. In traditional C, writing a data structure or algorithm that works across multiple types—such as a dynamic array, a sorting routine, or a hash table—forces developers into an uncomfortable choice:

1. **Copy-pasting functions (`max_int`, `max_float`, `max_double`)**: Bloating the codebase with repetitive boilerplate that is tedious to maintain.
2. **Untyped `void*` pointers and `sizeof` arithmetic**: Sacrificing compile-time type safety, forcing heap indirection, and inviting subtle memory corruption bugs.
3. **Preprocessor `##` token-pasting macros**: Producing cryptic compiler error messages that are nearly impossible to step through in a debugger.

Modern systems languages solve this problem with **generics** and **traits**, and Zen C brings these high-level abstractions directly to C11 with **zero runtime cost**.

---

## The Zen C Philosophy: Zero-Cost Polymorphism

Zen C provides three complementary mechanisms for writing reusable, expressive code:

1. **Generics (`<T>`) — Compile-Time Monomorphization**:
   Generic functions (`fn swap<T>`), structs (`struct Pair<T>`), and enums (`enum Option<T>`) let you write logic once using abstract type parameters. At compile time, the `zc` compiler specializes each generic template into concrete, type-safe C11 functions and structs (such as `Pair__int32_t` and `Pair__double`)—matching the exact assembly performance of hand-written C.

2. **Traits (`trait` & `impl Trait for Type`) — Shared Behavior & Polymorphism**:
   Traits define shared interfaces that multiple types can implement. Zen C supports both **static dispatch** (calling methods directly on concrete types with zero overhead) and **dynamic dispatch** (passing trait objects with automatic virtual method tables when runtime polymorphism is needed), as well as compiler-generated **smart derives** (`@derive(Copy, Clone, Eq, Debug)`).

3. **Operator Overloading — Expressive Domain Syntax**:
   By implementing standard method names (`add`, `sub`, `eq`, `lt`, `get`, `set`) inside an `impl` block, your custom mathematical, collection, and systems types can use natural operators (`v1 + v2`, `a == b`, `matrix[r, c] = val`) that desugar directly into ordinary C function calls.

---

## Chapter Roadmap

In this chapter, you will master:

1. **[Generic Data Types](ch10-01-generic-data-types.md)**: Extracting generic functions, defining generic structs and enums, implementing generic methods, and inspecting how monomorphization works in generated C11.
2. **[Traits: Defining Shared Behavior](ch10-02-traits.md)**: Declaring `trait` interfaces, implementing traits for custom types, writing functions that accept trait parameters, and comparing structural generics with trait polymorphism.
3. **[Standard Traits and Smart Derives](ch10-03-standard-traits.md)**: Mastering Zen C's built-in language traits (`Drop`, `Copy`, `Clone`, `Iterator<T>` / `Iterable<T>`, `to_string`) and eliminating boilerplate with `@derive(Copy, Clone, Eq, Debug, ToJson, FromJson)`.
4. **[Operator Overloading](ch10-04-operator-overloading.md)**: Overloading arithmetic, comparison, unary, bitwise, compound assignment, and multi-dimensional indexing operators (`[i, j]`).

Let's begin by eliminating code duplication with **Generic Data Types**!
