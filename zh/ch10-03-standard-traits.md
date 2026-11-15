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

正如我们在[第 4 章](ch04-04-cleanup.md)中学到的，为结构体实现 `Drop` 会注册一个析构器，每当拥有所有权的实例离开作用域时，编译器都会自动调用该析构器：

```zenc
struct TempFile {
    path: string;
}

impl Drop for TempFile {
    fn drop(self) {
        println "[Drop] Removing temporary file: {self.path}";
    }
}
```

任何实现 `Drop`（或包含实现 `Drop` 的字段）的结构体都被视为具有**默认移动**（move-by-default）语义的**资源类型**，因此其析构器绝不会在同一分配上被调用两次。

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

**代码清单 10-8: `list10-8.zc`**

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

**代码清单 10-9: `list10-9.zc`**

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

## 4. 使用 `@derive(...)` 实现智能 Derive

为每个数据结构体手动编写 `Copy`、`Clone`、`eq`、`to_string` 以及 JSON 序列化实现可能非常繁琐。Zen C 提供了 **`@derive(...)`** 属性，以便在编译期自动生成这些实现。

### 支持的内置 Derive

| Derive 属性 | 生成的实现 | 说明 |
| :--- | :--- | :--- |
| **`@derive(Copy)`** | `impl Copy for T {}` | 将类型标记为可通过值隐式复制（禁用移动失效）。 |
| **`@derive(Clone)`** | `fn clone(self) -> T` | 生成返回结构体副本的 `.clone()` 方法。 |
| **`@derive(Eq)`** | `fn eq(self, other: T*) -> bool` | 生成逐字段结构相等性检查，启用 `a == b` 和 `a != b`。 |
| **`@derive(Debug)`** | `fn to_string(self) -> char*` | 生成用于字符串插值 `"{val}"` 的默认 `to_string` 格式化器。 |
| **`@derive(ToJson)`** | `fn to_json(self) -> JsonValue` | 自动将结构体字段序列化为 `std/json.zc` 的 `JsonValue` 对象。 |
| **`@derive(FromJson)`** | `fn from_json(j: JsonValue*) -> Result<T>` | 自动将 `JsonValue*` 反序列化为 `Result<T>`。 |

### 组合 `@derive(Copy, Clone, Eq, Debug)`

你可以在 `struct` 或 `enum` 上方的单个 `@derive(...)` 属性中组合多个 derive trait：

**代码清单 10-10: `list10-10.zc`**

```zenc
@derive(Copy, Clone, Eq, Debug)
struct Point {
    x: int;
    y: int;
}

fn main() {
    let p1 = Point { x: 10, y: 20 };
    let p2 = p1;         // Implicit copy via @derive(Copy)
    let p3 = p1.clone(); // Explicit clone via @derive(Clone)
    let p4 = Point { x: 99, y: 99 };

    // Structural equality via @derive(Eq):
    println "p1 == p2: {p1 == p2}";
    println "p1 == p3: {p1 == p3}";
    println "p1 == p4: {p1 == p4}";

    // String formatting via @derive(Debug):
    println "Debug output: {p1}";
}
```

输出：
```text
p1 == p2: true
p1 == p3: true
p1 == p4: false
Debug output: Point { ... }
```

### 使用 `@derive(ToJson, FromJson)` 自动进行 JSON 序列化

当使用 `std/json.zc` 构建 Web 服务、CLI 工具或配置加载器时，`@derive(ToJson, FromJson)` 消除了手动进行 JSON 字段映射的工作：

**代码清单 10-11: `list10-11.zc`**

```zenc
import "std/json.zc"

@derive(ToJson, FromJson)
struct ServerConfig {
    host: char*;
    port: int;
    tls: bool;
}

fn main() {
    let cfg = ServerConfig {
        host: "127.0.0.1",
        port: 8080,
        tls: true,
    };

    // Serialize struct -> JSON string:
    let json_val = cfg.to_json();
    let json_str = json_val.to_string();
    println "Serialized JSON: {json_str}";

    // Deserialize JSON string -> struct:
    let parsed = JsonValue::parse(json_str).unwrap();
    let restored = ServerConfig::from_json(parsed).unwrap();
    println "Restored: host={restored.host}, port={restored.port}, tls={restored.tls}";
}
```

输出：
```text
Serialized JSON: {"tls":true,"port":8080,"host":"127.0.0.1"}
Restored: host=127.0.0.1, port=8080, tls=true
```

---

## 小结

- **`Drop`、`Copy` 与 `Clone`**：控制确定性 RAII 析构、隐式按位复制和显式深拷贝。
- **`Iterator<T>` 与 `Iterable<T>`**：使自定义结构体能够在 `for item in collection` 循环中无缝工作。
- **`to_string(self) -> char*`**：将自定义结构体直接挂钩到 Zen C 的 `{expr}` 字符串插值中。
- **`@derive(...)`**：在编译期自动生成 `Copy`、`Clone`、`Eq`、`Debug`、`ToJson` 和 `FromJson` 实现。

接下来，让我们看看如何使用**运算符重载**使自定义类型更加富有表现力！
