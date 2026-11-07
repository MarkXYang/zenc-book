# 16.4 Untagged Unions and Bit Manipulation

In a `struct`, every field occupies its own distinct byte offset, and the size of the struct is at least the sum of all its fields. In an **untagged `union`**, by contrast, **every field starts at byte offset `0` and shares the exact same block of memory**.

The size of a `union` is simply the size of its **largest member** (rounded up to satisfy the union's largest member alignment). Writing to one field of a union immediately overwrites the underlying bytes shared by all other fields.

---

## 1. Declaring and Using an Untagged `union`

Zen C declares untagged unions with the `union` keyword using the same field syntax as `struct`:

```zenc
union IpAddress4 {
    packed: u32;
    octets: u8[4];
}
```

Both `packed` (4 bytes) and `octets` ($4 \times 1 = 4$ bytes) occupy the same 4 bytes of memory:

```
IpAddress4 (sizeof == 4 bytes, all fields start at offset 0)
Offset:     0          1          2          3
         +----------+----------+----------+----------+
octets:  |   192    |   168    |    1     |   100    |  (u8[4])
         +----------+----------+----------+----------+
packed:  |      0x6401A8C0 (1677830336 in LE)        |  (u32)
         +-------------------------------------------+
```

When you initialize `let ip = IpAddress4 { packed: 0 };` and then write individual bytes to `ip.octets[0..3]`, reading `ip.packed` immediately reflects the combined 32-bit word without any pointer casts or heap allocations.

---

## 2. Bit Reinterpretation (Type Punning) with Unions

A classic low-level systems technique is **type punning**: reinterpreting the raw binary representation of a floating-point number (`f32` or `f64`) as an unsigned integer of the same width (`u32` or `u64`) so you can inspect or manipulate its IEEE 754 sign bit, exponent, and mantissa using fast bitwise shifts and masks.

Under the IEEE 754 `binary32` standard, a 32-bit `f32` is divided into three bitfields:

- **Bit 31 (1 bit)**: Sign bit (`0` for positive, `1` for negative).
- **Bits 23..30 (8 bits)**: Biased exponent ($\text{exponent} + 127$).
- **Bits 0..22 (23 bits)**: Fractional mantissa (significand).

By overlaying `value: f32` and `bits: u32` in a `union`, we can extract each component cleanly:

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

## 3. Untagged `union` vs. Tagged `enum`

In [Chapter 6](ch06-00-enums-and-pattern-matching.md), you learned about Zen C's high-level `enum` sum types, which can carry variant payloads and are checked exhaustively by `match`. Internally, a Zen C `enum` with payloads is a **compiler-managed tagged union**: it stores an integer discriminant tag alongside a union of the variant payloads, and refuses to let you read a variant's data unless the tag matches.

Why does Zen C also provide raw untagged `union` types?

| Feature | Tagged `enum` (Chapter 6) | Untagged `union` (Section 16.4) |
| :--- | :--- | :--- |
| **Discriminant Tag** | Automatic compiler-managed tag field | None (zero extra bytes; manual tag optional) |
| **Pattern Matching (`match`)** | Exhaustive compile-time safety | Not supported directly on the union |
| **Type Punning (`f32` $\leftrightarrow$ `u32`)** | Prohibited | Supported (fields share offset `0`) |
| **C ABI / Hardware Layout** | Uses Zen C's internal enum layout | Exact 1-to-1 match with C `union` ABI |

When interfacing with C libraries (such as Linux `epoll_data_t`, X11/SDL event structs, or embedded peripheral descriptors), the C header frequently defines a compact struct pairing a custom `u8` or `u16` tag with an untagged `union`:

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
> **Untagged Unions Do Not Track Active Variants**: In an untagged `union`, the compiler does not know which field was most recently written. Additionally, unions cannot automatically determine which field's destructor to run at scope exit. Always restrict untagged `union` members to plain `Copy` / primitive types (integers, floats, raw pointers, or `@derive(Copy)` structs), and use Zen C's tagged `enum` whenever you do not need exact C `union` layout or bit-level type punning.

---

## 4. Complete Example: Byte Overlay, IEEE 754 Bit Inspection, and Hardware Events

Listing 16-4 demonstrates all three patterns: overlaying four IPv4 octets with a packed `u32` in `IpAddress4`, extracting the IEEE 754 sign, exponent, and mantissa bits of `-3.5f` via `FloatBits`, and dispatching a C-compatible `HardwareEvent` struct containing an `EventPayload` union.

**Listing 16-4**: Untagged unions and bit manipulation (`examples/ch16/ch16-04-unions/main.zc`)

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

Run and verify Listing 16-4 with `zc run -q`:

```text
$ zc run -q examples/ch16/ch16-04-unions/main.zc
sizeof(IpAddress4) = 4 bytes
IP octets: 192.168.1.100
IP packed u32: 1677830336
FloatBits(-3.5): raw=3227516928, sign=1, exp=128, mantissa=6291456
Motion event: dx=-12, dy=34
```

---

## Summary

In this chapter, you mastered Zen C's low-level memory management toolkit:

- **Typed Raw Pointers (`T*`) and `std/mem.zc`**: Allocating and resizing zero-initialized heap memory with `alloc<T>`, `alloc_n<T>`, `realloc_n<T>`, and `dealloc<T>`, stepping through buffers with scaled pointer arithmetic (`ptr + i`), inspecting raw bytes via `void*` and `u8*`, and copying or swapping elements with `mem_copy<T>` and `swap<T>`.
- **Arena Allocation (`std/arena.zc`)**: Grouping phase-scoped allocations into a single contiguous buffer with `Arena::new(cap)`, `arena.alloc<T>()`, `arena.alloc_n<T>(n)`, and `arena.dup_str(s)`, reclaiming temporary scratch allocations in $O(1)$ time with `arena.save()` and `arena.restore(mark)`, and resetting the entire region with `arena.reset()`.
- **Binary Struct Layout**: Minimizing compiler padding by ordering fields from largest alignment to smallest, stripping all padding for wire protocols with `@packed`, packing sub-byte flags with bitfields (`u8 : N`), and enforcing cache-line or SIMD alignment with `@align(N)`.
- **Untagged Unions (`union`)**: Overlaying multiple representations at byte offset `0` for C FFI compatibility, hardware event records, and IEEE 754 bit manipulation.

In [Chapter 17: Concurrency](ch17-00-concurrency.md), we will explore how to run code simultaneously across multiple CPU cores using OS threads, synchronization primitives, message-passing channels, and `async`/`await`.
