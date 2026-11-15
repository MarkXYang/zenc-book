# Appendix A: Keywords

This appendix lists the keywords reserved in Zen C, grouped by purpose, along with notes on contextual or removed keywords.

## Declarations & Types

| Keyword | Purpose |
| :--- | :--- |
| `fn` | Declares a function or method. |
| `let` | Declares a variable binding. |
| `def` | Declares a compile-time constant (`def MAX = 100;`). |
| `struct` | Defines a product type (structure). |
| `enum` | Defines a sum type (tagged union / enumeration). |
| `union` | Defines an untagged C-style union (`union` overlays fields in the same memory). |
| `trait` | Defines an interface / behavioral contract. |
| `impl` | Implements methods or a `trait` for a type. |
| `alias` | Creates a type alias (`alias UserId = u64;`). |
| `opaque` | Declares an opaque type across module or FFI boundaries. |

## Modules, FFI & Low-Level Interop

| Keyword | Purpose |
| :--- | :--- |
| `import` | Imports a Zen C module (`import "std/vec.zc"`). |
| `include` | Includes a C header (`include <stdio.h>`). |
| `use` | Brings a namespace or symbol into scope. |
| `extern` | Declares external C functions or global variables. |
| `raw` | Emits verbatim C code (`raw { ... }`). |
| `asm` | Embeds inline assembly (`asm { ... }`). |
| `volatile` | Marks a memory access or inline assembly block as volatile. |

## Control Flow & Logical Operators

| Keyword | Purpose |
| :--- | :--- |
| `if` / `else` | Conditional branching. |
| `match` | Pattern matching on enums, integers, and values. |
| `for` / `in` | Iteration over ranges or collections (`for i in 0..10`). |
| `while` | Condition-controlled loop (`while cond { ... }`). |
| `loop` | Infinite loop (`loop { ... }`, exited via `break` or `return`). |
| `break` / `continue` | Exits or advances the enclosing loop. |
| `return` | Returns a value from a function. |
| `defer` | Schedules cleanup code to run when the enclosing scope exits. |
| `and` / `or` / `not` | Word-form logical operators (equivalent to `&&`, `||`, `!`). |

## Metaprogramming, Testing & Diagnostics

| Keyword | Purpose |
| :--- | :--- |
| `comptime` | Executes a block at compile time (`comptime { yield("..."); }`). |
| `embed` | Embeds a file at compile time as a byte slice, array, or `string`. |
| `sizeof` | Computes the compile-time byte size of a type or expression. |
| `test` | Declares a unit test block (`test "name" { ... }`). |
| `assert` | Runtime assertion (`assert(cond, "message")`). |
| `expect` | Test expectation / diagnostic assertion. |

## Removed Keywords

The following keywords existed in earlier prototypes of Zen C and have been **removed** from the language. Using them produces a compiler diagnostic suggesting the modern replacement:

- `async` / `await` — Removed in favor of explicit OS threads (`std/thread.zc`) and structured concurrency.
- `autofree` — Removed in favor of deterministic `defer` cleanup and RAII-style `Drop` patterns.
- `do` (as `do { ... } while ...`), `repeat`, `guard`, `unless` — Removed to keep control flow minimal (`loop`, `while`, `if !cond { return; }`).
