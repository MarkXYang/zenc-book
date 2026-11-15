# 附录 H：迁移旧版 Zen C 代码

随着 Zen C 逐渐成熟并形成当前的设计，一些实验性关键字和语法形式被移除，以使该语言保持可预测性、透明度并忠实于 C11 语义。如果你正在更新旧的 Zen C 代码或早期预览版中的代码片段，请使用本指南将已弃用的结构转换为其现代等价形式。

---

## 1. `autofree` → 确定性 `defer` 或 `Drop`

早期的 Zen C 原型曾尝试使用 `autofree` 关键字实现自动堆内存释放。该关键字后来被移除，因为隐藏的释放操作模糊了所有权，并且与 C FFI 边界的交互体验不佳。

**旧版（已移除）：**

```zenc
autofree let buf = malloc(1024);
```

**现代 Zen C：**

```zenc
let buf = malloc(1024);
defer free(buf);
```

对于可复用的资源类型（文件、套接字、缓冲区），请在你的 `struct` 上实现 `Drop`，以便在值离开作用域时确定性地运行清理。

---

## 2. `async` / `await` → `std/thread.zc` 与工作线程池

早期草案曾规划了 `async` / `await` 协程语法。Zen C 有意移除了 `async`/`await`，转而推崇显式的操作系统线程（`std/thread.zc` 中的 `Thread::spawn`）、`Mutex`/`CondVar`（`std/sync.zc`）以及有界工作线程池——从而避免了隐藏的堆分配状态机、函数染色问题（function coloring）以及运行时调度器。

**旧版（已移除）：**

```zenc
async fn fetch_data() -> string { ... }
let res = await fetch_data();
```

**现代 Zen C：**

```zenc
import "std/thread.zc"

let handle = Thread::spawn(fn() {
    // Perform blocking I/O or computation on a real OS thread
}).unwrap();
handle.join();
```

对于处理大量客户端的并发服务器，请参阅[第 21 章](ch21-02-multithreaded.md)中的有界工作线程池架构。

---

## 3. 已移除的控制流关键字（`do-while`、`repeat`、`guard`、`unless`）

Zen C 剔除了冗余的控制流关键字，为表达每种循环或提前退出保留了唯一明显的方式：

| 已移除的语法 | 现代 Zen C 替代方案 |
| :--- | :--- |
| `do { body(); } while cond;` | `loop { body(); if !cond { break; } }` |
| `repeat 5 { work(); }` | `for i in 0..5 { work(); }` |
| `guard cond else { return; }` | `if !cond { return; }` |
| `unless cond { work(); }` | `if !cond { work(); }` |

---

## 4. 顶级常量（`const` → `def`）

较旧的代码片段有时使用 `const` 表示顶级编译期常量。在现代 Zen C 中，请使用 `def` 声明编译期常量：

**旧版：**

```zenc
const MAX_CLIENTS = 128;
```

**现代 Zen C：**

```zenc
def MAX_CLIENTS = 128;
```

---

## 5. 单元枚举变体（`None` → `None()`）

泛型或带负载枚举的单元变体使用圆括号构造：

**旧版：**

```zenc
let x = MyOption<int>::None;
```

**现代 Zen C：**

```zenc
let x = MyOption<int>::None();
```
