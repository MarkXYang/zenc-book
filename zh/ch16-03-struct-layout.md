# 底层结构体布局：位域、打包与对齐

当你在 Zen C 中声明一个 `struct` 时，其字段会严格按照你编写的顺序在内存中排布，遵循目标平台的 C 应用程序二进制接口（ABI）。然而，`sizeof(MyStruct)` 往往大于其各个独立字段大小之和。

理解编译器*为什么*会插入隐式的填充字节——并掌握如何通过重排字段、`@packed`、位域以及 `@align(N)` 来消除或增加这些填充——在你解析二进制网络数据包、内存映射硬件寄存器或优化缓存行密度时至关重要。

---

## 1. 自然对齐与编译器填充

当大小为 $N$ 字节的原语值存储在 $N$ 的倍数的内存地址上时，现代 CPU 获取内存的效率最高：

| 类型 | 大小（`sizeof`） | 自然对齐边界 |
| :--- | :--- | :--- |
| `u8`、`i8`、`char`、`bool` | 1 字节 | 任意地址（1 的倍数） |
| `u16`、`i16` | 2 字节 | 偶数地址（2 的倍数） |
| `u32`、`i32`、`int`、`f32` | 4 字节 | 4 的倍数 |
| `u64`、`i64`、`f64`、`usize`、`T*`（64 位） | 8 字节 | 8 的倍数 |

此外，整个 `struct` 的对齐要求必须等于**其所有字段中最大的对齐要求**，且其总 `sizeof` 必须填充为该结构体对齐要求的倍数，以便连续数组 `MyStruct[N]` 中的每个元素都能保持正确对齐。

以 `UnpackedHeader` 为例，它混合了 1 字节的 `u8`、8 字节的 `u64` 和 2 字节的 `u16`：

```zenc
struct UnpackedHeader {
    tag: u8;        // 1 byte  (offset 0) + 7 bytes padding (offsets 1..7)
    timestamp: u64; // 8 bytes (offsets 8..15, must be 8-byte aligned)
    length: u16;    // 2 bytes (offsets 16..17) + 6 bytes tail padding (offsets 18..23)
}
```

尽管实际有效载荷只有 $1 + 8 + 2 = 11$ 字节，但 `sizeof(UnpackedHeader)` 却是 **24 字节**——结构体中有一半以上都是无用的填充！

```
UnpackedHeader (24 bytes total, 8-byte alignment):
Offset:  0    1..7 (7B)     8..15 (8B)       16..17 (2B)  18..23 (6B)
       +-----+------------+----------------+-------------+------------+
       | tag | [padding]  |   timestamp    |   length    | [padding]  |
       +-----+------------+----------------+-------------+------------+
```

### 通过重排字段零成本缩小结构体

通过按**对齐要求降序**排列字段（先放 8 字节字段，再放 4 字节、2 字节和 1 字节字段），每个字段都能自然落到对齐的偏移量上，不会产生内部空隙：

```zenc
struct ReorderedHeader {
    timestamp: u64; // 8 bytes (offsets 0..7)
    length: u16;    // 2 bytes (offsets 8..9)
    tag: u8;        // 1 byte  (offset 10) + 5 bytes tail padding (offsets 11..15)
}
```

```
ReorderedHeader (16 bytes total, 8-byte alignment):
Offset:  0..7 (8B)          8..9 (2B)     10   11..15 (5B)
       +------------------+-------------+-----+------------+
       |    timestamp     |   length    | tag | [padding]  |
       +------------------+-------------+-----+------------+
```

仅仅通过重新排列这三个字段，结构体就从 **24 字节缩减到 16 字节**（在处理大型数组时可减少 33% 的内存占用），同时保持每个字段的高速访问和自然对齐。

---

## 2. 使用 `@packed` 消除填充

当你读取或写入二进制网络传输协议（例如 TCP/IP 报头、PNG 数据块或自定义遥测数据帧）时，外部字节流并不包含编译器插入的填充。为结构体添加 `@packed` 注解会指示编译器将每个字段紧随前一个字段放置，具有 **1 字节对齐且零填充**：

```zenc
@packed
struct PackedHeader {
    tag: u8;        // 1 byte  (offset 0)
    timestamp: u64; // 8 bytes (offsets 1..8)
    length: u16;    // 2 bytes (offsets 9..10)
}
// sizeof(PackedHeader) == 11 bytes
```

```
PackedHeader (11 bytes total, 1-byte alignment, 0 padding bytes):
Offset:  0    1..8 (8B)          9..10 (2B)
       +-----+------------------+-------------+
       | tag |    timestamp     |   length    |
       +-----+------------------+-------------+
```

> [!WARNING]
> **未对齐访问与指向 `@packed` 字段的指针**：由于 `PackedHeader.timestamp` 起始于字节偏移量 `1`，它在内存中是**未对齐**的。直接按值访问 `hdr.timestamp` 是安全的（编译器会生成未对齐加载/存储指令），但你**绝不能获取 `@packed` 结构体内部多字节字段的裸指针（`&hdr.timestamp`）**并将其传递给期望自然对齐的 `u64*` 的函数。在严格对齐的架构（或向量化 SIMD 指令）上，解引用未对齐的 `u64*` 可能会触发硬件对齐故障（alignment fault）。

---

## 3. 使用位域进行亚字节打包

硬件状态寄存器和紧凑型协议标志通常将多个布尔标志或小型多位字段打包进单个字节或字中。Zen C 支持 C 兼容的位域宽度，语法为 `field_name: IntegralType : bit_width;`：

```zenc
struct StatusRegister {
    ready: u8 : 1;    // Bit 0     (0..1)
    error: u8 : 1;    // Bit 1     (0..1)
    tx_empty: u8 : 1; // Bit 2     (0..1)
    mode: u8 : 2;     // Bits 3..4 (0..3)
    reserved: u8 : 3; // Bits 5..7 (0..7)
}
// Total: 1 + 1 + 1 + 2 + 3 = 8 bits -> sizeof(StatusRegister) == 1 byte
```

当你读取或写入 `reg.mode = (u8)3` 时，编译器会自动生成更新第 3 位和第 4 位所需的按位移位和掩码指令，而不会干扰相邻标志。因为位域没有独立的字节地址，所以无法获取位域的地址（不允许 `&reg.ready`）。

---

## 4. 使用 `@align(N)` 强制边界对齐

有时你需要与 `@packed` *相反*的效果：你需要结构体以比字段自然对齐更严格的 2 的幂次边界开始：

- **SIMD 向量加载（`@align(16)` 或 `@align(32)`）**：当结构体对齐到 16 或 32 字节时，SSE（`16` 字节）和 AVX（`32` 字节）向量寄存器可以用一条指令加载四个 `f32` 或八个 `f32` 值。
- **防止跨 CPU 核心的伪共享（`@align(64)`）**：现代 CPU 缓存以 **64 字节缓存行**为单位传输内存。如果不同核心上的两个线程频繁递增刚好位于同一条 64 字节缓存行中的两个独立 8 字节计数器，各个核心就会不断使彼此的缓存行失效（即*伪共享 / false sharing*）。为结构体标注 `@align(64)` 可以强制每个实例独占一条 64 字节缓存行，并将 `sizeof` 填充为 64 字节的倍数：

```zenc
@align(64)
struct CacheAlignedCounter {
    count: u64;
    label_id: u32;
}
// sizeof(CacheAlignedCounter) == 64 bytes, address is always a multiple of 64
```

---

## 5. 完整示例：检查大小、位域与缓存对齐

代码清单 16-3 对比了 `UnpackedHeader`（24 字节）、`ReorderedHeader`（16 字节）和 `PackedHeader`（11 字节）的内存占用，将五个硬件标志打包进 1 字节的 `StatusRegister`，并验证 `CacheAlignedCounter` 对齐在 64 字节边界上。

**代码清单 16-3**：控制结构体填充、位域与对齐（`examples/ch16/ch16-03-struct-layout/main.zc`）

```zenc
// File: examples/ch16/ch16-03-struct-layout/main.zc

// 1. Default C alignment inserts padding between `u8`, `u64`, and `u16`
struct UnpackedHeader {
    tag: u8;        // 1 byte + 7 bytes padding
    timestamp: u64; // 8 bytes
    length: u16;    // 2 bytes + 6 bytes tail padding
}

// 2. Reordering fields by descending alignment reduces padding naturally
struct ReorderedHeader {
    timestamp: u64; // 8 bytes
    length: u16;    // 2 bytes
    tag: u8;        // 1 byte + 5 bytes tail padding
}

// 3. `@packed` removes all compiler-inserted padding for wire/file protocols
@packed
struct PackedHeader {
    tag: u8;        // 1 byte
    timestamp: u64; // 8 bytes (immediately at offset 1)
    length: u16;    // 2 bytes (immediately at offset 9)
}

// 4. C-style bitfields pack multiple sub-byte flags into a single `u8`
struct StatusRegister {
    ready: u8 : 1;
    error: u8 : 1;
    tx_empty: u8 : 1;
    mode: u8 : 2;
    reserved: u8 : 3;
}

// 5. `@align(64)` enforces 64-byte cache-line alignment for concurrent/SIMD data
@align(64)
struct CacheAlignedCounter {
    count: u64;
    label_id: u32;
}

fn main() {
    let sz_unpacked = sizeof(UnpackedHeader);
    let sz_reordered = sizeof(ReorderedHeader);
    let sz_packed = sizeof(PackedHeader);
    let sz_status = sizeof(StatusRegister);
    let sz_aligned = sizeof(CacheAlignedCounter);

    println "sizeof(UnpackedHeader)      = {sz_unpacked} bytes";
    println "sizeof(ReorderedHeader)     = {sz_reordered} bytes";
    println "sizeof(PackedHeader)        = {sz_packed} bytes";
    println "sizeof(StatusRegister)      = {sz_status} byte";
    println "sizeof(CacheAlignedCounter) = {sz_aligned} bytes";

    assert(sz_unpacked == 24, "UnpackedHeader has 13 bytes of padding (24 bytes total)");
    assert(sz_reordered == 16, "ReorderedHeader shrinks to 16 bytes");
    assert(sz_packed == 11, "PackedHeader is exactly 1 + 8 + 2 = 11 bytes");
    assert(sz_status == 1, "1 + 1 + 1 + 2 + 3 = 8 bits = 1 byte");
    assert(sz_aligned == 64, "@align(64) pads the struct size to a multiple of 64 bytes");

    let reg = StatusRegister {
        ready: (u8)1,
        error: (u8)0,
        tx_empty: (u8)1,
        mode: (u8)3,
        reserved: (u8)0,
    };
    let ready: u8 = reg.ready;
    let error: u8 = reg.error;
    let tx_empty: u8 = reg.tx_empty;
    let mode: u8 = reg.mode;
    println "StatusRegister: ready={ready}, error={error}, tx_empty={tx_empty}, mode={mode}";
    assert(ready == 1 && mode == 3, "Bitfields should store 1 and 3");

    let counter = CacheAlignedCounter { count: 42, label_id: 7 };
    let addr: usize = (usize)&counter;
    println "CacheAlignedCounter address mod 64 = {addr % 64}";
    assert(addr % 64 == 0, "@align(64) must align variable on a 64-byte boundary");
}
```

使用 `zc run -q` 运行并验证代码清单 16-3：

```text
$ zc run -q examples/ch16/ch16-03-struct-layout/main.zc
sizeof(UnpackedHeader)      = 24 bytes
sizeof(ReorderedHeader)     = 16 bytes
sizeof(PackedHeader)        = 11 bytes
sizeof(StatusRegister)      = 1 byte
sizeof(CacheAlignedCounter) = 64 bytes
StatusRegister: ready=1, error=0, tx_empty=1, mode=3
CacheAlignedCounter address mod 64 = 0
```
