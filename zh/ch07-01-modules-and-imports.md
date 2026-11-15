# 模块与导入

在 Zen C 中，程序被组织成**模块（Modules）**。模块是一个自包含的代码单元，包含函数、结构体、枚举、常量和类型别名。

与传统 C 语言使用文本 `#include` 复制粘贴不同，Zen C 具有现代化的语义模块系统，具备清晰的命名空间作用域划分、选择性导入、循环依赖检测以及编译期封装。

---

## 1. 定义与导入模块

在 Zen C 中，**每个 `.zc` 文件都会自动成为一个模块**。声明模块名称不需要任何特殊的关键字。

假设我们有一个名为 `math_utils.zc` 的辅助文件：

```zenc
// math_utils.zc
def PI = 3.14159265;

fn add(a: int, b: int) -> int {
    return a + b;
}

fn multiply(a: int, b: int) -> int {
    return a * b;
}
```

要在 `main.zc` 中使用 `math_utils.zc`，我们使用 `import` 语句：

**代码清单 7-1：`list7-1.zc`**

```zenc
 1 | // main.zc
 2 | import "math_utils.zc";
 3 |
 4 | fn main() {
 5 |     // Access symbols using the file's base name as the namespace
 6 |     let sum = math_utils::add(10, 20);
 7 |     let prod = math_utils::multiply(6, 7);
 8 |
 9 |     println "Sum: {sum}, Product: {prod}";
10 | }
```

输出：
```text
Sum: 30, Product: 42
```

### 模块路径解析

在解析 `import "path"` 中的路径时，`zc` 编译器按以下顺序搜索文件系统：

1. **绝对路径**：如果路径以 `/`（Unix）或 `C:\`（Windows）开头。
2. **相对于当前文件**：搜索包含当前正在编译的 `.zc` 文件的目录。
3. **当前工作目录（`.`）**：搜索调用 `zc` 命令时所在的工作目录。
4. **包含标志（`-I`）**：通过命令行 `-I <path>` 指定的任何目录。
5. **标准库路径（`$ZC_ROOT`）**：搜索 `$ZC_ROOT/std` 或 `$ZC_ROOT`。
6. **系统路径**：系统安装目录（例如 `/usr/local/share/zenc` 和 `/usr/share/zenc`）。

---

## 2. 命名空间别名（`as alias`）

如果模块的文件名较长，或者多个模块具有相同的基本名称，可以使用 `as` 关键字指定自定义命名空间别名：

**代码清单 7-2：`list7-2.zc`**

```zenc
 1 | // main.zc
 2 | import "math_utils.zc" as math;
 3 |
 4 | fn main() {
 5 |     let sum = math::add(15, 27);
 6 |     let area = PI * 10.0 * 10.0; // Manifest constant folded at compile time
 7 |
 8 |     println "Sum: {sum}, Area: {area}";
 9 | }
```

输出：
```text
Sum: 42, Area: 314.159265
```

> [!NOTE]
> **跨模块的表现常量（`def`）**：使用 `def` 声明的常量在编译期求值，并直接折叠到跨模块的表达式中。函数和方法则通过模块命名空间进行限定（例如 `math::add`）。

### 通配符导入（`as *`）

要将模块中的所有符号直接导入当前作用域，而无需使用命名空间前缀进行限定，请使用 `as *`：

**代码清单 7-3：`list7-3.zc`**

```zenc
 1 | import "math_utils.zc" as *;
 2 |
 3 | fn main() {
 4 |     // Directly call functions without math_utils:: prefix
 5 |     let sum = add(10, 20);
 6 |     println "Sum: {sum}";
 7 | }
```

输出：
```text
Sum: 30
```

> [!WARNING]
> 虽然 `as *` 在小型脚本或测试文件中很方便，但在大型代码库中过度使用通配符导入会导致命名空间污染和符号冲突。在生产代码中，建议使用显式命名空间或选择性导入。

---

## 3. 选择性导入（`import { ... } from "..."`）

Zen C 允许你使用选择性导入语法从模块中精选出特定符号：

**代码清单 7-4：`list7-4.zc`**

```zenc
 1 | import { add, multiply } from "math_utils.zc";
 2 |
 3 | fn main() {
 4 |     let sum = add(5, 12);
 5 |     let prod = multiply(4, 3);
 6 |     println "Result: {sum}, {prod}";
 7 | }
```

输出：
```text
Result: 17, 12
```

你还可以在选择性导入期间为单个符号指定别名：

**代码清单 7-5：`list7-5.zc`**

```zenc
 1 | import { add as sum_func, multiply as prod_func } from "math_utils.zc";
 2 |
 3 | fn main() {
 4 |     let res = sum_func(100, 200);
 5 |     println "Result: {res}";
 6 | }
```

输出：
```text
Result: 300
```

---

## 小结

在本节中，你学习了：
- Zen C 中的每个 `.zc` 文件如何自动成为一个独立的模块。
- 如何使用 `import "path.zc";` 导入模块。
- 如何使用命名空间别名（`import "path.zc" as my_mod;`）和通配符导入（`as *`）。
- 如何使用 `import { a, b } from "path.zc";` 选择性地导入符号。

接下来，让我们探索目录模块与重新导出！
