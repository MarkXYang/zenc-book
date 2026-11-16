# 函数

函数是 Zen C 中可执行代码的基本构建块。本节介绍函数语法、命名参数、只读参数以及默认参数。闭包、原始函数指针（`fn*`）以及 C 变长参数函数将在本书后面的章节中介绍。

---

## 定义函数与命名参数

函数使用 `fn` 关键字声明。参数使用 `name: Type` 注解，返回类型在箭头（`->`）之后指定。

```zenc
fn add(a: int, b: int) -> int {
    return a + b;
}
```

### 命名参数

调用函数时，你可以显式传递参数名以提高可读性：

```zenc
let sum = add(a: 10, b: 20);
```

> [!NOTE]
> **严格参数顺序**：命名参数必须严格遵循函数签名中定义的参数顺序。例如，`add(b: 20, a: 10)` 是无效的。

---

## const 参数

函数参数可以使用 `const` 类型限定修饰符标记，以在函数体内强制执行只读语义：

```zenc
fn print_val(v: const int) {
    // v = 10; // Error: Cannot assign to const variable
    println "{v}";
}
```

这在编译期保证了函数不会修改传入的实参值。

---

## 默认参数

函数可以为尾部参数定义默认值。默认值可以是字面量、在调用处求值的表达式，或是结构体构造等复杂初始化器：

**代码清单 3-4**
```zenc
// 1. Literal default value
fn increment(val: int, amount: int = 1) -> int {
    return val + amount;
}

// 2. Expression default value (evaluated at call site)
fn offset(val: int, pad: int = 10 * 2) -> int {
    return val + pad;
}

// 3. Struct default value
struct Config {
    debug: bool;
}

fn init_app(cfg: Config = Config { debug: true }) {
    if cfg.debug {
        println "Debug Mode Enabled";
    }
}

fn main() {
    println "{increment(10)}";  // Uses amount = 1 -> 11
    println "{offset(5)}";     // Uses pad = 20 -> 25
    init_app();               // Uses default Config struct -> Prints "Debug Mode Enabled"
}
```

输出：
```text
11
25
Debug Mode Enabled
```

---

## 本节小结

在本节中，你学到了：
- 如何使用带有参数和返回类型注解的 `fn` 定义函数。
- 如何在调用处传递命名参数以增强代码可读性。
- 如何使用 `const` 参数强制执行只读语义。
- 如何为尾部函数参数指定默认值。

> [!NOTE]
> - 匿名闭包（Lambda）和与 C 兼容的原始函数指针（`fn*`）将在[第 14 章：函数式特性](ch14-00-functional-features.md)中讨论。
> - 变长参数函数（`...` 与 `va_list`）将在[第 12 章：使用 C 语言库](ch12-00-using-c-libraries.md)中讨论。

接下来，让我们探索 Zen C 中的注释、打印与字符串插值！
