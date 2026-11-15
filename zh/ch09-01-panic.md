# 使用 panic 处理不可恢复错误

有时代码中会发生糟糕的情况，而你对此无能为力。在这些情况下，尝试继续执行可能会损坏内存、向磁盘写入无效数据或引入严重的安全漏洞。

Zen C 提供了 **`panic`** 函数用于处理不可恢复的错误。当 panic 发生时，程序会向标准错误（`stderr`）打印错误消息，显示诊断上下文，并以退出码 `1` 终止执行。

---

## Panic 何时发生

在 Zen C 中主要有两种方式触发 panic：
1. **显式触发**：当内部不变量被违背时，代码显式调用 `panic("reason")`。
2. **标准库不变量**：像 `Option<T>::unwrap()` 或 `Result<T>::unwrap()` 这样的方法在意外变体上调用时（例如解包 `None` 或 `Err`）会自动 panic。

---

## 显式触发 Panic

要显式中止程序，请传入解释字符串调用 `panic`：

**代码清单 9-1: `list9-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "Starting application initialization...";
 3 | 
 4 |     let critical_config_loaded = false;
 5 |     if !critical_config_loaded {
 6 |         panic("Configuration file missing or corrupted! Cannot continue.");
 7 |     }
 8 | 
 9 |     println "This line will never be reached.";
10 | }
```

使用 `zc run` 运行该程序：

```text
Starting application initialization...
Panic: Configuration file missing or corrupted! Cannot continue.
```

该消息清晰地指明了失败原因并立即终止进程，从而阻止第 9 行被执行。

---

## 错误打印简写（`!`）

Zen C 还提供了一种向标准错误（`stderr`）输出消息的简洁语法简写：在字符串字面量前加上前缀 `!`：

```zenc
!"Critical: invalid memory buffer state encountered\n";
```

该简写等价于调用 `eprintln`，在诊断工具中经常与提早退出配合使用。

---

> [!TIP]
> ### 🔍 窥探底层 C 代码：`panic` 在底层是如何工作的
> Zen C 没有 C++ 异常运行时，没有 RTTI，也没有多帧栈展开表。
> 当你调用 `panic(msg)` 时，`zc` 编译器会生成对核心运行时 panic 处理函数的直接调用：
>
> ```c
> ZC_FUNC void __zenc_panic_impl(const char* file, int32_t line, const char* func, const char* msg) {
>     fprintf(stderr, "Panic: %s\n", msg);
>     exit(1);
> }
> ```
>
> 因为它直接编译为 `exit(1)`，所以在正常的非 panic 执行路径中，panic 具有**零运行时开销**。

---

## 通过 `unwrap` 触发 Panic

当使用 `Option<T>` 或 `Result<T>`（我们将在下一节详细探讨）时，调用 `.unwrap()` 断言操作是成功的。如果值为 `None` 或 `Err`，`unwrap()` 会触发立即 panic：

```zenc
let opt = Option<int>::None();
let val = opt.unwrap(); // Panics with: "Panic: unwrap called on None"
```

虽然 `.unwrap()` 对于快速原型设计和自动化测试很方便，但生产系统通常应该更倾向于可恢复的错误处理。

接下来，让我们学习如何使用 `Result` 和 `Option` 处理可恢复错误！
