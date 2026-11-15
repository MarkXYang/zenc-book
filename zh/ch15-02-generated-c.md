# 15.2 检查生成的 C 代码与名称修饰

作为一门系统级编程语言，Zen C 最大的优势之一在于其产生的中间表示是**人类可读的 GNU C11**。每当你想要验证高级特性如何降级（lower）为 C、诊断链接器错误、在 `gdb` 或 `lldb` 中设置断点，或者从现有的 C/C++ 项目中调用 Zen C 函数时，都可以直接检查生成的 C 代码。

---

## 1. 使用 `zc transpile` 与 `--emit-c` 发射 C 代码

Zen C 为你提供了两种检查生成 C 代码的方法：

1. **仅转译（`zc transpile`）**：生成 `.c` 文件后停止，而不调用 C 编译器：
   ```console
   $ zc transpile main.zc -o main.c
   ```
2. **构建并保留（`--emit-c`）**：正常编译可执行文件，*并且*在二进制文件旁保留生成的 `.c` 文件：
   ```console
   $ zc build main.zc --emit-c -o app
   $ ls app*
   app  app.c
   ```

> [!TIP]
> 默认情况下，`zc` 会在生成的 C 代码中包含 `#line` 预处理器指令，以便调试器和编译器诊断信息能够指回你的 `.zc` 行号。当你想要阅读没有 `#line` 干扰的清爽 C 代码时，可以传入 `-g0`：
> ```console
> $ zc transpile -g0 main.zc -o main_clean.c
> ```

---

## 2. 生成 C 文件的剖析

当你打开由 `zc transpile` 生成的 `.c` 文件时，它自顶向下由四个可预测的部分组成：

1. **标准 C 头文件与运行时前导**：`#include <stdio.h>`、`<stdint.h>`、`<stdbool.h>`、C11 `_Generic` 格式化辅助项（`_z_str`、`_z_arg`）、闭包胖指针类型（`z_closure_T`）以及边界检查辅助项。
2. **前向结构体与虚表声明**：针对你的结构体、单态化泛型结构体和 trait 胖指针（`{ void *self; Trait_VTable *vtable; }`）的 `typedef struct ...` 声明。
3. **函数原型与全局 Drop 分派**：针对所有函数和方法的前向 `ZC_FUNC` 原型，加上 `_z_drop(x)` 宏分派表。
4. **函数与方法实现**：你的函数、方法和 `main` 转译出的实现主体。

---

## 3. Zen C 符号修饰规则

因为 C 语言只有一个平坦的全局命名空间，不支持重载、命名空间或类型参数，所以 `zc` 将 Zen C 的方法、trait、模块和泛型映射为由双下划线（`__`）分隔的唯一 C 标识符。

名称修饰（mangling）规则旨在确保在调试器中**可读**并且具备**单射性**（两个不同的 Zen C 声明永远不会冲突）：

| Zen C 构造 | 声明 | 发射的 C 符号 |
| :--- | :--- | :--- |
| **全局函数** | `fn zc_area_sum(a: f64, b: f64) -> f64` | `zc_area_sum` *(未修饰！)* |
| **模块函数** | `math` 中的 `fn sqrt(x: f64) -> f64` | `math__sqrt` |
| **结构体方法 / 关联函数** | `impl Square { fn new(side: f64) -> Square }` | `Square__new` |
| **以下划线开头的方法** | `impl Square { fn _grow(self, k: f64) -> Square }` | `Square___grow` *(3 个下划线)* |
| **Trait 实现** | `impl Shape for Square { fn area(self) -> f64 }` | `Square__Shape__area` |
| **泛型结构体** | `struct Boxed<T>` 实例化为 `Boxed<int>` | `struct Boxed__int32_t` |
| **泛型结构体方法** | `Boxed<int>::get(self)` | `Boxed__int32_t__get` |
| **泛型函数** | `fn largest<T>(a: T, b: T) -> T` | `largest__int32_t`, `largest__double` |
| **`extern fn` / `@link("...")`** | `extern fn qsort(...)` | `qsort` *(逐字原样)* |

### 为什么保留三个下划线（`___`）

注意上表中的 `Square___grow`。为什么它有**三个**下划线？

- `Struct` 和 `Method` 片段之间由 `__`（两个下划线）连接。
- 当方法名称本身以前导下划线开头（`_grow`）时，连接 `Square` + `__` + `_grow` 会产生 `Square___grow`（三个下划线）。
- Zen C 的符号规范化器会将连续 **4 个或更多**的下划线折叠为 2 个（`____` $\rightarrow$ `__`），但有意**保留连续 3 个下划线**（`___`），从而使得 `fn _grow(self)`（`Square___grow`）永远不会与 `fn grow(self)`（`Square__grow`）发生符号冲突。

---

## 4. 深入剖析：检查 `shapes.c` 中的符号

让我们观察每条名称修饰规则的实际效果。示例 15-2 定义了一个 trait（`Shape`）、一个带有 `scale` 和 `_grow` 方法的具体结构体（`Square`）、一个泛型结构体（`Boxed<T>`）、一个泛型函数（`largest<T>`）以及一个顶层函数（`zc_area_sum`）：

**示例 15-2: `list15-2.zc` —— 结构体、trait、泛型与 C 符号修饰**

```zenc
// File: examples/ch15/ch15-02-generated-c/main.zc
//
// Transpile this file and inspect the C symbols that zc emits:
//   zc transpile examples/ch15/ch15-02-generated-c/main.zc -o shapes.c

/// Shared behavior for anything with an area.
trait Shape {
    fn area(self) -> f64;
}

/// A square with a side length.
struct Square {
    side: f64;
}

/// A generic box holding a single value.
struct Boxed<T> {
    value: T;
}

impl Boxed<T> {
    fn get(self) -> T {
        return self.value;
    }
}

impl Square {
    // Associated function (no `self`)   -> Square__new
    fn new(side: f64) -> Square {
        return Square { side: side };
    }

    // Leading underscore is preserved   -> Square___grow (three underscores)
    fn _grow(self, k: f64) -> Square {
        return Square { side: self.side * k };
    }

    // Regular method                    -> Square__scale
    fn scale(self, k: f64) -> Square {
        return self._grow(k);
    }
}

// Trait implementation                  -> Square__Shape__area
impl Shape for Square {
    fn area(self) -> f64 {
        return self.side * self.side;
    }
}

// Generic function, monomorphized       -> largest__int32_t, largest__double
fn largest<T>(a: T, b: T) -> T {
    if a > b { return a; }
    return b;
}

// Plain global function: not mangled, callable from C as `zc_area_sum`.
fn zc_area_sum(a: f64, b: f64) -> f64 {
    return a + b;
}

fn main() {
    let s = Square::new(2.0);
    let big = s.scale(3.0);
    println "small area = {s.area()}";
    println "big area   = {big.area()}";
    println "sum        = {zc_area_sum(s.area(), big.area())}";

    let bi = Boxed<int> { value: 42 };
    println "boxed      = {bi.get()}";
    println "largest    = {largest<int>(7, 3)} / {largest<f64>(1.5, 2.5)}";
}
```

使用 `-g0` 转译并在 `shapes.c` 中检查生成的声明：

```console
$ zc transpile -q -g0 examples/ch15/ch15-02-generated-c/main.zc -o shapes.c
```

以下是 `shapes.c` 的核心代码摘录：

```c
typedef struct Boxed__int32_t Boxed__int32_t;
typedef struct Square Square;

typedef struct Shape_VTable {
    double (*area)(void* self);
} Shape_VTable;
typedef struct Shape { void *self; Shape_VTable *vtable; } Shape;

struct Boxed__int32_t {
    int32_t value;
};

struct Square {
    double side;
};

ZC_FUNC double largest__double(double a, double b);
ZC_FUNC int32_t largest__int32_t(int32_t a, int32_t b);
ZC_FUNC int32_t Boxed__int32_t__get(Boxed__int32_t* self);
ZC_FUNC int main(void);
ZC_FUNC double zc_area_sum(double a, double b);
ZC_FUNC double Square__Shape__area(Square* self);
ZC_FUNC Square Square__new(double side);
ZC_FUNC Square Square___grow(Square* self, double k);
ZC_FUNC Square Square__scale(Square* self, double k);
Shape_VTable Square__Shape__VTable = {
    .area = (__typeof__(((Shape_VTable*)0)->area))Square__Shape__area
};
```

如果我们编译该二进制文件并使用 `nm` 检查其符号表，我们在 ELF 二进制文件中会看到完全相同的名称：

```console
$ zc build -q examples/ch15/ch15-02-generated-c/main.zc -o shapes
$ nm shapes | grep -E " T (Square|Boxed|largest|zc_area)"
0000000000001b36 T Boxed__int32_t__get
0000000000001e62 T Square__Shape__area
0000000000001e98 T Square___grow
0000000000001e84 T Square__new
0000000000001eb8 T Square__scale
0000000000001aea T largest__double
0000000000001b16 T largest__int32_t
0000000000001e44 T zc_area_sum
```

---

## 5. 从 C 中调用 Zen C 函数（`-shared` 与 `zc transpile`）

因为顶层 Zen C 函数**不进行名称修饰**（并且结构体方法遵循确定性的 `Struct__method` 命名规则），所以你可以将 Zen C 模块编译为共享库（`.so` / `.dylib` / `.dll`）或 `.c` 文件，并直接从 C 语言中调用它们：

```console
$ zc build -shared mathlib.zc -o libzmath.so
$ gcc caller.c -L. -lzmath -Wl,-rpath,. -o caller
$ ./caller
```

---

## 6. 其他输出后端（`--backend`）

虽然 GNU C11（`--backend c`）是默认后端，但 `zc transpile` 和 `zc build` 通过 `--backend` 还支持若干额外的代码生成与检查后端：

| 后端 | 标志 / 简写 | 输出扩展名 | 用途 |
| :--- | :--- | :---: | :--- |
| **C11** | `--backend c` *(默认)* | `.c` | 标准 GNU C11 输出 |
| **C++** | `--backend cpp` (`--cpp`) | `.cpp` | 兼容 C++11 的代码（`auto`、显式 `void*` 转换），用于链接 C++ 库 |
| **CUDA** | `--backend cuda` (`--cuda`) | `.cu` | NVIDIA CUDA C++ 内核（`@global`、`@device`、`launch ... with { grid, block }`） |
| **Objective-C** | `--backend objc` (`--objc`) | `.m` | 适用于 macOS/GNUStep 框架的 Objective-C 输出 |
| **AST 转储** | `--backend ast-dump` | `.ast` | 经过解析与类型检查的 AST 的人类可读树形视图 |
| **JSON AST** | `--backend json` (`--json-pretty`) | `.json` | 面向外部 linter 和静态分析工具的机器可读 AST |
| **Graphviz** | `--backend dot` | `.dot` | 可视化 AST 图形（`dot -Tpng out.dot -o ast.png`） |
| **Common Lisp** | `--backend lisp` | `.lisp` | S 表达式转译（`sbcl --script`） |

例如，要在终端中检查示例 15-2 经过类型检查的 AST：

```console
$ zc transpile -q examples/ch15/ch15-02-generated-c/main.zc --backend ast-dump -o shapes.ast
$ head -n 14 shapes.ast
 ROOT
    ├──  TRAIT 'Shape' [7:7]
    │   └──  FUNCTION 'area' [8:8]
    ├──  STRUCT 'Square' :Square [12:8]
    │   └──  FIELD 'side' :double
    ├──  STRUCT 'Boxed' :Boxed [17:8]
    │   └──  FIELD 'value' :T
    ├──  IMPL 'Boxed'
    │   ├──  FUNCTION 'Boxed__get' [22:8]
```

---

## 小结

- 使用 `zc transpile file.zc -o file.c`（或 `zc build --emit-c`）检查 Zen C 生成的 C11 代码，添加 `-g0` 可去除 `#line` 指令。
- 顶层函数在 C 中保留其确切名称（`zc_area_sum`），而方法、trait 和泛型则使用可预测的以 `__` 分隔的名称（`Square__scale`、`Square___grow`、`Square__Shape__area`、`Boxed__int32_t__get`）。
- 使用 `zc build -shared` 构建可被 C 调用的共享库，或者在针对 C++/GPU 工具链或检查 AST 时使用 `--backend ast-dump` / `--backend json` / `--cpp` / `--cuda`。
