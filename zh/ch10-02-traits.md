# Trait：定义共享行为

**Trait**（特征）用于告知 Zen C 编译器某个特定类型所拥有且可与其他类型共享的功能。Trait 允许我们以抽象的方式定义共享行为：它们的作用类似于 Go 或 Java 中的接口（interface），或是 Rust 中的 trait，指定了一组实现类型必须提供的方法签名。

---

## 1. 定义 Trait

类型的行为由我们可以在该类型上调用的方法组成。如果我们可以在多种不同类型上调用相同的方法，那么这些类型就共享了相同的行为。

要声明 trait，请使用 `trait` 关键字，后跟 trait 的名称和一个包含一个或多个以分号（`;`）结尾的方法签名的块：

```zenc
trait Summary {
    fn summarize(self) -> string;
}
```

这里，我们声明了一个带有一个方法签名的 `Summary` trait：`fn summarize(self) -> string;`。每个实现该 trait 的类型都必须为 `summarize` 提供自己的自定义函数体。

一个 trait 可以在其内部指定多个方法签名：

```zenc
trait Drawable {
    fn draw(self);
    fn bounding_box(self) -> int;
}
```

### 泛型 Trait

Trait 也可以使用泛型类型参数 `<T>` 进行参数化：

```zenc
trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait From<T> {
    fn from_val(val: T) -> Self;
}
```

---

## 2. 为类型实现 Trait

定义了 trait 之后，你可以使用以下语法为结构体实现它：

```zenc
impl <TraitName> for <StructName> {
    // 方法实现
}
```

让我们在两种不同的媒体类型 `NewsArticle` 和 `Tweet` 上实现 `Summary` trait：

**代码清单 10-5**
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

输出：
```text
New article: Zen C 0.4 Released, by The Zen C Team (San Francisco)
New tweet:   @zenc_lang: Zero-cost abstractions that compile to clean C11!
```

在具体实例上直接调用 trait 方法（`article.summarize()`）会在编译期静态解析为 `NewsArticle__Summary__summarize(&article)`。

> [!WARNING]
> **返回的插值字符串是临时的。** `return "@{self.username}: {self.content}";` 会在一个属于该行代码的静态缓冲区中构建文本，并返回指向该缓冲区的 `string`（`char*`）。下一次调用同一方法时会覆盖该缓冲区：
>
> ```zenc
> let a = tweet1.summarize();
> let b = tweet2.summarize();
> println "{a} | {b}";   // prints tweet2's summary twice
> ```
>
> 像 `println "{tweet.summarize()}"` 这样立即使用结果是安全的。如果需要保留文本，请改为返回拥有所有权的 `String`：将签名改为 `-> String`，并写成 `return String::from("@{self.username}: {self.content}");`。`String` 会通过 `Drop` 释放其内存。你将在[第 8 章](ch08-02-strings.md)中进一步了解 `String`。

> [!NOTE]
> **防止反向 `impl` 语法的编译器保护**：
> 来自其他语言的开发者有时会误写为 `impl Struct for Trait` 而不是 `impl Trait for Struct`。如果你颠倒了顺序，`zc` 会立即捕获该错误并给出清晰的诊断：
> ```text
> error: Incorrect usage of impl. Did you mean 'impl Summary for NewsArticle'?
>        Syntax is 'impl <Trait> for <Struct>'
> ```

---

## 3. Trait 作为参数

当你编写接受实现给定 trait 的*任意*类型的函数，而不是硬编码单个具体结构体时，Trait 会变得尤为强大。

在 Zen C 中，你可以直接使用 trait 名称作为参数类型（`item: Summary`）。当你传递指向实现 `Summary` 的任何结构体的指针（例如 `&article` 或 `&tweet`）时，编译器会自动将其打包为 **trait 对象**：

**代码清单 10-6**
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

输出：
```text
Breaking news! Penguins Win the Stanley Cup, by Iceburgh
Breaking news! @horse_ebooks: of course, as you probably already know, people
```

> [!TIP]
> ### 🔍 窥探底层 C 代码：Trait 多态在底层是如何工作的
> 当你定义 `trait Summary` 时，`zc` 编译器会生成一个 C11 虚方法表（`Summary_VTable`）以及一个由数据指针 `void *self` 和虚表指针 `Summary_VTable *vtable` 组成的双指针**胖指针**（fat pointer）结构体（`Summary`）：
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
> 当你实现 `impl Summary for NewsArticle` 时，`zc` 会生成一个静态虚表实例：
>
> ```c
> Summary_VTable NewsArticle__Summary__VTable = {
>     .summarize = NewsArticle__Summary__summarize
> };
> ```
>
> 而当你调用 `notify(&article)` 时，`zc` 会在调用点自动构造 `Summary` 胖指针：
>
> ```c
> notify((Summary){
>     .self = (void*)&article,
>     .vtable = &NewsArticle__Summary__VTable
> });
> ```
>
> 我们将在**[第 18 章：多态：组合与 Trait 对象](ch18-00-polymorphism.md)**中深入探讨 trait 对象、trait 对象的异构集合以及虚表内部机制。

---

## 4. 为泛型类型实现 Trait

你也可以为泛型结构体实现 trait。例如，在 Zen C 标准库（`std/mem.zc` 和 `std/vec.zc`）中，`Drop` trait 就是为泛型的 `Box<T>` 和 `Vec<T>` 类型实现的：

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

每当实例化像 `Box<int>` 或 `Box<f64>` 这样的具体特化类型时，编译器都会自动实例化相应的 `Drop` 实现，以便在离开作用域时清理其内存。

---

## 5. 静态结构化泛型 vs. Trait 多态

Zen C 提供了两种编写多态函数的不同方式，各自适用于不同的系统工程需求：

**代码清单 10-7**
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

输出：
```text
Area = 12.566360
Area = 16.000000
```

> [!NOTE]
> ### 来自 Rust 或 C++ 视角：泛型与 Trait 如何交互
> - Zen C 中的**泛型函数（`fn f<T>(x: T*)`）**类似于 **C++ 模板**：它们采用**编译期结构化单态化**。当实例化 `print_area<Circle>(&c)` 时，编译器会检查 `Circle` 是否具有固有的 `.area()` 方法，并生成对 `Circle__area(shape)` 的直接调用，具有**零虚表间接开销**。
> - **Trait 参数（`fn notify(item: Summary)`）**类似于 **Go 接口或 Rust 的 `&dyn Trait`**：它们强制执行显式的 `impl Summary for Type` 契约，并通过轻量级 C11 胖指针（`{ self, vtable }`）进行分发，允许单个编译后的函数在运行时接受不同类型，而无需重复生成机器码。

| 特性 | 泛型函数 (`fn f<T>(x: T*)`) | Trait 参数 (`fn f(x: Trait)`) |
| :--- | :--- | :--- |
| **分发机制** | **静态**（编译期单态化） | **动态**（运行时虚表查找） |
| **调用开销** | **零**（直接 C 函数调用，可内联） | **1 次指针间接寻址**（`vtable->method`） |
| **代码体积** | 每个具体类型 `T` 生成一个 C 函数 | 所有类型共享单个 C 函数 |
| **方法解析** | 解析固有的 `impl Type` 方法与运算符 | 解析 `impl Trait for Type` 方法 |

---

## 小结

- **`trait` 声明**：定义各类型可以实现的共享方法签名。
- **`impl Trait for Struct`**：将具体结构体连接到 trait 契约。
- **Trait 参数（`item: Trait`）**：通过自动将结构体指针包装为 `{ self, vtable }` 胖指针，实现清晰的运行时多态。
- **静态 vs. 动态选择**：对于零开销编译期特化使用 `<T>` 泛型；当你需要接口契约和共享运行时代码时使用 `Trait` 参数。

接下来，让我们研究直接与 Zen C 编译器和语法集成的内置**标准 Trait 与智能 Derive**！
