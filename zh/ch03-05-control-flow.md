# 控制流

根据条件、模式匹配或重复执行来控制程序执行流程是编程的根本基石。Zen C 提供了现代条件表达式、强大的 `match` 模式匹配、引用绑定、丰富的范围与枚举循环、带标签的循环控制以及提前返回保护子句。

---

## 条件语句

### 1. `if`、`else if` 和 `else`

标准条件分支通过测试布尔条件来执行分支：

**代码清单 3-8：`list3-8.zc`**

```zenc
 1 | let x = 15;
 2 |
 3 | if x > 10 {
 4 |     println "Large";
 5 | } else if x > 5 {
 6 |     println "Medium";
 7 | } else {
 8 |     println "Small";
 9 | }
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

**代码清单 3-9：`list3-9.zc`**

```zenc
 1 | let val = 12;
 2 |
 3 | match val {
 4 |     1         => { println "One"; },
 5 |     2 || 3    => { println "Two or Three"; },    // OR with ||
 6 |     4 or 5    => { println "Four or Five"; },    // OR with 'or'
 7 |     6, 7, 8   => { println "Six to Eight"; },    // OR with comma
 8 |     10 .. 15  => { println "10 to 14"; },        // Exclusive range
 9 |     10 ..< 15 => { println "10 to 14 (Explicit)"; }, // Exclusive range
10 |     20 ..= 25 => { println "20 to 25 (Inclusive)"; }, // Inclusive range
11 |     _         => { println "Other"; },           // Wildcard fallback
12 | }
```

输出：
```text
10 to 14
```

### 2. 解构枚举

`match` 可以直接解构带标签联合体枚举：

**代码清单 3-10：`list3-10.zc`**

```zenc
 1 | enum Shape {
 2 |     Circle(f64),
 3 |     Rect(f64, f64),
 4 |     Point,
 5 | }
 6 |
 7 | fn main() {
 8 |     let shape = Shape::Circle(5.0);
 9 |
10 |     match shape {
11 |         Shape::Circle(r)  => { println "Circle radius: {r}"; },
12 |         Shape::Rect(w, h) => { println "Rectangle area: {w * h}"; },
13 |         Shape::Point      => { println "Point"; },
14 |     }
15 | }
```

输出：
```text
Circle radius: 5.000000
```

---

## 引用绑定 (`ref`)

在对只支持移动语义（Move-only）的类型（例如 `Option`、`Result` 或非 Copy 结构体）进行模式匹配时，提取字段默认会移动所有权。在模式内部可以使用 `ref` 关键字通过引用来检查值，而不会消耗它：

**代码清单 3-11：`list3-11.zc`**

```zenc
 1 | import "std/option.zc";
 2 |
 3 | fn main() {
 4 |     let opt = Option<int>::Some(42);
 5 |
 6 |     match opt {
 7 |         Option::Some(ref n) => {
 8 |             // 'n' is a pointer/reference to the value inside 'opt'
 9 |             // 'opt' is NOT moved or destroyed here
10 |             println "Inspected value: {*n}";
11 |         },
12 |         Option::None => {},
13 |     }
14 | }
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

**代码清单 3-12：`list3-12.zc`**

```zenc
 1 | let arr: int[5] = [10, 20, 30, 40, 50];
 2 |
 3 | for val in arr {
 4 |     println "Element: {val}";
 5 | }
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

**代码清单 3-13：`list3-13.zc`**

```zenc
 1 | let arr: int[3] = [100, 200, 300];
 2 |
 3 | // i = 0, 1, 2; val = 100, 200, 300
 4 | for i, val in arr {
 5 |     println "arr[{i}] = {val}";
 6 | }
```

输出：
```text
arr[0] = 100
arr[1] = 200
arr[2] = 300
```

### 4. `while` 循环

Zen C 拥有唯一的条件循环 `while`。如果需要在测试条件之前至少执行一次循环体（即 C 语言中的 `do … while`），可以无条件循环并在底部使用 `break`：

**代码清单 3-14：`list3-14.zc`**

```zenc
 1 | // Standard while loop
 2 | let count = 3;
 3 | while count > 0 {
 4 |     println "Count: {count}";
 5 |     count--;
 6 | }
 7 |
 8 | // Run the body once before testing the condition
 9 | let x = 0;
10 | while true {
11 |     println "Executed at least once!";
12 |     x++;
13 |     if !(x < 0) {
14 |         break;
15 |     }
16 | }
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

**代码清单 3-15：`list3-15.zc`**

```zenc
 1 | fn process_ptr(ptr: void*) {
 2 |     if ptr == NULL {
 3 |         println "Null pointer provided! Exiting early.";
 4 |         return;
 5 |     }
 6 |
 7 |     println "Pointer is valid, proceeding with work...";
 8 | }
 9 |
10 | fn validate(is_valid: bool) {
11 |     if !is_valid {
12 |         println "State is invalid!";
13 |         return;
14 |     }
15 |
16 |     println "State is valid.";
17 | }
18 |
19 | fn main() {
20 |     process_ptr(NULL);
21 |     process_ptr((void*)1);
22 |     validate(false);
23 |     validate(true);
24 | }
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
- **函数与 Lambda**：命名参数、`const` 参数、默认参数、值捕获（`[=]`）与引用捕获（`[&]`）闭包、原始函数指针（`fn*`）以及变长参数函数（`...`、`va_list`）。
- **控制流**：条件语句、`match` 模式匹配、`ref` 绑定、范围循环、枚举迭代、带标签的循环以及提前返回保护子句。

在**第 4 章**中，我们将探索 Zen C 的内存管理模型：**Drop 与 RAII**！
