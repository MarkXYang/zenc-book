# 确定性清理：`defer` 与 `Drop`

Zen C 提供了自动清理机制，在避免垃圾回收器开销的同时，消除了手动跟踪资源生命周期的负担。

---

## `defer` 语句

`defer` 语句用于安排一个语句或代码块在包含它的作用域退出时（无论是通过 `return`、到达代码块末尾，还是提前退出）自动执行。

```zenc
fn process_file() {
    let f = fopen("data.txt", "r");
    if f == 0 {
        return;
    }
    defer fclose(f); // Guaranteed to run when process_file() exits

    // Perform file operations...
}
```

### LIFO 执行顺序

同一作用域内的多个 `defer` 语句按照**后进先出（LIFO, Last-In, First-Out）**的顺序执行：

**代码清单 4-4**
```zenc
fn main() {
    println "Start";

    defer println "Third (First deferred)";
    defer println "Second (Second deferred)";
    defer println "First (Last deferred)";

    println "End";
}
```

输出：
```text
Start
End
First (Last deferred)
Second (Second deferred)
Third (First deferred)
```

> [!WARNING]
> **Defer 中禁止控制流**：为了防止未定义行为，`defer` 块内**不允许**使用控制流跳转语句（`return`、`break`、`continue`、`goto`）。

---

## 使用 `defer free(...)` 释放堆内存

对于通过 `malloc` 分配的堆内存，可以在分配后紧接着使用 `defer` 安排对应的 `free()`。这样内存分配与其清理逻辑便紧挨在一起，无论从哪条路径退出（包括提前返回），内存都会被妥善释放：

```zenc
fn process_buffer() {
    let buffer = malloc(1024);
    defer free(buffer); // Runs when process_buffer returns, however it returns

    // Use buffer without worrying about the free
}
```

当堆分配属于某个结构体而不是单个函数时，应当为该结构体实现 `Drop`（下一节将介绍），这样无论该值在何处离开作用域，内存都会被自动释放。

> **注意：** Zen C 的早期版本曾有 `autofree` 修饰符（`autofree let p = malloc(n);`）。该语法已被移除；编译器现在会提示 `'autofree' was removed; declare the variable normally and add 'defer free(x)'`。

---

## 析构函数与 RAII（`Drop` Trait）

资源获取即初始化（RAII）是一种将资源（堆内存、套接字连接、线程句柄）绑定到对象生命周期的模式。

在 Zen C 中，自定义结构体通过实现 `Drop` trait 来定义自动销毁逻辑：

**代码清单 4-5**
```zenc
struct CustomBuffer {
    data: void*;
    size: usize;
}

impl Drop for CustomBuffer {
    fn drop(self) {
        println "Dropping CustomBuffer (releasing {self.size} bytes)";
        if self.data != 0 {
            free(self.data);
        }
    }
}

fn create_and_use() {
    let buf = CustomBuffer {
        data: malloc(512),
        size: 512,
    };

    // Use buf...
} // buf goes out of scope here: CustomBuffer.drop(buf) is called automatically

fn main() {
    create_and_use();
}
```

输出：
```text
Dropping CustomBuffer (releasing 512 bytes)
```

### `Drop` 的核心优势

1. **自动内存清理**：杜绝遗漏 `free()` 的风险。
2. **异常与提前退出安全**：无论以何种方式退出作用域，都能保证执行清理。
3. **封装性**：使用 `CustomBuffer` 的调用方无需了解其内部的析构销毁步骤。

---

## 解除析构函数：`forget()` 方法

虽然 RAII 和 `Drop` 通过自动回收资源来防止内存泄漏，但在某些情况下你可能希望**阻止 `drop()` 运行**：
1. **将所有权转移给外部 / C API**：将原生堆缓冲区传递给负责释放它的 C 库函数。如果 Zen C 包装结构体的 `drop()` 仍然执行，就会导致双重释放崩溃。
2. **在自定义容器间移动资源**：在像 `Vec<T>` 和 `String` 这样的标准集合中，当从容器中追加或转移元素时，源容器的内存缓冲区会使用 `.forget()` 分离，从而防止其析构函数释放已转移的内存。

在 Zen C 中，标准惯例是在资源类型上实现 `forget(self)` 方法。`forget()` 方法将内部指针和资源句柄置零或置空：

**代码清单 4-6**
```zenc
struct CustomBuffer {
    data: void*;
    size: usize;
}

impl CustomBuffer {
    // Detaches the underlying resource, disarming Drop
    fn forget(self) {
        self.data = NULL;
        self.size = 0;
    }
}

impl Drop for CustomBuffer {
    fn drop(self) {
        if self.data != NULL {
            println "Drop: freeing {self.size} bytes";
            free(self.data);
        } else {
            println "Drop: buffer was forgotten, skipping deallocation";
        }
    }
}

fn transfer_to_c_api(raw_ptr: void*, size: usize) {
    println "C API taking ownership of {size} bytes";
    // Simulated C API freeing the buffer
    free(raw_ptr);
}

fn main() {
    println "=== Normal Drop ===";
    {
        let buf = CustomBuffer { data: malloc(64), size: 64 };
    } // buf dropped here -> frees 64 bytes

    println "\n=== Disarming Drop with forget() ===";
    {
        let buf = CustomBuffer { data: malloc(128), size: 128 };
        let raw = buf.data;
        let size = buf.size;

        // Disarm buf's destructor before passing to C API
        buf.forget();

        transfer_to_c_api(raw, size);
    } // buf dropped here, but data is NULL so no double free!
}
```

输出：
```text
=== Normal Drop ===
Drop: freeing 64 bytes

=== Disarming Drop with forget() ===
C API taking ownership of 128 bytes
Drop: buffer was forgotten, skipping deallocation
```

> [!TIP]
> 标准库类型如 `Vec<T>`、`String`、`Option<T>` 和 `Result<T>` 均提供了 `.forget()` 方法，以支持手动所有权转移和零开销资源交接。

---

## 第 4 章小结

在第 4 章中，你学习了 Zen C 的所有权与资源清理模型：
1. **移动语义**：赋值或传递资源会移动它，从而避免双重释放。`.clone()` 进行显式深拷贝，`Copy` 则让小型值类型选择隐式复制。
2. **指针作为借用**：传递 `T*`（使用 `&x`）可以将值借给函数，而不转移所有权。
3. **切片**：`Slice<T>` 是指向连续内存的非拥有视图。
4. **作用域清理**：`defer` 按后进先出（LIFO）顺序执行清理，包括针对堆指针的 `defer free(p)`。
5. **RAII 与析构函数**：`impl Drop for Struct` 在作用域结束时自动运行销毁逻辑。
6. **解除清理（`forget`）**：`.forget()` 分离资源，使其析构函数不会在所有权交接时运行。

在 **第 5 章** 中，我们将学习如何使用 **结构体与方法语法** 来组织复杂数据！
