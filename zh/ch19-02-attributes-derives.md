# 属性与智能 Derive

Zen C 中的属性使用 `@name` 或 `@name(args)` 语法为结构体、枚举、函数和字段附加元数据。它们用于控制 C 级别的内存布局、优化器提示、启动钩子以及自动 trait 实现。

## 使用 `@derive` 自动派生 Trait

无需为相等性检查或序列化手写重复的样板代码，你可以为 `struct` 或 `enum` 添加 `@derive(...)` 注解。Zen C 编译器支持派生以下 trait：

- `Clone` —— 深度或显式复制
- `Copy` —— 值复制语义
- `Debug` —— 人类可读的格式化输出
- `Eq` —— 结构相等性（`==` 和 `!=`）
- `FromJson` / `ToJson` —— JSON 反序列化与序列化

以下是一个结合了 `@derive`、布局属性、内联提示以及 `@constructor` 启动钩子的示例：

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

<span class="caption">代码清单 19-2：使用 `@derive`、`@packed`、`@align`、`@inline`、`@noinline` 与 `@constructor`</span>

## 常见内置属性

| 属性 | 目标 | 效果 |
| :--- | :--- | :--- |
| `@derive(Traits...)` | `struct`、`enum` | 为 `Clone`、`Copy`、`Debug`、`Eq`、`FromJson`、`ToJson` 生成实现。 |
| `@packed` | `struct` | 移除结构体字段之间的填充字节（`__attribute__((packed))`）。 |
| `@align(N)` | `struct` | 强制最小对齐为 `N` 字节（`_Alignas(N)` / `__attribute__((aligned(N)))`）。 |
| `@inline` / `@noinline` | `fn` | 向 C 编译器提示内联（或避免内联）该函数。 |
| `@constructor` | `fn` | 将函数注册为在 `main()` 之前自动运行。 |
| `@destructor` | `fn` | 将函数注册为在进程退出时自动运行。 |
| `@unused` | `fn`、`let` | 抑制未使用的符号警告。 |
| `@deprecated("msg")` | `fn`、`struct` | 当被引用时发出废弃警告。 |

> ### 🔍 窥探底层 C 代码
>
> Zen C 将布局与链接属性直接降级为标准 C11 或 GCC/Clang 属性（`__attribute__((packed))`、`__attribute__((constructor))`、`inline`）。这意味着 Zen C 中的 `@packed` 结构体具有与 packed C 结构体完全相同的 ABI 布局——使它们安全适用于网络传输协议和硬件寄存器。
