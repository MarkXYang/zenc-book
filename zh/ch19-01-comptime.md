# 编译期执行（`comptime`）

Zen C 包含一个由 `comptime { ... }` 块和 `@comptime` 函数触发的内置编译期求值器。无需手动计算常量或手写样板代码——也无需依赖脆弱的 C 预处理器宏——你可以编写普通的 Zen C 逻辑，在编译期间执行并将生成的代码直接注入到转译输出中。

## 顶级与局部 `comptime` 块

`comptime` 块既可以出现在文件的顶级（生成常量、类型或函数），也可以出现在函数体内部（生成局部语句）。在 `comptime` 块内部，你可以使用包含有效 Zen C 代码的字符串调用 `yield("...")`，将该代码拼接到程序中：

```zenc
// File: examples/ch19/ch19-01-comptime/main.zc

// 1. Top-level comptime block generating compile-time constants
comptime {
    yield("def COMPTIME_MAGIC = 1024;");
    yield("def COMPTIME_TAG = \"v1-gen\";");
}

// 2. @comptime function evaluated at compile time
@comptime
fn factorial(n: int) -> int {
    let acc = 1;
    let i = 2;
    while i <= n {
        acc = acc * i;
        i = i + 1;
    }
    return acc;
}

// 3. Compile-time invariant guard using compile_error(...)
comptime {
    let f5 = factorial(5);
    if f5 != 120 {
        compile_error("Compile-time factorial(5) invariant failed!");
    }
}

fn main() {
    println "Testing Compile-Time Execution (comptime)...";
    println "COMPTIME_MAGIC = {COMPTIME_MAGIC}, TAG = {COMPTIME_TAG}";
    assert(COMPTIME_MAGIC == 1024, "Expected COMPTIME_MAGIC == 1024");

    let fact5 = factorial(5);
    println "factorial(5) = {fact5}";
    assert(fact5 == 120, "factorial(5) must be 120");

    // 4. Local comptime block emitting statements into main()
    let generated_sum = 0;
    comptime {
        yield("generated_sum = 10 + 20 + 30;");
    }
    println "generated_sum = {generated_sum}";
    assert(generated_sum == 60, "generated_sum must be 60");

    println "All comptime checks passed!";
}
```

<span class="caption">代码清单 19-1：顶级 `comptime`、`@comptime` 函数、`compile_error` 与局部 `yield`</span>

运行命令：

```sh
zc run -q examples/ch19/ch19-01-comptime/main.zc
```

## `@comptime` 函数与 `compile_error`

为函数添加 `@comptime` 注解会将其标记为在编译期求值。在编写 `@comptime` 函数时，请注意两条重要规则：

1. **在 `@comptime` 函数内部优先使用迭代循环而非递归**。目前的编译期解释器为每次调用在扁平作用域中评估局部变量；编写迭代式的 `while` 或 `for` 循环（如上面的 `factorial` 所示）更加可靠且快速。
2. **使用 `compile_error("message")` 强制维护构建期不变式**。如果 `comptime` 块检测到无效配置或被破坏的数学不变式，调用 `compile_error(...)` 会在编译任何 C 代码之前以清晰的诊断消息立即终止编译。

> ### 🔍 窥探底层 C 代码
>
> 任何通过 `yield(...)` 输出的内容都会被解析为 Zen C，并在 C 编译器运行之前降级为标准 C 声明或语句。等到 `gcc` 或 `clang` 看到输出时，`COMPTIME_MAGIC` 已经是一个普通的编译期常量，而 `generated_sum = 10 + 20 + 30;` 也是一条纯正的 C 赋值语句——零运行时解释器开销。
