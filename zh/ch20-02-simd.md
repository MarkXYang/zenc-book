# 20.2 原生 SIMD 向量化

单指令多数据（**SIMD**）指令能够在 CPU 向量寄存器内打包的多个数据通道（lanes）上，同时执行相同的算术或逻辑运算。

在现代 `x86_64`（SSE、AVX、AVX-512）与 `aarch64`（ARM NEON）处理器上，SIMD 为游戏数学、物理引擎、图像处理、信号分析以及机器学习内核带来了显著的吞吐量倍增（2 倍至 8 倍以上）。

Zen C 通过标准库模块 **`std/simd.zc`** 提供一等公民的原生 SIMD 向量类型。

---

## 1. `std/simd.zc` 中的向量类型

`std/simd.zc` 使用 `@vector(N)` 属性定义向量类型。编译器将这些类型直接映射到底层 GCC/Clang 向量扩展：

### 128 位向量（SSE / NEON）
- `f32x4`：4 个 32 位浮点数
- `f64x2`：2 个 64 位浮点数（双精度）
- `i32x4`：4 个 32 位有符号整数
- `u32x4`：4 个 32 位无符号整数
- `i16x8`、`u16x8`：8 个 16 位整数
- `i8x16`、`u8x16`：16 个 8 位整数（字节）

### 256 位向量（AVX / AVX2）
- `f32x8`：8 个 32 位浮点数
- `f64x4`：4 个 64 位浮点数
- `i32x8`：8 个 32 位有符号整数
- `u32x8`：8 个 32 位无符号整数
- `i16x16`、`u16x16`：16 个 16 位整数
- `i8x32`、`u8x32`：32 个 8 位整数

---

## 2. 逐分量运算与索引

向量类型直接支持标准算术与位运算符，并跨所有通道并行运算：

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

支持的操作包括：
- **算术运算**：`+`、`-`、`*`、`/`
- **位运算**（整数向量）：`&`、`|`、`^`、`~`、`<<`、`>>`
- **通道访问**：`vec[index]` 读取通道 `index`

---

## 3. 🔍 窥探底层 C 代码：向量属性下沉

在 `std/simd.zc` 中，向量类型使用 `@vector(N)` 注解：

```zenc
@vector(4)
struct f32x4 {
    v: f32;
}
```

当转译为 C11 时，`zc` 会将该结构体下沉为 GCC/Clang 原生向量类型：

```c
typedef float f32x4 __attribute__((vector_size(16)));
```

由于 C 编译器后端能理解原生向量扩展，像 `a + b` 这样的表达式会生成单条硬件向量指令（例如 x86_64 上的 `addps` 或 ARM NEON 上的 `fadd.4s`），而不是标量循环。

---

## 4. 完整示例：代码清单 20-2

代码清单 20-2 演示了 128 位浮点向量、整数位掩码以及 256 位 AVX 向量的使用。

**代码清单 20-2**：`list20-2.zc` —— SIMD 向量操作（`examples/ch20/ch20-02-simd/main.zc`）

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

使用 `zc run -q` 运行并验证代码清单 20-2：

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

## 本节小结

- 导入 `std/simd.zc` 即可使用 128 位（`f32x4`、`i32x4`）与 256 位（`f32x8`、`i32x8`）向量类型。
- 标准算术运算符（`+`、`-`、`*`、`/`）可跨所有通道并发执行，无需手动编写内建函数（intrinsics）。
- 使用向量索引（`vec[i]`）提取或审查单个标量元素。
- 编译器将 `@vector(N)` 结构体直接下沉为硬件 SIMD 寄存器操作，产生零运行时开销。
