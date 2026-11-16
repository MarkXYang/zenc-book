# Polymorphism: Composition and Trait Objects

**Polymorphism**—the ability to write code that operates on values of multiple different types through a shared interface—is one of the foundational ideas in software architecture.

Traditional object-oriented languages (such as C++, Java, and C#) tie polymorphism directly to **class inheritance**: to share code or satisfy an interface, a child class must inherit from a base class (`class Button extends Widget`), embedding a hidden virtual table pointer (`vptr`) inside every object instance and coupling subtype behavior to a rigid class hierarchy.

Zen C separates code reuse, compile-time specialization, and runtime dynamic dispatch into four orthogonal, zero-surprise mechanisms:

| Mechanism | How It Works | Runtime Overhead | Best Suited For |
| :--- | :--- | :--- | :--- |
| **Struct Composition (`use` Mixins)** | Embeds fields and forwards methods (`use Base;` or `use comp: Part;`) | **Zero** (direct C function calls on flat struct fields) | Sharing state and methods across concrete entity types without class hierarchies ([Section 18.1](ch18-01-oop-characteristics.md)). |
| **Static Generics (`<T>`)** | Monomorphizes a specialized C function per concrete type `T` | **Zero** (inlined direct calls) | Performance-critical algorithms and containers (`Vec<T>`, `Map<V>`) where types are known at compile time ([Chapter 10](ch10-01-generic-data-types.md)). |
| **Tagged Enums (`enum` + `match`)** | Stores a closed set of variants in a single tagged union | **1 integer tag branch** (no heap or pointer indirection) | Closed-world sum types where all possible variants are known up front ([Chapter 6](ch06-00-enums.md)). |
| **Trait Objects (`Trait`)** | Packages `{ void* self, Trait_VTable* vtable }` into a 16-byte fat pointer | **1 function-pointer call** (`vtable->method(self)`) | Open-world heterogeneous collections (`Vec<Widget>`), plugin systems, and runtime state machines ([Sections 18.2–18.4](ch18-02-trait-objects.md)). |

## What You Will Learn in This Chapter

1. **[18.1 Object-Oriented Characteristics of Zen C](ch18-01-oop-characteristics.md)**: How Zen C addresses the classic pillars of OOP—packaging data with methods (`impl`), enforcing invariants with `opaque struct`, and replacing fragile base-class inheritance with primary `use` mixins and named component composition.
2. **[18.2 Trait Objects for Dynamic Dispatch](ch18-02-trait-objects.md)**: How to store heterogeneous structs (`Button`, `ProgressBar`, `StatusLabel`) inside a single `Vec<Widget>` of trait objects, mutate state dynamically through trait methods, and render open-ended component trees.
3. **[18.3 Vtables Under the Hood in C11](ch18-03-vtables-in-c.md)**: How `zc transpile` generates C11 `Trait_VTable` structs and 16-byte `{ self, vtable }` fat pointers, why concrete structs pay **zero per-instance `vptr` memory overhead**, and how to inspect the raw pointers of a trait object at runtime.
4. **[18.4 Implementing an Object-Oriented Design Pattern](ch18-04-oop-patterns.md)**: Implementing the classic Gang of Four **State Pattern** (`DraftState` $\rightarrow$ `PendingReviewState` $\rightarrow$ `PublishedState`) using trait objects, and comparing it against enum-based state machines.
