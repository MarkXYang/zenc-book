# 控制流

根据条件、模式匹配或重复执行来控制程序执行流程是编程的根本基石。Zen C 提供了现代条件表达式、强大的 `match` 模式匹配、引用绑定、丰富的范围与枚举循环、带标签的循环控制以及提前返回保护子句。

---

## 条件语句

### 1. `if`、`else if` 和 `else`

标准条件分支通过测试布尔条件来执行分支：

**代码清单 3-10**
```zenc
let x = 15;

if x > 10 {
    println "Large";
} else if x > 5 {
    println "Medium";
} else {
    println "Small";
}
```

输出：
```text
Large
```

### 2. 三元运算符

对于简洁的行内条件选择，Zen C 支持标准三元运算符：

```zenc
let y = x > 10 ? 1 : 0;
```

### 3. `if` 表达式

Zen C 中的 `if` 块可以作为求值的表达式使用：

```zenc
let category = if (x > 100) { "huge" } else if (x > 10) { "large" } else { "small" };
```

---

## 模式匹配 (`match`)

Zen C 通过 `match` 提供了模式匹配功能，为 C 语言传统的 `switch` 语句提供了一种安全且表达式驱动的现代替代方案。

### 1. 值与范围匹配

`match` 分支可以匹配单个字面量、多个“或”条件（`||`、`or`、`,`）或是数值范围：

**代码清单 3-11**
```zenc
let val = 12;

match val {
    1         => { println "One"; },
    2 || 3    => { println "Two or Three"; },    // OR with ||
    4 or 5    => { println "Four or Five"; },    // OR with 'or'
    6, 7, 8   => { println "Six to Eight"; },    // OR with comma
    10 .. 15  => { println "10 to 14"; },        // Exclusive range
    10 ..< 15 => { println "10 to 14 (Explicit)"; }, // Exclusive range
    20 ..= 25 => { println "20 to 25 (Inclusive)"; }, // Inclusive range
    _         => { println "Other"; },           // Wildcard fallback
}
```

输出：
```text
10 to 14
```

### 2. 解构枚举

`match` 可以直接解构带标签联合体枚举：

**代码清单 3-12**
```zenc
enum Shape {
    Circle(f64),
    Rect(f64, f64),
    Point,
}

fn main() {
    let shape = Shape::Circle(5.0);

    match shape {
        Shape::Circle(r)  => { println "Circle radius: {r}"; },
        Shape::Rect(w, h) => { println "Rectangle area: {w * h}"; },
        Shape::Point      => { println "Point"; },
    }
}
```

输出：
```text
Circle radius: 5.000000
```

---

## 引用绑定 (`ref`)

在对只支持移动语义（Move-only）的类型（例如 `Option`、`Result` 或非 Copy 结构体）进行模式匹配时，提取字段默认会移动所有权。在模式内部可以使用 `ref` 关键字通过引用来检查值，而不会消耗它：

**代码清单 3-13**
```zenc
import "std/option.zc";

fn main() {
    let opt = Option<int>::Some(42);

    match opt {
        Option::Some(ref n) => {
            // 'n' is a pointer/reference to the value inside 'opt'
            // 'opt' is NOT moved or destroyed here
            println "Inspected value: {*n}";
        },
        Option::None => {},
    }
}
```

输出：
```text
Inspected value: 42
```

---

## 循环与迭代

Zen C 提供了丰富的循环构造：范围循环、数组/集合循环、枚举循环、`while` 以及带标签的无限 `loop` 块。

### 1. 范围循环 (`for ..`)

遍历具有可选步长的数值范围：

```zenc
// Exclusive range: 0 to 9
for i in 0..10 {
    println "{i}";
}

// Explicit exclusive range (0 to 9)
for i in 0..<10 {
    println "{i}";
}

// Inclusive range: 0 to 10
for i in 0..=10 {
    println "{i}";
}

// Custom step size
for i in 0..10 step 2 {
    println "Step 2: {i}"; // 0, 2, 4, 6, 8
}

// Descending loop
for i in 10..0 step -1 {
    println "Countdown: {i}";
}

// Repeat N times (ignoring counter)
for _ in 0..5 {
    println "Repeating...";
}
```

### 2. 数组与集合迭代

直接遍历固定大小数组或标准集合的元素：

**代码清单 3-14**
```zenc
let arr: int[5] = [10, 20, 30, 40, 50];

for val in arr {
    println "Element: {val}";
}
```

输出：
```text
Element: 10
Element: 20
Element: 30
Element: 40
Element: 50
```

### 3. 枚举循环 (`index, value`)

同时获取当前索引和元素值：

**代码清单 3-15**
```zenc
let arr: int[3] = [100, 200, 300];

// i = 0, 1, 2; val = 100, 200, 300
for i, val in arr {
    println "arr[{i}] = {val}";
}
```

输出：
```text
arr[0] = 100
arr[1] = 200
arr[2] = 300
```

### 4. `while` 循环

Zen C 拥有唯一的条件循环 `while`。如果需要在测试条件之前至少执行一次循环体（即 C 语言中的 `do … while`），可以无条件循环并在底部使用 `break`：

**代码清单 3-16**
```zenc
// Standard while loop
let count = 3;
while count > 0 {
    println "Count: {count}";
    count--;
}

// Run the body once before testing the condition
let x = 0;
while true {
    println "Executed at least once!";
    x++;
    if !(x < 0) {
        break;
    }
}
```

> **注意：** Zen C 的早期版本曾有 `do { … } while cond;` 循环。该语法已被移除；编译器现在会报告 `'do ... while' was removed; use 'while'`。

输出：
```text
Count: 3
Count: 2
Count: 1
Executed at least once!
```

### 5. 带标签的无限循环 `loop`

使用 `loop` 创建的无限循环可以赋予标签，以便 `break` 或 `continue` 可以针对特定的嵌套外层循环：

```zenc
let done = false;

outer: loop {
    loop {
        if done {
            break outer; // Breaks out of the outer loop directly
        }
        done = true;
    }
}
```

---

## 提前返回（保护子句）

一种常见的编程模式是在函数顶部检查非法输入并立即退出，从而使函数体的其余部分可以放心地假定输入有效。在 Zen C 中，你可以使用普通的 `if` 编写这些保护子句，并在需要时用 `!` 取反条件：

**代码清单 3-17**
```zenc
fn process_ptr(ptr: void*) {
    if ptr == NULL {
        println "Null pointer provided! Exiting early.";
        return;
    }

    println "Pointer is valid, proceeding with work...";
}

fn validate(is_valid: bool) {
    if !is_valid {
        println "State is invalid!";
        return;
    }

    println "State is valid.";
}

fn main() {
    process_ptr(NULL);
    process_ptr((void*)1);
    validate(false);
    validate(true);
}
```

输出：
```text
Null pointer provided! Exiting early.
Pointer is valid, proceeding with work...
State is invalid!
State is valid.
```

---

## 第 3 章总结

在第 3 章中，你掌握了 Zen C 的核心语言概念：
- **变量与常量**：编译期 `def`、类型推导的 `let` 以及只读 `const`。
- **数据类型**：标量类型（`i8`..`i128`、`u8`..`u128`、`usize`、`f32`、`f64`、`bool`、`char`、`rune`、`string`）、C 互操作类型、任意位宽整数（`iN`/`uN`）、数值字面量特性以及固定大小数组（`T[N]`）。
- **函数**：命名参数、`const` 参数以及默认参数。
- **注释、打印与插值**：`//` 与 `///` 注释、`print`/`println`/`eprint`/`eprintln`、`{}` 插值、原始字符串与多行字符串，以及输入提示。
- **控制流**：条件语句、`match` 模式匹配、`ref` 绑定、范围循环、枚举迭代、带标签的循环以及提前返回保护子句。

在**第 4 章**中，我们将了解 Zen C 如何处理所有权、指针与资源清理。
