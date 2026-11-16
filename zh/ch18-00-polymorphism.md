# 多态：组合与 Trait 对象

**多态（Polymorphism）**——编写能够通过统一接口操作多种不同类型的值的代码的能力——是软件架构中最根本的思想之一。

传统的面向对象语言（例如 C++、Java 和 C#）将多态与**类继承**直接绑定在一起：为了共享代码或满足接口规范，子类必须继承自基类（`class Button extends Widget`），在每个对象实例内部嵌入隐藏的虚函数表指针（`vptr`），并将子类型行为耦合到僵化的类层次结构中。

Zen C 将代码复用、编译期特化以及运行时动态分发分离为四个正交且毫无意外的机制：

| 机制 | 工作原理 | 运行时开销 | 最适用场景 |
| :--- | :--- | :--- | :--- |
| **结构体组合（`use` 混入）** | 嵌入字段并转发方法（`use Base;` 或 `use comp: Part;`） | **零开销**（对扁平结构体字段的直接 C 函数调用） | 在具体实体类型之间共享状态和方法，无需类继承层次结构（[18.1 节](ch18-01-oop-characteristics.md)）。 |
| **静态泛型（`<T>`）** | 为每个具体类型 `T` 单态化（Monomorphize）特化的 C 函数 | **零开销**（内联直接调用） | 类型在编译期已知的性能敏感型算法与容器（`Vec<T>`、`Map<V>`）（[第 10 章](ch10-01-generic-data-types.md)）。 |
| **带标签枚举（`enum` + `match`）** | 在单个带标签联合体中存储闭合的变体集合 | **1 次整数标签分支**（无堆分配或指针间接跳转） | 所有可能变体预先已知的封闭世界（Closed-world）和类型（[第 6 章](ch06-00-enums.md)）。 |
| **Trait 对象（`Trait`）** | 将 `{ void* self, Trait_VTable* vtable }` 打包为一个 16 字节的胖指针 | **1 次函数指针调用**（`vtable->method(self)`） | 开放世界（Open-world）异构集合（`Vec<Widget>`）、插件系统与运行时状态机（[18.2–18.4 节](ch18-02-trait-objects.md)）。 |

## 本章你将学到什么

1. **[18.1 Zen C 的面向对象特性](ch18-01-oop-characteristics.md)**：Zen C 如何应对经典 OOP 的核心支柱——通过方法（`impl`）组织数据，通过 `opaque struct` 强制维护不变式，并使用主 `use` 混入（mixin）与具名组件组合替代脆弱的基类继承。
2. **[18.2 用于动态分发的 Trait 对象](ch18-02-trait-objects.md)**：如何在单个 trait 对象的 `Vec<Widget>` 中存储异构结构体（`Button`、`ProgressBar`、`StatusLabel`），通过 trait 方法动态修改状态，并渲染开放式的组件树。
3. **[18.3 C11 底层虚表（Vtable）机制](ch18-03-vtables-in-c.md)**：`zc transpile` 如何生成 C11 `Trait_VTable` 结构体和 16 字节 `{ self, vtable }` 胖指针，为什么具体结构体**在每个实例上承担零 `vptr` 内存开销**，以及如何在运行时检查 trait 对象的原始指针。
4. **[18.4 实现面向对象设计模式](ch18-04-oop-patterns.md)**：使用 trait 对象实现经典的 GoF（四人帮）**状态模式**（`DraftState` $\rightarrow$ `PendingReviewState` $\rightarrow$ `PublishedState`），并将其与基于枚举的状态机进行对比。
