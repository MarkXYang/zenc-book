# Attributes and Smart Derives

Attributes in Zen C attach metadata to structs, enums, functions, and fields using `@name` or `@name(args)` syntax. They control C-level memory layout, optimizer hints, startup hooks, and automatic trait implementations.

## Automatic Trait Derivation with `@derive`

Instead of writing repetitive boilerplate for equality checks or serialization, you can annotate a `struct` or `enum` with `@derive(...)`. The Zen C compiler supports deriving:

- `Clone` — deep or explicit duplication
- `Copy` — value-copy semantics
- `Debug` — human-readable formatting
- `Eq` — structural equality (`==` and `!=`)
- `FromJson` / `ToJson` — JSON deserialization and serialization

Here is an example combining `@derive`, layout attributes, inlining hints, and a `@constructor` startup hook:

```zenc
// File: examples/ch19/ch19-02-attributes-derives/main.zc

@derive(Debug, Eq, Copy)
struct Point {
    x: i32;
    y: i32;
}

@packed
struct PacketHeader {
    version: u8;
    flags: u16;
    length: u32;
}

@align(16)
struct AlignedBlock {
    data: u64;
    tag: u32;
}

@inline
fn fast_add(a: i32, b: i32) -> i32 {
    return a + b;
}

@noinline
fn slow_path_log(msg: string) {
    println "[slow-path] {msg}";
}

let boot_flag: i32 = 0;

@constructor
fn init_boot_flag() {
    boot_flag = 42;
}

fn main() {
    println "Testing Attributes and Derives...";
    assert(boot_flag == 42, "@constructor must run before main()");

    let p1 = Point { x: 3, y: 4 };
    let p2 = Point { x: 3, y: 4 };
    let p3 = Point { x: 5, y: 6 };

    assert(p1 == p2, "Derived Eq must compare equal points");
    assert(p1 != p3, "Derived Eq must distinguish different points");

    let sum = fast_add(p1.x, p1.y);
    assert(sum == 7, "fast_add(3, 4) == 7");

    let hdr_size = sizeof(PacketHeader);
    println "sizeof(PacketHeader) = {hdr_size}";
    assert(hdr_size == 7, "@packed PacketHeader must be 7 bytes");

    let blk_size = sizeof(AlignedBlock);
    println "sizeof(AlignedBlock) = {blk_size}";
    assert(blk_size >= 16, "@align(16) AlignedBlock must be at least 16 bytes");

    slow_path_log("attributes verified");
    println "All attributes & derives checks passed!";
}
```

<span class="caption">Listing 19-2: Using `@derive`, `@packed`, `@align`, `@inline`, `@noinline`, and `@constructor`</span>

## Common Built-In Attributes

| Attribute | Target | Effect |
| :--- | :--- | :--- |
| `@derive(Traits...)` | `struct`, `enum` | Generates implementations for `Clone`, `Copy`, `Debug`, `Eq`, `FromJson`, `ToJson`. |
| `@packed` | `struct` | Removes padding bytes between struct fields (`__attribute__((packed))`). |
| `@align(N)` | `struct` | Forces minimum alignment of `N` bytes (`_Alignas(N)` / `__attribute__((aligned(N)))`). |
| `@inline` / `@noinline` | `fn` | Hints to the C compiler to inline (or avoid inlining) the function. |
| `@constructor` | `fn` | Registers the function to run automatically before `main()`. |
| `@destructor` | `fn` | Registers the function to run automatically when the process exits. |
| `@unused` | `fn`, `let` | Suppresses unused-symbol warnings. |
| `@deprecated("msg")` | `fn`, `struct` | Emits a deprecation warning when referenced. |

> ### 🔍 Peek at the C
>
> Zen C lowers layout and linkage attributes directly to standard C11 or GCC/Clang attributes (`__attribute__((packed))`, `__attribute__((constructor))`, `inline`). That means `@packed` structs in Zen C have the exact same ABI layout as packed C structs—making them safe for wire protocols and hardware registers.
