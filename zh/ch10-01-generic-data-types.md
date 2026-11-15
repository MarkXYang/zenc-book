# 泛型数据类型

我们使用**泛型**为函数签名、结构体和枚举等项创建定义，然后可以将它们与许多不同的具体数据类型一起使用。我们不再需要为 `int`、`f64` 和自定义结构体编写单独的实现，而是使用像 `<T>` 这样的占位符类型对定义进行参数化。

事实上，我们在前面的章节中已经使用过泛型类型：
- 第 6 章介绍了 `Option<T>` 和 `Result<T>`，它们包装了任意值类型 `T`。
- 第 8 章讲解了 `Vec<T>`、`Map<V>` 和 `Set<T>`，它们存储任意元素类型的集合。
- 第 9 章使用 `Result<T>` 在函数间传播可恢复错误。

在本节中，你将学习如何定义自己的泛型函数、结构体、枚举和方法，并了解 `zc` 如何以零运行时开销将它们编译为特化的 C11 代码。

---

## 1. 使用泛型函数消除重复

假设我们需要一个函数返回两个值中较大的一个，或者在内存中交换两个值。如果没有泛型，我们将不得不为每种类型编写单独的函数：

```zenc
fn max_int(a: int, b: int) -> int {
    return a > b ? a : b;
}

fn max_f64(a: f64, b: f64) -> f64 {
    return a > b ? a : b;
}
```

这两个函数的函数体完全相同；只有参数和返回类型不同。

### 定义泛型函数

要对函数进行类型参数化，请在函数名后紧跟尖括号（`<T>`）放置类型参数名：

**代码清单 10-1: `list10-1.zc`**

```zenc
fn max_val<T>(a: T, b: T) -> T {
    if a > b {
        return a;
    }
    return b;
}

fn swap_vals<T>(a: T*, b: T*) {
    let temp = *a;
    *a = *b;
    *b = temp;
}

fn main() {
    // 1. Type arguments inferred automatically from arguments:
    let m1 = max_val(10, 25);
    let m2 = max_val(3.14, 2.71);
    println "max int: {m1}, max f64: {m2}";

    // 2. Explicit type arguments can also be provided:
    let m3 = max_val<i64>(1000, 5000);
    println "max i64: {m3}";

    // 3. Generic pointer manipulation:
    let x = 100;
    let y = 200;
    swap_vals(&x, &y);
    println "after swap: x = {x}, y = {y}";
}
```

输出：
```text
max int: 25, max f64: 3.140000
max i64: 5000
after swap: x = 200, y = 100
```

我们将 `fn max_val<T>(a: T, b: T) -> T` 读作：*“函数 `max_val` 针对某种类型 `T` 是泛型的。它接受两个相同类型 `T` 的参数 `a` 和 `b`，并返回类型为 `T` 的值。”*

> [!TIP]
> **类型实参推断 vs. 显式 `<T>`**：
> 当类型参数 `T` 出现在函数的参数列表中时（如 `max_val(10, 25)` 或 `swap_vals(&x, &y)`），Zen C 会根据调用处的实参自动推断出 `T`。当泛型函数不接受任何参数时——例如 `std/mem.zc` 中的标准库分配器 `alloc<T>()`——你需要在尖括号中显式指定类型实参：`let ptr = alloc<int>();`。

---

## 2. 在结构体定义中

我们还可以在结构体名称后使用 `<T>` 语法，定义在一个或多个字段中使用泛型类型参数的结构体。

### 单类型参数

这是一个保存两个相同类型 `T` 值的泛型 `Pair<T>` 结构体：

```zenc
struct Pair<T> {
    first: T;
    second: T;
}
```

因为 `first` 和 `second` 的类型都是 `T`，所以实例化 `Pair<int>` 要求两个字段都是 `int`，而 `Pair<f64>` 要求两个字段都是 `f64`。

### 多类型参数

如果你希望字段保存不同的泛型类型，可以声明多个以逗号分隔的类型参数，例如 `<K, V>`：

**代码清单 10-2: `list10-2.zc`**

```zenc
struct Pair<T> {
    first: T;
    second: T;
}

struct KeyValue<K, V> {
    key: K;
    val: V;
}

fn main() {
    let coords = Pair<int> { first: 10, second: 20 };
    let weights = Pair<f64> { first: 1.5, second: 9.8 };

    let setting = KeyValue<string, int> {
        key: "max_connections",
        val: 512,
    };

    println "Coords: ({coords.first}, {coords.second})";
    println "Weights: ({weights.first}, {weights.second})";
    println "Setting: {setting.key} = {setting.val}";
}
```

输出：
```text
Coords: (10, 20)
Weights: (1.500000, 9.800000)
Setting: max_connections = 512
```

你可以在一个定义中使用最多 8 个泛型类型参数，但实际上使用超过两到三个通常表明该结构体可以拆分为更小、更专注的类型。

---

## 3. 在枚举定义中

正如我们在 `Option<T>` 和 `Result<T>` 中看到的那样，枚举也可以接受泛型类型参数以保存任意类型的有效载荷：

**代码清单 10-3: `list10-3.zc`**

```zenc
enum Maybe<T> {
    Just(T),
    Nothing,
}

fn main() {
    let a = Maybe<int>::Just(42);
    let b = Maybe<int>::Nothing();

    match a {
        Maybe::Just(v) => { println "a contains Just({v})"; },
        Maybe::Nothing => { println "a is Nothing"; },
    }

    match b {
        Maybe::Just(v) => { println "b contains Just({v})"; },
        Maybe::Nothing => { println "b is Nothing"; },
    }
}
```

输出：
```text
a contains Just(42)
b is Nothing
```

当 `Maybe<int>` 被实例化时，编译器会生成一个特化的带标签联合体（tagged union），其 `Just` 负载为一个 `int32_t`。

---

## 4. 在方法定义中（`impl` 块）

你可以在 `impl` 头部指定类型参数，从而在泛型结构体和枚举上实现方法。Zen C 同时支持 `impl Pair<T>` 和 `impl<T> Pair<T>` 语法：

**代码清单 10-4: `list10-4.zc`**

```zenc
struct Pair<T> {
    first: T;
    second: T;
}

impl Pair<T> {
    fn new(first: T, second: T) -> Pair<T> {
        return Pair<T> { first: first, second: second };
    }

    fn max_element(const self) -> T {
        if self.first > self.second {
            return self.first;
        }
        return self.second;
    }

    fn swap(self) {
        let tmp = self.first;
        self.first = self.second;
        self.second = tmp;
    }
}

fn main() {
    let p = Pair<int>::new(15, 42);
    println "Initial: ({p.first}, {p.second}), max = {p.max_element()}";

    p.swap();
    println "After swap: ({p.first}, {p.second})";
}
```

输出：
```text
Initial: (15, 42), max = 42
After swap: (42, 15)
```

### 非泛型结构体中的泛型方法

普通（非泛型）结构体也可以定义针对自身类型参数 `<T>` 泛型的独立方法。例如，内存 arena 或序列化器结构体本身可能是非泛型的，但提供一个泛型的 `alloc<T>(self) -> T*` 方法：

```zenc
struct LinearBuffer {
    used: usize;
}

impl LinearBuffer {
    fn record_size<T>(self) -> usize {
        let sz = sizeof(T);
        self.used += sz;
        return sz;
    }
}
```

---

## 5. 使用泛型的代码性能：单态化

你可能会好奇，与手写具体类型相比，使用 `<T>` 泛型参数是否会产生任何运行时开销。

好消息是：**Zen C 泛型拥有零运行时开销。**

Zen C 通过在编译期执行**单态化**（monomorphization）来实现这一点。*单态化*是指通过在每个调用点填入所使用的实际类型，将泛型模板转换为特化的具体 C11 定义的过程。

> [!TIP]
> ### 🔍 窥探底层 C 代码：单态化在底层是如何工作的
> 当你使用 `zc transpile` 编译**代码清单 10-1**和**代码清单 10-4**时，泛型 `Pair<T>` 和 `max_val<T>` 模板会完全消失。作为替代，`zc` 会生成特化的 C11 结构体和函数，其名称经过重整并带有具体的类型名称：
>
> ```c
> // Specialized struct generated for Pair<int>:
> struct Pair__int32_t {
>     int32_t first;
>     int32_t second;
> };
>
> // Specialized functions generated for max_val<int> and max_val<f64>:
> ZC_FUNC int32_t max_val__int32_t(int32_t a, int32_t b) {
>     if ((a > b)) {
>         return a;
>     }
>     return b;
> }
>
> ZC_FUNC double max_val__double(double a, double b) {
>     if ((a > b)) {
>         return a;
>     }
>     return b;
> }
>
> // Specialized methods generated for Pair<int>:
> ZC_FUNC Pair__int32_t Pair__int32_t__new(int32_t first, int32_t second) {
>     return (struct Pair__int32_t){.first = first, .second = second};
> }
> ```
>
> 而在 `main()` 中，每次泛型调用都会直接连线到其特化的 C 函数：
>
> ```c
> int32_t m1 = max_val__int32_t(10, 25);
> double m2 = max_val__double(3.14, 2.71);
> Pair__int32_t p = Pair__int32_t__new(15, 42);
> ```
>
> 没有 `void*` 转换，没有堆上的装箱（boxing），也没有间接函数指针。C 编译器（`gcc` 或 `clang`）看到的是普通的强类型 C 函数，可以在 `-O2`/`-O3` 下进行内联和向量化，就像你手工编写了每个特化版本一样！

---

## 小结

- **泛型函数（`fn name<T>`）**：在消除跨类型代码重复的同时，保留完整的编译期类型安全。
- **泛型结构体与枚举（`struct Name<T>`、`enum Name<T>`）**：允许像 `Pair<T>`、`KeyValue<K, V>`、`Option<T>` 和 `Vec<T>` 这样的数据容器直接内联保存任意类型，无需 `void*` 间接寻址。
- **泛型 `impl` 块（`impl Name<T>`）**：为泛型类型附加方法和关联构造函数。
- **零成本单态化**：`zc` 编译器在编译期为每个唯一实例化生成具体的 C11 类型和函数。

接下来，让我们探索如何使用 **Traits** 在不同类型间定义共享行为！
