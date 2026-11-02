# 16.3 Struct Layout, Padding, and Alignment (`@packed`, `@align`)

When you declare a `struct` in Zen C, its fields are laid out in memory in the exact order you write them, following the target platform's C Application Binary Interface (ABI). However, `sizeof(MyStruct)` is often larger than the sum of its individual field sizes.

Understanding *why* the compiler inserts invisible padding bytes—and knowing how to eliminate or increase that padding with field reordering, `@packed`, bitfields, and `@align(N)`—is essential when you parse binary network packets, memory-map hardware registers, or optimize cache-line density.

---

## 1. Natural Alignment and Compiler Padding

Modern CPUs fetch memory most efficiently when a primitive value of size $N$ bytes is stored at a memory address that is a multiple of $N$:

| Type | Size (`sizeof`) | Natural Alignment Boundary |
| :--- | :--- | :--- |
| `u8`, `i8`, `char`, `bool` | 1 byte | Any address (multiple of 1) |
| `u16`, `i16` | 2 bytes | Even address (multiple of 2) |
| `u32`, `i32`, `int`, `f32` | 4 bytes | Multiple of 4 |
| `u64`, `i64`, `f64`, `usize`, `T*` (64-bit) | 8 bytes | Multiple of 8 |

Furthermore, a `struct` as a whole must have an alignment equal to the **largest alignment of any of its fields**, and its total `sizeof` must be padded to a multiple of that struct alignment so that elements in a contiguous array `MyStruct[N]` stay properly aligned.

Consider `UnpackedHeader`, which mixes a 1-byte `u8`, an 8-byte `u64`, and a 2-byte `u16`:

```zenc
struct UnpackedHeader {
    tag: u8;        // 1 byte  (offset 0) + 7 bytes padding (offsets 1..7)
    timestamp: u64; // 8 bytes (offsets 8..15, must be 8-byte aligned)
    length: u16;    // 2 bytes (offsets 16..17) + 6 bytes tail padding (offsets 18..23)
}
```

Even though the useful payload is only $1 + 8 + 2 = 11$ bytes, `sizeof(UnpackedHeader)` is **24 bytes**—more than half of the struct is padding!

```
UnpackedHeader (24 bytes total, 8-byte alignment):
Offset:  0    1..7 (7B)     8..15 (8B)       16..17 (2B)  18..23 (6B)
       +-----+------------+----------------+-------------+------------+
       | tag | [padding]  |   timestamp    |   length    | [padding]  |
       +-----+------------+----------------+-------------+------------+
```

### Shrinking Structs for Free by Reordering Fields

By sorting fields in **descending order of alignment** (8-byte fields first, then 4-byte, 2-byte, and 1-byte fields), every field naturally lands on an aligned offset without interior gaps:

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

Simply reordering the three fields shrinks the struct from **24 bytes to 16 bytes** (a 33% memory reduction across large arrays) while keeping every field fast and naturally aligned.

---

## 2. Eliminating Padding with `@packed`

When you read or write a binary wire protocol (such as a TCP/IP header, a PNG chunk, or a custom telemetry frame), the external byte stream does not contain compiler padding. Annotating a struct with `@packed` instructs the compiler to place every field immediately after the previous one with **1-byte alignment and zero padding**:

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
> **Unaligned Access and Pointers to `@packed` Fields**: Because `PackedHeader.timestamp` starts at byte offset `1`, it is **unaligned** in memory. Accessing `hdr.timestamp` directly by value is safe (the compiler emits unaligned load/store instructions), but you should **never take a raw pointer (`&hdr.timestamp`)** to a multi-byte field inside a `@packed` struct and pass it to a function expecting a naturally aligned `u64*`. On strict-alignment architectures (or vectorized SIMD instructions), dereferencing an unaligned `u64*` can trigger a hardware alignment fault.

---

## 3. Sub-Byte Packing with Bitfields

Hardware status registers and compact protocol flags often pack multiple boolean flags or small multi-bit fields into a single byte or word. Zen C supports C-compatible bitfield widths using the syntax `field_name: IntegralType : bit_width;`:

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

When you read or write `reg.mode = (u8)3`, the compiler automatically generates the bitwise shift and mask instructions needed to update bits 3 and 4 without disturbing the neighboring flags. Because bitfields do not have their own individual byte addresses, you cannot take the address of a bitfield (`&reg.ready` is not allowed).

---

## 4. Enforcing Boundary Alignment with `@align(N)`

Sometimes you want the *opposite* of `@packed`: you need a struct to start on a stricter power-of-two boundary than its fields would naturally require:

- **SIMD Vector Loads (`@align(16)` or `@align(32)`)**: SSE (`16`-byte) and AVX (`32`-byte) vector registers load four `f32` or eight `f32` values in a single instruction when the struct is aligned to 16 or 32 bytes.
- **Preventing False Sharing Across CPU Cores (`@align(64)`)**: Modern CPU caches transfer memory in **64-byte cache lines**. If two threads on different cores frequently increment two separate 8-byte counters that happen to sit in the same 64-byte cache line, the cores constantly invalidate each other's cache line (*false sharing*). Annotating the struct with `@align(64)` forces each instance onto its own 64-byte cache line and pads `sizeof` to a multiple of 64 bytes:

```zenc
@align(64)
struct CacheAlignedCounter {
    count: u64;
    label_id: u32;
}
// sizeof(CacheAlignedCounter) == 64 bytes, address is always a multiple of 64
```

---

## 5. Complete Example: Inspecting Sizes, Bitfields, and Cache Alignment

Listing 16-3 compares the memory footprint of `UnpackedHeader` (24 bytes), `ReorderedHeader` (16 bytes), and `PackedHeader` (11 bytes), packs five hardware flags into a 1-byte `StatusRegister`, and verifies that `CacheAlignedCounter` is aligned on a 64-byte boundary.

**Listing 16-3**: Controlling struct padding, bitfields, and alignment (`examples/ch16/ch16-03-struct-layout/main.zc`)

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

Run and verify Listing 16-3 with `zc run -q`:

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
