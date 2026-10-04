# Method Syntax and impl Blocks

*Methods* are similar to functions: they are declared with the `fn` keyword, accept parameters, return values, and contain code that runs when called. However, methods differ from regular functions in two key ways:

1. They are defined within the context of a struct using an **`impl` block**.
2. Their first parameter is always **`self`** (or **`const self`**), which represents the instance of the struct the method is being invoked upon.

---

## Defining Methods in an `impl` Block

Let's start with a `Rectangle` struct and define an `area` method to calculate its surface area:

**Listing 5-9: `list5-9.zc`**

```zenc
 1 | struct Rectangle {
 2 |     width: int;
 3 |     height: int;
 4 | }
 5 |
 6 | // Attach methods to Rectangle inside an impl block
 7 | impl Rectangle {
 8 |     fn area(const self) -> int {
 9 |         return self.width * self.height;
10 |     }
11 | }
12 |
13 | fn main() {
14 |     let rect = Rectangle { width: 30, height: 50 };
15 |
16 |     // Call the method using dot notation:
17 |     println "The area of the rectangle is {rect.area()} square pixels.";
18 | }
```

Output:
```text
The area of the rectangle is 1500 square pixels.
```

To call a method, write the instance name, followed by a dot (`.`), the method name, and parentheses `()` with any arguments.

---

## The Receiver Parameter: `const self` vs. `self`

The first parameter in a method signature defines how the method interacts with the instance:

| Parameter | Type Under the Hood | Mutability | When to Use |
| :--- | :--- | :--- | :--- |
| **`const self`** | `const Rectangle* self` | **Read-only** | Inspection, queries, calculations that do not alter state |
| **`self`** | `Rectangle* self` | **Mutable** | Modifying fields or state on the struct instance |

### 1. Read-Only Methods (`const self`)

When a method only reads data without modifying fields, declare the receiver as `const self`:

```zenc
impl Rectangle {
    fn perimeter(const self) -> int {
        return 2 * (self.width + self.height);
    }

    fn can_hold(const self, other: Rectangle) -> bool {
        return self.width > other.width && self.height > other.height;
    }
}
```

The compiler guarantees that code inside a `const self` method cannot accidentally assign to `self.width` or `self.height`.

### 2. Mutating Methods (`self`)

When a method needs to modify struct fields, use `self`:

**Listing 5-10: `list5-10.zc`**

```zenc
 1 | struct Rectangle {
 2 |     width: int;
 3 |     height: int;
 4 | }
 5 |
 6 | impl Rectangle {
 7 |     fn scale(self, factor: int) {
 8 |         self.width = self.width * factor;
 9 |         self.height = self.height * factor;
10 |     }
11 |
12 |     fn translate(self, dw: int, dh: int) {
13 |         self.width = self.width + dw;
14 |         self.height = self.height + dh;
15 |     }
16 | }
17 |
18 | fn main() {
19 |     let rect = Rectangle { width: 10, height: 20 };
20 |     rect.scale(2);
21 |
22 |     println "Scaled: {rect.width}x{rect.height}";
23 | }
```

Output:
```text
Scaled: 20x40
```

### Automatic Referencing and Dereferencing

In C or C++, calling a method via a pointer requires arrow syntax (`ptr->area()`), while calling on a stack object requires dot syntax (`rect.area()`), and you must manually decide when to pass `&rect` or `rect`.

Zen C eliminates this friction with **automatic referencing and dereferencing**:

```zenc
let rect = Rectangle { width: 10, height: 20 };
let rect_ptr = &rect;

// Calling on a value (compiler automatically borrows &rect):
let a1 = rect.area();

// Calling on a pointer (compiler passes the pointer directly):
let a2 = rect_ptr.area();
```

Both invocations compile to clean, optimal C pointer function calls.

---

## Self Shorthand (`.field`)

In methods with a `self` or `const self` receiver parameter, Zen C allows you to use **`.field`** as an ultra-ergonomic shorthand for `self.field`:

```zenc
struct Point {
    x: int;
    y: int;
}

impl Point {
    // Using .x and .y directly inside methods:
    fn dist_squared(const self) -> int {
        return .x * .x + .y * .y; // Equivalent to self.x * self.x + self.y * self.y
    }

    fn translate(self, dx: int, dy: int) {
        .x += dx; // Equivalent to self.x += dx
        .y += dy; // Equivalent to self.y += dy
    }
}
```

This shorthand eliminates repetitive boilerplate code in mathematical formulas, physics engines, and graphics programming, while keeping field access clear and unambiguous due to the leading dot (`.`).

---

## Associated Functions (Static Methods)

All functions defined inside an `impl` block are called **associated functions** because they are associated with the type.

When an associated function **does not** take `self` as its first parameter, it is an **associated function / static method**. These functions do not operate on a specific instance; instead, they are commonly used as **constructors** that return a new instance of the struct:

```zenc
impl Rectangle {
    // Static method (constructor convention using -> Self)
    fn new(width: int, height: int) -> Self {
        return Rectangle {
            width: width,
            height: height,
        };
    }

    // Specialized constructor: creates a square
    fn square(size: int) -> Self {
        return Rectangle::new(size, size);
    }
}
```

> [!NOTE]
> **The `Self` Type**: Inside an `impl` block, `Self` is a built-in alias representing the implementing type (in this case, `Rectangle`). Returning `-> Self` is the standard Zen C convention for constructors and factory methods.

### Calling Associated Functions (`::`)

To call an associated function that doesn't take `self`, use the double colon (`::`) namespace operator on the struct name:

**Listing 5-11: `list5-11.zc`**

```zenc
 1 | struct Rectangle {
 2 |     width: int;
 3 |     height: int;
 4 | }
 5 |
 6 | impl Rectangle {
 7 |     // Static method (constructor convention using -> Self)
 8 |     fn new(width: int, height: int) -> Self {
 9 |         return Rectangle {
10 |             width: width,
11 |             height: height,
12 |         };
13 |     }
14 |
15 |     // Specialized constructor: creates a square
16 |     fn square(size: int) -> Self {
17 |         return Rectangle::new(size, size);
18 |     }
19 | }
20 |
21 | fn main() {
22 |     let r1 = Rectangle::new(30, 50);
23 |     let sq = Rectangle::square(25);
24 |
25 |     println "Rectangle: {r1.width}x{r1.height}";
26 |     println "Square: {sq.width}x{sq.height}";
27 | }
```

Output:
```text
Rectangle: 30x50
Square: 25x25
```

### Compiler Protection Against Misuse

If you mistakenly try to call an associated constructor using the dot operator on an instance, the Zen C compiler catches the mistake with an actionable error:

```zenc
let r = Rectangle::new(10, 20);
r.new(30, 40); // Error!
```

**Compiler Diagnostic:**
```text
error: Cannot call static method 'new' with dot operator
   = help: Use 'Rectangle::new(...)' instead of instance.new(...)
```

---

## Multiple `impl` Blocks

Each struct is allowed to have multiple `impl` blocks. This allows you to organize methods logically across your codebase:

```zenc
struct Point {
    x: int;
    y: int;
}

// Block 1: Constructors and core geometry
impl Point {
    fn new(x: int, y: int) -> Point {
        return Point { x: x, y: y };
    }

    fn distance_squared(const self) -> int {
        return self.x * self.x + self.y * self.y;
    }
}

// Block 2: Transformations and operations
impl Point {
    fn translate(self, dx: int, dy: int) {
        self.x = self.x + dx;
        self.y = self.y + dy;
    }
}
```

There is no functional difference between combining all methods in one `impl` block or splitting them across multiple blocks. Multiple blocks are especially useful when grouping related methods together or separating basic constructors from advanced algorithms.

---

## Methods on Primitive Types

Zen C allows you to define methods on primitive scalar types (like `int`, `bool`, etc.) using the exact same `impl` syntax.

Because primitive values are passed by pointer to methods (`int* self`), dereferencing `*self` retrieves the underlying scalar value:

**Listing 5-15: `list5-15.zc`**

```zenc
 1 | impl int {
 2 |     fn abs(self) -> int {
 3 |         return *self < 0 ? -(*self) : *self;
 4 |     }
 5 |
 6 |     fn square(self) -> int {
 7 |         return (*self) * (*self);
 8 |     }
 9 | }
10 |
11 | fn main() {
12 |     let x = -10;
13 |     let y = x.abs(); // 10
14 |
15 |     // Calling methods on numeric literals directly (wrap in parentheses):
16 |     let z = (-5).abs(); // 5
17 |     let sq = (8).square(); // 64
18 |
19 |     println "abs(-10) = {y}, abs(-5) = {z}, 8^2 = {sq}";
20 | }
```

Output:
```text
abs(-10) = 10, abs(-5) = 5, 8^2 = 64
```

---

## Bridging to Traits: Standard Traits

Method syntax and `impl` blocks form the foundation of Zen C's **Trait System** (explored in depth in [Chapter 10](ch10-00-generics-and-traits.md)). Zen C includes several standard traits that integrate directly with core language syntax:

- **`Drop`**: Defines a destructor (`fn drop(self)`) that runs automatically when a resource-owning struct goes out of scope (RAII).
- **`Copy`**: Marker trait applied via `@derive(Copy)` to opt-in to implicit duplication instead of move semantics for plain data structs.
- **`Clone`**: Defines explicit duplication (`fn clone(self) -> Self`) for resource-owning types.
- **`Iterable<T>`**: Implementing an iterator with `fn next(self) -> Option<T>` enables `for-in` loop iteration directly over custom types.

---

---

## Summary

In this section, you learned:
- How to define methods inside `impl` blocks for custom struct types.
- How to choose between read-only receivers (`const self`) and mutating receivers (`self`).
- How to use the `.field` self shorthand for concise code.
- How to create associated constructor functions (`Rectangle::square(size)`) and use the `Self` return type.
- How to attach methods to primitive types (such as `impl int`).

Next, let's explore Struct Composition with `use`!
