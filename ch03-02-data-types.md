# Data Types

Every value in Zen C is of a specific **data type**, which determines how much memory is allocated, how binary bits are interpreted, and how the values transpile into C11 code.

Zen C provides a rich set of **primitive scalar types** (integers, floats, booleans, characters, runes, strings), **C interop types**, and **compound types** (fixed-size arrays).

---

## Primitive Types Overview

The following table summarizes all primitive scalar types in Zen C and their underlying C11 mapping:

| Type | C Equivalent | Description |
| :--- | :--- | :--- |
| `int`, `uint` | `int32_t`, `uint32_t` | 32-bit signed/unsigned integer (Standard default) |
| `i8` .. `i128` (or `I8` .. `I128`) | `int8_t` .. `__int128_t` | Fixed-width signed integers |
| `u8` .. `u128` (or `U8` .. `U128`) | `uint8_t` .. `__uint128_t` | Fixed-width unsigned integers |
| `byte` | `uint8_t` | Alias for `u8` / `U8` |
| `isize`, `usize` | `ptrdiff_t`, `size_t` | Pointer-sized signed/unsigned integers |
| `iN` / `uN` (e.g. `i256`, `u42`) | `_BitInt(N)` / `unsigned _BitInt(N)` | Arbitrary bit-width integer (C23 standard) |
| **C Interop Types** | | |
| `c_char`, `c_uchar` | `char`, `unsigned char` | Platform-dependent C char |
| `c_short`, `c_ushort` | `short`, `unsigned short` | Platform-dependent C short |
| `c_int`, `c_uint` | `int`, `unsigned int` | Platform-dependent C int |
| `c_long`, `c_ulong` | `long`, `unsigned long` | Platform-dependent C long |
| `c_longlong`, `c_ulonglong` | `long long`, `unsigned long long` | Platform-dependent C long long |
| **Floating-Point** | | |
| `f32` / `F32` | `float` | 32-bit single-precision float (IEEE 754) |
| `f64` / `F64` | `double` | 64-bit double-precision float (IEEE 754) |
| **Text & Special** | | |
| `bool` | `bool` | Boolean (`true` or `false`) |
| `char` | `char` | Single 8-bit ASCII character |
| `rune` | `uint32_t` | Unicode scalar value (UTF-32 code point) |
| `string` | `char*` | Null-terminated C string |
| `void`, `u0`, `U0` | `void` | Empty / return void type |

---

## Literals & Formatting Rules

Zen C provides modern syntax rules for writing numeric and text literals in source code.

### 1. Integer Literals & Number Bases

Integer literals can be written in several number bases:

- **Decimal**: `123`
- **Hexadecimal**: `0xFF`
- **Octal**: `0o755` (prefixed with `0o`)
- **Binary**: `0b1011` (prefixed with `0b`)

> [!IMPORTANT]
> **Leading Zeros in Zen C**: Unlike C (where numbers starting with `0` like `0123` are parsed as octal), Zen C treats leading zeros as standard **decimal** numbers. `0123` in Zen C evaluates to decimal `123`.

### 2. Readable Numeric Underscores

To enhance readability in large numbers or binary flags, you can insert visual underscores (`_`) anywhere inside numeric literals:

```zenc
let million = 1_000_000;
let bytes = 0b_1111_0000_1010_0101;
let pi_approx = 3_14.15_92_65;
```

---

## Unicode and Runes (`rune`)

Zen C provides first-class support for Unicode scalar values via the `rune` type. A `rune` represents a single UTF-32 Unicode code point stored as a 32-bit unsigned integer (`uint32_t`).

### Character vs. Rune Literals

| Literal | Type | Description |
| :--- | :--- | :--- |
| `'a'` | `char` / `rune` | Standard ASCII character |
| `'🚀'` | `rune` | Multi-byte Unicode emoji / character |
| `'\u{2764}'` | `rune` | Hexadecimal Unicode escape sequence |

**Listing 3-2: `list3-2.zc`**

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

Output:
```text
Char: a, Emoji: 🚀
```

---

## Best Practices for Portable Code

> [!TIP]
> **Portable Types vs. C Interop Types**
> 1. **Use Portable Types** (`int`, `uint`, `i64`, `u8`, etc.) for all pure Zen C application logic. `int` is guaranteed to be 32-bit signed on all target platforms and architectures.
> 2. **Use C Interop Types** (`c_int`, `c_char`, `c_long`, `c_ulong`, etc.) **only** when writing FFI wrapper code or interfacing directly with external C libraries. Their byte sizes vary depending on platform ABI (e.g. `c_long` is 32-bit on 64-bit Windows, but 64-bit on 64-bit Linux).
> 3. **Use `isize` and `usize`** for array indexing, slice lengths, and pointer arithmetic.

---

## Compound Types: Fixed-Size Arrays (`T[N]`)

An **array** is a fixed-length contiguous sequence of elements of the same type:

**Listing 3-3: `list3-3.zc`**

```zenc
 1 | fn main() {
 2 |     let numbers: i32[5] = [10, 20, 30, 40, 50];
 3 |     let first = numbers[0]; // 10
 4 |     numbers[0] = 99;        // Mutate first element
 5 |
 6 |     println "First: {first}, Updated: {numbers[0]}";
 7 | }
```

Output:
```text
First: 10, Updated: 99
```

Next, let's explore functions and lambdas in Zen C!
