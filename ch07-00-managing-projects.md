# Managing Growing Projects

In earlier chapters, we wrote small programs that lived in a single file. As your codebases grow in size and complexity, keeping all your code in one file quickly becomes unmaintainable. Large software projects require separating code into logical modules, managing dependencies, preventing naming collisions, and strictly encapsulating internal implementation details.

In traditional C, project organization relies on the preprocessor `#include` directive. Because `#include` performs a simple textual copy-and-paste, C projects suffer from fragile header guards (`#ifndef FOO_H`), slow compilation times, macro pollution across translation units, and the lack of true namespaces. Furthermore, implementing private fields in C requires cumbersome "opaque pointer" idioms (`struct Foo*` allocated on the heap via `malloc`), incurring runtime performance overhead.

Zen C replaces these legacy mechanisms with a modern, high-performance **Module System** and an extensive **Standard Library**.

---

## What Makes Zen C's Module System Unique?

Zen C's module system is designed from the ground up for safety, speed, and clean software architecture:

- **Every File is a Module**: You do not need to configure separate package manifests or complex build scripts for basic modularity. Every `.zc` source file represents an independent, cleanly scoped module.
- **Hierarchical Directory Packages (`mod.zc`)**: Folders containing a `mod.zc` file are automatically resolved as directory modules, enabling intuitive multi-level project structures.
- **Clean Namespace Isolation**: Import modules under their natural names or define custom aliases (`import "path.zc" as my_alias;`). Access module members cleanly with the double-colon (`::`) operator.
- **Selective Imports**: Bring only the functions, structs, or constants you need into local scope (`import { add, PI } from "math_utils.zc";`).
- **Compile-Time Circular Dependency Detection**: The `zc` compiler actively prevents circular imports (`Circular import detected`), enforcing clean, acyclic dependency graphs.
- **Zero-Cost Encapsulation (`opaque`)**:
  - `opaque struct`: Protects private fields so that only code within the defining module can access them. Unlike C's heap-allocated opaque pointers, Zen C's opaque structs retain value semantics and can be allocated directly on the stack!
  - `opaque alias`: Creates nominal, non-interchangeable type wrappers for primitives (e.g., distinguishing a `UserID` from an `AccountID` at compile time).
- **Direct C Interoperability**: Seamlessly import C headers as modules (`import "math.h" as c_math;`) or emit preprocessor includes with strict FFI signatures (`include <stdio.h>`).

---

## Batteries Included: The Standard Library

Zen C ships with a rich standard library (`std`) covering essential systems programming needs without third-party dependencies:

- **Dynamic Collections**: Fast generic arrays (`std/vec.zc`), hash maps (`std/map.zc`), sets (`std/set.zc`), ring queues (`std/queue.zc`), and stacks (`std/stack.zc`).
- **Text & UTF-8**: Heap-allocated growable strings (`std/string.zc`), UTF-8 decoders (`std/utf8.zc`), and regular expressions (`std/regex.zc`).
- **Filesystem & I/O**: File streams (`std/fs.zc`), path manipulation (`std/path.zc`), and formatted terminal I/O (`std/io.zc`).
- **OS & Concurrency**: Process management (`std/process.zc`), environment variables (`std/env.zc`), high-resolution clocks (`std/time.zc`), and multithreading primitives (`std/thread.zc`, `std/sync.zc`).
- **Numerics & SIMD**: Math functions (`std/math.zc`), arbitrary-precision arithmetic (`std/bigint.zc`, `std/bigfloat.zc`), bit manipulation (`std/bits.zc`), and native vectorization (`std/simd.zc`).

---

## Chapter Roadmap

This chapter is organized into two sections:

1. **[Modules and Imports](ch07-01-modules-and-imports.md)**: How to define modules, use `import`, manage namespaces and aliases, structure directory packages with `mod.zc`, enforce data hiding with `opaque struct` and `opaque alias`, and integrate C headers.
2. **[Standard Library Overview](ch07-02-standard-library-overview.md)**: A tour of the standard library, covering key modules, data structures, I/O, system utilities, and how `zc` locates standard modules.

Let's begin by mastering modules and imports!
