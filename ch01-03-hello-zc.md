# Hello, zc!

In Section 1.2, you created a simple Zen C program and compiled it using `zc run` and `zc build`. Now let's explore `zc`, the official command-line compiler driver and toolchain for Zen C.

Like `cargo` in Rust or `go` in Go, `zc` acts as your central interface for building, running, checking, transpiling, testing, and debugging Zen C applications.

---

## Standard Project Layout

As your projects grow beyond a single file, establishing a convention for your directory structure helps maintain readability and seamless build integration.

The standard layout for a Zen C application is:

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

To compile a project structured this way:

```bash
zc build src/main.zc -o bin/my_project
```

---

## Essential `zc` Subcommands

Here is a summary of the core subcommands available in `zc`:

| Command | Usage | Description |
| :--- | :--- | :--- |
| `zc run <file>` | `zc run src/main.zc` | Compiles and executes the program immediately in a temporary location. |
| `zc build <file>` | `zc build src/main.zc -o app` | Compiles source code into a standalone native binary or shared library. |
| `zc check <file>` | `zc check src/main.zc` | Performs syntax validation and type checking without invoking the C backend. |
| `zc transpile <file>` | `zc transpile src/main.zc -o out.c` | Translates Zen C code into standard, human-readable GNU C11 source code. |
| `zc test <file>` | `zc test src/main.zc` | Runs all unit test blocks defined inside your `.zc` files. |
| `zc repl` | `zc repl` | Starts an interactive Read-Eval-Print Loop shell for experimenting with Zen C. |
| `zc lsp` | `zc lsp` | Launches the built-in Language Server Protocol daemon for editor autocompletion and diagnostics. |

---

## Common Compiler Options & Flags

`zc` gives you fine-grained control over backend optimization, debugging, linking, and safety compliance.

### 1. Output Name (`-o`)
Specify the output binary name:
```bash
zc build src/main.zc -o my_app
```

### 2. Optimization Levels (`-O`) & Release Mode (`--release`)
- `-O0`: Development mode, fastest compilation time, no optimization.
- `-O2`: Balanced production optimizations.
- `-O3`: Maximum speed optimizations.
- `--release`: Shortcut for production builds (equivalent to `-O3 -g0`).

```bash
# Build for release
zc build src/main.zc --release -o my_app
```

### 3. Backend Compiler Selection (`--cc`)
By default, `zc` auto-detects an available host compiler (preferring `gcc` or `clang`). You can explicitly force a specific backend C compiler using `--cc`:

```bash
# Force compilation with Clang
zc build src/main.zc --cc clang -o my_app

# Force compilation with TinyCC for lightning-fast dev builds
zc build src/main.zc --cc tcc -o my_app
```

### 4. Safety & MISRA Compliance (`--misra`)
For embedded and safety-critical engineering, `zc` can emit C code strictly conforming to MISRA C standards:

```bash
zc build src/main.zc --misra -o embedded_app
```

### 5. Including C Headers & Libraries (`-I`, `-L`, `-l`)
To link against standard external C libraries (e.g., `libcurl`, `sqlite3`, `raylib`):

```bash
zc build src/main.zc -I/usr/include -L/usr/lib -lsqlite3 -o app
```

---

## Chapter 1 Summary

In Chapter 1, you learned how to:
1. Install prerequisites and the `zc` compiler driver.
2. Configure editor support for VS Code and LSP-compatible editors.
3. Write your first Zen C program using `fn main()` and `println`.
4. Run, build, and inspect transpiled C code using `zc run`, `zc build`, and `zc transpile`.
5. Organize projects and use common `zc` command-line flags.

You now have a solid foundation and a working Zen C development environment. In **Chapter 2**, we will put these tools into practice by building a complete interactive **Guessing Game** project!
