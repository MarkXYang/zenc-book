# 指针作为借用

在 [4.1 节](ch04-01-move-semantics.md) 中，我们了解到将拥有资源的值传入函数或赋值给另一个变量会**移动**所有权。一旦被移动，原始变量就无法再使用了。

然而，在实际程序中，函数通常需要读取或修改某个资源，而不需要取得其全部所有权。在 Zen C 中，你可以使用**指针**（`T*`）来借用对值的访问权。

---

## 引用与指针类型

要创建对变量的引用（借用），请使用取地址运算符（`&`）。指向 `T` 的指针类型写作 `T*`：

```zenc
struct Buffer {
    data: int*;
    len: int;
}

fn inspect_buffer(buf: Buffer*) {
    // Borrows buf without taking ownership
    println "Buffer length: {buf.len}";
}

fn main() {
    let my_buf = Buffer { data: 0, len: 1024 };
    inspect_buffer(&my_buf); // Borrowing via &
    // my_buf is still valid here because ownership was NOT moved!
}
```

---

## 自动解引用特性

在标准 C 中，通过指针访问结构体成员需要使用繁琐的箭头语法（`ptr->field`）或显式解引用（`(*ptr).field`）。

在 Zen C 中，字段访问（`ptr.field`）和方法调用（`ptr.method()`）会**自动解引用**指针：

```zenc
struct Node {
    value: int;
}

impl Node {
    fn display(self) {
        println "Node value: {self.value}";
    }
}

fn process_node(ptr: Node*) {
    // Automatically dereferences pointer (equivalent to (*ptr).value)
    println "Value: {ptr.value}";

    // Automatically dereferences for method calls
    ptr.display();
}

fn main() {
    let n = Node { value: 42 };
    process_node(&n);
}
```

---

## 安全导航（`?.`）与空值合并（`??`）

Zen C 提供了符合人体工程学的语法糖运算符，以便安全地处理可能为 `NULL` 的指针：

### 1. 安全导航运算符（`?.`）
通过指针安全地访问字段。如果指针为 `NULL`，表达式将短路返回 `NULL` / 0，而不会崩溃：

```zenc
struct Session {
    id: int;
}

fn print_session(s: Session*) {
    let sess_id = s?.id; // Returns 0 / NULL if s is NULL
}
```

### 2. 空值合并运算符（`??`）
如果指针为 `NULL`，则求值为备用值：

```zenc
let user_ptr = active_profile ?? &default_profile;
```

### 3. 空值赋值运算符（`??=`）
仅在目标当前为 `NULL` 时才赋备用指针值：

```zenc
app_cfg ??= &fallback_cfg;
```

---

## Zen C 指针与 Rust 借用检查器的对比

> [!IMPORTANT]
> **与 Rust 的对比**：
> 在 Rust 中，编译器通过带有生命周期注解（`&'a T`）的编译期借用检查器（Borrow Checker）来防止引用的生命周期长于目标。
> 在 Zen C 中：
> - 底层指针就是原生 C 指针（`T*`），具有**零运行时开销**和 100% 的 C ABI 兼容性。
> - Zen C 通过移动语义防止双重释放。但是，避免悬垂指针（例如返回局部栈变量的地址）仍然是程序员的责任，正如在现代 C 和 C++ 中一样。
> - 在调用栈向下传递时使用指针进行借用，并在作用域结束时使用 `defer` / `Drop` 进行确定性清理。

接下来，让我们探索 Zen C 中的切片！
