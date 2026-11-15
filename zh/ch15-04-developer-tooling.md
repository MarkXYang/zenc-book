# 15.4 开发者工具：`zc-doc`、`zc-format`、REPL 与 LSP

一个高效的系统级语言不仅需要一个编译器。Zen C 提供了一套集成的开发者工具套件，它们与编译器共享词法分析器、语法分析器和类型检查器：

- **`zc check`** —— 快速进行类型与语义检查，无需调用 C 编译器。
- **`zc-doc`**（或 `zc doc`）—— 适用于模块、结构体、方法和函数的 Markdown 文档生成器。
- **`zc-format`** —— 规范源码格式化工具，带有专用于 CI 流水线的 `--check` 模式。
- **`zc-repl`**（或 `zc repl`）—— 交互式读取-求值-打印循环（REPL），用于快速实验和 C 代码检查。
- **`zc-lsp`**（或 `zc lsp`）—— 适用于 VS Code、Neovim、Zed 及其他编辑器的语言服务器协议（LSP）后台守护进程。

---

## 1. 快速类型检查与 JSON 诊断信息（`zc check`）

在日常开发或持续集成（CI）过程中，你通常希望验证文件能否顺利解析并完成类型检查，而无需等待后端 C 编译器组装并链接可执行文件。此时可以运行 `zc check`：

```console
$ zc check examples/ch15/ch15-04-developer-tooling/main.zc
   Compiling examples/ch15/ch15-04-developer-tooling/main.zc...
```

如果文件中包含类型错误，`zc check` 会精确报告源代码位置范围：

```console
$ zc check bad.zc
   Compiling bad.zc...
error: Type validation failed. Expected 'int32_t', but got 'string'
  --> bad.zc:2:18
   |
2  |     let x: int = "hello";
   |                  ^ here
   |
```

对于编辑器插件、构建系统和 CI 机器人，可以添加 `--json` 标志以发射结构化的 JSON 诊断对象，而非适合人类阅读的文本：

```console
$ zc check --json bad.zc
   Compiling bad.zc...
{"file":"bad.zc","line":2,"col":18,"level":"error","message":"Type validation failed. Expected 'int32_t', but got 'string'"}
```

---

## 2. 生成 Markdown 文档（`zc-doc`）

`zc-doc` 提取文档注释（声明上方的 `///`，以及文件开头的注释），并将结构化的 Markdown API 文档输出到标准输出。

| 标志 | 行为 |
| :--- | :--- |
| `zc-doc file.zc`（或 `--recursive-doc`） | 为 `file.zc` 生成文档，**并且**递归遍历导入的模块（默认行为）。 |
| `zc-doc --no-recursive-doc file.zc` | **仅**为 `file.zc` 生成文档，跳过导入的标准库或第三方模块。 |

让我们观察示例 15-4 中的带文档注释的 `TempLog` 模块，我们可以将其传递给 `zc-doc`、`zc-format` 和 `zc check` 处理：

**示例 15-4: `list15-4.zc` —— 带文档注释的温度记录模块**

```zenc
// File: examples/ch15/ch15-04-developer-tooling/main.zc
//
// A tiny temperature-logging module used to demonstrate the Zen C tooling:
//   zc-doc --no-recursive-doc main.zc   (generate Markdown API docs)
//   zc-format --check main.zc           (verify formatting in CI)
//   zc check main.zc                    (type-check without building)

include <stdio.h>

/// A fixed-capacity temperature log, in tenths of a degree Celsius.
struct TempLog {
    readings: int[8];
    count: int;
}

impl TempLog {
    /// Creates an empty log.
    fn new() -> TempLog {
        return TempLog { readings: [0, 0, 0, 0, 0, 0, 0, 0], count: 0 };
    }

    /// Records a reading. Returns `false` when the log is full.
    fn record(self, tenths: int) -> bool {
        if self.count >= 8 {
            return false;
        }
        self.readings[self.count] = tenths;
        self.count += 1;
        return true;
    }

    /// Returns the average reading in tenths of a degree (0 if empty).
    fn average(self) -> int {
        if self.count == 0 {
            return 0;
        }
        let total = 0;
        for i in 0..self.count {
            total += self.readings[i];
        }
        return total / self.count;
    }
}

/// Formats tenths of a degree as `whole.fraction`, e.g. 215 -> "21.5".
fn print_temp(label: const char*, tenths: int) {
    println "{label}: {tenths / 10}.{tenths % 10} C";
}

fn main() {
    let log = TempLog::new();
    log.record(198);
    log.record(215);
    log.record(207);

    println "readings: {log.count}";
    print_temp("average", log.average());
}
```

首先正常运行程序：

```console
$ zc run -q examples/ch15/ch15-04-developer-tooling/main.zc
readings: 3
average: 20.6 C
```

现在运行 `zc-doc --no-recursive-doc` 并将 Markdown 输出重定向到 `API.md`（或在终端中直接查看）：

````markdown
$ zc-doc --no-recursive-doc examples/ch15/ch15-04-developer-tooling/main.zc
# Module: examples/ch15/ch15-04-developer-tooling/main.zc

File: examples/ch15/ch15-04-developer-tooling/main.zc

A tiny temperature-logging module used to demonstrate the Zen C tooling:
zc-doc --no-recursive-doc main.zc   (generate Markdown API docs)
zc-format --check main.zc           (verify formatting in CI)
zc check main.zc                    (type-check without building)


## struct `TempLog`

A fixed-capacity temperature log, in tenths of a degree Celsius.

```zc
struct TempLog {
    readings: int32_t[8],
    count: int32_t,
}
```

## impl for `TempLog`

Creates an empty log.
Records a reading. Returns `false` when the log is full.
Returns the average reading in tenths of a degree (0 if empty).


### method `new`
```zc
fn new(...);
```

### method `record`
```zc
fn record(...);
```

### method `average`
```zc
fn average(...);
```

## function `print_temp`

Formats tenths of a degree as `whole.fraction`, e.g. 215 -> "21.5".

```zc
fn print_temp(label: const char*, tenths: int32_t) -> void;
```

## function `main`
```zc
fn main() -> c_int;
```
````

---

## 3. 使用 `zc-format` 格式化代码

`zc-format` 读取 Zen C 文件（若未指定文件则读取标准输入），并将规范缩进的源代码输出到标准输出：

```bash
# Preview formatted code on stdout
zc-format main.zc

# Format a file via a temporary file
zc-format main.zc > main.zc.tmp && mv main.zc.tmp main.zc

# Format code piped over stdin
cat main.zc | zc-format
```

### 在 CI 中强制执行格式检查（`zc-format --check`）

传入 `--check` 标志可以验证文件是否已经符合 `zc-format` 的输出，而无需打印整个文件。当文件格式正确时，`zc-format --check` 以状态码 **`0`** 退出；当需要修改格式时，以状态码 **`1`** 退出：

```console
$ zc-format --check examples/ch15/ch15-04-developer-tooling/main.zc
$ echo $?
0
```

---

## 4. 使用 `zc-repl` 进行交互式探索

运行 `zc-repl`（或 `zc repl`）可以启动交互式的读取-求值-打印循环。它会将命令历史记录保存在 `~/.zenc_history` 中，并在启动时自动执行 `~/.zencrc` 中的命令（如果存在）。

在 REPL 内部，你可以输入 Zen C 表达式和语句，或者使用冒号（`:`）元命令来检查类型、当前绑定以及生成的 C 代码：

| REPL 命令 | 说明 |
| :--- | :--- |
| `:help` | 列出所有可用的 REPL 命令 |
| `:type <expr>` | 显示表达式推断出的 Zen C 类型 |
| `:c <stmt>` | 显示针对某个 Zen C 语句生成的准确 C 代码 |
| `:vars` / `:funcs` / `:structs` | 列出当前会话中的活动变量、函数或结构体 |
| `:imports` | 列出当前会话中的活动 `import` 声明 |
| `:time <expr>` | 对 `<expr>` 进行 1,000 次迭代基准测试 |
| `:watch <expr>` / `:unwatch <n>` | 在每次输入后自动重新评估 `<expr>` |
| `:save <file.zc>` / `:load <file.zc>` | 将会话保存到 `.zc` 文件或加载文件到会话中 |
| `:undo` / `:delete <n>` / `:reset` | 撤销上一次输入、删除条目 `n` 或清空会话 |
| `! <cmd>` | 执行 shell 命令（例如 `!ls`） |
| `:quit` | 退出 REPL |

---

## 5. 编辑器集成（`zc-lsp` 与调试）

`zc-lsp`（也可通过 `zc lsp` 或 `zls` 调用）是内置的语言服务器协议后台守护进程，通过标准 I/O（JSON-RPC 2.0）进行通信。它为官方的 **Zen C VS Code 扩展** 以及 Neovim、Vim（`zenc.vim`）和 Zed 提供支持。

### 支持的 LSP 功能

- 跨导入的 `.zc` 模块进行 **跳转到定义（Go to Definition）** 与 **查找引用（Find References）**
- 显示解析类型和 `///` 文档注释的 **悬停信息（Hover Information）**
- 针对函数、结构体、字段和点号方法（`vec.`）的 **自动补全（Autocomplete）**
- **文档大纲符号（Document Symbols）** 与 **参数签名帮助（Signature Help）**
- **实时诊断（Real-time Diagnostics）** 与 **文档格式化（Document Formatting）**（使用与 `zc-format` 相同的引擎）

### 工作区配置（`zenc.server.json`）

对于多目录项目，在工作区根目录下放置一个 `zenc.server.json` 文件，以便 `zc-lsp` 知晓在哪里查找自定义包含路径以及需要跳过哪些生成的目录：

```json
{
  "include_paths": ["../libs", "third_party/include"],
  "exclude": ["generated/", "*.tmp.zc"],
  "use_gitignore": true
}
```

### 在 VS Code 中一键调试（`GDB` / `LLDB`）

因为 `zc` 发射直接指向 `.zc` 文件的 `#line` 指令，所以你可以在 VS Code 中使用 **CodeLLDB** 或微软的 **C/C++** 扩展设置断点并单步调试 Zen C 源码行。有关完整的 `.vscode/tasks.json` 和 `.vscode/launch.json` 配置，请参见 [第 11.3 节：调试 Zen C 程序](ch11-03-debugging.md)。

---

## 第 15 章小结

在本章中，你探索了完整的 `zc` 工具链：
- **编译器后端（`15.1`）**：切换 C 编译器（`--cc gcc | clang | zig | tcc`）、控制优化（`-O2`、`-O3`、`--release`）与调试符号（`-g`、`-g0`、`-ggdb`），以及使用 `//>` 指令嵌入可移植的构建标志。
- **生成的 C 代码与名称修饰（`15.2`）**：使用 `zc transpile` 和 `--emit-c` 阅读生成的 C11 代码、理解 `__` 与 `___` 符号修饰规则、构建共享库（`-shared`），以及使用其他后端（`--cpp`、`--cuda`、`--backend ast-dump`、`--backend json`）。
- **真正可移植的可执行文件（`15.3`）**：将 Zen C 与 Cosmopolitan 的 `cosmocc` 结合使用，构建原生运行在六种操作系统和两种 CPU 架构上的单文件 `.com` 二进制文件。
- **开发者工具（`15.4`）**：使用 `zc check`（`--json`）进行类型检查、使用 `zc-doc` 生成 Markdown 文档、使用 `zc-format --check` 强制代码风格、在 `zc-repl` 中进行实验，以及在编辑器中配置 `zc-lsp` 和 LLDB/GDB。

接下来，在 **[第 16 章：高级内存管理](ch16-00-advanced-memory-management.md)** 中，我们将深入探讨原始指针、arena 分配器、低层级结构体布局（位域、紧凑排列与对齐）以及无标签联合体！
