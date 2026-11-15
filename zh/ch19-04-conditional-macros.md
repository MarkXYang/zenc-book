# 条件编译与 C 宏

跨平台的系统级代码通常需要根据特性标志（feature flags）、构建模式或目标平台来选择不同的实现。Zen C 提供了用于结构化条件编译的 `@cfg(...)` 属性，并完全支持 C 预处理器指令（`#define`、`#ifdef`、`#endif`）。

## 使用 `//> define:` 与 `@cfg(...)` 管理特性标志

你可以使用 `//> define: FLAG_NAME` 直接在源文件中声明编译期特性标志（或向编译器传递 `-DFLAG_NAME` 参数），然后使用 `@cfg(FLAG_NAME)` 和 `@cfg(not(FLAG_NAME))` 对函数或类型进行条件编译。

因为 Zen C 会转译为 C，所以每当你需要 C 头文件兼容性或词法标记级（token-level）宏展开时，也可以随时使用标准 C 预处理器宏（`#define`、类函数宏以及 `#ifdef` 代码块）：

```zenc
// File: examples/ch19/ch19-04-conditional-macros/main.zc
//> define: ENABLE_METRICS

#define BUFFER_CAP 64
#define SQUARE(x) ((x) * (x))

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

    #ifdef ENABLE_METRICS
    println "Preprocessor #ifdef ENABLE_METRICS is active";
    #endif

    let cap = BUFFER_CAP;
    let sq = SQUARE(5);
    println "BUFFER_CAP = {cap}, SQUARE(5) = {sq}";
    assert(cap == 64, "BUFFER_CAP must be 64");
    assert(sq == 25, "SQUARE(5) must be 25");

    println "All conditional & macro checks passed!";
}
```

<span class="caption">代码清单 19-4：结合使用 `@cfg(...)` 条件函数与 `#define` 及 `#ifdef`</span>

## 在 `@cfg`、`comptime` 与 `#define` 之间进行选择

| 机制 | 最佳使用场景 | 核心优势 |
| :--- | :--- | :--- |
| `@cfg(...)` | 平台/特性函数变体 | 保持函数签名干净易读。 |
| `comptime` | 生成常量、重复代码、构建断言 | 拥有完整的 Zen C 语法和类型安全的编译期逻辑。 |
| `#define` / `#ifdef` | C 头文件互操作与简单常量/宏包装 | 与现有 C 语言库和头文件 100% 兼容。 |

> ### 🔍 窥探底层 C 代码
>
> `@cfg(FLAG)` 声明在 Zen C 的编译阶段就会被过滤——只有匹配的分支会被输出到生成的 `.c` 文件中。与此同时，`#define` 和 `#ifdef` 指令则会直接传递给 C 预处理器，因此 Zen C 的条件属性与标准 C 头文件能够无缝协同工作。

## 本章小结

Zen C 中的元编程忠实地贯彻了该语言的哲学：零隐藏运行时成本、直接降级为 C11，并与 C 工具链无缝互操作。现在，你已经掌握了如何使用 `comptime` 生成代码、使用 `@` 属性和 `@derive` 塑造布局与行为、使用 `embed` 嵌入静态资源，以及使用 `@cfg` 门控特性标志。
