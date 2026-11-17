# 标准 Trait 与智能 Derive

除了用户定义的 trait 之外，Zen C 还包含一组**标准 trait** 和**编译器约定**，它们直接挂钩到语言的语法和内存模型中——为自动作用域清理（RAII）、移动与拷贝语义、`for .. in` 循环迭代、字符串插值以及相等性比较提供支持。

此外，为了避免你为常见操作编写重复的样板代码，Zen C 提供了 **`@derive(...)`** 属性，该属性在编译期自动生成 trait 和方法实现。

---

## 1. 核心资源与值 Trait（`Drop`、`Copy`、`Clone`）

定义在 `std/mem.zc` 中（并且每当你实现它们时由编译器自动导入），三个核心 trait 控制着 Zen C 如何管理类型的生命周期和赋值：

```zenc
trait Drop {
    fn drop(self);
}

trait Copy {}

trait Clone {
    fn clone(self) -> Self;
}
```

### 1. `Drop` —— 确定性作用域析构器（RAII）

`Drop` 是确定性清理的 trait 入口。实现了 `Drop`（或包含 `Drop` 字段）的类型会被当作资源拥有类型处理，并采用默认移动语义，以避免重复析构。

析构行为和 `.forget()` 的细节已在[第 4 章](ch04-04-cleanup.md)展开，提前返回路径上的清理行为已在[第 9 章](ch09-03-defer-cleanup.md)展开。

### 2. `Copy` —— 选择性值复制

标记 trait 没有方法（`trait Copy {}`）。实现 `Copy` 会告知编译器该类型是一个普通的栈值（例如 2D 坐标或 RGB 颜色），它不拥有堆资源，可以在赋值时（`let b = a;`）通过按位复制安全地复制，而不会使原始变量失效：

```zenc
struct Vec2 {
    x: f64;
    y: f64;
}

impl Copy for Vec2 {}
```

### 3. `Clone` —— 显式深拷贝

对于隐式复制代价高昂或不安全的资源拥有类型（例如 `Vec<T>` 或 `String`），实现 `Clone` 提供了常规的 `.clone()` 方法以创建显式、独立的副本：

```zenc
impl Clone for Vec2 {
    fn clone(self) -> Vec2 {
        return Vec2 { x: self.x, y: self.y };
    }
}
```

---

## 2. 迭代协议（`Iterator<T>` 与 `Iterable<T>`）

在 Zen C 中，任何自定义结构体都可以直接在 `for item in collection` 循环中使用！

定义在 `std/iter.zc` 中的迭代协议由两个 trait 组成：

```zenc
import "std/option.zc"

trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait Iterable<T> {
    fn iterator(self) -> Iterator<T>;
}
```

当编译器遇到 `for item in expr` 时，它会查找：
1. `expr` 上的 `.iterator(self)` 方法，该方法返回一个迭代器状态结构体。
2. 该迭代器结构体上的 `.next(self) -> Option<T>` 方法，该方法为每个元素返回 `Option<T>::Some(val)`，并在迭代完成时返回 `Option<T>::None()`。

让我们构建一个自定义的 `Countdown` 迭代器，使其原生支持 Zen C 的 `for .. in` 循环：

**代码清单 10-8**
```zenc
import "std/option.zc"

struct Countdown {
    current: int;
}

impl Countdown {
    fn new(start: int) -> Countdown {
        return Countdown { current: start };
    }

    // Yields the next countdown value, or None when finished:
    fn next(self) -> Option<int> {
        if self.current > 0 {
            let val = self.current;
            self.current -= 1;
            return Option<int>::Some(val);
        }
        return Option<int>::None();
    }

    // Returns the iterator for `for .. in` loops:
    fn iterator(self) -> Countdown {
        return self;
    }
}

fn main() {
    println "Initiating launch sequence:";

    let timer = Countdown::new(3);
    for n in timer {
        println "  T-minus {n}...";
    }

    println "Liftoff!";
}
```

输出：
```text
Initiating launch sequence:
  T-minus 3...
  T-minus 2...
  T-minus 1...
Liftoff!
```

> [!TIP]
> ### 🔍 窥探底层 C 代码：`for .. in` 在底层是如何脱糖的
> 当你使用 `zc transpile` 转译**代码清单 10-8** 时，`for n in timer` 循环会被编译为一个紧凑的、零分配的 C `for` 循环，调用 `Countdown__iterator` 和 `Countdown__next`：
>
> ```c
> Countdown __it = Countdown__iterator(&timer);
> for (; 1; ) {
>     Option__int32_t __opt = Countdown__next(&__it);
>     if (Option__int32_t__is_none(&__opt)) {
>         break;
>     }
>     int32_t n = Option__int32_t__unwrap(&__opt);
>     {
>         fprintf(stdout, "  T-minus %d...\n", n);
>     }
> }
> ```
>
> 因为 `Option__int32_t` 是一个栈值结构体（`{ bool is_some; int32_t val; }`），C 优化器会将整个循环内联为一个简单的寄存器递减操作！

---

## 3. 自定义字符串格式化（`to_string`）

Zen C 的字符串插值（`println "Value: {x}"`）开箱即用地支持所有原生类型。如果你想在 `{...}` 内部直接插值自定义结构体该怎么办？

只需在结构体上实现 `fn to_string(self) -> char*` 即可！每当编译器在字符串插值表达式中看到结构体实例时，它都会自动调用 `.to_string()`：

**代码清单 10-9**
```zenc
struct Color {
    r: int;
    g: int;
    b: int;
}

impl Color {
    fn to_string(self) -> char* {
        let s = "rgb({self.r}, {self.g}, {self.b})";
        return s;
    }
}

fn main() {
    let primary = Color { r: 255, g: 128, b: 0 };
    println "Selected theme color: {primary}";
}
```

输出：
```text
Selected theme color: rgb(255, 128, 0)
```

---

## 4. Derive 回顾（`@derive(...)`）

`@derive(...)` 可以减少大量重复 trait 样板。常见组合包括 `Copy`、`Clone`、`Eq` 和 `Debug`：

**代码清单 10-10**
```zenc
@derive(Copy, Clone, Eq, Debug)
struct Point {
    x: int;
    y: int;
}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = p1;
    let p3 = p1.clone();

    println "p1 == p2: {p1 == p2}";
    println "p1 == p3: {p1 == p3}";
    println "Debug output: {p1}";
}
```

关于完整 derive 列表（`ToJson`、`FromJson`）以及与 `@packed`、`@align`、`@inline`、`@constructor` 等属性的组合，请见[第 19.2 节](ch19-02-attributes-derives.md)。

---

## 小结

- **`Drop`、`Copy` 与 `Clone`**：控制确定性 RAII 析构、隐式按位复制和显式深拷贝。
- **`Iterator<T>` 与 `Iterable<T>`**：使自定义结构体能够在 `for item in collection` 循环中无缝工作。
- **`to_string(self) -> char*`**：将自定义结构体直接挂钩到 Zen C 的 `{expr}` 字符串插值中。
- **`@derive(...)`**：减少重复 trait 样板；完整的 derive 与属性工具箱见第 19.2 节。

接下来，让我们看看如何使用**运算符重载**使自定义类型更加富有表现力！
