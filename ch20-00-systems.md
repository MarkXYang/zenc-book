# Chapter 20: Systems and Safety-Critical Programming

Zen C was engineered from day one for systems-level development: OS kernels, bare-metal bootloaders, embedded microcontrollers, high-throughput financial engines, graphics pipelines, and safety-critical avionics or automotive control units.

In high-level managed languages, low-level hardware access is either forbidden or wrapped in slow, opaque foreign function interfaces. In traditional C, writing low-level code often sacrifices type safety, ergonomics, and modern language tooling. Zen C bridges this divide by providing first-class primitives for bare-metal systems and safety-critical engineering:

1. **Inline Assembly (`asm { ... }` / `asm volatile { ... }`)**: Direct hardware access to special CPU instructions, cycle counters (`rdtsc`), memory barriers (`mfence`), and atomic operations with seamless variable binding via `{var}`.
2. **Native SIMD Vectorization (`std/simd.zc`)**: 128-bit (SSE/NEON) and 256-bit (AVX/AVX2) vector types (`f32x4`, `i32x4`, `f32x8`, etc.) with compiler-accelerated component-wise arithmetic and bitwise operators.
3. **MISRA C:2012 Compliance Mode (`--misra`)**: Automatic compiler verification and generation of automotive-grade, safety-critical code conforming to MISRA C:2012 rules (enforcing strict boolean conditions, exhaustive branches, and single-point returns).
4. **Polyglot Interoperability (`--cpp`, `--objc`, `--cuda`)**: Compiling Zen C programs to target C++17 runtimes, Apple Objective-C frameworks, or NVIDIA CUDA device kernels (`@global`) without rewriting logic.
5. **Embedding Zen C in Existing C Codebases (`@export`, `@link_name`)**: Compiling Zen C modules into static (`.o`, `.a`) or shared (`.so`, `.dylib`, `.dll`) C libraries callable by any standard C host application.

---

## The Safety-Critical Spectrum

Different systems domains demand different safety and performance guarantees:

| Domain | Key Demands | Zen C Solution |
| :--- | :--- | :--- |
| **Bare-Metal & OS Kernels** | Hardware register access, memory fences, exact CPU instructions | `asm volatile { ... }`, raw pointers (`*T`), `@packed`, `@align` |
| **Game Engines & DSP** | High-throughput parallel arithmetic, zero allocation per frame | `std/simd.zc` (`f32x4`, `f32x8`), value types, arenas |
| **Automotive & Aerospace** | Deterministic control flow, zero undefined behavior, audit compliance | `zc --misra`, MISRA C:2012 checker, static bounds checking |
| **Heterogeneous Acceleration** | GPU parallel offloading, existing C++ engine interop | `zc --cuda`, `zc --cpp`, `zc --objc` |
| **Legacy Codebase Modernization** | Step-by-step migration without rewrite | `@export`, `@link_name`, seamless C header imports |

---

## What You Will Learn in This Chapter

1. **[20.1 Inline Assembly and Volatile](ch20-01-inline-assembly.md)**: Writing `asm` and `asm volatile` blocks, binding input/output registers with `{var}`, handling condition code clobbers, and controlling compiler optimization barriers.
2. **[20.2 Native SIMD Vectorization](ch20-02-simd.md)**: Using 128-bit and 256-bit vector types from `std/simd.zc`, executing component-wise arithmetic (`+`, `-`, `*`) and bitwise operations, and understanding hardware vector lowering.
3. **[20.3 MISRA C:2012 Compliance Mode](ch20-03-misra-mode.md)**: Enabling `--misra` mode, understanding key MISRA rules enforced by `zc`, inspecting defensive C output, and writing verifiable safety-critical software.
4. **[20.4 Polyglot Interoperability: C++, Objective-C, and CUDA](ch20-04-cpp-objc-cuda.md)**: Emitting C++ (`--cpp`), Objective-C (`--objc`), and NVIDIA CUDA (`--cuda`) source, mapping pointers to `nullptr`, and structuring polyglot applications.
5. **[20.5 Embedding Zen C in C Programs](ch20-05-embedding-zc.md)**: Exporting C-callable symbols with `@export` and `@link_name`, compiling reusable static and shared libraries, and integrating Zen C into an existing C build pipeline.
