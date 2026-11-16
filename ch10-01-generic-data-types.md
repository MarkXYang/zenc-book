# Generic Data Types

We use **generics** to create definitions for items like function signatures, structs, and enums, which we can then use with many different concrete data types. Rather than writing separate implementations for `int`, `f64`, and custom structs, we parameterize our definitions with placeholder types like `<T>`.

In fact, we have already used generic types in previous chapters:
- Chapter 6 introduced `Option<T>` and `Result<T>`, which wrap an arbitrary value type `T`.
- Chapter 8 covered `Vec<T>`, `Map<V>`, and `Set<T>`, which store collections of any element type.
- Chapter 9 used `Result<T>` to propagate recoverable errors across functions.

In this section, you will learn how to define your own generic functions, structs, enums, and methods, and see how `zc` compiles them into specialized C11 code with zero runtime overhead.

---

## 1. Removing Duplication with Generic Functions

Suppose we need a function that returns the larger of two values, or swaps two values in memory. Without generics, we would have to write separate functions for every type:

```zenc
fn max_int(a: int, b: int) -> int {
    return a > b ? a : b;
}

fn max_f64(a: f64, b: f64) -> f64 {
    return a > b ? a : b;
}
```

Both functions have the exact same body; only the parameter and return types differ.

### Defining a Generic Function

To parameterize a function over a type, place the type parameter name inside angle brackets (`<T>`) immediately after the function name:

**Listing 10-1**
```zenc
fn max_val<T>(a: T, b: T) -> T {
    if a > b {
        return a;
    }
    return b;
}

fn swap_vals<T>(a: T*, b: T*) {
    let temp = *a;
    *a = *b;
    *b = temp;
}

fn main() {
    // 1. Type arguments inferred automatically from arguments:
    let m1 = max_val(10, 25);
    let m2 = max_val(3.14, 2.71);
    println "max int: {m1}, max f64: {m2}";

    // 2. Explicit type arguments can also be provided:
    let m3 = max_val<i64>(1000, 5000);
    println "max i64: {m3}";

    // 3. Generic pointer manipulation:
    let x = 100;
    let y = 200;
    swap_vals(&x, &y);
    println "after swap: x = {x}, y = {y}";
}
```

Output:
```text
max int: 25, max f64: 3.140000
max i64: 5000
after swap: x = 200, y = 100
```

We read `fn max_val<T>(a: T, b: T) -> T` as: *"The function `max_val` is generic over some type `T`. It takes two parameters `a` and `b` of that same type `T`, and returns a value of type `T`."*

> [!TIP]
> **Type Argument Inference vs. Explicit `<T>`**:
> When the type parameter `T` appears in the function's parameters (as in `max_val(10, 25)` or `swap_vals(&x, &y)`), Zen C infers `T` automatically from the call-site arguments. When a generic function takes no arguments—such as the standard library allocator `alloc<T>()` in `std/mem.zc`—you specify the type argument explicitly in angle brackets: `let ptr = alloc<int>();`.

---

## 2. In Struct Definitions

We can also define structs to use a generic type parameter in one or more fields using the `<T>` syntax after the struct name.

### Single Type Parameter

Here is a generic `Pair<T>` struct that holds two values of the same type `T`:

```zenc
struct Pair<T> {
    first: T;
    second: T;
}
```

Because `first` and `second` both have type `T`, instantiating `Pair<int>` requires both fields to be `int`, while `Pair<f64>` requires both fields to be `f64`.

### Multiple Type Parameters

If you want fields to hold different generic types, you can declare multiple comma-separated type parameters, such as `<K, V>`:

**Listing 10-2**
```zenc
struct Pair<T> {
    first: T;
    second: T;
}

struct KeyValue<K, V> {
    key: K;
    val: V;
}

fn main() {
    let coords = Pair<int> { first: 10, second: 20 };
    let weights = Pair<f64> { first: 1.5, second: 9.8 };

    let setting = KeyValue<string, int> {
        key: "max_connections",
        val: 512,
    };

    println "Coords: ({coords.first}, {coords.second})";
    println "Weights: ({weights.first}, {weights.second})";
    println "Setting: {setting.key} = {setting.val}";
}
```

Output:
```text
Coords: (10, 20)
Weights: (1.500000, 9.800000)
Setting: max_connections = 512
```

You can use up to 8 generic type parameters in a definition, though in practice using more than two or three often indicates that a struct could be factored into smaller, more focused types.

---

## 3. In Enum Definitions

As we saw with `Option<T>` and `Result<T>`, enums can also take generic type parameters to hold payloads of any type:

**Listing 10-3**
```zenc
enum Maybe<T> {
    Just(T),
    Nothing,
}

fn main() {
    let a = Maybe<int>::Just(42);
    let b = Maybe<int>::Nothing();

    match a {
        Maybe::Just(v) => { println "a contains Just({v})"; },
        Maybe::Nothing => { println "a is Nothing"; },
    }

    match b {
        Maybe::Just(v) => { println "b contains Just({v})"; },
        Maybe::Nothing => { println "b is Nothing"; },
    }
}
```

Output:
```text
a contains Just(42)
b is Nothing
```

When `Maybe<int>` is instantiated, the compiler generates a specialized tagged union whose `Just` payload is an `int32_t`.

---

## 4. In Method Definitions (`impl` Blocks)

You can implement methods on generic structs and enums by specifying the type parameter in the `impl` header. Zen C supports both `impl Pair<T>` and `impl<T> Pair<T>` syntax:

**Listing 10-4**
```zenc
struct Pair<T> {
    first: T;
    second: T;
}

impl Pair<T> {
    fn new(first: T, second: T) -> Pair<T> {
        return Pair<T> { first: first, second: second };
    }

    fn max_element(const self) -> T {
        if self.first > self.second {
            return self.first;
        }
        return self.second;
    }

    fn swap(self) {
        let tmp = self.first;
        self.first = self.second;
        self.second = tmp;
    }
}

fn main() {
    let p = Pair<int>::new(15, 42);
    println "Initial: ({p.first}, {p.second}), max = {p.max_element()}";

    p.swap();
    println "After swap: ({p.first}, {p.second})";
}
```

Output:
```text
Initial: (15, 42), max = 42
After swap: (42, 15)
```

### Generic Methods Inside Non-Generic Structs

A regular (non-generic) struct can also define individual methods that are generic over their own type parameter `<T>`. For example, a memory arena or serializer struct might be non-generic itself, but provide a generic `alloc<T>(self) -> T*` method:

```zenc
struct LinearBuffer {
    used: usize;
}

impl LinearBuffer {
    fn record_size<T>(self) -> usize {
        let sz = sizeof(T);
        self.used += sz;
        return sz;
    }
}
```

---

## 5. Performance of Code Using Generics: Monomorphization

You might wonder whether using `<T>` generic parameters incurs any runtime cost compared to writing concrete types by hand.

The good news is: **Zen C generics have zero runtime overhead.**

Zen C achieves this by performing **monomorphization** at compile time. *Monomorphization* is the process of turning generic templates into specialized, concrete C11 definitions by filling in the actual types used at each call site.

> [!TIP]
> ### 🔍 Peek at the C: How Monomorphization Works Under the Hood
> When you compile **Listing 10-1** and **Listing 10-4** with `zc transpile`, the generic `Pair<T>` and `max_val<T>` templates disappear completely. In their place, `zc` emits specialized C11 structs and functions mangled with their concrete type names:
>
> ```c
> // Specialized struct generated for Pair<int>:
> struct Pair__int32_t {
>     int32_t first;
>     int32_t second;
> };
>
> // Specialized functions generated for max_val<int> and max_val<f64>:
> ZC_FUNC int32_t max_val__int32_t(int32_t a, int32_t b) {
>     if ((a > b)) {
>         return a;
>     }
>     return b;
> }
>
> ZC_FUNC double max_val__double(double a, double b) {
>     if ((a > b)) {
>         return a;
>     }
>     return b;
> }
>
> // Specialized methods generated for Pair<int>:
> ZC_FUNC Pair__int32_t Pair__int32_t__new(int32_t first, int32_t second) {
>     return (struct Pair__int32_t){.first = first, .second = second};
> }
> ```
>
> And in `main()`, every generic call is wired directly to its specialized C function:
>
> ```c
> int32_t m1 = max_val__int32_t(10, 25);
> double m2 = max_val__double(3.14, 2.71);
> Pair__int32_t p = Pair__int32_t__new(15, 42);
> ```
>
> There are no `void*` casts, no boxing on the heap, and no indirect function pointers. The C compiler (`gcc` or `clang`) sees ordinary, strongly-typed C functions and can inline and vectorize them at `-O2`/`-O3` just as if you had written every specialization by hand!

---

## Summary

- **Generic Functions (`fn name<T>`)**: Eliminate code duplication across types while preserving full compile-time type safety.
- **Generic Structs & Enums (`struct Name<T>`, `enum Name<T>`)**: Allow data containers like `Pair<T>`, `KeyValue<K, V>`, `Option<T>`, and `Vec<T>` to hold arbitrary types directly in-line without `void*` indirection.
- **Generic `impl` Blocks (`impl Name<T>`)**: Attach methods and associated constructors to generic types.
- **Zero-Cost Monomorphization**: The `zc` compiler stamps out concrete C11 types and functions for each unique instantiation at compile time.

Next, let's explore how to define shared behavior across different types using **Traits**!
