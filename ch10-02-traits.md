# Traits: Defining Shared Behavior

A **trait** tells the Zen C compiler about functionality a particular type has and can share with other types. Traits allow us to define shared behavior in an abstract way: they act like interfaces in Go or Java, or traits in Rust, specifying a set of method signatures that implementing types must provide.

---

## 1. Defining a Trait

A type's behavior consists of the methods we can call on that type. Different types share the same behavior if we can call the same methods on all of those types.

To declare a trait, use the `trait` keyword followed by the trait's name and a block containing one or more method signatures terminated by semicolons (`;`):

```zenc
trait Summary {
    fn summarize(self) -> string;
}
```

Here, we declare a `Summary` trait with a single method signature: `fn summarize(self) -> string;`. Each type implementing this trait must provide its own custom body for `summarize`.

A trait can specify multiple method signatures inside its body:

```zenc
trait Drawable {
    fn draw(self);
    fn bounding_box(self) -> int;
}
```

### Generic Traits

Traits can also be parameterized with generic type arguments `<T>`:

```zenc
trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait From<T> {
    fn from_val(val: T) -> Self;
}
```

---

## 2. Implementing a Trait on a Type

Once a trait is defined, you implement it for a struct using the syntax:

```zenc
impl <TraitName> for <StructName> {
    // method implementations
}
```

Let's implement the `Summary` trait on two distinct media types: `NewsArticle` and `Tweet`:

**Listing 10-5: `list10-5.zc`**

```zenc
trait Summary {
    fn summarize(self) -> string;
}

struct NewsArticle {
    headline: string;
    location: string;
    author: string;
}

impl Summary for NewsArticle {
    fn summarize(self) -> string {
        return "{self.headline}, by {self.author} ({self.location})";
    }
}

struct Tweet {
    username: string;
    content: string;
}

impl Summary for Tweet {
    fn summarize(self) -> string {
        return "@{self.username}: {self.content}";
    }
}

fn main() {
    let article = NewsArticle {
        headline: "Zen C 0.4 Released",
        location: "San Francisco",
        author: "The Zen C Team",
    };

    let tweet = Tweet {
        username: "zenc_lang",
        content: "Zero-cost abstractions that compile to clean C11!",
    };

    println "New article: {article.summarize()}";
    println "New tweet:   {tweet.summarize()}";
}
```

Output:
```text
New article: Zen C 0.4 Released, by The Zen C Team (San Francisco)
New tweet:   @zenc_lang: Zero-cost abstractions that compile to clean C11!
```

Calling a trait method directly on a concrete instance (`article.summarize()`) resolves statically at compile time to `NewsArticle__Summary__summarize(&article)`.

> [!NOTE]
> **Compiler Guard Against Reversed `impl` Syntax**:
> Developers coming from other languages sometimes accidentally write `impl Struct for Trait` instead of `impl Trait for Struct`. If you swap the order, `zc` catches the mistake immediately with a clear diagnostic:
> ```text
> error: Incorrect usage of impl. Did you mean 'impl Summary for NewsArticle'?
>        Syntax is 'impl <Trait> for <Struct>'
> ```

---

## 3. Traits as Parameters

Traits become especially powerful when you write functions that accept *any* type implementing a given trait, rather than hardcoding a single concrete struct.

In Zen C, you can use a trait name directly as a parameter type (`item: Summary`). When you pass a pointer to any struct that implements `Summary` (such as `&article` or `&tweet`), the compiler automatically packages it into a **trait object**:

**Listing 10-6: `list10-6.zc`**

```zenc
trait Summary {
    fn summarize(self) -> string;
}

struct NewsArticle {
    headline: string;
    author: string;
}

impl Summary for NewsArticle {
    fn summarize(self) -> string {
        return "{self.headline}, by {self.author}";
    }
}

struct Tweet {
    username: string;
    content: string;
}

impl Summary for Tweet {
    fn summarize(self) -> string {
        return "@{self.username}: {self.content}";
    }
}

// Accepts any type that implements the Summary trait!
fn notify(item: Summary) {
    println "Breaking news! {item.summarize()}";
}

fn main() {
    let article = NewsArticle {
        headline: "Penguins Win the Stanley Cup",
        author: "Iceburgh",
    };

    let tweet = Tweet {
        username: "horse_ebooks",
        content: "of course, as you probably already know, people",
    };

    notify(&article);
    notify(&tweet);
}
```

Output:
```text
Breaking news! Penguins Win the Stanley Cup, by Iceburgh
Breaking news! @horse_ebooks: of course, as you probably already know, people
```

> [!TIP]
> ### 🔍 Peek at the C: How Trait Polymorphism Works Under the Hood
> When you define `trait Summary`, the `zc` compiler emits a C11 virtual method table (`Summary_VTable`) and a two-pointer **fat pointer** struct (`Summary`) consisting of a `void *self` data pointer and a `Summary_VTable *vtable` pointer:
>
> ```c
> typedef struct Summary_VTable {
>     string (*summarize)(void* self);
> } Summary_VTable;
>
> typedef struct Summary {
>     void *self;
>     Summary_VTable *vtable;
> } Summary;
> ```
>
> When you implement `impl Summary for NewsArticle`, `zc` generates a static vtable instance:
>
> ```c
> Summary_VTable NewsArticle__Summary__VTable = {
>     .summarize = NewsArticle__Summary__summarize
> };
> ```
>
> And when you call `notify(&article)`, `zc` automatically constructs the `Summary` fat pointer at the call site:
>
> ```c
> notify((Summary){
>     .self = (void*)&article,
>     .vtable = &NewsArticle__Summary__VTable
> });
> ```
>
> We will explore trait objects, heterogeneous collections of trait objects, and vtable internals in depth in **[Chapter 18: Polymorphism: Composition and Trait Objects](ch18-00-polymorphism.md)**.

---

## 4. Implementing Traits for Generic Types

You can also implement traits for generic structs. For example, in the Zen C standard library (`std/mem.zc` and `std/vec.zc`), the `Drop` trait is implemented for the generic `Box<T>` and `Vec<T>` types:

```zenc
struct Box<T> {
    ptr: T*;
}

impl<T> Box<T> {
    fn free(self) {
        if self.ptr != NULL {
            dealloc<T>(self.ptr);
            self.ptr = NULL;
        }
    }
}

impl Drop for Box {
    fn drop(self) {
        self.free();
    }
}
```

Whenever a concrete specialization like `Box<int>` or `Box<f64>` is instantiated, the compiler automatically instantiates the corresponding `Drop` implementation so that it cleans up its memory when leaving scope.

---

## 5. Static Structural Generics vs. Trait Polymorphism

Zen C gives you two distinct ways to write polymorphic functions, each suited to a different systems engineering need:

**Listing 10-7: `list10-7.zc`**

```zenc
struct Circle {
    radius: f64;
}

impl Circle {
    fn area(const self) -> f64 {
        return 3.14159 * self.radius * self.radius;
    }
}

struct Square {
    side: f64;
}

impl Square {
    fn area(const self) -> f64 {
        return self.side * self.side;
    }
}

// Compile-time structural monomorphization:
fn print_area<T>(shape: T*) {
    println "Area = {shape.area()}";
}

fn main() {
    let c = Circle { radius: 2.0 };
    let s = Square { side: 4.0 };

    print_area<Circle>(&c);
    print_area<Square>(&s);
}
```

Output:
```text
Area = 12.566360
Area = 16.000000
```

> [!NOTE]
> ### Coming from Rust or C++: How Generics and Traits Interact
> - **Generic Functions (`fn f<T>(x: T*)`)** in Zen C work like **C++ templates**: they use **compile-time structural monomorphization**. When `print_area<Circle>(&c)` is instantiated, the compiler checks that `Circle` has an inherent `.area()` method and emits a direct call to `Circle__area(shape)` with **zero vtable indirection**.
> - **Trait Parameters (`fn notify(item: Summary)`)** work like **Go interfaces or Rust `&dyn Trait`**: they enforce an explicit `impl Summary for Type` contract and dispatch via a lightweight C11 fat pointer (`{ self, vtable }`), allowing a single compiled function to accept different types at runtime without duplicating machine code.

| Feature | Generic Function (`fn f<T>(x: T*)`) | Trait Parameter (`fn f(x: Trait)`) |
| :--- | :--- | :--- |
| **Dispatch Mechanism** | **Static** (compile-time monomorphization) | **Dynamic** (runtime vtable lookup) |
| **Call Overhead** | **Zero** (direct C function call, inlineable) | **1 pointer indirection** (`vtable->method`) |
| **Code Size** | Generates one C function per concrete type `T` | Single C function shared by all types |
| **Method Resolution** | Resolves inherent `impl Type` methods & operators | Resolves `impl Trait for Type` methods |

---

## Summary

- **`trait` Declarations**: Define shared method signatures that types can implement.
- **`impl Trait for Struct`**: Connects a concrete struct to a trait contract.
- **Trait Parameters (`item: Trait`)**: Enable clean runtime polymorphism by automatically wrapping struct pointers into `{ self, vtable }` fat pointers.
- **Static vs. Dynamic Choice**: Use `<T>` generics for zero-overhead compile-time specialization, and `Trait` parameters when you want interface contracts and shared runtime code.

Next, let's examine the built-in **Standard Traits and Smart Derives** that integrate directly with Zen C's compiler and syntax!
