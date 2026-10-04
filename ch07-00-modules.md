# Modules and Multi-File Projects

In earlier chapters, we wrote small programs that lived in a single file. As your codebases grow in size and complexity, keeping all your code in one file quickly becomes unmaintainable. Large software projects require separating code into logical modules, managing dependencies, preventing naming collisions, and strictly encapsulating internal implementation details.

In traditional C, project organization relies on the preprocessor `#include` directive. Because `#include` performs a simple textual copy-and-paste, C projects suffer from fragile header guards (`#ifndef FOO_H`), slow compilation times, macro pollution across translation units, and the lack of true namespaces.

Zen C replaces these legacy mechanisms with a modern, high-performance **Module System**.

---

## Chapter Roadmap

This chapter is organized into four sections:

1. **[Modules and Imports](ch07-01-modules-and-imports.md)**: How to define modules, use `import`, manage namespaces and aliases (`as alias`), and use selective imports (`import { ... } from "..."`).
2. **[Directory Modules and Re-exports](ch07-02-directory-modules.md)**: Structuring hierarchical packages using `mod.zc` and re-exporting symbols with `export import`.
3. **[Encapsulation with opaque](ch07-03-encapsulation.md)**: Enforcing data hiding with `opaque struct` (stack-allocated private fields) and `opaque alias` (nominal types).
4. **[Circular Dependency Prevention](ch07-04-circular-dependencies.md)**: How the compiler guarantees acyclic dependency graphs, standard project layouts, and the `ZC_ROOT` environment variable.

> [!NOTE]
> The complete reference tour of all Standard Library modules has been relocated to **[Appendix C: Zen C Standard Library Comprehensive Tour](appendix-03-std-tour.md)**. C header imports and FFI are covered in **[Chapter 12: Using C Libraries](ch12-00-using-c-libraries.md)**.

Let's begin by mastering modules and imports!
