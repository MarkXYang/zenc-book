# 泛型、Trait 与运算符重载

每种编程语言都需要工具来清晰地处理概念重复。在传统 C 语言中，编写跨多种类型工作的数据结构或算法——例如动态数组、排序例程或哈希表——迫使开发者做出痛苦的选择：

1. **复制粘贴函数（`max_int`、`max_float`、`max_double`）**：使代码库膨胀并充满重复的样板代码，维护起来极其繁琐。
2. **无类型的 `void*` 指针与 `sizeof` 算术**：牺牲编译期类型安全，强制引入堆间接寻址，并容易引发微妙的内存损坏 bug。
3. **预处理器 `##` 标记粘贴宏**：产生晦涩难懂的编译器错误信息，在调试器中几乎无法单步调试。

现代系统级语言使用**泛型**（generics）和 **traits** 解决了这一问题，而 Zen C 将这些高级抽象直接带到了 C11 中，且拥有**零运行时开销**。

---

## Zen C 的哲学：零成本多态

Zen C 提供了三种互补的机制来编写可复用且富有表现力的代码：

1. **泛型（`<T>`）——编译期单态化**：
   泛型函数（`fn swap<T>`）、结构体（`struct Pair<T>`）和枚举（`enum Option<T>`）允许你使用抽象类型参数只编写一次逻辑。在编译期，`zc` 编译器将每个泛型模板特化为具体、类型安全的 C11 函数和结构体（例如 `Pair__int32_t` 和 `Pair__double`）——完全匹配手写 C 的汇编性能。

2. **Traits（`trait` 与 `impl Trait for Type`）——共享行为与多态**：
   Traits 定义了多个类型可以实现的共享接口。Zen C 同时支持**静态分发**（直接在具体类型上调用方法，零开销）和**动态分发**（在需要运行时多态时传递带有自动虚方法表的 trait 对象），以及编译器生成的**智能 derive**（`@derive(Copy, Clone, Eq, Debug)`）。

3. **运算符重载——富有表现力的领域语法**：
   通过在 `impl` 块内部实现标准方法名称（`add`、`sub`、`eq`、`lt`、`get`、`set`），你的自定义数学、集合和系统类型可以使用自然的运算符（`v1 + v2`、`a == b`、`matrix[r, c] = val`），这些运算符会直接脱糖为普通的 C 函数调用。

---

## 本章路线图

在本章中，你将掌握：

1. **[Generic Data Types](ch10-01-generic-data-types.md)**：提取泛型函数、定义泛型结构体与枚举、实现泛型方法，以及探究单态化在生成的 C11 中如何工作。
2. **[Traits: Defining Shared Behavior](ch10-02-traits.md)**：声明 `trait` 接口、为自定义类型实现 trait、编写接受 trait 参数的函数，以及比较结构化泛型与 trait 多态。
3. **[Standard Traits and Smart Derives](ch10-03-standard-traits.md)**：精通 Zen C 的内置语言 trait（`Drop`、`Copy`、`Clone`、`Iterator<T>` / `Iterable<T>`、`to_string`），并使用 `@derive(Copy, Clone, Eq, Debug, ToJson, FromJson)` 消除样板代码。
4. **[Operator Overloading](ch10-04-operator-overloading.md)**：重载算术、比较、一元、位、复合赋值以及多维索引运算符（`[i, j]`）。

让我们从使用**泛型数据类型**消除代码重复开始吧！
