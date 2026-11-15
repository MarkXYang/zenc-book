# 数据类型

Zen C 中的每个值都属于特定的**数据类型**，数据类型决定了分配多少内存、如何解释二进制位以及如何将这些值转译为 C11 代码。

Zen C 提供了丰富的**标量基础类型**（整数、浮点数、布尔值、字符、Rune、字符串）、**C 互操作类型**以及**复合类型**（固定大小数组）。

---

## 基础类型概览

下表总结了 Zen C 中的所有标量基础类型及其底层的 C11 映射关系：

| 类型 | 对应 C 类型 | 描述 |
| :--- | :--- | :--- |
| `int`, `uint` | `int32_t`, `uint32_t` | 32 位有符号/无符号整数（标准默认值） |
| `i8` .. `i128`（或 `I8` .. `I128`） | `int8_t` .. `__int128_t` | 固定宽度有符号整数 |
| `u8` .. `u128`（或 `U8` .. `U128`） | `uint8_t` .. `__uint128_t` | 固定宽度无符号整数 |
| `byte` | `uint8_t` | `u8` / `U8` 的别名 |
| `isize`, `usize` | `ptrdiff_t`, `size_t` | 指针大小的有符号/无符号整数 |
| `iN` / `uN`（例如 `i256`, `u42`） | `_BitInt(N)` / `unsigned _BitInt(N)` | 任意位宽整数（C23 标准） |
| **C 互操作类型** | | |
| `c_char`, `c_uchar` | `char`, `unsigned char` | 平台相关的 C char |
| `c_short`, `c_ushort` | `short`, `unsigned short` | 平台相关的 C short |
| `c_int`, `c_uint` | `int`, `unsigned int` | 平台相关的 C int |
| `c_long`, `c_ulong` | `long`, `unsigned long` | 平台相关的 C long |
| `c_longlong`, `c_ulonglong` | `long long`, `unsigned long long` | 平台相关的 C long long |
| **浮点类型** | | |
| `f32` / `F32` | `float` | 32 位单精度浮点数（IEEE 754） |
| `f64` / `F64` | `double` | 64 位双精度浮点数（IEEE 754） |
| **文本与特殊类型** | | |
| `bool` | `bool` | 布尔值（`true` 或 `false`） |
| `char` | `char` | 单个 8 位 ASCII 字符 |
| `rune` | `uint32_t` | Unicode 标量值（UTF-32 码点） |
| `string` | `char*` | 以空字符结尾的 C 字符串 |
| `void`, `u0`, `U0` | `void` | 空类型 / 无返回值 void 类型 |

---

## 字面量与格式化规则

Zen C 提供了现代化的语法规则，用于在源代码中书写数值和文本字面量。

### 1. 整数字面量与数制进制

整数字面量可以用多种进制表示：

- **十进制**：`123`
- **十六进制**：`0xFF`
- **八进制**：`0o755`（以 `0o` 为前缀）
- **二进制**：`0b1011`（以 `0b` 为前缀）

> [!IMPORTANT]
> **Zen C 中的前导零**：与 C 语言不同（在 C 语言中以 `0` 开头的数字如 `0123` 会被解析为八进制），Zen C 将前导零视作标准**十进制**数字。Zen C 中的 `0123` 求值结果为十进制的 `123`。

### 2. 增强可读性的数值下划线

为了增强长数字或二进制标志的可读性，你可以在数值字面量中的任意位置插入可视下划线（`_`）：

```zenc
let million = 1_000_000;
let bytes = 0b_1111_0000_1010_0101;
let pi_approx = 3_14.15_92_65;
```

---

## Unicode 与 Rune (`rune`)

Zen C 通过 `rune` 类型为 Unicode 标量值提供了一流支持。一个 `rune` 代表一个存储为 32 位无符号整数（`uint32_t`）的 UTF-32 Unicode 码点。

### 字符与 Rune 字面量对比

| 字面量 | 类型 | 描述 |
| :--- | :--- | :--- |
| `'a'` | `char` / `rune` | 标准 ASCII 字符 |
| `'🚀'` | `rune` | 多字节 Unicode Emoji / 字符 |
| `'\u{2764}'` | `rune` | 十六进制 Unicode 转义序列 |

**代码清单 3-2：`list3-2.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let c: char = 'a';
 5 |     let emoji: rune = '🚀';
 6 |
 7 |     println "Char: {c}, Emoji: {emoji}";
 8 | }
```

输出：
```text
Char: a, Emoji: 🚀
```

---

## 编写可移植代码的最佳实践

> [!TIP]
> **可移植类型 vs C 互操作类型**
> 1. **在所有纯 Zen C 应用程序逻辑中优先使用可移植类型**（`int`、`uint`、`i64`、`u8` 等）。`int` 在所有目标平台和架构上均保证为 32 位有符号整数。
> 2. **仅在编写 FFI 包装代码或直接与外部 C 库交互时使用 C 互操作类型**（`c_int`、`c_char`、`c_long`、`c_ulong` 等）。它们的字节大小取决于特定平台的 ABI（例如 `c_long` 在 64 位 Windows 上为 32 位，但在 64 位 Linux 上为 64 位）。
> 3. **使用 `isize` 和 `usize`** 进行数组索引、切片长度计算以及指针算术运算。

---

## 复合类型：固定大小数组 (`T[N]`)

**数组**是相同类型元素的固定长度连续序列：

**代码清单 3-3：`list3-3.zc`**

```zenc
 1 | fn main() {
 2 |     let numbers: i32[5] = [10, 20, 30, 40, 50];
 3 |     let first = numbers[0]; // 10
 4 |     numbers[0] = 99;        // Mutate first element
 5 |
 6 |     println "First: {first}, Updated: {numbers[0]}";
 7 | }
```

输出：
```text
First: 10, Updated: 99
```

接下来，让我们探索 Zen C 中的函数与 Lambda！
