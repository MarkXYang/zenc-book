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

As we learned in [Chapter 4](ch04-04-cleanup.md), implementing `Drop` for a struct registers a destructor that the compiler invokes automatically whenever an owned instance goes out of scope:

```zenc
struct TempFile {
    path: string;
}

impl Drop for TempFile {
    fn drop(self) {
        println "[Drop] Removing temporary file: {self.path}";
    }
}
```

Any struct that implements `Drop` (or contains a field that implements `Drop`) is treated as a **Resource Type** with **move-by-default** semantics so its destructor can never be called twice on the same allocation.

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

**Listing 10-8: `list10-8.zc`**

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

**Listing 10-9: `list10-9.zc`**

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

## 4. Smart Derives with `@derive(...)`

Writing manual `Copy`, `Clone`, `eq`, `to_string`, and JSON serialization implementations for every data struct can be tedious. Zen C provides the **`@derive(...)`** attribute to generate these implementations automatically at compile time.

### Supported Built-In Derives

| Derive Attribute | Generated Implementation | Description |
| :--- | :--- | :--- |
| **`@derive(Copy)`** | `impl Copy for T {}` | Marks the type as implicitly copyable by value (disables move invalidation). |
| **`@derive(Clone)`** | `fn clone(self) -> T` | Generates a `.clone()` method returning a copy of the struct. |
| **`@derive(Eq)`** | `fn eq(self, other: T*) -> bool` | Generates field-by-field structural equality, enabling `a == b` and `a != b`. |
| **`@derive(Debug)`** | `fn to_string(self) -> char*` | Generates a default `to_string` formatter for string interpolation `"{val}"`. |
| **`@derive(ToJson)`** | `fn to_json(self) -> JsonValue` | Automatically serializes struct fields into a `std/json.zc` `JsonValue` object. |
| **`@derive(FromJson)`** | `fn from_json(j: JsonValue*) -> Result<T>` | Automatically deserializes a `JsonValue*` into `Result<T>`. |

### Combining `@derive(Copy, Clone, Eq, Debug)`

You can combine multiple derive traits in a single `@derive(...)` attribute above a `struct` or `enum`:

**Listing 10-10: `list10-10.zc`**

```zenc
@derive(Copy, Clone, Eq, Debug)
struct Point {
    x: int;
    y: int;
}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = p1;         // Implicit copy via @derive(Copy)
    let p3 = p1.clone(); // Explicit clone via @derive(Clone)
    let p4 = Point { x: 99, y: 99 };

    // Structural equality via @derive(Eq):
    println "p1 == p2: {p1 == p2}";
    println "p1 == p3: {p1 == p3}";
    println "p1 == p4: {p1 == p4}";

    // String formatting via @derive(Debug):
    println "Debug output: {p1}";
}
```

Output:
```text
p1 == p2: true
p1 == p3: true
p1 == p4: false
Debug output: Point { ... }
```

### Automatic JSON Serialization with `@derive(ToJson, FromJson)`

When building web services, CLI tools, or configuration loaders with `std/json.zc`, `@derive(ToJson, FromJson)` eliminates manual JSON field mapping:

**Listing 10-11: `list10-11.zc`**

```zenc
import "std/json.zc"

@derive(ToJson, FromJson)
struct ServerConfig {
    host: char*;
    port: int;
    tls: bool;
}

fn main() {
    let cfg = ServerConfig {
        host: "127.0.0.1",
        port: 8080,
        tls: true,
    };

    // Serialize struct -> JSON string:
    let json_val = cfg.to_json();
    let json_str = json_val.to_string();
    println "Serialized JSON: {json_str}";

    // Deserialize JSON string -> struct:
    let parsed = JsonValue::parse(json_str).unwrap();
    let restored = ServerConfig::from_json(parsed).unwrap();
    println "Restored: host={restored.host}, port={restored.port}, tls={restored.tls}";
}
```

Output:
```text
Serialized JSON: {"tls":true,"port":8080,"host":"127.0.0.1"}
Restored: host=127.0.0.1, port=8080, tls=true
```

---

## Summary

- **`Drop`, `Copy`, and `Clone`**: Govern deterministic RAII destruction, implicit bitwise copying, and explicit deep cloning.
- **`Iterator<T>` and `Iterable<T>`**: Enable custom structs to work seamlessly inside `for item in collection` loops.
- **`to_string(self) -> char*`**: Hooks custom structs directly into Zen C's `{expr}` string interpolation.
- **`@derive(...)`**: Automatically generates `Copy`, `Clone`, `Eq`, `Debug`, `ToJson`, and `FromJson` implementations at compile time.

Next, let's see how to make custom types even more expressive with **Operator Overloading**!
