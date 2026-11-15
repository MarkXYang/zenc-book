# 附录 G：编译器诊断与错误排查指南

Zen C 输出带有跨度高亮（span-highlighted）和上下文 `help:` 提示的结构化诊断信息。传入 `--json` 可以输出供编辑器和 CI 脚本使用的机器可读 JSON 诊断。

## Zen C 诊断信息解剖

```text
error: Unknown trait 'PartialEq' in @derive
  --> examples/ch19/ch19-02-attributes-derives/main.zc:3:16
   |
3  | @derive(Debug, PartialEq, Copy)
   |                ^ here
   |
   = help: Derivable traits: Clone, Copy, Debug, Eq, FromJson, ToJson
```

## 常见错误与排查方法

### 1. 已弃用的语言语法

如果你从较旧的原型或教程中复制代码，`zc` 会直接指出已移除的语法结构：

- **`async` / `await` 已移除**：替换为 `std/thread.zc` 线程或同步/回调模式（参见附录 H）。
- **`autofree` 已移除**：替换为显式的 `defer free(ptr);` 或 RAII 清理。
- **`do { ... } while`、`repeat`、`guard`、`unless` 已移除**：使用 `loop { ... if !cond { break; } }`、`while` 或 `if !cond { return; }`。

### 2. 条件内部赋值（`warn_assign_cond`）

```text
warning: Assignment in condition; did you mean '=='?
```

当在 `if` 或 `while` 条件内部使用 `=` 且很可能是想使用 `==` 时，Zen C 会发出警告。

### 3. 单元枚举变体调用

在 Zen C 中，单元（无数据负载）枚举变体通过圆括号调用，例如 `MyOption<int>::None()` 而非 `MyOption<int>::None`。如果省略 `()`，编译器会报告类型/表达式不匹配。

### 4. 未知的 `@derive` Trait

只有 `Clone`、`Copy`、`Debug`、`Eq`、`FromJson` 和 `ToJson` 是内置的可派生 Trait。请使用 `Eq` 代替 `PartialEq`。

### 5. `embed` 文件未找到（`error: 404: <path>`）

`embed` 解析路径是相对于调用 `zc` 的工作目录。请传入相对于项目根目录的路径（或从包含资产的目录运行构建）。

### 6. FFI / 标准库调用中缺少 C 头文件

当直接调用 C 标准库函数（例如 `time(NULL)` 或 `srand(...)`）时，确保在文件顶部包含了相应的 C 头文件（`include <time.h>`），以便 C 编译器获得完整的函数原型。

### 7. 在 `comptime` 中使用自定义诊断

你可以通过 `comptime` 块中使用 `compile_error("message")` 输出自定义的编译期错误，以便尽早捕获无效的构建配置。
