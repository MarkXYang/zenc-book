# Zen C Book — Chapter Architecture Review

Scope: `/home/mark/code/zenc-app/book` (mdBook). Status today: Ch 0–8 are written (~210 KB). Ch 9–20 are only title stubs.
I checked it against the Zen C language reference (`zenc-docs/reference/01–17`), `Zen-C/std/`, and the current Rust Book (2024 edition, 21 chapters).

> [!IMPORTANT]
> Ch 9–20 haven't been written yet, so now is the cheapest time to change the structure. Most of the changes below only move existing sections around. The one real piece of new writing is the pointers/slices material in Ch 4.

---

## 1. Where the Rust structure doesn't fit Zen C

| Rust Book assumption | Zen C reality | What it means for the book |
|---|---|---|
| The borrow checker makes ownership the hard concept (Ch 4) | Move-by-default resources, but **no borrow checker or lifetimes**. You borrow with **pointers** (`T*`, `&x`) | Ch 4 has to teach pointers as the way to borrow. Right now raw pointers wait until Ch 15, but Ch 4 already uses `fn peek(r: Resource*)` and Ch 5 uses `?.` |
| Cleanup is implicit (`Drop`) | `defer`, `autofree`, `Drop`, `forget()` (all explicit and deterministic) | Teach **ownership first, then cleanup**. The current Ch 4 does it the other way round |
| FFI is an `unsafe` corner (Rust Ch 20) | Zero-FFI C interop is one of the **main selling points**. The std library is small, and real programs call libc/raylib/etc. | Bring "Using C libraries" forward into Part II |
| Lifetimes (Rust 10.3) | Don't exist | Use that slot for **standard traits, derives, operator overloading** |
| Cargo / crates.io (Rust Ch 14) | `zc` with pluggable C backends (gcc/clang/tcc/zig), `transpile`, APE, build directives, REPL, LSP, no package registry | Ch 14 becomes "The zc toolchain & C backends" |
| "Fearless concurrency" | Threads, mutexes, and `async` are **pthread-backed**, with no compile-time data-race guarantee | Rename the chapter and be honest about the trade-off. Teach async as threads underneath |
| OOP chapter discusses lack of inheritance | No inheritance. Zen C has **`use` composition/mixins** and trait objects (`let d: Drawable = &circle;`) | Ch 17 "Encapsulation and *Inheritance*" is misleading. Replace it with "Polymorphism: composition & trait objects" |
| Patterns get their own chapter (Rust Ch 19) | `match`, destructuring, `ref`, and ranges are a small surface | Fold patterns into Ch 6 |
| — | Metaprogramming is large: comptime, `embed`, plugins, attributes, derives, conditional compilation, inline asm, MISRA | The current Ch 19 has only one sub-chapter (comptime). It needs a real chapter, plus a separate "systems / safety-critical" chapter |

### Structural problems in the written chapters
1. **Ch 3 is overloaded.** It covers lambdas/captures, raw `fn*`, variadics (`va_list`), operator overloading, and input prompts before structs exist. Lambdas then come back in Ch 13.
2. **Operator overloading is taught twice**, in `ch03-05` and `ch05-02`, before traits.
3. **`ch05-01` mixes beginner and low-level topics.** Bitfields, `@packed`, and `@align` sit next to "defining a struct."
4. **`ch07-02` Standard Library Overview reads like a reference catalogue**, not a narrative chapter. It belongs in an appendix.
5. **There's no "inspect the generated C" thread.** This is Zen C's biggest teaching advantage over Rust, and the book doesn't use it consistently.
6. **The final project is an "Async Web Server",** but async is pthread-based. A thread-pool server (like Rust's) is more honest and teaches more.

---

## 2. Design principles for the new outline

1. **Keep Rust's three-part rhythm.** Part I covers fundamentals, Part II builds real programs, Part III goes further. Each part ends with a project.
2. **Ownership → borrowing (pointers) → cleanup** as one connected story in Ch 4.
3. **Teach C interop as an everyday skill (Part II), not an advanced trick.**
4. **Recurring sidebar convention:** a "🔍 Peek at the C" box (`zc transpile`) in every chapter, plus a "Coming from Rust / C" note where behaviour differs.
5. **Don't teach a feature before its prerequisite exists.** Operators that need traits wait until traits are covered, and closures wait until functions-as-values.

---

## 3. Proposed table of contents

```mermaid
flowchart LR
  P1["Part I: Fundamentals (Ch 1-6)"] --> P2["Part II: Building Real Programs (Ch 7-13)"] --> P3["Part III: Going Further (Ch 14-21)"] --> AP["Appendices A-G"]
```

### Part I — Fundamentals
| # | Chapter | Sub-chapters | Rust analogue |
|---|---|---|---|
| 0 | Introduction | Who this book is for (C, Rust, Go devs), how Zen C relates to C, book conventions ("Peek at the C") | Intro |
| 1 | Getting Started | 1.1 Installation · 1.2 Hello, World! · 1.3 Hello, `zc`! (run / build / **transpile**) | Ch 1 |
| 2 | Programming a Guessing Game | — | Ch 2 |
| 3 | Common Programming Concepts | 3.1 Variables & Constants (`let`/`const`/`def`) · 3.2 Data Types (primitives, runes, arrays, tuples, basic operators) · 3.3 Functions (named/default/const args) · 3.4 Comments, Printing & Interpolation · 3.5 Control Flow (`if`, loops, labels, `guard`/`unless`) | Ch 3 |
| 4 | **Ownership, Pointers & Cleanup** | 4.1 Stack, Heap & Move Semantics (resources vs `Copy`, `clone`) · 4.2 **Pointers as Borrows** (`T*`, `&`, auto-deref, `const`, `NULL`, `?.`, `??`) · 4.3 **Slices** · 4.4 Deterministic Cleanup (`defer`, `autofree`, `Drop`, `forget`) · sidebar: *What Zen C does not check* | Ch 4 |
| 5 | Structs & Composition | 5.1 Defining Structs · 5.2 Example: Rectangles · 5.3 Methods & `impl` (receivers, associated fns, primitive methods) · 5.4 **Composition with `use`** (mixins, named, method forwarding) | Ch 5 |
| 6 | Enums & Pattern Matching | 6.1 Enums as Tagged Unions (+ `Option`/`Result` intro) · 6.2 `match` · 6.3 **Patterns & Destructuring Everywhere** (`let`, `for`, `ref`, ranges) | Ch 6 + Ch 19 |

### Part II — Building Real Programs
| # | Chapter | Sub-chapters | Rust analogue |
|---|---|---|---|
| 7 | Modules & Multi-File Projects | 7.1 Modules & Imports · 7.2 Directory Modules & Re-exports · 7.3 Encapsulation with `opaque` · 7.4 Project Layout, `ZC_ROOT` & Build Directives | Ch 7 |
| 8 | Common Collections | 8.1 `Vec<T>` · 8.2 Strings (`string` vs `String` vs `char*`, UTF-8) · 8.3 `Map` & `Set` | Ch 8 |
| 9 | Error Handling | 9.1 `panic` & `assert` · 9.2 `Result`/`Option`, `?`, `??`, `guard` · 9.3 **Cleanup on Error Paths with `defer`** · 9.4 Wrapping C Error Codes / `errno` · 9.5 To panic or not | Ch 9 |
| 10 | Generics & Traits | 10.1 Generic Types (monomorphization, with the generated C) · 10.2 Traits & Bounds · 10.3 **Standard Traits & Derives** (`Drop`, `Copy`, `Clone`, `Iterable`, `@derive`) · 10.4 **Operator Overloading** | Ch 10 (lifetimes slot reused) |
| 11 | Testing & Debugging | 11.1 `test` blocks & assertions · 11.2 `zc test` · 11.3 **Debugging with gdb/lldb/VS Code** | Ch 11 |
| 12 | **Using C Libraries** | 12.1 Trusted `import "x.h"` vs `include` · 12.2 Explicit FFI declarations · 12.3 Linking (`-l`, build directives) · 12.4 Variadics & `va_list` · 12.5 Example: a raylib window | (Rust Ch 20.1, promoted) |
| 13 | I/O Project: Building `zgrep` | args, `fs`, errors, tests, env vars, stderr | Ch 12 |

### Part III — Going Further
| # | Chapter | Sub-chapters | Rust analogue |
|---|---|---|---|
| 14 | Functional Features | 14.1 Lambdas & Captures (`[=]`, `[&]`) · 14.2 Function Pointers (`fn*`) · 14.3 Iterators & `Iterable` · 14.4 Improving `zgrep` · 14.5 Performance (what closures compile to) | Ch 13 |
| 15 | The `zc` Toolchain | 15.1 C Backends (gcc/clang/tcc/zig) & Cross-compiling · 15.2 Release Builds, Flags & Build Directives · 15.3 Reading Generated C & Name Mangling · 15.4 Portable Binaries (APE) · 15.5 `zc-doc`, `zc-format`, REPL, LSP | Ch 14 |
| 16 | Advanced Memory Management | 16.1 Raw Pointer Operations (arithmetic, `void*`, casts) · 16.2 Allocators & Arenas · 16.3 Build Your Own Smart Pointer (`Box`/`Rc` via `Drop`) · 16.4 Unions & Memory Layout (bitfields, `@packed`, `@align`) | Ch 15 |
| 17 | Concurrency | 17.1 Threads · 17.2 Shared State: Mutex & Atomics · 17.3 Message Passing (queues) · 17.4 `async`/`await` (how it maps to pthreads, and how that differs from Rust) | Ch 16 + 17 |
| 18 | Polymorphism | 18.1 Is Zen C object-oriented? (encapsulation, no inheritance) · 18.2 Trait Objects & Dynamic Dispatch (vtables in C) · 18.3 Static vs Dynamic Dispatch · 18.4 Implementing the State Pattern | Ch 18 |
| 19 | Metaprogramming | 19.1 `comptime` · 19.2 Attributes, Custom Attributes & Smart Derives · 19.3 `embed` & Plugins · 19.4 Conditional Compilation & Generic C Macros | Ch 20 (macros) |
| 20 | Systems & Safety-Critical Programming | 20.1 Inline Assembly & `volatile` · 20.2 SIMD Vectors · 20.3 MISRA C Mode · 20.4 C++, Objective-C & CUDA · 20.5 Embedding Zen C in C | Ch 20 |
| 21 | Final Project: Multithreaded Web Server | 21.1 Single-threaded · 21.2 Thread Pool · 21.3 Graceful Shutdown & Cleanup (optional async variant) | Ch 21 |

### Appendices
A. Keywords · B. Operators & Syntactic Sugar · C. **Standard Library Tour** (moved from 7.2) · D. Editor & Dev Tools (VS Code, Vim, LSP) · E. MISRA Rule Reference · F. **Zen C for C and Rust Programmers** cheat-sheet · G. Diagnostics & Compiler Flags

---

## 4. Changes needed in the written chapters (1–8)

| Current location | Action | New location |
|---|---|---|
| `ch03-03` Lambdas, `fn*` | Move | 14.1, 14.2 |
| `ch03-03` Variadics / `va_list` | Move | 12.4 |
| `ch03-04` `match` sections | Trim to a short preview | 6.2 |
| `ch03-05` Operator overloading | Move and merge with `ch05-02` overloading | 10.4 |
| `ch03-05` Sugar ops (`?.`, `??`, `?`) | Spread out to where each is used | 4.2, 9.2 (Appendix B lists them all) |
| `ch03-06` Input prompts `?` | Keep (it's needed by the guessing game) | 3.4 |
| `ch04-01` / `ch04-02` | **Swap the order.** Write new **4.2 Pointers** and **4.3 Slices** | 4.1–4.4 |
| `ch05-01` Composition `use` | Split into its own file | 5.4 |
| `ch05-01` Bitfields, `@packed`, `@align` | Move | 16.4 |
| `examples/ch05/rectangles` | Promote to its own sub-chapter (already exists) | 5.2 |
| `ch05-02` Standard traits bridge | Move | 10.3 |
| `ch07-01` §7 C header imports | Leave a teaser and move the body | 12.1 |
| `ch07-02` Std library overview | Move | Appendix C |

> [!WARNING]
> Renumbering means renaming files (`chNN-MM-*.md`) **and** `examples/chNN/` directories, plus the "Listing X-Y" titles you added in commit `f3fce76`. I'd do the renames in one mechanical commit (git mv + sed) before writing Ch 9.

---

## 5. Draft `SUMMARY.md` (mdBook part headers)

```markdown
# Summary

[The Zen C Programming Language](ch00-00-introduction.md)

# Part I — Fundamentals
- [Getting Started](ch01-00-getting-started.md)
    - [Installation](ch01-01-installation.md)
    - [Hello, World!](ch01-02-hello-world.md)
    - [Hello, zc!](ch01-03-hello-zc.md)
- [Programming a Guessing Game](ch02-00-guessing-game-tutorial.md)
- [Common Programming Concepts](ch03-00-common-programming-concepts.md)
    - [Variables and Constants](ch03-01-variables-and-constants.md)
    - [Data Types](ch03-02-data-types.md)
    - [Functions](ch03-03-functions.md)
    - [Comments, Printing and Interpolation](ch03-04-printing-and-interpolation.md)
    - [Control Flow](ch03-05-control-flow.md)
- [Ownership, Pointers and Cleanup](ch04-00-ownership-pointers-cleanup.md)
    - [Stack, Heap and Move Semantics](ch04-01-move-semantics.md)
    - [Pointers as Borrows](ch04-02-pointers.md)
    - [Slices](ch04-03-slices.md)
    - [Deterministic Cleanup: defer, autofree and Drop](ch04-04-cleanup.md)
- [Structs and Composition](ch05-00-structs.md)
    - [Defining and Instantiating Structs](ch05-01-defining-structs.md)
    - [An Example Program Using Structs](ch05-02-example-structs.md)
    - [Method Syntax](ch05-03-method-syntax.md)
    - [Composition with use](ch05-04-composition.md)
- [Enums and Pattern Matching](ch06-00-enums.md)
    - [Defining an Enum](ch06-01-defining-an-enum.md)
    - [The match Construct](ch06-02-match.md)
    - [Patterns and Destructuring](ch06-03-patterns.md)

# Part II — Building Real Programs
- [Modules and Multi-File Projects](ch07-00-modules.md)
- [Common Collections](ch08-00-common-collections.md)
- [Error Handling](ch09-00-error-handling.md)
- [Generics and Traits](ch10-00-generics-and-traits.md)
- [Testing and Debugging](ch11-00-testing-and-debugging.md)
- [Using C Libraries](ch12-00-using-c-libraries.md)
- [An I/O Project: Building zgrep](ch13-00-io-project.md)

# Part III — Going Further
- [Functional Features: Lambdas and Iterators](ch14-00-functional-features.md)
- [The zc Toolchain](ch15-00-toolchain.md)
- [Advanced Memory Management](ch16-00-advanced-memory.md)
- [Concurrency](ch17-00-concurrency.md)
- [Polymorphism: Composition and Trait Objects](ch18-00-polymorphism.md)
- [Metaprogramming](ch19-00-metaprogramming.md)
- [Systems and Safety-Critical Programming](ch20-00-systems.md)
- [Final Project: A Multithreaded Web Server](ch21-00-final-project.md)

# Appendix
- [A — Keywords](appendix-01-keywords.md)
- [B — Operators and Syntactic Sugar](appendix-02-operators.md)
- [C — Standard Library Tour](appendix-03-std-tour.md)
- [D — Editors and Dev Tools](appendix-04-tools.md)
- [E — MISRA Rule Reference](appendix-05-misra.md)
- [F — Zen C for C and Rust Programmers](appendix-06-cheatsheet.md)
- [G — Diagnostics and Compiler Flags](appendix-07-diagnostics.md)
```
(Part II and III sub-chapters follow the tables in §3.)

---

## 6. Small housekeeping items I noticed
- `book.toml` → `git-repository-url = "https://github.com/zenc-lang/zenc"` doesn't match the real repos (`zenc-lang/Zen-C`, or your book repo).
- Compiled binaries are tracked: `examples/ch01/hello_world/hello` and `examples/ch03/ch03-05-01`. Also `sandbox/` contains a `.swp` file. Add these to `.gitignore`.
- The README pins `zc v0.4.4`. Keep one "Tested with" line per chapter so readers can tell when examples go stale.

## 7. Open questions
1. **Primary audience:** experienced C programmers (lean into "Peek at the C"), or general programmers like the Rust Book assumes? This decides how much of Ch 4.2 explains pointers from scratch.
2. **Ch 12 placement:** OK to promote C interop into Part II? Or would you rather keep it advanced and add only a short "calling a C function" section in Ch 7?
3. **Final project:** thread-pool web server (my recommendation), or keep async?
4. **Renumber now?** Should I apply the restructure to the repo (file renames, section moves, new `SUMMARY.md`) in one commit?
