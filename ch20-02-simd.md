# 20.2 Native SIMD Vectorization

Single Instruction, Multiple Data (**SIMD**) instructions execute the same arithmetic or logical operation simultaneously across multiple data lanes packed inside CPU vector registers.

On modern `x86_64` (SSE, AVX, AVX-512) and `aarch64` (ARM NEON) processors, SIMD unlocks dramatic throughput multipliers (2x to 8x+) for game math, physics engines, image processing, signal analysis, and machine learning kernels.

Zen C provides first-class, native SIMD vector types through the standard library module **`std/simd.zc`**.

---

## 1. Vector Types in `std/simd.zc`

`std/simd.zc` defines vector types using the `@vector(N)` attribute. The compiler maps these types directly to native GCC/Clang vector extensions:

### 128-Bit Vectors (SSE / NEON)
- `f32x4`: 4 x 32-bit floats
- `f64x2`: 2 x 64-bit floats (doubles)
- `i32x4`: 4 x 32-bit signed integers
- `u32x4`: 4 x 32-bit unsigned integers
- `i16x8`, `u16x8`: 8 x 16-bit integers
- `i8x16`, `u8x16`: 16 x 8-bit integers (bytes)

### 256-Bit Vectors (AVX / AVX2)
- `f32x8`: 8 x 32-bit floats
- `f64x4`: 4 x 64-bit floats
- `i32x8`: 8 x 32-bit signed integers
- `u32x8`: 8 x 32-bit unsigned integers
- `i16x16`, `u16x16`: 16 x 16-bit integers
- `i8x32`, `u8x32`: 32 x 8-bit integers

---

## 2. Component-Wise Operations & Indexing

Vector types support standard arithmetic and bitwise operators directly, operating across all lanes in parallel:

```zenc
import "std/simd.zc"

let a = f32x4 { v: 1.5 };
let b = f32x4 { v: 2.5 };

// Parallel addition of all 4 lanes:
let c = a + b; // [4.0, 4.0, 4.0, 4.0]

// Read individual lanes using array indexing:
let first = c[0];
let last  = c[3];
```

Supported operations include:
- **Arithmetic**: `+`, `-`, `*`, `/`
- **Bitwise** (integer vectors): `&`, `|`, `^`, `~`, `<<`, `>>`
- **Lane Access**: `vec[index]` reads lane `index`

---

## 3. 🔍 Peek at the C: Vector Attribute Lowering

In `std/simd.zc`, vector types are annotated with `@vector(N)`:

```zenc
@vector(4)
struct f32x4 {
    v: f32;
}
```

When transpiled to C11, `zc` lowers this struct into GCC/Clang native vector types:

```c
typedef float f32x4 __attribute__((vector_size(16)));
```

Because the C compiler backend understands native vector extensions, an expression like `a + b` emits a single hardware vector instruction (such as `addps` on x86_64 or `fadd.4s` on ARM NEON) rather than a scalar loop.

---

## 4. Complete Example: Listing 20-2

Listing 20-2 exercises 128-bit float vectors, integer bitwise masking, and 256-bit AVX vectors.

**Listing 20-2**: `list20-2.zc` — SIMD vector operations (`examples/ch20/ch20-02-simd/main.zc`)

```zenc
// File: examples/ch20/ch20-02-simd/main.zc
import "std/simd.zc"

fn main() {
    println "Testing SIMD vectorization in Zen C...";

    // 1. 128-bit float vectors (4 x f32)
    let a = f32x4 { v: 1.5 };
    let b = f32x4 { v: 2.5 };

    // Parallel component-wise addition: [1.5, 1.5, 1.5, 1.5] + [2.5, 2.5, 2.5, 2.5]
    let c = a + b;
    let c0 = c[0];
    let c3 = c[3];
    println "f32x4 addition [0]: {c0}, [3]: {c3}";
    assert(c0 == 4.0 && c3 == 4.0, "f32x4 addition mismatch");

    // Parallel component-wise multiplication
    let d = a * b;
    let d0 = d[0];
    println "f32x4 multiplication [0]: {d0}";
    assert(d0 == 3.75, "f32x4 multiplication mismatch");

    // 2. 128-bit integer vectors (4 x i32) with bitwise operations
    let mask1 = i32x4 { v: 0xFF };
    let mask2 = i32x4 { v: 0x0F };
    let bit_and = mask1 & mask2;
    let b0 = bit_and[0];
    println "i32x4 bitwise AND [0]: {b0}";
    assert(b0 == 15, "i32x4 bitwise AND mismatch");

    // 3. 256-bit AVX vectors (8 x f32)
    let v8_a = f32x8 { v: 10.0 };
    let v8_b = f32x8 { v: 2.0 };
    let v8_sub = v8_a - v8_b;
    let s0 = v8_sub[0];
    let s7 = v8_sub[7];
    println "f32x8 subtraction [0]: {s0}, [7]: {s7}";
    assert(s0 == 8.0 && s7 == 8.0, "f32x8 subtraction mismatch");

    println "SIMD vector operations executed successfully!";
}
```

Run and verify Listing 20-2 with `zc run -q`:

```console
$ zc run -q examples/ch20/ch20-02-simd/main.zc
Testing SIMD vectorization in Zen C...
f32x4 addition [0]: 4.000000, [3]: 4.000000
f32x4 multiplication [0]: 3.750000
i32x4 bitwise AND [0]: 15
f32x8 subtraction [0]: 8.000000, [7]: 8.000000
SIMD vector operations executed successfully!
```

---

## Summary

- Import `std/simd.zc` to access 128-bit (`f32x4`, `i32x4`) and 256-bit (`f32x8`, `i32x8`) vector types.
- Standard arithmetic operators (`+`, `-`, `*`, `/`) execute across all lanes concurrently without manual intrinsics.
- Use vector indexing (`vec[i]`) to extract or inspect individual scalar elements.
- The compiler lowers `@vector(N)` structs directly into hardware SIMD registers, emitting zero runtime overhead.
