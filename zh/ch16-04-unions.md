# 16.4 无标签联合体与位操作

在 `struct` 中，每个字段都占据其独有的字节偏移量，结构体的大小至少等于其所有字段大小的总和。与此相反，在**无标签 `union`** 中，**每个字段都起始于字节偏移量 `0`，并共享完全相同的内存块**。

`union` 的大小仅取决于其**最大成员**的大小（向上舍入以满足该联合体最大成员的对齐要求）。向联合体的一个字段写入数据，会立即覆盖所有其他字段所共享的底层字节。

---

## 1. 声明与使用无标签 `union`

Zen C 使用 `union` 关键字声明无标签联合体，采用与 `struct` 相同的字段语法：

```zenc
union IpAddress4 {
    packed: u32;
    octets: u8[4];
}
```

`packed`（4 字节）和 `octets`（$4 \times 1 = 4$ 字节）共同占据相同的 4 字节内存：

```
IpAddress4 (sizeof == 4 bytes, all fields start at offset 0)
Offset:     0          1          2          3
         +----------+----------+----------+----------+
octets:  |   192    |   168    |    1     |   100    |  (u8[4])
         +----------+----------+----------+----------+
packed:  |      0x6401A8C0 (1677830336 in LE)        |  (u32)
         +-------------------------------------------+
```

当你初始化 `let ip = IpAddress4 { packed: 0 };` 随后向 `ip.octets[0..3]` 写入各个独立字节时，读取 `ip.packed` 即可立即反映组合后的 32 位字，无需进行任何指针强制转换或堆分配。

---

## 2. 使用联合体进行位重新解释（类型双关 / Type Punning）

一种经典的底层系统级技术是**类型双关（type punning）**：将浮点数（`f32` 或 `f64`）的原始二进制表示重新解释为相同宽度的无符号整数（`u32` 或 `u64`），以便你可以利用高速的按位移位和掩码操作来检查或修改其 IEEE 754 符号位、指数位和尾数位。

在 IEEE 754 `binary32` 标准下，32 位的 `f32` 被划分为三个位域：

- **第 31 位（1 位）**：符号位（正数为 `0`，负数为 `1`）。
- **第 23..30 位（8 位）**：带偏置的指数（$\text{指数} + 127$）。
- **第 0..22 位（23 位）**：小数尾数（有效数字）。

通过在 `union` 中覆盖 `value: f32` 和 `bits: u32`，我们可以清晰地提取出各个分量：

```zenc
union FloatBits {
    value: f32;
    bits: u32;
}

let fb = FloatBits { value: -3.5 };
let sign_bit: u32   = (fb.bits >> 31) & 1;        // 1 (negative)
let biased_exp: u32 = (fb.bits >> 23) & 0xFF;     // 128 (unbiased exponent = 128 - 127 = 1)
let mantissa: u32   = fb.bits & 0x7FFFFF;         // 0x600000 (1.75 * 2^1 = 3.5)
```

---

## 3. 无标签 `union` 与带标签 `enum` 的对比

在[第 6 章](ch06-00-enums-and-pattern-matching.md)中，你学习了 Zen C 的高级 `enum` 和类型（sum types），它们可以携带变体载荷并通过 `match` 进行穷尽性检查。在内部，带有载荷的 Zen C `enum` 是一个**由编译器管理的带标签联合体**：它在各变体载荷联合体的旁边存储一个整数判别标签（discriminant tag），并且只有在标签匹配时才允许你读取某个变体的数据。

为什么 Zen C 还要提供底层的无标签 `union` 类型呢？

| 特性 | 带标签 `enum`（第 6 章） | 无标签 `union`（16.4 节） |
| :--- | :--- | :--- |
| **判别标签** | 编译器自动管理的标签字段 | 无（零额外字节；可选择手动管理标签） |
| **模式匹配（`match`）** | 穷尽性的编译期安全检查 | 联合体本身不支持直接模式匹配 |
| **类型双关（`f32` $\leftrightarrow$ `u32`）** | 禁止 | 支持（各字段共享偏移量 `0`） |
| **C ABI / 硬件布局** | 使用 Zen C 内部的 enum 布局 | 与 C 语言 `union` ABI 完全 1:1 匹配 |

当与 C 语言库（例如 Linux 的 `epoll_data_t`、X11/SDL 事件结构体或嵌入式外设描述符）交互时，C 头文件通常会定义一个紧凑的结构体，将自定义的 `u8` 或 `u16` 标签与无标签 `union` 结合在一起：

```zenc
def EVENT_KEY: u8 = 1;
def EVENT_MOTION: u8 = 2;

@derive(Copy)
struct MotionData {
    dx: i16;
    dy: i16;
}

union EventPayload {
    key_code: u32;
    motion: MotionData;
}

struct HardwareEvent {
    kind: u8;
    payload: EventPayload;
}
```

> [!CAUTION]
> **无标签联合体不会跟踪活跃变体**：在无标签 `union` 中，编译器并不知道最近写入的是哪一个字段。此外，联合体无法在退出作用域时自动判断应该执行哪个字段的析构函数。请始终将无标签 `union` 的成员限制为普通的 `Copy` / 原语类型（整数、浮点数、裸指针或 `@derive(Copy)` 结构体）；只要你不需要精确的 C `union` 布局或位级类型双关，就应当优先使用 Zen C 的带标签 `enum`。

---

## 4. 完整示例：字节覆盖、IEEE 754 位检查与硬件事件

示例 16-4 展示了这三种模式：在 `IpAddress4` 中将四个 IPv4 字节与紧凑的 `u32` 覆盖，通过 `FloatBits` 提取 `-3.5f` 的 IEEE 754 符号、指数和尾数位，以及分发一个包含 `EventPayload` 联合体的 C 兼容 `HardwareEvent` 结构体。

**示例 16-4**：无标签联合体与位操作（`examples/ch16/ch16-04-unions/main.zc`）

```zenc
// File: examples/ch16/ch16-04-unions/main.zc

// 1. Untagged union overlaying a 32-bit unsigned integer and 4 raw bytes
union IpAddress4 {
    packed: u32;
    octets: u8[4];
}

// 2. IEEE 754 single-precision float bit reinterpretation
union FloatBits {
    value: f32;
    bits: u32;
}

// 3. Compact C-style tagged union for hardware events
def EVENT_KEY: u8 = 1;
def EVENT_MOTION: u8 = 2;

@derive(Copy)
struct MotionData {
    dx: i16;
    dy: i16;
}

union EventPayload {
    key_code: u32;
    motion: MotionData;
}

struct HardwareEvent {
    kind: u8;
    payload: EventPayload;
}

fn main() {
    // 1. Overlaying a 32-bit word and a 4-byte array in the same 4 bytes
    let ip = IpAddress4 { packed: 0 };
    ip.octets[0] = (u8)192;
    ip.octets[1] = (u8)168;
    ip.octets[2] = (u8)1;
    ip.octets[3] = (u8)100;

    println "sizeof(IpAddress4) = {sizeof(IpAddress4)} bytes";
    println "IP octets: {ip.octets[0]}.{ip.octets[1]}.{ip.octets[2]}.{ip.octets[3]}";
    println "IP packed u32: {ip.packed}";
    assert(sizeof(IpAddress4) == 4, "Union size equals its largest member (4 bytes)");
    assert(ip.packed != 0, "Writing to octets modifies the shared 32-bit word");

    // 2. Inspecting IEEE 754 sign, exponent, and mantissa bits of -3.5f
    let fb = FloatBits { value: -3.5 };
    let sign_bit: u32 = (fb.bits >> 31) & 1;
    let biased_exp: u32 = (fb.bits >> 23) & 0xFF;
    let mantissa: u32 = fb.bits & 0x7FFFFF;

    println "FloatBits(-3.5): raw={fb.bits}, sign={sign_bit}, exp={biased_exp}, mantissa={mantissa}";
    assert(fb.bits == 0xC0600000, "-3.5f in IEEE 754 binary32 is 0xC0600000");
    assert(sign_bit == 1 && biased_exp == 128, "Sign bit is 1 and biased exponent is 128 (2^1)");

    // 3. C-style manual tagged union struct
    let ev = HardwareEvent {
        kind: EVENT_MOTION,
        payload: EventPayload {
            motion: MotionData { dx: (i16)(-12), dy: (i16)34 },
        },
    };
    if ev.kind == EVENT_MOTION {
        println "Motion event: dx={ev.payload.motion.dx}, dy={ev.payload.motion.dy}";
        assert(ev.payload.motion.dx == -12 && ev.payload.motion.dy == 34, "Motion payload should match");
    }
}
```

使用 `zc run -q` 运行并验证示例 16-4：

```text
$ zc run -q examples/ch16/ch16-04-unions/main.zc
sizeof(IpAddress4) = 4 bytes
IP octets: 192.168.1.100
IP packed u32: 1677830336
FloatBits(-3.5): raw=3227516928, sign=1, exp=128, mantissa=6291456
Motion event: dx=-12, dy=34
```

---

## 本章小结

在本章中，你掌握了 Zen C 的底层内存管理工具集：

- **类型化裸指针（`T*`）与 `std/mem.zc`**：使用 `alloc<T>`、`alloc_n<T>`、`realloc_n<T>` 和 `dealloc<T>` 分配并调整零初始化的堆内存大小；通过带比例缩放的指针运算（`ptr + i`）遍历缓冲区；通过 `void*` 和 `u8*` 检查裸字节；以及使用 `mem_copy<T>` 和 `swap<T>` 复制或交换元素。
- **Arena 分配（`std/arena.zc`）**：使用 `Arena::new(cap)`、`arena.alloc<T>()`、`arena.alloc_n<T>(n)` 和 `arena.dup_str(s)` 将阶段作用域内的分配归并到单个连续缓冲区中；使用 `arena.save()` 和 `arena.restore(mark)` 在 $O(1)$ 时间内回收临时暂存分配；以及使用 `arena.reset()` 重置整个区域。
- **二进制结构体布局**：通过按对齐要求从大到小排列字段来最小化编译器填充；使用 `@packed` 剥离所有填充以适配网络传输协议；使用位域（`u8 : N`）打包亚字节标志；以及使用 `@align(N)` 强制缓存行或 SIMD 对齐。
- **无标签联合体（`union`）**：在字节偏移量 `0` 处覆盖多种表示，以实现 C FFI 兼容性、硬件事件记录以及 IEEE 754 位操作。

在[第 17 章：并发](ch17-00-concurrency.md)中，我们将探索如何使用 OS 线程、同步原语、消息传递通道以及工作池，在多个 CPU 核心上同时运行代码。
