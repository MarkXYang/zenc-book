# 16.1 Raw Pointers and Manual Memory (`T*`, `void*`)

In [Section 4.2](ch04-02-pointers.md), we introduced Zen C's pointer syntax: `&x` takes the memory address of `x` to produce a typed pointer `T*`, `*ptr` dereferences the pointer to read or write its target, and `ptr.field` automatically dereferences struct pointers without requiring C's `->` operator.

When you build custom data structures, interface with C libraries, or manage raw memory buffers directly, you need more than single-variable stack borrowing. In this section, we explore typed heap allocation with `std/mem.zc`, scaled pointer arithmetic, type-erased `void*` pointers, byte-level memory inspection via `u8*`, and bulk memory operations.

---

## 1. Typed Heap Allocation with `std/mem.zc`

While you can always call C's raw `malloc`, `calloc`, `realloc`, and `free` (or Zen C's built-in `zalloc`), calculating byte sizes manually with `sizeof(T) * count` and casting `void*` pointers is repetitive and error-prone. The standard library module `std/mem.zc` provides generic, type-safe memory functions that scale by `sizeof(T)` automatically and return properly typed `T*` pointers:

| Function | Signature | Behavior |
| :--- | :--- | :--- |
| **`alloc<T>()`** | `fn alloc<T>() -> T*` | Allocates and **zero-initializes** space for 1 instance of `T` (`calloc(1, sizeof(T))`). |
| **`alloc_n<T>(n)`** | `fn alloc_n<T>(count: usize) -> T*` | Allocates and **zero-initializes** a contiguous array of `count` instances of `T`. |
| **`realloc_n<T>(ptr, old_n, new_n)`** | `fn realloc_n<T>(ptr: T*, old_n: usize, new_n: usize) -> T*` | Resizes an allocation from `old_n` to `new_n` elements; if `new_n > old_n`, the newly added elements are zero-initialized. |
| **`dealloc<T>(ptr)`** | `fn dealloc<T>(ptr: T*)` | Frees a heap pointer previously returned by `alloc<T>`, `alloc_n<T>`, or `realloc_n<T>`. |
| **`mem_zero<T>(ptr, n)`** | `fn mem_zero<T>(ptr: T*, count: usize)` | Fills `count * sizeof(T)` bytes starting at `ptr` with `0` (`memset`). |
| **`mem_copy<T>(dst, src, n)`** | `fn mem_copy<T>(dst: T*, src: T*, count: usize)` | Copies `count * sizeof(T)` bytes from `src` to non-overlapping `dst` (`memcpy`). |
| **`swap<T>(a, b)`** | `fn swap<T>(a: T*, b: T*)` | Exchanges the values pointed to by `a` and `b` in place. |

### Pairing Allocation with `defer dealloc<T>`

Raw pointers (`T*`) are lightweight memory addresses—they do not automatically free heap memory when they go out of scope. Whenever a function owns a raw heap buffer, pair its allocation with `defer dealloc<T>(ptr)` so every return path releases the memory deterministically:

```zenc
import "std/mem.zc"

fn process_window() {
    let window: f64* = alloc_n<f64>(256);
    defer dealloc<f64>(window);

    // Every element is guaranteed to start at 0.0
    window[0] = 1.0;
    window[255] = -1.0;
} // `dealloc<f64>(window)` runs automatically here
```

> [!WARNING]
> **Reallocating a Buffer Invalidates Old Pointers**: When you call `buf = realloc_n<int>(buf, old_n, new_n)`, the allocator may move the block to a new memory address if it cannot expand in place. Any secondary pointers aimed inside the old buffer (such as `let first = &buf[0]`) become **dangling pointers** after `realloc_n`. Always recompute interior pointers from the updated base pointer `buf`.

---

## 2. Pointer Indexing and Scaled Pointer Arithmetic

A typed pointer `T*` pointing to the start of a contiguous array supports two equivalent forms of element access:

1. **Subscript Indexing (`ptr[i]`)**: Reads or writes the $i$-th element at offset `i`, identical to array indexing.
2. **Scaled Pointer Arithmetic (`ptr + i`)**: Adding an integer offset `i` to a `T*` advances the memory address by **`i * sizeof(T)` bytes**, yielding a new `T*` aimed at element `i`. Dereferencing `*(ptr + i)` accesses the exact same memory location as `ptr[i]`.

```
Base pointer: buf (int*, sizeof(int) == 4 bytes)

Address:   0x1000       0x1004       0x1008       0x100C
         +------------+------------+------------+------------+
Value:   |     60     |     20     |     30     |     40     |
         +------------+------------+------------+------------+
           ^            ^            ^            ^
           |            |            |            |
         buf + 0      buf + 1      buf + 2      buf + 3
         (&buf[0])    (&buf[1])    (&buf[2])    (&buf[3])
```

To inspect the raw numerical byte distance between two pointers, cast each pointer to `usize` before subtracting:

```zenc
let first_addr: usize = (usize)&buf[0];
let fourth_addr: usize = (usize)(buf + 3);
let byte_delta: usize = fourth_addr - first_addr; // 3 * sizeof(int) == 12 bytes
```

---

## 3. Type-Erased Pointers (`void*`) and Byte Inspection (`u8*`)

A `void*` pointer holds a raw memory address without any associated pointee type. Because the compiler does not know the size or layout of what a `void*` points to:

- You **cannot** dereference a `void*` directly (`*raw_ptr` is a compile-time error).
- You **cannot** index a `void*` (`raw_ptr[i]`) without first casting it to a concrete pointer type.

`void*` serves two primary roles in systems code:

1. **Generic Memory Interfaces**: Functions that operate on arbitrary blocks of memory—such as `checksum_bytes(raw_ptr: void*, byte_len: usize)` or C callback `user_data: void*` parameters—accept `void*` so callers can pass the address of any struct, integer, or array.
2. **Byte-by-Byte Inspection via `(u8*)` Cast**: Casting a `void*` (or any `&value`) to `u8*` lets you step through the underlying bytes of a value in memory at 1-byte granularity (`sizeof(u8) == 1`).

> [!NOTE]
> **Little-Endian Byte Order**: On x86_64 and ARM64 architectures, multi-byte integers are stored in **little-endian** order: the least-significant byte resides at the lowest memory address (`bytes[0]`), and the most-significant byte resides at the highest memory address (`bytes[sizeof(T) - 1]`). For example, the 32-bit hexadecimal integer `0x04030201` is stored in memory as the four bytes `0x01`, `0x02`, `0x03`, `0x04`.

---

## 4. Complete Example: Heap Buffers, Pointer Walks, and Byte Checksums

Listing 16-1 combines typed heap allocation (`alloc_n`, `realloc_n`, `alloc`, `dealloc`), in-place pointer swapping (`swap`), scaled pointer arithmetic (`base + i`), `void*` byte inspection, and struct copying (`mem_copy`).

**Listing 16-1**: Working with raw pointers and `std/mem.zc` (`examples/ch16/ch16-01-raw-pointers/main.zc`)

```zenc
// File: examples/ch16/ch16-01-raw-pointers/main.zc
import "std/mem.zc"

@derive(Copy)
struct Sample {
    id: int;
    reading: f64;
}

// Walk a contiguous buffer using raw pointer arithmetic (`base + i`)
fn sum_via_pointer_walk(base: int*, count: usize) -> int {
    let total = 0;
    for i in (usize)0..count {
        let elem_ptr: int* = base + i;
        total += *elem_ptr;
    }
    return total;
}

// Inspect raw bytes of any value in memory through a type-erased `void*`
fn checksum_bytes(raw_ptr: void*, byte_len: usize) -> u32 {
    let bytes: u8* = (u8*)raw_ptr;
    let sum: u32 = 0;
    for i in (usize)0..byte_len {
        sum += (u32)bytes[i];
    }
    return sum;
}

fn main() {
    // 1. Typed heap allocation and dynamic growth with `std/mem.zc`
    let count: usize = 4;
    let buf: int* = alloc_n<int>(count);
    defer dealloc<int>(buf);

    for i in (usize)0..count {
        buf[i] = ((int)i + 1) * 10; // 10, 20, 30, 40
    }

    // Grow the allocation from 4 ints to 6 ints (zeroes the new elements)
    buf = realloc_n<int>(buf, 4, 6);
    buf[4] = 50;
    buf[5] = 60;

    // 2. Swap two elements in place via `T*` pointers
    swap<int>(&buf[0], &buf[5]);
    println "After swap(&buf[0], &buf[5]): buf[0]={buf[0]}, buf[5]={buf[5]}";
    assert(buf[0] == 60 && buf[5] == 10, "Endpoints should be swapped");

    // 3. Pointer arithmetic (`base + i` advances by `i * sizeof(int)` bytes)
    let sum = sum_via_pointer_walk(buf, 6);
    println "Sum via pointer walk: {sum}";
    assert(sum == 210, "10 + 20 + 30 + 40 + 50 + 60 = 210");

    let first_addr: usize = (usize)&buf[0];
    let fourth_addr: usize = (usize)(buf + 3);
    let byte_delta: usize = fourth_addr - first_addr;
    println "Byte distance from buf[0] to (buf + 3): {byte_delta} bytes";
    assert(byte_delta == 3 * sizeof(int), "Pointer + 3 must advance by 3 * sizeof(int)");

    // 4. Type-erased `void*` and byte-level inspection via `(u8*)` cast
    let magic: u32 = 0x04030201;
    let bsum = checksum_bytes((void*)&magic, sizeof(u32));
    println "Byte checksum of 0x04030201: {bsum}";
    assert(bsum == 10, "0x01 + 0x02 + 0x03 + 0x04 = 10");

    // 5. Typed single-struct allocation and `mem_copy<T>`
    let src_sample: Sample* = alloc<Sample>();
    let dst_sample: Sample* = alloc<Sample>();
    defer dealloc<Sample>(src_sample);
    defer dealloc<Sample>(dst_sample);

    src_sample.id = 7;
    src_sample.reading = 98.6;
    mem_copy<Sample>(dst_sample, src_sample, 1);
    println "Copied Sample: id={dst_sample.id}, reading={dst_sample.reading}";
    assert(dst_sample.id == 7 && dst_sample.reading == 98.6, "Copied struct fields must match");
}
```

Run and verify Listing 16-1 with `zc run -q`:

```text
$ zc run -q examples/ch16/ch16-01-raw-pointers/main.zc
After swap(&buf[0], &buf[5]): buf[0]=60, buf[5]=10
Sum via pointer walk: 210
Byte distance from buf[0] to (buf + 3): 12 bytes
Byte checksum of 0x04030201: 10
Copied Sample: id=7, reading=98.600000
```

---

## 5. Safety Checklist for Raw Pointers

When working with `T*` and `void*` directly, keep four rules in mind:

1. **Check or Guarantee Non-`NULL` Before Dereferencing**: If a C library or bounded allocator can return `NULL` on exhaustion, verify `if ptr == NULL` before accessing `*ptr` or `ptr[i]`.
2. **Never Return the Address of a Local Stack Variable**: A pointer `&local_var` becomes invalid the moment its enclosing function returns. Always return values by move/copy, write into a caller-supplied out-pointer, or allocate on the heap/arena.
3. **Do Not Mix Allocators**: Memory allocated with `alloc<T>` / `alloc_n<T>` must be freed with `dealloc<T>(ptr)`. Pointers allocated inside an `Arena` (covered next in [Section 16.2](ch16-02-arenas.md)) must **never** be passed to `dealloc<T>`.
4. **Use `mem_copy<T>` Only for Plain Data (`Copy` Types)**: Bitwise-copying a struct that owns a heap handle (such as `String` or `Vec<T>`) duplicates the raw pointer without cloning the underlying allocation, leading to a double-free when both copies are dropped.
