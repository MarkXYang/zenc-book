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
    - [Comments, Printing and String Interpolation](ch03-04-printing-and-interpolation.md)
    - [Control Flow](ch03-05-control-flow.md)

- [Ownership, Pointers and Cleanup](ch04-00-ownership-pointers-cleanup.md)
    - [Stack, Heap and Move Semantics](ch04-01-move-semantics.md)
    - [Pointers as Borrows](ch04-02-pointers.md)
    - [Slices](ch04-03-slices.md)
    - [Deterministic Cleanup: defer and Drop](ch04-04-cleanup.md)

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
    - [Modules and Imports](ch07-01-modules-and-imports.md)
    - [Directory Modules and Re-exports](ch07-02-directory-modules.md)
    - [Encapsulation with opaque](ch07-03-encapsulation.md)
    - [Circular Dependency Prevention](ch07-04-circular-dependencies.md)

- [Common Collections](ch08-00-common-collections.md)
    - [Vectors (Vec)](ch08-01-vectors.md)
    - [Strings](ch08-02-strings.md)
    - [Hash Maps and Sets](ch08-03-hash-maps.md)

- [Error Handling](ch09-00-error-handling.md)
    - [Unrecoverable Errors with panic](ch09-01-panic.md)
    - [Recoverable Errors with Result and Option](ch09-02-option-and-result.md)
    - [Cleanup on Error Paths with defer](ch09-03-defer-cleanup.md)
    - [Bridging C Return Codes and errno](ch09-04-c-errors.md)
    - [To panic or Not to panic](ch09-05-panic-guidelines.md)

- [Generics, Traits & Operator Overloading](ch10-00-generics-and-traits.md)
    - [Generic Data Types](ch10-01-generic-data-types.md)
    - [Traits: Defining Shared Behavior](ch10-02-traits.md)
    - [Standard Traits and Smart Derives](ch10-03-standard-traits.md)
    - [Operator Overloading](ch10-04-operator-overloading.md)

- [Writing Automated Tests & Debugging](ch11-00-testing.md)
    - [How to Write Tests](ch11-01-writing-tests.md)
    - [Running Tests with zc](ch11-02-running-tests.md)
    - [Debugging with GDB, LLDB, and VS Code](ch11-03-debugging.md)

- [Using C Libraries](ch12-00-using-c-libraries.md)
    - [C Header Imports vs Includes](ch12-01-c-headers.md)
    - [Explicit FFI Declarations](ch12-02-ffi-declarations.md)
    - [C Types, Strings, and Variadics](ch12-03-c-types-variadics.md)
    - [Linking and Build Directives](ch12-04-linking-directives.md)
    - [Hands-on Example: Raylib Graphics Window](ch12-05-raylib-example.md)

- [An I/O Project: Building zgrep](ch13-00-cli-project.md)
    - [Accepting Command Line Arguments](ch13-01-cli-arguments.md)
    - [Reading a File](ch13-02-reading-file.md)
    - [Refactoring to Improve Modularity and Error Handling](ch13-03-refactoring.md)
    - [Working with Environment Variables](ch13-04-env-variables.md)
    - [Writing Error Messages to Standard Error](ch13-05-stderr.md)

# Part III — Going Further

- [Functional Features: Closures and Iterators](ch14-00-functional-features.md)
    - [Lambdas and Closure Capture](ch14-01-lambdas.md)
    - [Raw Function Pointers (fn*)](ch14-02-fn-pointers.md)
    - [Processing Items with Iterators](ch14-03-iterators.md)
    - [Comparing Performance: Loops vs Iterators](ch14-04-performance.md)

- [The zc Toolchain and Compiler Backends](ch15-00-toolchain.md)
    - [Configuring Compiler Backends](ch15-01-compiler-backends.md)
    - [Inspecting Generated C and Name Mangling](ch15-02-generated-c.md)
    - [Actually Portable Executables (APE)](ch15-03-portable-ape.md)
    - [Developer Tooling: zc-doc, zc-format, REPL, and LSP](ch15-04-developer-tooling.md)

- [Advanced Memory Management](ch16-00-advanced-memory-management.md)
    - [Raw Pointers and Unsafe Operations](ch16-01-raw-pointers.md)
    - [Arena Allocators](ch16-02-arenas.md)
    - [Low-Level Struct Layout: Bitfields, Packing, and Alignment](ch16-03-struct-layout.md)
    - [Untagged Unions](ch16-04-unions.md)

- [Concurrency](ch17-00-concurrency.md)
    - [Using Threads to Run Code Simultaneously](ch17-01-threads.md)
    - [Shared-State Concurrency: Mutex and Atomics](ch17-02-mutex-sync.md)
    - [Message Passing with Queues](ch17-03-message-passing.md)
    - [Worker Pools and Task Dispatching](ch17-04-worker-pools.md)

- [Polymorphism: Composition and Trait Objects](ch18-00-polymorphism.md)
    - [Object-Oriented Characteristics of Zen C](ch18-01-oop-characteristics.md)
    - [Trait Objects for Dynamic Dispatch](ch18-02-trait-objects.md)
    - [Vtables Under the Hood in C11](ch18-03-vtables-in-c.md)
    - [Implementing an Object-Oriented Design Pattern](ch18-04-oop-patterns.md)

- [Metaprogramming and Compile-Time Execution](ch19-00-metaprogramming.md)
    - [Compile-Time Execution (comptime)](ch19-01-comptime.md)
    - [Attributes and Smart Derives](ch19-02-attributes-derives.md)
    - [Asset Embedding (embed) and Compiler Plugins](ch19-03-embed-plugins.md)
    - [Conditional Compilation and C Macros](ch19-04-conditional-macros.md)

- [Systems and Safety-Critical Programming](ch20-00-systems.md)
    - [Inline Assembly and Volatile](ch20-01-inline-assembly.md)
    - [Native SIMD Vectorization](ch20-02-simd.md)
    - [MISRA C:2012 Compliance Mode](ch20-03-misra-mode.md)
    - [Polyglot Interoperability: C++, Objective-C, and CUDA](ch20-04-cpp-objc-cuda.md)
    - [Embedding Zen C in C Programs](ch20-05-embedding-zc.md)

- [Final Project: Building a Multithreaded Web Server](ch21-00-final-project.md)
    - [Building a Single-Threaded Web Server](ch21-01-single-threaded.md)
    - [Turning Our Single-Threaded Server into a Multithreaded Server](ch21-02-multithreaded.md)
    - [Graceful Shutdown and Cleanup](ch21-03-graceful-shutdown.md)
    - [Extending the Server: Routing, Static Files, Timing, and JSON](ch21-04-extending-server.md)

# Appendix

- [Appendix A: Keywords](appendix-01-keywords.md)
- [Appendix B: Operators and Syntactic Sugar](appendix-02-operators.md)
- [Appendix C: Zen C Standard Library Comprehensive Tour](appendix-03-std-tour.md)
- [Appendix D: Development Tools](appendix-04-dev-tools.md)
- [Appendix E: MISRA C Compliance Rules Reference](appendix-05-misra-rules.md)
- [Appendix F: Zen C Quick Reference Cheat Sheet](appendix-06-cheatsheet.md)
- [Appendix G: Compiler Diagnostics and Error Guide](appendix-07-diagnostics.md)
- [Appendix H: Migrating Older Zen C Code](appendix-08-migration.md)
