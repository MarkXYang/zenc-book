# Appendix D: Development Tools

Zen C ships with an integrated CLI (`zc`), formatter (`zc-format`), language server (`zc-lsp`), and interactive REPL. This appendix summarizes the commands and flags you will use every day.

## The `zc` Compiler CLI

```text
usage: zc [-v | -h | -q | -V] [-I | -L | -l | -D <path/macro>] [--cc <c>] [-O<l>] [-g]
          [--release] [--json] [--paths] [--zen] <command> [<args>]
```

### Common Subcommands

| Command | Description |
| :--- | :--- |
| `zc build <file.zc>` | Compiles `<file.zc>` (default subcommand) into an executable. |
| `zc run <file.zc>` | Compiles and immediately executes the program. |
| `zc check <file.zc>` | Runs parsing and type checking without invoking the C compiler. |
| `zc transpile <file.zc>` | Emits the generated C11 source code without building a binary. |
| `zc test <file.zc>` | Compiles and runs `test "..." { ... }` blocks in the file. |
| `zc repl` | Starts an interactive Zen C Read-Eval-Print Loop. |
| `zc lsp` | Starts the Language Server Protocol daemon over stdio. |
| `zc doc <file.zc>` | Generates documentation from source comments. |

### Common Compiler Flags

| Flag | Description |
| :--- | :--- |
| `-o <file>` | Sets the output binary or object path. |
| `--cc <compiler>` | Selects the backend C compiler (`gcc`, `clang`, `tcc`, etc.). |
| `-I <dir>`, `-L <dir>`, `-l <lib>` | Adds C include directories, library directories, and link libraries. |
| `-D <macro>` | Defines a preprocessor / `@cfg` flag at compile time. |
| `-O0`..`-O3`, `--release` | Sets C optimization level or enables release build settings. |
| `-g`, `-g0` | Enables or disables debug symbols. |
| `-q`, `--quiet` | Suppresses non-error compiler output. |
| `-v`, `--verbose` | Prints granular compiler phases and invoked C commands. |
| `--json` | Emits structured JSON diagnostics for editors and CI tools. |

### Safety, MISRA & Interop Flags

| Flag | Description |
| :--- | :--- |
| `--check` | Enables the borrow/safety checker pass. |
| `--free` | Compiles in freestanding mode without the standard library. |
| `--misra` | Enables MISRA C compliance checking and MISRA-safe C code generation. |
| `--cpp`, `--cuda` | Enables C++ or CUDA backend compatibility modes. |
| `-c`, `-S`, `-E`, `-shared` | Emits object files, assembly, preprocessed C, or shared libraries (`.so`/`.dll`). |

## Code Formatting (`zc-format`)

Zen C includes `zc-format` to enforce canonical formatting across projects:

- **Format to stdout**: `zc-format path/to/file.zc`
- **Check formatting in CI** (exits non-zero if a file differs from canonical style): `zc-format --check path/to/file.zc`

## Language Server (`zc-lsp`)

`zc-lsp` (also invocable via `zc lsp`) provides IDE diagnostics, hover types, go-to-definition, and completions for VS Code, Neovim, and any LSP-compatible editor. See [Section 11.3](ch11-03-debugging.md) and [Section 15.4](ch15-04-developer-tooling.md) for editor setup details.
