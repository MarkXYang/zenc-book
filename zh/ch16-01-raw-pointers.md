# 裸指针与不安全操作

在[4.2 节](ch04-02-pointers.md)中，我们介绍了 Zen C 的指针语法：`&x` 获取 `x` 的内存地址以生成类型化指针 `T*`，`*ptr` 解引用指针以读取或写入其目标，而 `ptr.field` 会自动解引用结构体指针，无需使用 C 语言的 `->` 运算符。

当你构建自定义数据结构、与 C 语言库交互或直接管理原始内存缓冲区时，仅靠单个变量的栈借用是远远不够的。在这一节中，我们将探索使用 `std/mem.zc` 进行类型化堆分配、带比例缩放的指针运算、类型擦除的 `void*` 指针、通过 `u8*` 进行字节级内存检查以及批量内存操作。

---

## 1. 使用 `std/mem.zc` 进行类型化堆分配

虽然你随时可以调用 C 原生的 `malloc`、`calloc`、`realloc` 和 `free`（或者 Zen C 内置的 `zalloc`），但手动通过 `sizeof(T) * count` 计算字节大小并强转 `void*` 指针既繁琐又极易出错。标准库模块 `std/mem.zc` 提供了泛型、类型安全的内存函数，它们会自动按 `sizeof(T)` 进行比例缩放，并返回正确类型的 `T*` 指针：

| 函数 | 签名 | 行为 |
| :--- | :--- | :--- |
| **`alloc<T>()`** | `fn alloc<T>() -> T*` | 分配并**零初始化** 1 个 `T` 实例的空间（`calloc(1, sizeof(T))`）。 |
| **`alloc_n<T>(n)`** | `fn alloc_n<T>(count: usize) -> T*` | 分配并**零初始化**包含 `count` 个 `T` 实例的连续数组。 |
| **`realloc_n<T>(ptr, old_n, new_n)`** | `fn realloc_n<T>(ptr: T*, old_n: usize, new_n: usize) -> T*` | 将分配大小从 `old_n` 调整为 `new_n` 个元素；如果 `new_n > old_n`，新添加的元素将被零初始化。 |
| **`dealloc<T>(ptr)`** | `fn dealloc<T>(ptr: T*)` | 释放先前由 `alloc<T>`、`alloc_n<T>` 或 `realloc_n<T>` 返回的堆指针。 |
| **`mem_zero<T>(ptr, n)`** | `fn mem_zero<T>(ptr: T*, count: usize)` | 将从 `ptr` 开始的 `count * sizeof(T)` 个字节全部填充为 `0`（`memset`）。 |
| **`mem_copy<T>(dst, src, n)`** | `fn mem_copy<T>(dst: T*, src: T*, count: usize)` | 从 `src` 复制 `count * sizeof(T)` 个字节到不重叠的 `dst`（`memcpy`）。 |
| **`swap<T>(a, b)`** | `fn swap<T>(a: T*, b: T*)` | 原地交换 `a` 和 `b` 所指向的值。 |

### 搭配 `defer dealloc<T>` 进行释放

裸指针（`T*`）只是轻量级的内存地址——当它们离开作用域时，并不会自动释放堆内存。每当一个函数拥有一个原始堆缓冲区的所有权时，请将其分配与 `defer dealloc<T>(ptr)` 结对使用，这样每个返回路径都会确定性地释放这块内存：

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
> **重新分配缓冲区会使旧指针失效**：当你调用 `buf = realloc_n<int>(buf, old_n, new_n)` 时，如果无法就地扩展，分配器可能会将内存块移动到新的内存地址。在 `realloc_n` 之后，任何指向旧缓冲区内部的二级指针（例如 `let first = &buf[0]`）都会变成**悬垂指针**（dangling pointers）。务必从更新后的基指针 `buf` 重新计算内部指针。

---

## 2. 指针索引与带比例缩放的指针运算

指向连续数组开头的类型化指针 `T*` 支持两种等效的元素访问形式：

1. **下标索引（`ptr[i]`）**：读取或写入偏移量 `i` 处的第 $i$ 个元素，与数组索引完全一致。
2. **带比例缩放的指针运算（`ptr + i`）**：为 `T*` 增加整数偏移量 `i` 会将内存地址推进 **`i * sizeof(T)` 个字节**，生成指向元素 `i` 的新 `T*`。解引用 `*(ptr + i)` 访问的内存位置与 `ptr[i]` 完全相同。

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

若要检查两个指针之间原始的数值字节距离，请在相减前将每个指针转换为 `usize`：

```zenc
let first_addr: usize = (usize)&buf[0];
let fourth_addr: usize = (usize)(buf + 3);
let byte_delta: usize = fourth_addr - first_addr; // 3 * sizeof(int) == 12 bytes
```

---

## 3. 类型擦除指针（`void*`）与字节检查（`u8*`）

`void*` 指针持有原始内存地址，没有任何关联的被指向者类型。由于编译器不知道 `void*` 所指对象的大小或布局：

- 你**不能**直接解引用 `void*`（`*raw_ptr` 是编译期错误）。
- 你**不能**对 `void*` 进行索引（`raw_ptr[i]`），除非先将其转换为具体指针类型。

`void*` 在系统级代码中扮演着两个核心角色：

1. **通用内存接口**：操作任意内存块的函数——例如 `checksum_bytes(raw_ptr: void*, byte_len: usize)` 或 C 回调函数的 `user_data: void*` 参数——接收 `void*`，这样调用者就可以传入任何结构体、整数或数组的地址。
2. **通过 `(u8*)` 转换进行逐字节检查**：将 `void*`（或任何 `&value`）转换为 `u8*`，使你可以以 1 字节粒度（`sizeof(u8) == 1`）逐步遍历内存中值的底层字节。

> [!NOTE]
> **小端序（Little-Endian）字节序**：在 x86_64 和 ARM64 架构上，多字节整数以**小端序**存储：最低有效字节位于最低内存地址（`bytes[0]`），最高有效字节位于最高内存地址（`bytes[sizeof(T) - 1]`）。例如，32 位十六进制整数 `0x04030201` 在内存中存储为四个字节：`0x01`、`0x02`、`0x03`、`0x04`。

---

## 4. 完整示例：堆缓冲区、指针遍历与字节校验和

代码清单 16-1 综合了类型化堆分配（`alloc_n`、`realloc_n`、`alloc`、`dealloc`）、原地指针交换（`swap`）、带比例缩放的指针运算（`base + i`）、`void*` 字节检查以及结构体复制（`mem_copy`）。

**代码清单 16-1**：使用裸指针与 `std/mem.zc`（`examples/ch16/ch16-01-raw-pointers/main.zc`）

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

使用 `zc run -q` 运行并验证代码清单 16-1：

```text
$ zc run -q examples/ch16/ch16-01-raw-pointers/main.zc
After swap(&buf[0], &buf[5]): buf[0]=60, buf[5]=10
Sum via pointer walk: 210
Byte distance from buf[0] to (buf + 3): 12 bytes
Byte checksum of 0x04030201: 10
Copied Sample: id=7, reading=98.600000
```

---

## 5. 裸指针安全检查清单

直接使用 `T*` 和 `void*` 时，请牢记以下四条规则：

1. **解引用前检查或确保非 `NULL`**：如果 C 语言库或有界分配器在耗尽时可能返回 `NULL`，在访问 `*ptr` 或 `ptr[i]` 之前请先通过 `if ptr == NULL` 进行验证。
2. **绝不返回局部栈变量的地址**：指针 `&local_var` 在其所在函数返回的瞬间即告失效。始终通过移动/复制返回值、写入调用者提供的传出指针，或在堆/Arena 上分配。
3. **切勿混用分配器**：使用 `alloc<T>` / `alloc_n<T>` 分配的内存必须使用 `dealloc<T>(ptr)` 释放。在 `Arena`（下一节 [16.2 节](ch16-02-arenas.md)中讨论）内部分配的指针**绝对不能**传递给 `dealloc<T>`。
4. **仅对普通数据（`Copy` 类型）使用 `mem_copy<T>`**：对拥有堆句柄的结构体（例如 `String` 或 `Vec<T>`）进行按位复制，会仅复制裸指针而不会克隆底层分配，从而在两个副本都被销毁时引发双重释放（double-free）。
