# Debugging with GDB, LLDB, and VS Code

When a test fails or a pointer goes astray, `println` statements will only get you so far. Because Zen C compiles through standard C11 toolchains (`gcc` and `clang`), you have full access to industrial-strength native debuggers—including **GDB**, **LLDB**, and **VS Code's visual debugger**—without needing a custom Zen C debugger plugin.

Even better, you do not have to debug raw transpiled C code unless you want to. When compiled in debug mode, Zen C emits `#line` preprocessor directives that map every generated C statement back to the exact `.zc` file and line number where it originated.

---

## Compiling for Source-Level Debugging

To step through `.zc` source files in GDB or LLDB with full local variable inspection, two things need to happen during compilation:

1. **Zen C Source Mapping (`-g`)**: Passing `-g` to `zc` enables Zen C's internal `mode_debug` mode, which emits `#line <line> "<file.zc>"` directives throughout the generated C code.
2. **Backend DWARF Debug Symbols & Zero Optimization (`-ggdb -O0` or `-g3 -O0`)**: Passing `-ggdb -O0` (or `-g3 -O0` on Clang/macOS) instructs the underlying C compiler to embed full DWARF debug symbol tables into the executable and disable optimizations so variables aren'tinlined or optimized out into registers.

```bash
$ zc build -g -ggdb -O0 examples/ch11/ch11-03-debugging/main.zc -o debug_demo
```

> **Tip: Embedding Debug Flags with `//> cflags:`**
> If you are iterating on a debug target and want `zc build -g` to automatically include backend DWARF symbols and `-O0`, you can also place a build directive at the top of your entry file:
> ```zc
> //> cflags: -g -O0
> ```

### Inspecting the Generated C Code (`--emit-c`)

Sometimes—especially when debugging FFI bindings, inline assembly, or macro interactions—you want to inspect the generated C file alongside your `.zc` source. Pass `--emit-c` to `zc build` (or run `zc transpile`) to keep the generated `.c` file on disk:

```bash
$ zc build --emit-c -g -ggdb -O0 main.zc -o app
```

---

## A Complete Debugging Walkthrough

Consider the following order-processing program in `examples/ch11/ch11-03-debugging/main.zc`, which uses a struct, methods, a slice, and a tagged-union `enum`:

```zc
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

Let's compile this program with debug symbols and launch GDB:

```bash
$ zc build -g -ggdb -O0 examples/ch11/ch11-03-debugging/main.zc -o order_debug
$ gdb ./order_debug
```

### Setting Breakpoints on `.zc` Lines and Methods

Because the DWARF line table points directly to `main.zc`, you can set breakpoints using `.zc` filenames and line numbers, or by using Zen C's predictable C function names:

```text
(gdb) break main.zc:32
Breakpoint 1 at 0x198a: file examples/ch11/ch11-03-debugging/main.zc, line 33.

(gdb) run
Starting program: ./order_debug

Breakpoint 1, Order__total_cents (self=0x7fffffffc6c0)
    at examples/ch11/ch11-03-debugging/main.zc:33
33          let sub = self.subtotal();
```

Notice how GDB stops directly inside `main.zc` at line 33 and displays the original Zen C source line!

---

## Understanding Zen C Symbol Names in Debuggers

Because Zen C transpiles to C, identifiers in backtraces (`bt`) and breakpoint tab-completion follow a clean, deterministic naming scheme:

| Zen C Construct | Zen C Syntax | Debugger Symbol Name |
| :--- | :--- | :--- |
| Free function | `fn parse_header(...)` | `parse_header` |
| Struct method | `impl Order { fn total_cents(self) }` | `Order__total_cents` |
| Trait implementation | `impl Display for Order { fn to_string(&self) }` | `Order__Display__to_string` |
| Generic struct | `Vec<int>` / `Pair<int, string>` | `struct Vec_int` / `struct Pair_int_string` |
| Generic method | `vec.push(42)` on `Vec<int>` | `Vec_int__push` |
| RAII destructor glue | `impl Drop for Resource` | `Resource__Drop__glue` |
| Test block `N` | `test "my unit test" { ... }` | `_z_test_0`, `_z_test_1`, ... |
| Test runner | (auto-generated) | `_z_run_tests` |

> **Tip: Debugging a Failing `test` Block**
> Because every `test "..."` block is compiled to a regular C function (`_z_test_0`, `_z_test_1`, etc.) or can be targeted by `.zc` line number, you can build a test file with `zc build -g -ggdb -O0 my_test.zc -o my_test` and set a breakpoint directly inside the failing test block (`break my_test.zc:42` or `break __zenc_assert`).

---

## Inspecting Zen C Types in GDB and LLDB

One of the biggest advantages of Zen C's C11 backend is that every high-level Zen C abstraction has a transparent C struct layout in the debugger:

### 1. Inspecting Structs and Methods (`self`)

Inside a method like `Order::total_cents`, `self` is passed as a pointer (`Order *self`). Use `print *self` in GDB (or `frame variable *self` in LLDB) to inspect all fields at once:

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

### 2. Inspecting Slices (`T[]`)

A Zen C slice `int[]` is represented in C as `Slice__int32_t` containing `{ int32_t *data; usize len; usize cap; }`. In GDB, you can dereference `data` with the `@` array-slice operator (`*ptr@len`) to print all elements of a slice cleanly:

```text
(gdb) print self->item_prices.len
$3 = 3
(gdb) print *self->item_prices.data@self->item_prices.len
$4 = {1500, 2500, 1000}
```

### 3. Inspecting Tagged Union Enums (`enum` with Payloads)

A Zen C `enum` with payloads (such as `Discount`) compiles to a C struct with two fields:
- `.tag`: A tag enum value (`Discount__None_Tag`, `Discount__Percent_Tag`, `Discount__FlatCents_Tag`) that GDB prints symbolically!
- `.data`: A C `union` holding a named field for each payload variant (`self->discount.data.Percent`).

```text
(gdb) print self->discount.tag
$5 = Discount__Percent_Tag
(gdb) print self->discount.data.Percent
$6 = 20
```

---

## GDB vs. LLDB Quick Reference for Zen C

| Debugging Task | GDB Command | LLDB Command |
| :--- | :--- | :--- |
| Launch debugger | `gdb ./app` | `lldb ./app` |
| Break at `.zc` line | `break main.zc:33` | `breakpoint set --file main.zc --line 33` (or `b main.zc:33`) |
| Break on struct method | `break Order__total_cents` | `b Order__total_cents` |
| Start execution | `run` (`r`) | `run` (`r`) |
| Step over (next `.zc` line) | `next` (`n`) | `next` (`n`) |
| Step into function/method | `step` (`s`) | `step` (`s`) |
| Inspect local variables | `info locals` | `frame variable` (`fr v`) |
| Dereference `self` struct | `print *self` (`p *self`) | `p *self` |
| Print slice elements | `p *slice.data@slice.len` | `parray slice.len slice.data` |
| Show call stack | `backtrace` (`bt`) | `bt` |

---

## Visual Debugging in VS Code

Because Zen C emits standard DWARF line mappings pointing to `.zc` files, you can set red-dot breakpoints directly in the gutter of your `.zc` editor in VS Code, hover over variables to inspect their fields, and step through code using `F5` / `F10` / `F11`.

### 1. Configure `.vscode/tasks.json`

Create a build task that compiles the currently active `.zc` file with `-g -ggdb -O0`:

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

### 2. Configure `.vscode/launch.json`

Pair the build task with a launch configuration using either the Microsoft C/C++ extension (`cppdbg` with `gdb`) or the **CodeLLDB** extension (`lldb`):

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

Now open any `.zc` file in VS Code, click in the left gutter to place a breakpoint on a Zen C statement, and press **F5**. VS Code will automatically compile the `.zc` file with debug symbols, launch GDB, pause at your `.zc` breakpoint, and populate the **Variables**, **Watch**, and **Call Stack** panels!

---

## 🔍 Peek at the C: How `#line` Directives Map C Back to `.zc`

How does GDB know that address `0x18e5` inside the C function `Order__total_cents` corresponds to line 25 of `main.zc`?

When you compile with `-g`, Zen C's code generator (`emit_source_mapping` in `codegen_decl.c`) tracks the source token (`node->token.line` and `node->token.file`) of every AST statement and emits C preprocessor `#line` directives right before the generated C code:

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

Even when a Zen C statement triggers multiple deferred cleanups (`defer` or `Drop`) at the end of a scope, Zen C uses `emit_source_mapping_duplicate()` to emit a `#line` directive pointing back to the original `defer` or variable declaration line. As you step out of a block in GDB with `next`, you can literally watch the debugger jump to each `defer` line in LIFO order before returning from the function!
