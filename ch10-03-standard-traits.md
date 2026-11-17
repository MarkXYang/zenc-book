# Standard Traits and Smart Derives

Beyond user-defined traits, Zen C includes a set of **standard traits** and **compiler conventions** that hook directly into the language's syntax and memory model—powering automatic scope cleanup (RAII), move vs. copy semantics, `for .. in` loop iteration, string interpolation, and equality comparisons.

Furthermore, to spare you from writing repetitive boilerplate for common operations, Zen C provides the **`@derive(...)`** attribute, which automatically generates trait and method implementations at compile time.

---

## 1. Core Resource & Value Traits (`Drop`, `Copy`, `Clone`)

Defined in `std/mem.zc` (and automatically imported by the compiler whenever you implement them), three core traits govern how Zen C manages the lifecycle and assignment of your types:

```zenc
trait Drop {
    fn drop(self);
}

trait Copy {}

trait Clone {
    fn clone(self) -> Self;
}
```

### 1. `Drop` — Deterministic Scope Destructors (RAII)

`Drop` is the trait-level hook for deterministic cleanup. A type that implements `Drop` (or contains fields that do) is treated as a resource-owning type and follows move-by-default semantics to prevent double-destruction.

We covered destructor behavior and `.forget()` in detail in [Chapter 4](ch04-04-cleanup.md), and early-return cleanup behavior in [Chapter 9](ch09-03-defer-cleanup.md).

### 2. `Copy` — Opt-In Value Duplication

Marker traits have no methods (`trait Copy {}`). Implementing `Copy` tells the compiler that a type is a plain stack value (like a 2D coordinate or RGB color) that does not own heap resources and can be safely duplicated via a bitwise copy on assignment (`let b = a;`) without invalidating the original variable:

```zenc
struct Vec2 {
    x: f64;
    y: f64;
}

impl Copy for Vec2 {}
```

### 3. `Clone` — Explicit Deep Copies

For resource-owning types where implicit copying would be expensive or unsafe (such as `Vec<T>` or `String`), implementing `Clone` provides the conventional `.clone()` method to create an explicit, independent copy:

```zenc
impl Clone for Vec2 {
    fn clone(self) -> Vec2 {
        return Vec2 { x: self.x, y: self.y };
    }
}
```

---

## 2. The Iteration Protocol (`Iterator<T>` and `Iterable<T>`)

In Zen C, any custom struct can be used directly inside a `for item in collection` loop!

Defined in `std/iter.zc`, the iteration protocol consists of two traits:

```zenc
import "std/option.zc"

trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait Iterable<T> {
    fn iterator(self) -> Iterator<T>;
}
```

When the compiler encounters `for item in expr`, it looks for:
1. An `.iterator(self)` method on `expr` that returns an iterator state struct.
2. A `.next(self) -> Option<T>` method on that iterator struct, which returns `Option<T>::Some(val)` for each element and `Option<T>::None()` when iteration is complete.

Let's build a custom `Countdown` iterator that works natively with Zen C's `for .. in` loop:

**Listing 10-8**
```zenc
import "std/option.zc"

struct Countdown {
    current: int;
}

impl Countdown {
    fn new(start: int) -> Countdown {
        return Countdown { current: start };
    }

    // Yields the next countdown value, or None when finished:
    fn next(self) -> Option<int> {
        if self.current > 0 {
            let val = self.current;
            self.current -= 1;
            return Option<int>::Some(val);
        }
        return Option<int>::None();
    }

    // Returns the iterator for `for .. in` loops:
    fn iterator(self) -> Countdown {
        return self;
    }
}

fn main() {
    println "Initiating launch sequence:";

    let timer = Countdown::new(3);
    for n in timer {
        println "  T-minus {n}...";
    }

    println "Liftoff!";
}
```

Output:
```text
Initiating launch sequence:
  T-minus 3...
  T-minus 2...
  T-minus 1...
Liftoff!
```

> [!TIP]
> ### 🔍 Peek at the C: How `for .. in` Desugars Under the Hood
> When you transpile **Listing 10-8** with `zc transpile`, the `for n in timer` loop compiles into a tight, zero-allocation C `for` loop calling `Countdown__iterator` and `Countdown__next`:
>
> ```c
> Countdown __it = Countdown__iterator(&timer);
> for (; 1; ) {
>     Option__int32_t __opt = Countdown__next(&__it);
>     if (Option__int32_t__is_none(&__opt)) {
>         break;
>     }
>     int32_t n = Option__int32_t__unwrap(&__opt);
>     {
>         fprintf(stdout, "  T-minus %d...\n", n);
>     }
> }
> ```
>
> Because `Option__int32_t` is a stack value struct (`{ bool is_some; int32_t val; }`), the C optimizer inlines the entire loop into a simple register decrement!

---

## 3. Custom String Formatting (`to_string`)

Zen C's string interpolation (`println "Value: {x}"`) works out of the box for all primitive types. What if you want to interpolate your own custom structs directly inside `{...}`?

Simply implement `fn to_string(self) -> char*` on your struct! Whenever the compiler sees a struct instance inside a string interpolation expression, it automatically calls `.to_string()`:

**Listing 10-9**
```zenc
struct Color {
    r: int;
    g: int;
    b: int;
}

impl Color {
    fn to_string(self) -> char* {
        let s = "rgb({self.r}, {self.g}, {self.b})";
        return s;
    }
}

fn main() {
    let primary = Color { r: 255, g: 128, b: 0 };
    println "Selected theme color: {primary}";
}
```

Output:
```text
Selected theme color: rgb(255, 128, 0)
```

---

## 4. Derive Recap (`@derive(...)`)

`@derive(...)` removes repetitive trait boilerplate. Typical combinations include `Copy`, `Clone`, `Eq`, and `Debug`:

**Listing 10-10**
```zenc
@derive(Copy, Clone, Eq, Debug)
struct Point {
    x: int;
    y: int;
}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = p1;
    let p3 = p1.clone();

    println "p1 == p2: {p1 == p2}";
    println "p1 == p3: {p1 == p3}";
    println "Debug output: {p1}";
}
```

For the full derive catalog (`ToJson`, `FromJson`, and attribute interactions such as `@packed`, `@align`, `@inline`, and `@constructor`), see [Chapter 19.2](ch19-02-attributes-derives.md).

---

## Summary

- **`Drop`, `Copy`, and `Clone`**: Govern deterministic RAII destruction, implicit bitwise copying, and explicit deep cloning.
- **`Iterator<T>` and `Iterable<T>`**: Enable custom structs to work seamlessly inside `for item in collection` loops.
- **`to_string(self) -> char*`**: Hooks custom structs directly into Zen C's `{expr}` string interpolation.
- **`@derive(...)`**: Eliminates repetitive trait boilerplate; Chapter 19.2 covers the full derive and attribute toolbox.

Next, let's see how to make custom types even more expressive with **Operator Overloading**!
