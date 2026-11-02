# Chapter 16: Advanced Memory Management

In [Chapter 4](ch04-00-understanding-ownership.md), we explored Zen C's foundational memory model: values live on the stack by default, non-`Copy` resource types enforce single-owner move semantics, `defer` statements guarantee scope-exit cleanup, and implementing the `Drop` trait automates deterministic Resource Acquisition Is Initialization (RAII). For the vast majority of application code—manipulating `String` buffers, growing `Vec<T>` collections, or managing file handles—those high-level abstractions give you memory safety without manual bookkeeping or garbage collection pauses.

Systems programming, however, frequently requires stepping beneath high-level containers to take direct, byte-level control over how data is allocated, addressed, aligned, and represented in RAM:

- **Custom Data Structures and C Interop**: Building intrusive linked lists, ring buffers, custom allocators, or zero-copy FFI wrappers requires raw typed pointers (`T*`), type-erased pointers (`void*`), pointer arithmetic (`ptr + offset`), and typed heap allocation primitives from `std/mem.zc`.
- **High-Throughput Phase-Based Allocation**: Compilers, HTTP servers, game loops, and protocol parsers often allocate thousands of small, interconnected objects that share a single well-defined lifetime. Freeing each object individually adds allocator metadata overhead and cache-miss latency; grouping them into a contiguous **Arena** (`std/arena.zc`) turns allocation into an $O(1)$ pointer bump and deallocation into a single $O(1)$ offset reset.
- **Exact Binary Layout and Hardware Alignment**: Network protocols, file headers, and memory-mapped hardware registers demand exact byte offsets without compiler-inserted padding (`@packed`) or sub-byte flag packing (bitfields), while SIMD vector units and multi-core atomic counters require strict power-of-two boundary alignment (`@align(N)`).
- **Shared-Memory Overlay and Bit Reinterpretation**: Low-level drivers, variant payloads, and IEEE 754 floating-point bit manipulation sometimes need multiple fields to occupy the exact same memory address via untagged `union` types.

## Choosing the Right Memory Strategy

Before reaching for low-level primitives, match your problem to the highest-level abstraction that satisfies its performance and layout constraints:

| Mechanism | Typical Use Case | Allocation Cost | Deallocation Strategy |
| :--- | :--- | :--- | :--- |
| **Stack Values & RAII (`Vec<T>`, `String`, `Drop`)** | Everyday application state, dynamic collections, file/socket handles | Stack frame (or amortized heap in container) | Automatic via `Drop` at scope exit |
| **Typed Heap Primitives (`alloc<T>`, `alloc_n<T>` in `std/mem.zc`)** | Custom containers, dynamic buffers, manual C-compatible heap structures | Per-allocation `malloc` / `calloc` / `realloc` | Explicit `dealloc<T>(ptr)` (typically paired with `defer`) |
| **Region / Bump Allocator (`Arena` in `std/arena.zc`)** | AST nodes, per-request web buffers, per-frame game state, scratch tables | $O(1)$ 8-byte-aligned pointer bump | $O(1)$ `arena.restore(mark)`, `arena.reset()`, or automatic `Drop` |
| **Layout Attributes (`@packed`, `@align(N)`, bitfields)** | Wire headers, binary file formats, MMIO registers, cache-line / SIMD alignment | Identical to regular `struct` | Identical to regular `struct` |
| **Untagged Unions (`union`)** | C FFI unions, hardware event payloads, byte/bit punning | Identical to largest variant | Identical to regular `struct` (Copy / POD members) |

## What You Will Learn in This Chapter

1. **[16.1 Raw Pointers and Manual Memory (`T*`, `void*`)](ch16-01-raw-pointers.md)**: How to allocate zero-initialized heap memory with `alloc<T>` and `alloc_n<T>`, grow buffers with `realloc_n<T>`, perform scaled pointer arithmetic, inspect raw bytes through `void*` and `u8*` casts, and manipulate memory blocks with `mem_copy<T>`, `mem_zero<T>`, and `swap<T>`.
2. **[16.2 Arenas and Custom Allocators](ch16-02-arenas.md)**: How `Arena` in `std/arena.zc` eliminates per-object heap overhead using 8-byte-aligned bump allocation, string duplication (`dup_str`), scoped checkpoints (`save` and `restore`), and instant arena resets (`reset`).
3. **[16.3 Struct Layout, Padding, and Alignment (`@packed`, `@align`)](ch16-03-struct-layout.md)**: Why the compiler inserts padding bytes to satisfy CPU alignment rules, how reordering struct fields shrinks memory footprints for free, when to strip padding with `@packed` or pack sub-byte flags with bitfields, and how `@align(N)` prevents false sharing and enables SIMD loads.
4. **[16.4 Untagged Unions and Bit Manipulation](ch16-04-unions.md)**: How `union` overlays multiple fields at offset `0`, how to inspect raw bytes and IEEE 754 floating-point bitfields, and how to compare untagged C-style unions against Zen C's safe tagged `enum` sum types.
