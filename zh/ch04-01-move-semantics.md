# 栈、堆与移动语义

Zen C 将管理底层资源（例如堆指针、文件描述符或实现了 `Drop` 的结构体）的类型视为**资源（Resources）**。为了在没有垃圾回收开销的前提下保证内存安全，Zen C 在编译期强制执行严格的**资源语义（Resource Semantics）**。

---

## 资源语义（默认移动）

在传统 C 或 C++ 中，复制一个包含指针的结构体会盲目复制指针地址。当两个结构体离开作用域时，两者都会调用 `free()`，从而导致**双重释放内存损坏崩溃（double-free memory corruption crash）**。

Zen C 通过**移动语义（Move Semantics）**解决了这个问题：

- **默认移动（Move by Default）**：将拥有资源的变量赋值给另一个变量会转移所有权。原始变量将变为无效（**已移动 / Moved**）。
- **防止双重释放**：由于所有权发生了转移，离开作用域时只有新的所有者会执行析构函数。

```zenc
let a = CustomBuffer { data: malloc(100), size: 100 };
let b = a; // Ownership moved to 'b'. 'a' is now invalid.

// let c = a; // Compiler Error: Use of moved value 'a'
```

### 原生类型与资源类型

> [!NOTE]
> **原生类型总是按值复制，从不移动**
> 移动语义严格适用于**拥有资源的类型**（管理资源的结构体或实现了 `Drop` 的结构体）。
>
> 原始标量类型（`u8`–`u128`、`i8`–`i128`、`f32`、`f64`、`bool`、`char`、`rune`）保存在 CPU 寄存器或栈上，并不拥有堆内存或析构函数。复制它们只是一次微不足道的按位复制，完全没有双重释放的风险。
>
> 因此，原生类型**隐式具备 `Copy`**：
>
> ```zenc
> let a: u32 = 42;
> let b = a; // Copied by value
> let c = a; // OK: 'a' was not moved and remains valid!
>
> let x: f64 = 3.14;
> let y = x; // Copied by value
> let z = x; // OK: 'x' was not moved and remains valid!
> ```

### 编译器诊断与设计哲学

> [!IMPORTANT]
> **理解“Use of moved value”**
> 如果你遇到了编译器诊断错误 **`Use of moved value 'x'`**，Zen C 正在保护你的程序：
> *“该类型拥有资源（例如堆内存或文件句柄），盲目复制它是不安全的。”*

与 C/C++ 不同，Zen C 绝不会隐式复制拥有资源的值。

| 类型分类 | 示例 | 赋值行为 | 移动后失效？ |
| :--- | :--- | :--- | :--- |
| **原生标量类型** | `u8`–`u128`、`i8`–`i128`、`f32`、`f64`、`bool`、`char` | **Copy**（隐式按位复制） | **否**（保持有效） |
| **资源类型 / RAII** | 管理堆缓冲区、句柄或实现 `Drop` 的结构体 | **Move**（所有权转移） | **是**（原始变量失效） |
| **显式选择 Copy 的栈结构体** | 实现 `Copy`（`impl Copy for T`）的结构体 | **Copy**（显式按位复制） | **否**（保持有效） |

---

## 将资源传递给函数

将资源变量传递给函数遵循与变量赋值完全相同的所有权规则：

**代码清单 4-1**
```zenc
struct CustomBuffer {
    data: void*;
    size: usize;
}

fn consume_buffer(buf: CustomBuffer) {
    println "Consumed buffer of size {buf.size}";
}

fn peek_buffer(buf: CustomBuffer*) {
    println "Peeked buffer of size {buf.size}";
}

fn main() {
    let my_buf = CustomBuffer { data: malloc(50), size: 50 };

    peek_buffer(&my_buf); // OK: borrowed reference, my_buf remains valid

    consume_buffer(my_buf); // OK: moved into function

    // peek_buffer(&my_buf); // Error: my_buf was moved above!
}
```

输出：
```text
Peeked buffer of size 50
Consumed buffer of size 50
```

---

## 显式资源克隆（`Clone` Trait）

如果你明确希望拥有资源值的两份独立拷贝，可以调用其 `.clone()` 方法：

```zenc
let a = CustomBuffer { data: malloc(100), size: 100 };
let b = a.clone(); // Explicit duplicate allocation via Clone trait

// Both 'a' and 'b' are valid independent resource owners
```

---

## 显式选择 Copy 类型（`Copy` Trait）

对于完全保存在栈上且不拥有堆资源的小型值类型（例如普通的坐标点或数值配置），在赋值时转移所有权可能会很不方便。

你可以通过实现 `impl Copy for StructName` 显式开启隐式复制：

**代码清单 4-2**
```zenc
struct Point {
    x: int;
    y: int;
}

// Opt-in to implicit value duplication (Copy behavior)
impl Copy for Point {}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = p1; // Copied implicitly because Point implements Copy

    // Both p1 and p2 remain valid!
    println "p1: ({p1.x}, {p1.y}), p2: ({p2.x}, {p2.y})";
}
```

输出：
```text
p1: (10, 20), p2: (10, 20)
```

---

接下来，让我们看看指针如何让你在不移动值的情况下借用它！
