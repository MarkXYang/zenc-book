# 附录 D：开发工具

Zen C 附带了集成的命令行工具（`zc`）、代码格式化工具（`zc-format`）、语言服务器（`zc-lsp`）以及交互式 REPL。本附录总结了你日常开发中会用到的命令与标志。

## `zc` 编译器命令行

```text
usage: zc [-v | -h | -q | -V] [-I | -L | -l | -D <path/macro>] [--cc <c>] [-O<l>] [-g]
          [--release] [--json] [--paths] [--zen] <command> [<args>]
```

### 常用子命令

| 命令 | 描述 |
| :--- | :--- |
| `zc build <file.zc>` | 将 `<file.zc>`（默认子命令）编译为可执行文件。 |
| `zc run <file.zc>` | 编译并立即执行程序。 |
| `zc check <file.zc>` | 运行解析和类型检查，而不调用底层 C 编译器。 |
| `zc transpile <file.zc>` | 生成 C11 源代码，而不构建二进制文件。 |
| `zc test <file.zc>` | 编译并运行文件中的 `test "..." { ... }` 块。 |
| `zc repl` | 启动交互式 Zen C 读取-求值-打印循环（REPL）。 |
| `zc lsp` | 通过标准输入输出启动语言服务器协议守护进程。 |
| `zc doc <file.zc>` | 根据源代码注释生成文档。 |

### 常用编译器标志

| 标志 | 描述 |
| :--- | :--- |
| `-o <file>` | 设置输出的二进制文件或目标文件路径。 |
| `--cc <compiler>` | 选择后端 C 编译器（`gcc`、`clang`、`tcc` 等）。 |
| `-I <dir>`, `-L <dir>`, `-l <lib>` | 添加 C 头文件包含目录、库目录以及链接库。 |
| `-D <macro>` | 在编译期定义预处理器 / `@cfg` 标志。 |
| `-O0`..`-O3`, `--release` | 设置 C 优化级别或启用 release 构建配置。 |
| `-g`, `-g0` | 启用或禁用调试符号。 |
| `-q`, `--quiet` | 静默非错误编译器输出。 |
| `-v`, `--verbose` | 打印编译器详细阶段信息及调用的 C 命令。 |
| `--json` | 输出供编辑器和 CI 工具使用的结构化 JSON 诊断信息。 |

### 安全、MISRA 与互操作标志

| 标志 | 描述 |
| :--- | :--- |
| `--check` | 启用借用/安全检查分析通道。 |
| `--free` | 在无标准库的独立环境（freestanding）模式下编译。 |
| `--misra` | 启用 MISRA C 合规性检查并生成符合 MISRA 规范的安全 C 代码。 |
| `--cpp`, `--cuda` | 启用 C++ 或 CUDA 后端兼容模式。 |
| `-c`, `-S`, `-E`, `-shared` | 生成目标文件、汇编代码、预处理 C 代码或共享动态库（`.so`/`.dll`）。 |

## 代码格式化（`zc-format`）

Zen C 包含 `zc-format`，用于在项目中推行规范的格式化风格：

- **格式化输出到标准输出**：`zc-format path/to/file.zc`
- **在 CI 中检查格式**（如果文件与规范风格不符则返回非零值退出）：`zc-format --check path/to/file.zc`

## 语言服务器（`zc-lsp`）

`zc-lsp`（亦可通过 `zc lsp` 调用）为 VS Code、Neovim 以及任何兼容 LSP 的编辑器提供 IDE 诊断、悬停类型查看、跳转到定义以及代码补全。编辑器配置详情请参阅[11.3 节](ch11-03-debugging.md)与[15.4 节](ch15-04-developer-tooling.md)。
