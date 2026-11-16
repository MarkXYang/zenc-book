# 条件编译与 C 宏

跨平台的系统级代码通常需要根据特性标志（feature flags）、构建模式或目标平台来选择不同的实现。Zen C 提供了用于结构化条件编译的 `@cfg(...)` 属性、用于编译期常量的 `def`，并可以直接使用 C 头文件中定义的宏。

## 使用 `//> define:` 与 `@cfg(...)` 管理特性标志

你可以使用 `//> define: FLAG_NAME` 直接在源文件中声明编译期特性标志（或向编译器传递 `-DFLAG_NAME` 参数），然后使用 `@cfg(FLAG_NAME)` 和 `@cfg(not(FLAG_NAME))` 对函数或类型进行条件编译。

对于常量，请使用 `def` 而不是 `#define`；对于小型辅助函数，请使用 `@inline` 函数而不是类函数宏。两者都会经过 Zen C 的类型检查。来自 C 头文件的宏（例如 `<limits.h>` 中的 `INT_MAX`）在 `include` 之后仍然可以直接使用：

```zenc
// File: examples/ch19/ch19-04-conditional-macros/main.zc
//> define: ENABLE_METRICS

include <limits.h>

def BUFFER_CAP = 64;

@inline
fn square(x: int) -> int {
    return x * x;
}

@cfg(ENABLE_METRICS)
fn report_mode() {
    println "Mode: Metrics ENABLED";
}

@cfg(not(ENABLE_METRICS))
fn report_mode() {
    println "Mode: Metrics DISABLED";
}

fn main() {
    println "Testing Conditional Compilation & C Macros...";
    report_mode();

    let cap = BUFFER_CAP;
    let sq = square(5);
    println "BUFFER_CAP = {cap}, square(5) = {sq}";
    assert(cap == 64, "BUFFER_CAP must be 64");
    assert(sq == 25, "square(5) must be 25");

    // INT_MAX is a macro defined by the C header <limits.h>
    let max: int = INT_MAX;
    println "INT_MAX = {max}";
    assert(max > 0, "INT_MAX must be positive");

    println "All conditional & macro checks passed!";
}
```

<span class="caption">代码清单 19-4：`@cfg(...)` 条件函数、`def` 常量以及来自 C 头文件的宏</span>

> [!WARNING]
> 在 Zen C 源码中直接编写 `#define` 或 `#include` 已被弃用：编译器会警告 `Preprocessor directive '#define' is deprecated. Use 'def' instead.`。请改用 `def`、`@inline` 函数、`@cfg` 以及 `include`/`import`。

## 在 `@cfg`、`comptime` 与 `def` 之间进行选择

| 机制 | 最佳使用场景 | 核心优势 |
| :--- | :--- | :--- |
| `@cfg(...)` | 平台/特性函数变体 | 保持函数签名干净易读。 |
| `comptime` | 生成常量、重复代码、构建断言 | 拥有完整的 Zen C 语法和类型安全的编译期逻辑。 |
| `def` | 具名的编译期常量 | 经过类型检查的 `#define` 常量替代品。 |
| C 头文件宏 | 现有 C 语言库定义的值与标志 | `include <header.h>` 后即可使用，无需封装。 |

> ### 🔍 窥探底层 C 代码
>
> `@cfg(FLAG)` 声明会被输出到 `#if defined(ZC_CFG_FLAG)` 保护块中，而 `//> define: FLAG` 会生成 `#define ZC_CFG_FLAG 1`，因此只有匹配的变体会被编译。`def` 常量会变成 `const` 全局变量，而 `include <limits.h>` 会在生成的文件中变成 `#include <limits.h>`，`INT_MAX` 正是通过这种方式进入你的代码的。

## 本章小结

Zen C 中的元编程忠实地贯彻了该语言的哲学：零隐藏运行时成本、直接降级为 C11，并与 C 工具链无缝互操作。现在，你已经掌握了如何使用 `comptime` 生成代码、使用 `@` 属性和 `@derive` 塑造布局与行为、使用 `embed` 嵌入静态资源，以及使用 `@cfg` 门控特性标志。
