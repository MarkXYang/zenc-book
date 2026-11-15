# 使用 GDB、LLDB 和 VS Code 进行调试

当测试失败或指针走样时，仅靠 `println` 语句的作用是有限的。由于 Zen C 通过标准 C11 工具链（`gcc` 和 `clang`）进行编译，因此你可以完全使用工业级的原生调试器——包括 **GDB**、**LLDB** 以及 **VS Code 的可视化调试器**——而无需自定义的 Zen C 调试器插件。

更棒的是，除非你想看，否则你不需要去调试原始的转译 C 代码。当在调试模式下编译时，Zen C 会生成 `#line` 预处理器指令，将每个生成的 C 语句映射回其来源的确切 `.zc` 文件和行号。

---

## 为源码级调试进行编译

要在 GDB 或 LLDB 中单步调试 `.zc` 源文件并完整检查局部变量，编译期间需要满足两件事：

1. **Zen C 源码映射（`-g`）**：向 `zc` 传递 `-g` 会启用 Zen C 内部的 `mode_debug` 模式，在生成的整个 C 代码中输出 `#line <line> "<file.zc>"` 指令。
2. **后端 DWARF 调试符号与零优化（`-ggdb -O0` 或 `-g3 -O0`）**：传递 `-ggdb -O0`（或在 Clang/macOS 上传递 `-g3 -O0`）指示底层 C 编译器将完整的 DWARF 调试符号表嵌入可执行文件并禁用优化，以防变量被内联或优化掉到寄存器中。

```bash
$ zc build -g -ggdb -O0 examples/ch11/ch11-03-debugging/main.zc -o debug_demo
```

> **提示：使用 `//> cflags:` 嵌入调试标志**
> 如果你正在迭代一个调试目标，并希望 `zc build -g` 自动包含后端 DWARF 符号和 `-O0`，你还可以在入口文件的顶部放置一个构建指令：
> ```zenc
> //> cflags: -g -O0
> ```

### 检查生成的 C 代码（`--emit-c`）

有时——特别是在调试 FFI 绑定、内联汇编或宏交互时——你希望在查看 `.zc` 源码的同时检查生成的 C 文件。向 `zc build` 传递 `--emit-c`（或运行 `zc transpile`）以将生成的 `.c` 文件保留在磁盘上：

```bash
$ zc build --emit-c -g -ggdb -O0 main.zc -o app
```

---

## 完整的调试演练

考虑在 `examples/ch11/ch11-03-debugging/main.zc` 中的以下订单处理程序，该程序使用了结构体、方法、切片和带标签联合体 `enum`：

```zenc
// File: examples/ch11/ch11-03-debugging/main.zc

enum Discount {
    None,
    Percent(int),
    FlatCents(int),
}

struct Order {
    id: int,
    item_prices: int[],
    discount: Discount,
}

impl Order {
    fn new(id: int, prices: int[], discount: Discount) -> Order {
        return Order {
            id: id,
            item_prices: prices,
            discount: discount,
        };
    }

    fn subtotal(self) -> int {
        let sum = 0;
        for i in 0..self.item_prices.len {
            sum += self.item_prices[i];
        }
        return sum;
    }

    fn total_cents(self) -> int {
        let sub = self.subtotal();
        match self.discount {
            Discount::None => { return sub; },
            Discount::Percent(pct) => {
                let cut = (sub * pct) / 100;
                return sub - cut;
            },
            Discount::FlatCents(cents) => {
                if cents >= sub { return 0; }
                return sub - cents;
            },
        }
    }
}

fn main() -> int {
    let prices: int[3] = [1500, 2500, 1000];
    let order = Order::new(101, prices, Discount::Percent(20));

    let final_cents = order.total_cents();
    println "Order #{order.id} total: {final_cents} cents";
    return 0;
}
```

让我们使用调试符号编译该程序并启动 GDB：

```bash
$ zc build -g -ggdb -O0 examples/ch11/ch11-03-debugging/main.zc -o order_debug
$ gdb ./order_debug
```

### 在 `.zc` 行和方法上设置断点

由于 DWARF 行号表直接指向 `main.zc`，因此你可以使用 `.zc` 文件名和行号设置断点，或者使用 Zen C 可预测的 C 函数名称：

```text
(gdb) break main.zc:32
Breakpoint 1 at 0x198a: file examples/ch11/ch11-03-debugging/main.zc, line 33.

(gdb) run
Starting program: ./order_debug

Breakpoint 1, Order__total_cents (self=0x7fffffffc6c0)
    at examples/ch11/ch11-03-debugging/main.zc:33
33          let sub = self.subtotal();
```

注意 GDB 如何直接在 `main.zc` 的第 33 行停止并显示原始 Zen C 源代码行！

---

## 理解调试器中的 Zen C 符号名称

因为 Zen C 会转译为 C，所以回溯（`bt`）和断点制表符补全中的标识符遵循清晰且确定性的命名方案：

| Zen C 结构 | Zen C 语法 | 调试器符号名称 |
| :--- | :--- | :--- |
| 自由函数 | `fn parse_header(...)` | `parse_header` |
| 结构体方法 | `impl Order { fn total_cents(self) }` | `Order__total_cents` |
| Trait 实现 | `impl Display for Order { fn to_string(&self) }` | `Order__Display__to_string` |
| 泛型结构体 | `Vec<int>` / `Pair<int, string>` | `struct Vec_int` / `struct Pair_int_string` |
| 泛型方法 | `Vec<int>` 上的 `vec.push(42)` | `Vec_int__push` |
| RAII 析构器胶水代码 | `impl Drop for Resource` | `Resource__Drop__glue` |
| 测试块 `N` | `test "my unit test" { ... }` | `_z_test_0`, `_z_test_1`, ... |
| 测试运行器 | （自动生成） | `_z_run_tests` |

> **提示：调试失败的 `test` 块**
> 因为每个 `test "..."` 块都会被编译为一个常规的 C 函数（`_z_test_0`、`_z_test_1` 等）或者可以通过 `.zc` 行号来定位，所以你可以使用 `zc build -g -ggdb -O0 my_test.zc -o my_test` 构建测试文件，并直接在失败的测试块内部设置断点（`break my_test.zc:42` 或 `break __zenc_assert`）。

---

## 在 GDB 和 LLDB 中检查 Zen C 类型

Zen C 的 C11 后端最大的优势之一是，每个高级 Zen C 抽象在调试器中都具有透明的 C 结构体布局：

### 1. 检查结构体与方法（`self`）

在像 `Order::total_cents` 这样的方法内部，`self` 作为指针（`Order *self`）传递。在 GDB 中使用 `print *self`（或在 LLDB 中使用 `frame variable *self`）可以一次性检查所有字段：

```text
(gdb) next
34          match self.discount {
(gdb) print sub
$1 = 5000
(gdb) print *self
$2 = {
  id = 101,
  item_prices = {
    data = 0x7fffffffc6ec,
    len = 3,
    cap = 3
  },
  discount = {
    tag = Discount__Percent_Tag,
    data = {
      Percent = 20,
      FlatCents = 20
    }
  }
}
```

### 2. 检查切片（`T[]`）

Zen C 切片 `int[]` 在 C 中表示为 `Slice__int32_t`，包含 `{ int32_t *data; usize len; usize cap; }`。在 GDB 中，你可以使用 `@` 数组切片运算符（`*ptr@len`）解引用 `data`，以清晰地打印切片的所有元素：

```text
(gdb) print self->item_prices.len
$3 = 3
(gdb) print *self->item_prices.data@self->item_prices.len
$4 = {1500, 2500, 1000}
```

### 3. 检查带标签联合体枚举（带负载的 `enum`）

带负载的 Zen C `enum`（如 `Discount`）编译为具有两个字段的 C 结构体：
- `.tag`：一个标签枚举值（`Discount__None_Tag`、`Discount__Percent_Tag`、`Discount__FlatCents_Tag`），GDB 会符号化打印它！
- `.data`：一个 C `union`，为每个负载变体保存一个命名字段（`self->discount.data.Percent`）。

```text
(gdb) print self->discount.tag
$5 = Discount__Percent_Tag
(gdb) print self->discount.data.Percent
$6 = 20
```

---

## GDB 与 LLDB 针对 Zen C 的速查表

| 调试任务 | GDB 命令 | LLDB 命令 |
| :--- | :--- | :--- |
| 启动调试器 | `gdb ./app` | `lldb ./app` |
| 在 `.zc` 行设置断点 | `break main.zc:33` | `breakpoint set --file main.zc --line 33`（或 `b main.zc:33`） |
| 在结构体方法设置断点 | `break Order__total_cents` | `b Order__total_cents` |
| 开始执行 | `run`（`r`） | `run`（`r`） |
| 单步跳过（下一 `.zc` 行） | `next`（`n`） | `next`（`n`） |
| 单步进入函数/方法 | `step`（`s`） | `step`（`s`） |
| 检查局部变量 | `info locals` | `frame variable`（`fr v`） |
| 解引用 `self` 结构体 | `print *self`（`p *self`） | `p *self` |
| 打印切片元素 | `p *slice.data@slice.len` | `parray slice.len slice.data` |
| 显示调用栈 | `backtrace`（`bt`） | `bt` |

---

## 在 VS Code 中进行可视化调试

因为 Zen C 会生成指向 `.zc` 文件的标准 DWARF 行号映射，所以你可以直接在 VS Code 的 `.zc` 编辑器左侧边栏放置红点断点、将鼠标悬停在变量上检查其字段，并使用 `F5` / `F10` / `F11` 单步调试代码。

### 1. 配置 `.vscode/tasks.json`

创建一个使用 `-g -ggdb -O0` 编译当前活动 `.zc` 文件的构建任务：

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "zc: build debug active file",
            "type": "shell",
            "command": "zc",
            "args": [
                "build",
                "-g",
                "-ggdb",
                "-O0",
                "${file}",
                "-o",
                "${fileDirname}/${fileBasenameNoExtension}"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "problemMatcher": ["$gcc"]
        }
    ]
}
```

### 2. 配置 `.vscode/launch.json`

使用 Microsoft C/C++ 扩展（带有 `gdb` 的 `cppdbg`）或 **CodeLLDB** 扩展（`lldb`）将构建任务与启动配置配对：

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Zen C (Active File)",
            "type": "cppdbg",
            "request": "launch",
            "program": "${fileDirname}/${fileBasenameNoExtension}",
            "args": [],
            "stopAtEntry": false,
            "cwd": "${fileDirname}",
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "preLaunchTask": "zc: build debug active file"
        }
    ]
}
```

现在在 VS Code 中打开任意 `.zc` 文件，点击左侧边栏在 Zen C 语句上放置断点，然后按 **F5**。VS Code 将自动使用调试符号编译该 `.zc` 文件，启动 GDB，在你的 `.zc` 断点处暂停，并填充**变量**（Variables）、**监视**（Watch）和**调用堆栈**（Call Stack）面板！

---

## 🔍 窥探底层 C 代码：`#line` 指令如何将 C 映射回 `.zc`

GDB 如何知道 C 函数 `Order__total_cents` 内部的地址 `0x18e5` 对应于 `main.zc` 的第 25 行？

当使用 `-g` 编译时，Zen C 的代码生成器（`codegen_decl.c` 中的 `emit_source_mapping`）会跟踪每个 AST 语句的源码词元（`node->token.line` 和 `node->token.file`），并在生成的 C 代码前直接输出 C 预处理器 `#line` 指令：

```c
ZC_FUNC int Order__total_cents(struct Order* self)
{
#line 25 "examples/ch11/ch11-03-debugging/main.zc"
    __auto_type sub = Order__subtotal(self);
#line 26 "examples/ch11/ch11-03-debugging/main.zc"
    {
        __auto_type _z_match_val_0 = self->discount;
        if (_z_match_val_0.tag == Discount_None) {
#line 27 "examples/ch11/ch11-03-debugging/main.zc"
            return sub;
        }
        else if (_z_match_val_0.tag == Discount_Percent) {
            int pct = _z_match_val_0.data.Percent;
#line 29 "examples/ch11/ch11-03-debugging/main.zc"
            __auto_type cut = ((sub * pct) / 100);
#line 30 "examples/ch11/ch11-03-debugging/main.zc"
            return (sub - cut);
        }
        ...
    }
}
```

即使 Zen C 语句在作用域末尾触发了多个延迟清理（`defer` 或 `Drop`），Zen C 也会使用 `emit_source_mapping_duplicate()` 输出指向原始 `defer` 或变量声明行的 `#line` 指令。当你在 GDB 中使用 `next` 跳出代码块时，你真的可以看到调试器在从函数返回之前，按 LIFO 顺序跳转到每个 `defer` 行！
