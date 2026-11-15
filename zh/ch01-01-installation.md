# 安装

使用 Zen C 的第一步是安装编译器驱动工具链：`zc`。

由于 Zen C 直接转译为 GNU C11 标准代码，因此 `zc` 可以与你喜爱的 C 编译器后端（例如 **GCC**、**Clang** 或 **TinyCC (TCC)**）无缝协同工作。

---

## 前置准备

在安装 `zc` 之前，请确保系统中已安装 C 编译器后端以及必要的构建工具。

### 在 Linux (Ubuntu / Debian) 上
```bash
sudo apt update
sudo apt install build-essential git gcc clang make libtcc-dev
```

> [!TIP]
> **TinyCC 支持 (`libtcc-dev`)**：如果你遇到编译错误 `error: libtcc.h: No such file or directory`，安装 `libtcc-dev` 可确保提供 TCC 库头文件，以获得快速编译后端支持。


### 在 Arch Linux 上
```bash
sudo pacman -S base-devel git gcc clang make
```

### 在 macOS 上
安装 Xcode Command Line Tools：
```bash
xcode-select --install
```

### 在 Windows 上
我们推荐使用运行 Ubuntu 的 **WSL2**（Windows Subsystem for Linux），或者 MinGW-w64 / MSYS2 GCC 环境。

---

## 安装 Zen C (`zc`)

### 方式 1：源码编译安装（推荐）

你可以直接从官方源码仓库构建并安装最新版本的 `zc`：

```bash
# 1. Clone the repository
git clone https://git.zenc-lang.org/Zen-C.git zenc
cd zenc

# 2. Build the binary compiler driver
make

# 3. Install binary to system path (default /usr/local/bin)
sudo make install
```

### 方式 2：预编译二进制包
适用于 Linux x86_64、ARM64 和 macOS 的预编译二进制发行版可在官方 Release 页面下载：
[https://github.com/zenc-lang/zenc/releases](https://github.com/zenc-lang/zenc/releases)

---

## 验证安装

若要验证 Zen C 是否已正确安装，请打开一个新的终端窗口并运行：

```bash
zc --version
```

你应当会看到类似如下的版本和构建 commit 哈希输出：

```text
zc v0.4.4-330-g31a66fc
```

你也可以运行帮助命令以查看可用子命令的概览：

```bash
zc --help
```

---

## 编辑器支持与语言服务器协议（LSP）

Zen C 通过内置的语言服务器协议（LSP）服务器提供一流的 IDE 支持。

### VS Code
1. 打开 Visual Studio Code。
2. 在扩展应用市场中搜索 **Zen C** 扩展（`zenc-lang.zenc`）。
3. 点击**安装**（Install）。

该扩展提供：
- `.zc` 源文件的语法高亮。
- 由 `zc check --json` 驱动的实时诊断信息。
- 由 `zc lsp` 驱动的代码自动补全与跳转到定义。

### Neovim / Vim / Helix / Emacs
由于 `zc` 通过 `zc lsp` 内置了 LSP 能力，你可以将任何标准 LSP 客户端指向可执行文件 `zc lsp`，即可获得自动补全与诊断支持。

现在 `zc` 已经安装完毕并准备就绪，让我们来编写第一个 Zen C 程序吧！
