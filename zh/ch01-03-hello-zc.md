# Hello, zc!

在 1.2 节中，你创建了一个简单的 Zen C 程序，并使用 `zc run` 和 `zc build` 进行了编译。现在让我们深入探索 `zc` —— Zen C 官方的命令行编译器驱动与工具链。

类似于 Rust 中的 `cargo` 或 Go 中的 `go`，`zc` 是你构建、运行、检查、转译、测试和调试 Zen C 应用程序的核心接口。

---

## 标准项目结构

当你的项目不仅限于单个文件时，遵循通用的目录结构约定有助于保持代码清晰，并实现无缝的构建集成。

Zen C 应用程序的标准目录结构如下：

```text
my_project/
├── src/
│   ├── main.zc       # Application entry point
│   ├── helper.zc     # Additional module source
│   └── math.zc
├── include/           # Optional C headers for C interop
├── lib/               # Optional static/dynamic libraries
└── README.md
```

要编译按此结构组织的项目：

```bash
zc build src/main.zc -o bin/my_project
```

---

## 常用 `zc` 子命令

以下是 `zc` 中核心子命令的概览：

| 命令 | 用法 | 描述 |
| :--- | :--- | :--- |
| `zc run <file>` | `zc run src/main.zc` | 立即在一个临时位置编译并执行程序。 |
| `zc build <file>` | `zc build src/main.zc -o app` | 将源代码编译为独立的本地原生二进制文件或动态库。 |
| `zc check <file>` | `zc check src/main.zc` | 执行语法验证和类型检查，不调用 C 后端。 |
| `zc transpile <file>` | `zc transpile src/main.zc -o out.c` | 将 Zen C 代码翻译为标准且人类可读的 GNU C11 源代码。 |
| `zc test <file>` | `zc test src/main.zc` | 运行 `.zc` 文件中定义的所有单元测试块。 |
| `zc repl` | `zc repl` | 启动交互式 REPL（Read-Eval-Print Loop）环境，用于快速实验 Zen C 代码。 |
| `zc lsp` | `zc lsp` | 启动内置的语言服务器协议（LSP）守护进程，供编辑器进行代码补全和诊断。 |

---

## 常用编译器选项与标志

`zc` 让你能够对后端优化、调试、链接和安全规范进行细粒度控制。

### 1. 输出文件名 (`-o`)
指定输出二进制文件的名称：
```bash
zc build src/main.zc -o my_app
```

### 2. 优化级别 (`-O`) 与发布模式 (`--release`)
- `-O0`：开发模式，编译速度最快，不进行优化。
- `-O2`：兼顾性能与编译速度的生产环境优化。
- `-O3`：极致运行速度优化。
- `--release`：生产环境构建的快捷方式（等价于 `-O3 -g0`）。

```bash
# Build for release
zc build src/main.zc --release -o my_app
```

### 3. 后端编译器选择 (`--cc`)
默认情况下，`zc` 会自动检测可用的宿主编译器（优先使用 `gcc` 或 `clang`）。你可以使用 `--cc` 显式强制指定特定的后端 C 编译器：

```bash
# Force compilation with Clang
zc build src/main.zc --cc clang -o my_app

# Force compilation with TinyCC for lightning-fast dev builds
zc build src/main.zc --cc tcc -o my_app
```

### 4. 安全性与 MISRA 合规 (`--misra`)
在嵌入式和安全关键型工程中，`zc` 可以生成严格符合 MISRA C 标准的 C 代码：

```bash
zc build src/main.zc --misra -o embedded_app
```

### 5. 引入 C 头文件与库 (`-I`, `-L`, `-l`)
链接外部标准 C 库（例如 `libcurl`、`sqlite3`、`raylib`）：

```bash
zc build src/main.zc -I/usr/include -L/usr/lib -lsqlite3 -o app
```

---

## 第 1 章小结

在第 1 章中，你学会了：
1. 安装前置依赖以及 `zc` 编译器驱动。
2. 为 VS Code 及兼容 LSP 的编辑器配置开发环境。
3. 使用 `fn main()` 和 `println` 编写你的第一个 Zen C 程序。
4. 使用 `zc run`、`zc build` 和 `zc transpile` 运行、构建并检查转译后的 C 代码。
5. 组织项目目录结构并使用常见的 `zc` 命令行标志。

现在你已经打下了坚实的基础，并拥有了一个可用的 Zen C 开发环境。在**第 2 章**中，我们将学以致用，亲手构建一个完整的交互式**猜数游戏**项目！
