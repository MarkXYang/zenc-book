# 方法语法

*方法（Methods）*与函数类似：它们使用 `fn` 关键字声明、接受参数、返回值，并且包含在被调用时运行的代码。然而，方法与常规函数有两个关键区别：

1. 它们通过 **`impl` 块** 在结构体的上下文中定义。
2. 它们的第一个参数始终是 **`self`**（或 **`const self`**），代表调用该方法的结构体实例。

---

## 在 impl 块中定义方法

让我们以 `Rectangle` 结构体为例，定义一个 `area` 方法来计算其表面积：

**代码清单 5-4**
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

输出：
```text
The area of the rectangle is 1500 square pixels.
```

要调用方法，请写出实例名称，后跟一个点号（`.`）、方法名称以及包含任意实参的圆括号 `()`。

---

## 接收者参数：`const self` 与 `self`

方法签名中的第一个参数定义了该方法如何与实例进行交互：

| 参数 | 底层类型 | 可变性 | 何时使用 |
| :--- | :--- | :--- | :--- |
| **`const self`** | `const Rectangle* self` | **只读** | 检查、查询、不改变状态的计算 |
| **`self`** | `Rectangle* self` | **可变** | 修改结构体实例的字段或状态 |

### 1. 只读方法（`const self`）

当方法只读取数据而不修改字段时，将接收者声明为 `const self`：

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

编译器保证 `const self` 方法内部的代码不能意外给 `self.width` 或 `self.height` 赋值。

### 2. 可变方法（`self`）

当方法需要修改结构体字段时，使用 `self`：

**代码清单 5-5**
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

输出：
```text
Scaled: 20x40
```

### 自动引用与解引用

在 C 或 C++ 中，通过指针调用方法需要使用箭头语法（`ptr->area()`），而在栈对象上调用则需要使用点号语法（`rect.area()`），并且你必须手动决定何时传递 `&rect` 还是 `rect`。

Zen C 通过**自动引用与解引用**消除了这种摩擦：

```zenc
let rect = Rectangle { width: 10, height: 20 };
let rect_ptr = &rect;

// Calling on a value (compiler automatically borrows &rect):
let a1 = rect.area();

// Calling on a pointer (compiler passes the pointer directly):
let a2 = rect_ptr.area();
```

两种调用方式都会编译为清晰、最优的 C 指针函数调用。

---

## self 简写语法（`.field`）

在具有 `self` 或 `const self` 接收者参数的方法中，Zen C 允许你使用 **`.field`** 作为 `self.field` 的极其顺手的简写：

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

这种简写消除了数学公式、物理引擎和图形编程中重复的样板代码，同时由于前导点号（`.`）的存在，字段访问依然保持清晰明确。

---

## 关联函数（静态方法）

在 `impl` 块内部定义的所有函数都统称为**关联函数（associated functions）**，因为它们与该类型相关联。

当一个关联函数**不以** `self` 作为其第一个参数时，它就是一个**关联函数 / 静态方法**。这些函数不在特定实例上操作；相反，它们通常用作返回结构体新实例的**构造函数（constructors）**：

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
> **`Self` 类型**：在 `impl` 块内部，`Self` 是一个内置别名，代表正在实现的类型（在此例中为 `Rectangle`）。返回 `-> Self` 是 Zen C 中构造函数和工厂方法的标准惯例。

### 调用关联函数（`::`）

要调用不接受 `self` 的关联函数，请在结构体名称上使用双冒号（`::`）命名空间运算符：

**代码清单 5-6**
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

输出：
```text
Rectangle: 30x50
Square: 25x25
```

### 针对误用的编译器防护

如果你误尝试在实例上使用点号运算符调用关联构造函数，Zen C 编译器会捕获该错误并给出切实可行的提示：

```zenc
let r = Rectangle::new(10, 20);
r.new(30, 40); // Error!
```

**编译器诊断：**
```text
error: Cannot call static method 'new' with dot operator
   = help: Use 'Rectangle::new(...)' instead of instance.new(...)
```

---

## 多个 `impl` 块

每个结构体都允许拥有多个 `impl` 块。这使你能够在代码库中有条理地组织方法：

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

将所有方法合并在一个 `impl` 块中还是拆分到多个块中，在功能上没有任何区别。将相关方法归组在一起，或将基础构造函数与高级算法分开时，多个块尤其有用。

---

## 原生类型上的方法

Zen C 允许你使用完全相同的 `impl` 语法在原始标量类型（如 `int`、`bool` 等）上定义方法。

因为原始标量值是通过指针传递给方法的（`int* self`），所以解引用 `*self` 即可检索到底层的标量值：

**代码清单 5-7**
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

输出：
```text
abs(-10) = 10, abs(-5) = 5, 8^2 = 64
```

---

## 桥接到 Trait：标准 Trait

方法语法和 `impl` 块构成了 Zen C **Trait 系统**的基石（在 [第 10 章](ch10-00-generics-and-traits.md) 中有深入探讨）。Zen C 包含几个直接与核心语言语法集成的标准 trait：

- **`Drop`**：定义析构函数（`fn drop(self)`），当拥有资源的结构体离开作用域时自动运行（RAII）。
- **`Copy`**：通过 `@derive(Copy)` 应用的标记 trait，用于为纯数据结构体显式选择隐式复制而非移动语义。
- **`Clone`**：为拥有资源的类型定义显式复制（`fn clone(self) -> Self`）。
- **`Iterable<T>`**：通过 `fn next(self) -> Option<T>` 实现迭代器，支持在自定义类型上直接进行 `for-in` 循环迭代。

---

## 小结

在本节中，你学习了：
- 如何在 `impl` 块内部为自定义结构体类型定义方法。
- 如何在只读接收者（`const self`）与可变接收者（`self`）之间进行选择。
- 如何使用 `.field` self 简写语法编写简洁代码。
- 如何创建关联构造函数（`Rectangle::square(size)`）并使用 `Self` 返回类型。
- 如何在原生类型上附加方法（例如 `impl int`）。

接下来，让我们探索使用 `use` 进行结构体组合！
