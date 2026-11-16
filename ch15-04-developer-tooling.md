# Developer Tooling: `zc-doc`, `zc-format`, REPL, and LSP

A productive systems language needs more than just a compiler. Zen C ships with an integrated suite of developer tools that share the compiler's own lexer, parser, and type checker:

- **`zc check`** — Fast type and semantic checking without invoking a C compiler.
- **`zc-doc`** (or `zc doc`) — Markdown documentation generator for modules, structs, methods, and functions.
- **`zc-format`** — Canonical source code formatter with a `--check` mode for CI pipelines.
- **`zc-repl`** (or `zc repl`) — Interactive Read-Eval-Print Loop for rapid experimentation and C code inspection.
- **`zc-lsp`** (or `zc lsp`) — Language Server Protocol (LSP) daemon for VS Code, Neovim, Zed, and other editors.

---

## 1. Fast Type Checking and JSON Diagnostics (`zc check`)

During active development or continuous integration, you often want to verify that a file parses and type-checks without waiting for the backend C compiler to assemble and link an executable. Run `zc check`:

```console
$ zc check examples/ch15/ch15-04-developer-tooling/main.zc
   Compiling examples/ch15/ch15-04-developer-tooling/main.zc...
```

If a file contains a type error, `zc check` reports the exact source span:

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

For editor plugins, build systems, and CI bots, add `--json` to emit structured JSON diagnostic objects instead of human-formatted text:

```console
$ zc check --json bad.zc
   Compiling bad.zc...
{"file":"bad.zc","line":2,"col":18,"level":"error","message":"Type validation failed. Expected 'int32_t', but got 'string'"}
```

---

## 2. Generating Markdown Documentation (`zc-doc`)

`zc-doc` extracts documentation comments (`///` above declarations, as well as leading file comments) and emits structured Markdown API documentation to standard output.

| Flag | Behavior |
| :--- | :--- |
| `zc-doc file.zc` (or `--recursive-doc`) | Document `file.zc` **and** recursively traverse imported modules (default). |
| `zc-doc --no-recursive-doc file.zc` | Document **only** `file.zc`, skipping imported standard library or third-party modules. |

Let's examine Listing 15-4, a documented `TempLog` module that we can run through `zc-doc`, `zc-format`, and `zc check`:

**Listing 15-4: A documented temperature-logging module**

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

First, run the program normally:

```console
$ zc run -q examples/ch15/ch15-04-developer-tooling/main.zc
readings: 3
average: 20.6 C
```

Now run `zc-doc --no-recursive-doc` and redirect the Markdown output to `API.md` (or inspect it in the terminal):

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

## 3. Formatting Code with `zc-format`

`zc-format` reads a Zen C file (or standard input if no file is given) and writes the canonically indented source to standard output:

```bash
# Preview formatted code on stdout
zc-format main.zc

# Format a file via a temporary file
zc-format main.zc > main.zc.tmp && mv main.zc.tmp main.zc

# Format code piped over stdin
cat main.zc | zc-format
```

### Enforcing Formatting in CI (`zc-format --check`)

Pass `--check` to verify whether a file already matches `zc-format`'s output without printing the file. `zc-format --check` exits with status **`0`** when the file is properly formatted and **`1`** when changes are needed:

```console
$ zc-format --check examples/ch15/ch15-04-developer-tooling/main.zc
$ echo $?
0
```

---

## 4. Interactive Exploration with `zc-repl`

Running `zc-repl` (or `zc repl`) launches an interactive Read-Eval-Print Loop. It saves command history in `~/.zenc_history` and automatically runs commands from `~/.zencrc` on startup if present.

Inside the REPL, you can enter Zen C expressions and statements or use colon (`:`) meta-commands to inspect types, active bindings, and generated C code:

| REPL Command | Description |
| :--- | :--- |
| `:help` | List all available REPL commands |
| `:type <expr>` | Show the inferred Zen C type of an expression |
| `:c <stmt>` | Show the exact C code generated for a Zen C statement |
| `:vars` / `:funcs` / `:structs` | List active session variables, functions, or structs |
| `:imports` | List active `import` declarations |
| `:time <expr>` | Benchmark `<expr>` over 1,000 iterations |
| `:watch <expr>` / `:unwatch <n>` | Re-evaluate `<expr>` automatically after every entry |
| `:save <file.zc>` / `:load <file.zc>` | Save the session to a `.zc` file or load one into the session |
| `:undo` / `:delete <n>` / `:reset` | Remove the last entry, delete entry `n`, or clear the session |
| `! <cmd>` | Execute a shell command (for example, `!ls`) |
| `:quit` | Exit the REPL |

---

## 5. Editor Integration with `zc-lsp` and Debugging

`zc-lsp` (also invoked via `zc lsp` or `zls`) is the built-in Language Server Protocol daemon communicating over standard I/O (JSON-RPC 2.0). It powers the official **Zen C VS Code extension** as well as Neovim, Vim (`zenc.vim`), and Zed setups.

### Supported LSP Capabilities

- **Go to Definition** & **Find References** across imported `.zc` modules
- **Hover Information** showing resolved types and `///` doc comments
- **Autocomplete** for functions, structs, fields, and dot-methods (`vec.`)
- **Document Symbols** (file outline) and **Signature Help**
- **Real-time Diagnostics** and **Document Formatting** (using the same engine as `zc-format`)

### Workspace Configuration (`zenc.server.json`)

For multi-directory projects, place a `zenc.server.json` file at the root of your workspace so `zc-lsp` knows where to find custom include paths and which generated directories to skip:

```json
{
  "include_paths": ["../libs", "third_party/include"],
  "exclude": ["generated/", "*.tmp.zc"],
  "use_gitignore": true
}
```

### One-Click Debugging in VS Code (`GDB` / `LLDB`)

Because `zc` emits `#line` directives pointing directly to your `.zc` files, you can set breakpoints and step through Zen C source lines in VS Code using **CodeLLDB** or Microsoft's **C/C++** extension. For the complete `.vscode/tasks.json` and `.vscode/launch.json` configuration, see [Section 11.3: Debugging Zen C Programs](ch11-03-debugging.md).

---

## Summary of Chapter 15

In this chapter, you explored the complete `zc` toolchain:
- **Compiler Backends (`15.1`)**: Switching C compilers (`--cc gcc | clang | zig | tcc`), controlling optimization (`-O2`, `-O3`, `--release`) and debug symbols (`-g`, `-g0`, `-ggdb`), and embedding portable build flags with `//>` directives.
- **Generated C & Name Mangling (`15.2`)**: Using `zc transpile` and `--emit-c` to read generated C11 code, understanding `__` and `___` symbol mangling rules, building shared libraries (`-shared`), and using alternative backends (`--cpp`, `--cuda`, `--backend ast-dump`, `--backend json`).
- **Actually Portable Executables (`15.3`)**: Pairing Zen C with Cosmopolitan's `cosmocc` to build single-file `.com` binaries that run natively across six operating systems and two CPU architectures.
- **Developer Tooling (`15.4`)**: Type-checking with `zc check` (`--json`), generating Markdown docs with `zc-doc`, enforcing code style with `zc-format --check`, experimenting in `zc-repl`, and configuring `zc-lsp` and LLDB/GDB in your editor.

Next, in **[Chapter 16: Advanced Memory Management](ch16-00-advanced-memory-management.md)**, we will dive into raw pointers, arena allocators, low-level struct layout (bitfields, packing, and alignment), and untagged unions!
