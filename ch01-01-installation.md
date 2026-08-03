# Installation

The first step to using Zen C is installing the compiler driver toolchain: `zc`.

Because Zen C transpiles directly to GNU C11 standard code, `zc` works seamlessly alongside your favorite C compiler backends (such as **GCC**, **Clang**, or **TinyCC (TCC)**).

---

## Prerequisites

Before installing `zc`, ensure you have a C compiler backend and essential build utilities installed on your system.

### On Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install build-essential git gcc clang make libtcc-dev
```

> [!TIP]
> **TinyCC Support (`libtcc-dev`)**: If you encounter the compilation error `error: libtcc.h: No such file or directory`, installing `libtcc-dev` ensures the TCC library headers are present for fast compilation backend support.


### On Arch Linux
```bash
sudo pacman -S base-devel git gcc clang make
```

### On macOS
Install the Xcode Command Line Tools:
```bash
xcode-select --install
```

### On Windows
We recommend using **WSL2** (Windows Subsystem for Linux) with Ubuntu, or a MinGW-w64 / MSYS2 GCC environment.

---

## Installing Zen C (`zc`)

### Option 1: Building from Source (Recommended)

You can build and install the latest release of `zc` directly from the official source repository:

```bash
# 1. Clone the repository
git clone https://git.zenc-lang.org/Zen-C.git zenc
cd zenc

# 2. Build the binary compiler driver
make

# 3. Install binary to system path (default /usr/local/bin)
sudo make install
```

### Option 2: Prebuilt Packages
Prebuilt binary releases for Linux x86_64, ARM64, and macOS are available on the official releases page:
[https://github.com/zenc-lang/zenc/releases](https://github.com/zenc-lang/zenc/releases)

---

## Verifying the Installation

To verify that Zen C is installed properly, open a new terminal window and run:

```bash
zc --version
```

You should see output indicating the version and build commit hash, similar to:

```text
zc v0.4.4-330-g31a66fc
```

You can also run the help command to see a summary of available subcommands:

```bash
zc --help
```

---

## Editor Support and Language Server Protocol (LSP)

Zen C provides first-class IDE support via a built-in Language Server Protocol server.

### VS Code
1. Open Visual Studio Code.
2. Search for the **Zen C** extension in the Extension Marketplace (`zenc-lang.zenc`).
3. Click **Install**.

The extension provides:
- Syntax highlighting for `.zc` source files.
- Real-time diagnostic diagnostics powered by `zc check --json`.
- Autocompletion and jump-to-definition powered by `zc lsp`.

### Neovim / Vim / Helix / Emacs
Because `zc` includes built-in LSP capability via `zc lsp`, you can point any standard LSP client to executable `zc lsp` for auto-completion and diagnostics.

Now that `zc` is installed and ready, let's write our first Zen C program!
