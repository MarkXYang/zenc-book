# Method Syntax

*Methods* are similar to functions: they are declared with the `fn` keyword, accept parameters, return values, and contain code that runs when called. However, methods differ from regular functions in two key ways:

1. They are defined within the context of a struct using an **`impl` block**.
2. Their first parameter is always **`self`** (or **`const self`**), which represents the instance of the struct the method is being invoked upon.

---

## Defining Methods in an `impl` Block

Let's start with a `Rectangle` struct and define an `area` method to calculate its surface area:

**Listing 5-4**
```zenc
struct Rectangle {
    width: int;
    height: int;
}

// Attach methods to Rectangle inside an impl block
impl Rectangle {
    fn area(const self) -> int {
        return self.width * self.height;
    }
}

fn main() {
    let rect = Rectangle { width: 30, height: 50 };

    // Call the method using dot notation:
    println "The area of the rectangle is {rect.area()} square pixels.";
}
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

**Listing 5-5**
```zenc
struct Rectangle {
    width: int;
    height: int;
}

impl Rectangle {
    fn scale(self, factor: int) {
        self.width = self.width * factor;
        self.height = self.height * factor;
    }

    fn translate(self, dw: int, dh: int) {
        self.width = self.width + dw;
        self.height = self.height + dh;
    }
}

fn main() {
    let rect = Rectangle { width: 10, height: 20 };
    rect.scale(2);

    println "Scaled: {rect.width}x{rect.height}";
}
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

**Listing 5-6**
```zenc
struct Rectangle {
    width: int;
    height: int;
}

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

fn main() {
    let r1 = Rectangle::new(30, 50);
    let sq = Rectangle::square(25);

    println "Rectangle: {r1.width}x{r1.height}";
    println "Square: {sq.width}x{sq.height}";
}
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

**Listing 5-7**
```zenc
impl int {
    fn abs(self) -> int {
        return *self < 0 ? -(*self) : *self;
    }

    fn square(self) -> int {
        return (*self) * (*self);
    }
}

fn main() {
    let x = -10;
    let y = x.abs(); // 10

    // Calling methods on numeric literals directly (wrap in parentheses):
    let z = (-5).abs(); // 5
    let sq = (8).square(); // 64

    println "abs(-10) = {y}, abs(-5) = {z}, 8^2 = {sq}";
}
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
