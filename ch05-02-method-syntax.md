# Method Syntax and impl Blocks

*Methods* are similar to functions: they are declared with the `fn` keyword, accept parameters, return values, and contain code that runs when called. However, methods differ from regular functions in two key ways:

1. They are defined within the context of a struct using an **`impl` block**.
2. Their first parameter is always **`self`** (or **`const self`**), which represents the instance of the struct the method is being invoked upon.

---

## Defining Methods in an `impl` Block

Let's start with a `Rectangle` struct and define an `area` method to calculate its surface area:

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

```zenc
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

```zenc
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

## Operator Overloading via Methods

Zen C allows you to overload operators for your custom struct types simply by implementing methods with specific operator names. No complex syntax or special macros are required!

When the compiler encounters an operator expression like `a + b`, it checks whether `a`'s struct type implements the corresponding operator method (such as `add`).

### Arithmetic Operator Overloading

To overload `+`, implement `fn add`:

```zenc
struct Vec2 {
    x: int;
    y: int;
}

impl Vec2 {
    fn new(x: int, y: int) -> Vec2 {
        return Vec2 { x: x, y: y };
    }

    // Overloads binary '+'
    fn add(self, other: Vec2) -> Vec2 {
        return Vec2 {
            x: self.x + other.x,
            y: self.y + other.y,
        };
    }

    // Overloads binary '-'
    fn sub(self, other: Vec2) -> Vec2 {
        return Vec2 {
            x: self.x - other.x,
            y: self.y - other.y,
        };
    }
}

fn main() {
    let v1 = Vec2::new(1, 2);
    let v2 = Vec2::new(3, 4);

    let v3 = v1 + v2; // Calls v1.add(v2)
    println "v3 = ({v3.x}, {v3.y})";

    let v4 = v3 - v1; // Calls v3.sub(v1)
    println "v4 = ({v4.x}, {v4.y})";
}
```

Output:
```text
v3 = (4, 6)
v4 = (3, 4)
```

### Equality Operator Overloading

To overload `==` and `!=`, implement `fn eq`:

```zenc
impl Vec2 {
    // Overloads binary '=='
    fn eq(self, other: Vec2) -> bool {
        return self.x == other.x && self.y == other.y;
    }
}

fn main() {
    let a = Vec2::new(10, 20);
    let b = Vec2::new(10, 20);
    let c = Vec2::new(5, 5);

    println "a == b: {a == b}";
    println "a == c: {a == c}";
}
```

Output:
```text
a == b: true
a == c: false
```

### Complete Operator Overloading Table

The following table lists the operator methods supported by Zen C:

| Category | Operator | Method Name | Example Signature |
| :--- | :--- | :--- | :--- |
| **Arithmetic** | `+` | `add` | `fn add(self, other: T) -> T` |
| | `-` | `sub` | `fn sub(self, other: T) -> T` |
| | `*` | `mul` | `fn mul(self, other: T) -> T` |
| | `/` | `div` | `fn div(self, other: T) -> T` |
| | `%` | `rem` | `fn rem(self, other: T) -> T` |
| | `**` | `pow` | `fn pow(self, exp: int) -> T` |
| **Comparison** | `==` | `eq` | `fn eq(self, other: T) -> bool` |
| | `!=` | `neq` | `fn neq(self, other: T) -> bool` |
| | `<` | `lt` | `fn lt(self, other: T) -> bool` |
| | `>` | `gt` | `fn gt(self, other: T) -> bool` |
| | `<=` | `le` | `fn le(self, other: T) -> bool` |
| | `>=` | `ge` | `fn ge(self, other: T) -> bool` |
| **Bitwise** | `&` | `bitand` | `fn bitand(self, other: T) -> T` |
| | `\|` | `bitor` | `fn bitor(self, other: T) -> T` |
| | `^` | `bitxor` | `fn bitxor(self, other: T) -> T` |
| | `<<` | `shl` | `fn shl(self, shift: int) -> T` |
| | `>>` | `shr` | `fn shr(self, shift: int) -> T` |
| **Unary** | `-` | `neg` | `fn neg(self) -> T` |
| | `!` | `not` | `fn not(self) -> bool` |
| | `~` | `bitnot` | `fn bitnot(self) -> T` |
| **Indexing** | `c[idx]` | `get` | `fn get(self, idx: int) -> T` |
| | `c[idx] = v` | `set` | `fn set(self, idx: int, val: T)` |

> [!TIP]
> **Compound Assignments**: Compound assignments (`+=`, `-=`, `*=`, `|=`) automatically desugar into their corresponding operator method and assignment! For instance, `f1 |= f2` works as expected when `bitor` is defined.

---

## Mixin Method Forwarding

In [Section 5.1](ch05-01-defining-structs.md), we learned that structs can embed other structs using the `use` keyword. When a struct embeds another type via a mixin, all methods defined on the embedded type are **automatically available** on instances of the outer struct:

```zenc
struct Rectangle {
    width: int;
    height: int;
}

impl Rectangle {
    fn area(const self) -> int {
        return self.width * self.height;
    }
}

struct Window {
    use Rectangle; // Mixin: flattens fields and inherits Rectangle methods!
    title: string;
}

fn main() {
    let win = Window {
        width: 800,
        height: 600,
        title: "Main Application",
    };

    // area() is inherited directly from Rectangle!
    println "Window '{win.title}' area: {win.area()} px";
}
```

Output:
```text
Window 'Main Application' area: 480000 px
```

This mixin pattern provides the code-reuse benefits of object-oriented inheritance while preserving flat, predictable C struct memory layouts.

---

## Methods on Primitive Types

Zen C allows you to define methods on primitive scalar types (like `int`, `bool`, etc.) using the exact same `impl` syntax.

Because primitive values are passed by pointer to methods (`int* self`), dereferencing `*self` retrieves the underlying scalar value:

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

## A Complete Example

Let's bring together everything we've learned about structs, constructors, methods, `.field` shorthand, operator overloading, and mixins into a single complete example:

```zenc
@derive(Copy)
struct Point {
    x: int;
    y: int;
}

impl Point {
    // Constructor returning -> Self
    fn new(x: int, y: int) -> Self {
        return Point { x: x, y: y };
    }

    // Using .x and .y self shorthand
    fn translate(self, dx: int, dy: int) {
        .x += dx;
        .y += dy;
    }

    fn add(self, other: Point) -> Self {
        return Point { x: .x + other.x, y: .y + other.y };
    }

    fn eq(self, other: Point) -> bool {
        return .x == other.x && .y == other.y;
    }
}

struct Rectangle {
    top_left: Point;
    width: int;
    height: int;
}

impl Rectangle {
    fn new(x: int, y: int, width: int, height: int) -> Self {
        return Rectangle {
            top_left: Point::new(x, y),
            width: width,
            height: height,
        };
    }

    // Self shorthand with .width and .height
    fn area(const self) -> int {
        return .width * .height;
    }

    fn contains_point(const self, p: Point) -> bool {
        return p.x >= .top_left.x &&
               p.x <= (.top_left.x + .width) &&
               p.y >= .top_left.y &&
               p.y <= (.top_left.y + .height);
    }
}

fn main() {
    let p1 = Point::new(10, 20);
    let p2 = Point::new(30, 40);

    // Operator overloading
    let p3 = p1 + p2;
    println "p1 + p2 = ({p3.x}, {p3.y})";

    let rect = Rectangle::new(0, 0, 100, 50);
    println "Area: {rect.area()}";

    let test_pt = Point::new(25, 25);
    println "Contains (25, 25)? {rect.contains_point(test_pt)}";
}
```

Output:
```text
p1 + p2 = (40, 60)
Area: 5000
Contains (25, 25)? true
```

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch05/ch05-02-method-syntax/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch05/ch05-02-method-syntax/main.zc), and the chapter capstone application in [`book/examples/ch05/rectangles/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch05/rectangles/main.zc).

---

## Summary

In this chapter, you learned:
- How to define structs and instantiate them with complete field initializers or zero initialization (`Struct{}`).
- How to access and update fields using uniform dot notation on both struct values and pointers.
- How to destructure structs into distinct local variables with shorthand or renaming syntax.
- How to compose types and inherit methods using named composition and mixin flattening with `use`.
- How to control hardware-level memory representation with bitfields, `@packed`, and `@align`.
- How to write methods inside `impl` blocks, distinguishing between read-only (`const self`) and mutating (`self`) methods.
- How to write concise method code with **Self Shorthand (`.field`)**.
- How to define associated constructor functions using namespace syntax (`Struct::new()`) and the `Self` return type.
- How to overload arithmetic, comparison, and indexing operators with intuitive method names.
- How to attach methods to primitive types (like `impl int`) and invoke them on literals.

In [Chapter 6](ch06-00-enums-and-pattern-matching.md), we'll explore **Enums and Pattern Matching**, allowing you to represent values that can be one of several distinct variants!
