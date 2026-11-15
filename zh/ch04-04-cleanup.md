# 自动清理与 Drop

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

**代码清单 4-1：`list4-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "Start";
 3 |
 4 |     defer println "Third (First deferred)";
 5 |     defer println "Second (Second deferred)";
 6 |     defer println "First (Last deferred)";
 7 |
 8 |     println "End";
 9 | }
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

**代码清单 4-2：`list4-2.zc`**

```zenc
 1 | struct CustomBuffer {
 2 |     data: void*;
 3 |     size: usize;
 4 | }
 5 |
 6 | impl Drop for CustomBuffer {
 7 |     fn drop(self) {
 8 |         println "Dropping CustomBuffer (releasing {self.size} bytes)";
 9 |         if self.data != 0 {
10 |             free(self.data);
11 |         }
12 |     }
13 | }
14 |
15 | fn create_and_use() {
16 |     let buf = CustomBuffer {
17 |         data: malloc(512),
18 |         size: 512,
19 |     };
20 |
21 |     // Use buf...
22 | } // buf goes out of scope here: CustomBuffer.drop(buf) is called automatically
23 |
24 | fn main() {
25 |     create_and_use();
26 | }
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

**代码清单 4-3：`list4-3.zc`**

```zenc
 1 | struct CustomBuffer {
 2 |     data: void*;
 3 |     size: usize;
 4 | }
 5 |
 6 | impl CustomBuffer {
 7 |     // Detaches the underlying resource, disarming Drop
 8 |     fn forget(self) {
 9 |         self.data = NULL;
10 |         self.size = 0;
11 |     }
12 | }
13 |
14 | impl Drop for CustomBuffer {
15 |     fn drop(self) {
16 |         if self.data != NULL {
17 |             println "Drop: freeing {self.size} bytes";
18 |             free(self.data);
19 |         } else {
20 |             println "Drop: buffer was forgotten, skipping deallocation";
21 |         }
22 |     }
23 | }
24 |
25 | fn transfer_to_c_api(raw_ptr: void*, size: usize) {
26 |     println "C API taking ownership of {size} bytes";
27 |     // Simulated C API freeing the buffer
28 |     free(raw_ptr);
29 | }
30 |
31 | fn main() {
32 |     println "=== Normal Drop ===";
33 |     {
34 |         let buf = CustomBuffer { data: malloc(64), size: 64 };
35 |     } // buf dropped here -> frees 64 bytes
36 |
37 |     println "\n=== Disarming Drop with forget() ===";
38 |     {
39 |         let buf = CustomBuffer { data: malloc(128), size: 128 };
40 |         let raw = buf.data;
41 |         let size = buf.size;
42 |
43 |         // Disarm buf's destructor before passing to C API
44 |         buf.forget();
45 |
46 |         transfer_to_c_api(raw, size);
47 |     } // buf dropped here, but data is NULL so no double free!
48 | }
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
> 标准库类型如 `Vec<T>`、`String`、`Option<T>` 和 `Result<T, E>` 均提供了 `.forget()` 方法，以支持手动所有权转移和零开销资源交接。

---

接下来，让我们探索**资源语义、默认移动与借用**！
