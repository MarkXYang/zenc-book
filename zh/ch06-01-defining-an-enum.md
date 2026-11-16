# 定义枚举

**枚举（enum）**（*enumeration* 的简写）允许你通过枚举其可能的变体（variant）来定义一个类型。与传统 C 语言中枚举只是命名的整数不同，Zen C 的枚举是**带标签的联合体（Tagged Unions）**（也称为*和类型 / Sum Types* 或*代数数据类型 / Algebraic Data Types*）。

枚举的每个变体可以独立存储不同类型的数据，也可以完全不存储任何数据。

---

## 定义枚举

要定义枚举，请使用 `enum` 关键字，后跟采用大驼峰命名法（`UpperCamelCase`）的枚举名称。在大括号 `{ }` 内部，列出各个变体，并用逗号分隔：

```zenc
enum Status {
    Idle,
    Running,
    Finished,
    Error(int),
}
```

在这个例子中，`Status` 可以处于以下四种状态之一：
- `Idle`、`Running` 和 `Finished` 不携带任何载荷数据。
- `Error(int)` 携带一个整型错误码（例如 `404` 或 `500`）。

---

## 枚举变体的种类

Zen C 支持三种主要的枚举变体形式：

### 1. 单元变体（无载荷）

不带圆括号的变体不包含任何载荷数据。它们充当类型安全的状态标志：

```zenc
enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
}
```

### 2. 单载荷变体

变体可以通过在圆括号 `(Type)` 中指定类型来持有单个数据：

```zenc
enum Shape {
    Circle(float),      // Radius
    Point,              // No payload (unit variant)
}
```

### 3. 多载荷（元组）变体

变体可以通过在圆括号 `(Type1, Type2, ...)` 中指定以逗号分隔的类型来存储多个值：

```zenc
enum Shape {
    Circle(float),        // Single payload: radius
    Rect(float, float),   // Multi payload: width and height
    Point,                // Unit variant: at origin
}
```

### 综合示例：对事件建模

当需要将各种异构操作归组在统一的类型下时，枚举表现得尤为出色：

```zenc
enum WebEvent {
    PageLoad,                     // Unit variant
    PageUnload,                   // Unit variant
    KeyPress(char),               // Single payload
    Click(int, int),              // Multi payload: x, y coordinates
    Paste(string),                // Single payload: text string
    ChangeColor(int, int, int),   // Multi payload: RGB values
}
```

注意，与创建六个独立的结构体或管理不安全的 C 语言 `void*` 指针相比，这种方式是多么清晰和安全！

---

## 实例化枚举变体

要实例化枚举变体，请在枚举名称上使用双冒号（`::`）命名空间运算符：

```zenc
fn main() {
    // Instantiating unit variants:
    let load_event = WebEvent::PageLoad;
    let unload_event = WebEvent::PageUnload;

    // Instantiating payload variants with arguments:
    let press_event = WebEvent::KeyPress('q');
    let click_event = WebEvent::Click(100, 250);
    let paste_event = WebEvent::Paste("Hello, Zen C!");
    let color_event = WebEvent::ChangeColor(255, 128, 0);
}
```

> [!TIP]
> **单元变体上的可选括号**：对于无载荷的单元变体，`WebEvent::PageLoad` 和 `WebEvent::PageLoad()` 都是合法的。不带括号的写法更为地道。

---

## 底层原理：带标签联合体的内存布局

Zen C 是如何在没有垃圾回收开销的情况下实现枚举，同时保持 C ABI 兼容性的呢？

在编译为 GNU C11 时，`zc` 编译器会将枚举转译为经过优化的**带标签的联合体（Tagged Union）**：

1. **判别标签（Discriminant Tag）**：一个 C `typedef enum`，为每个变体分配一个整数标签（`Status__Idle_Tag = 0`、`Status__Running_Tag = 1` 等）。
2. **重叠的 `union`**：一个 C `union data`，包含每个变体载荷的字段。
3. **包装结构体**：一个将标签和联合体捆绑在一起的 C `struct`。

例如，我们的 `Status` 枚举在概念上会被转译为以下 C11 代码：

```c
// Conceptually generated C11 representation
typedef enum {
    Status__Idle_Tag,
    Status__Running_Tag,
    Status__Finished_Tag,
    Status__Error_Tag,
} Status_Tag;

struct Status {
    Status_Tag tag;
    union {
        int Error;
    } data;
};
```

### 内存效率

因为联合体中所有变体的载荷共享同一块内存，所以枚举实例所消耗的总内存仅为：

$$\text{Total Size} = \text{sizeof(Tag)} + \text{sizeof(Largest Payload)} + \text{Alignment Padding}$$

例如，如果一个枚举包含变体 `Char(u8)`（1 字节）和 `Coordinate(f64, f64)`（16 字节），则所有实例共享 16 字节的载荷空间。当实例是 `Char` 时，仅使用联合体的 1 个字节；当它是 `Coordinate` 时，则使用全部 16 个字节。

```text
+-------------------+-----------------------------------------------+
|   Tag (4 bytes)   |              Payload Union (16 bytes)         |
+-------------------+-----------------------------------------------+
| Status__Error_Tag | Error Code: 404 (4 bytes) | Unused (12 bytes) |
+-------------------+---------------------------+-------------------+
```

---

## 枚举上的方法（`impl EnumName`）

就像[方法语法](ch05-03-method-syntax.md)一节中的结构体一样，枚举也可以使用 `impl` 块附加方法！

在枚举方法内部：
- 接收者是 `self`（或 `const self`）。
- 因为 `self` 是指向枚举实例的指针（`Status* self`），所以你可以解引用 `*self` 以对当前激活的变体进行模式匹配：

**代码清单 6-1**
```zenc
enum Status {
    Idle,
    Running,
    Finished,
    Error(int),
}

impl Status {
    // Read-only inspection method
    fn is_terminal(const self) -> bool {
        match *self {
            Status::Finished => { return true; },
            Status::Error(_) => { return true; },
            _ => { return false; },
        }
    }

    // Extraction method with fallback
    fn error_or_default(const self, default_code: int) -> int {
        match *self {
            Status::Error(code) => { return code; },
            _ => { return default_code; },
        }
    }
}

fn main() {
    let s1 = Status::Running;
    let s2 = Status::Error(500);

    println "Is s1 terminal? {s1.is_terminal()}";
    println "Is s2 terminal? {s2.is_terminal()}";
    println "s2 error code: {s2.error_or_default(0)}";
}
```

输出：
```text
Is s1 terminal? false
Is s2 terminal? true
s2 error code: 500
```

---

## 标准库中的 `Option` 与 `Result`

Zen C 用两个标准枚举替代了容易出错的错误码和 `NULL` 指针：

### 1. `Option<T>`：表示可选值

函数可以返回 `Option<T>`，而无需返回可能为 `NULL` 的指针（进而需要手动判空）：

```zenc
enum Option<T> {
    Some(T),
    None,
}
```

如果存在值，它会被包装在 `Option::Some(value)` 中。如果不存在，则为 `Option::None`。

### 2. `Result<T, E>`：可恢复错误

可能失败的函数会返回 `Result<T, E>`，而不是返回整型状态码或设置全局 `errno` 变量：

```zenc
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

我们将在 [第 9 章：错误处理](ch09-00-error-handling.md) 中深入探讨 `Option` 和 `Result`。

---

## 枚举语法小结

| 特性 | 语法示例 | 说明 |
| :--- | :--- | :--- |
| **枚举声明** | `enum Status { Idle, Error(int) }` | 变体之间以逗号分隔 |
| **单元变体** | `Status::Idle` | 无载荷数据 |
| **单载荷** | `Status::Error(404)` | 存储单个值 |
| **元组载荷** | `Shape::Rect(10.0, 20.0)` | 存储多个值 |
| **内存模型** | 标签（Tag）+ 联合体（Union）载荷 | 零堆分配开销 |
| **方法** | `impl Status { fn is_ok(const self) -> bool { ... } }` | 在枚举上实现行为 |

> [!TIP]
> 你可以在 [`book/examples/ch06/ch06-01-defining-an-enum/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/ch06-01-defining-an-enum/main.zc) 中找到并运行本节的完整示例。

既然我们已经知道了如何定义和实例化枚举，接下来让我们学习如何使用 **`match` 控制流结构** 安全地检查和提取它们的值！
