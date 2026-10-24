# Writing Automated Tests & Debugging

In traditional C development, automated testing and source-level debugging often feel like separate worlds bolted onto the language from the outside. Writing unit tests in C typically requires choosing and vendoring an external framework (such as Unity, Check, Criterion, or GoogleTest), maintaining a parallel directory of test executables in `CMakeLists.txt` or `Makefile`, and manually wiring up `main()` functions that register every test function by hand. If you forget to register a test function in your runner array, that test silently never runs.

Zen C takes a batteries-included approach inspired by modern systems languages while staying 100% faithful to its C11 compilation model:

1. **First-Class `test` Blocks**: You write tests directly inside your `.zc` files using the `test "description" { ... }` declaration—either alongside the code under test in a module file or in dedicated test files. No external test libraries, header files, or registration macros are needed.
2. **Non-Fatal Expectations & Rich Assertions**: Built-in `assert` and `expect` statements—paired with helper functions from `std/test.zc`—let you check invariants with full string interpolation (`assert(actual == 42, "Expected 42, got {actual}")`). Even better, interpolated failure messages are lazily evaluated only when a check fails.
3. **Zero-Boilerplate Test Runner Generation**: When `zc` compiles a file that contains `test` blocks and no `fn main()`, it automatically synthesizes a test runner (`_z_run_tests()`) and a `main()` entry point that executes every test in sequence, isolates failures per test, runs `defer` and `Drop` cleanups at the end of each test scope, and exits with a non-zero status code equal to the number of failed checks.
4. **Source-Level Debugging with GDB, LLDB, and VS Code**: Because Zen C transpiles to human-readable C and emits `#line` preprocessor directives when compiled with `-g`, standard C debuggers (`gdb`, `lldb`, and the VS Code C/C++ or CodeLLDB extensions) step directly through your `.zc` source files line by line and inspect your structs, enums, and slices natively.

---

## How Zen C Testing Works Under the Hood

The following diagram illustrates how `zc` transforms your `test` blocks and assertions into a standalone, zero-dependency C test binary:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         rect.zc (Source File)                        │
│                                                                      │
│   struct Rectangle { width: int, height: int }                       │
│   impl Rectangle { ... }                                             │
│                                                                      │
│   test "area calculation" {                                          │
│       let r = Rectangle::new(10, 5);                                 │
│       assert(r.area() == 50, "Expected 50, got {r.area()}");         │
│   }                                                                  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼  zc run rect.zc
┌──────────────────────────────────────────────────────────────────────┐
│                     Generated C11 (Transpiler)                       │
│                                                                      │
│   1. Auto-imports `std/test.zc` (`expect_eq`, `expect_ne`, ...)      │
│   2. Emits `static int _z_test_0()` for each `test "..."` block      │
│   3. Emits `int _z_run_tests()` to run all tests & report summary    │
│   4. If no user `fn main()` exists, emits:                           │
│        int main() { return _z_run_tests(); }                         │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼  Backend C Compiler (gcc / clang)
┌──────────────────────────────────────────────────────────────────────┐
│                        Test Execution Output                         │
│                                                                      │
│     TEST: area calculation ... OK                                    │
│                                                                      │
│   0 test(s) failed   (Exit code: 0)                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Chapter Roadmap

In this chapter, we will master testing and debugging Zen C programs from the ground up:

- **[11.1 How to Write Tests](ch11-01-writing-tests.md)**: Writing `test "name" { ... }` blocks, checking invariants with `assert` and `expect`, formatting failure diagnostics with string interpolation, using `std/test.zc` comparison helpers (`expect_eq`, `expect_ne`, `expect_approx_eq`), and verifying resource cleanup with `defer` and `Drop`.
- **[11.2 Running Tests with `zc`](ch11-02-running-tests.md)**: Running standalone test suites and in-module unit tests with `zc run`, understanding how `zc` synthesizes `main()` vs. calling `_z_run_tests()` manually, filtering platform-specific tests with `@cfg(...)`, and integrating Zen C test suites into Makefiles and CI pipelines.
- **[11.3 Debugging with GDB, LLDB, and VS Code](ch11-03-debugging.md)**: Compiling with `-g -ggdb -O0` for source-level `#line` mappings and DWARF symbols, setting breakpoints on `.zc` files and methods, inspecting Zen C structs, tagged unions, and slices in `gdb` and `lldb`, keeping generated `.c` files with `--emit-c`, and configuring one-click visual debugging in VS Code.
