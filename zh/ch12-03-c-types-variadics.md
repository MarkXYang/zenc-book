# 12.3 C 类型、字符串与变长参数

尽管 Zen C 直接编译为 C11，但编写可移植的 FFI 绑定仍需要注意 C ABI 的三个细节：**与平台相关的整数宽度**、**带 `const` 限定符的字符串指针**以及 **C 变长参数列表（`...`）**。

---

## 1. 可移植的 C ABI 类型（`c_*`）与定宽类型

在 Zen C 中，标准整数类型如 `int`（`int32_t`）、`uint`（`uint32_t`）、`i64`（`int64_t`）和 `u64`（`uint64_t`）在所有操作系统和 CPU 架构上都具有**固定的位宽**。

然而在 C 语言中，诸如 `int`、`long` 和 `char` 等基本类型的宽度则由**具体实现定义**，并且因平台 ABI 而异。最显著的是，在 64 位 Linux 和 macOS（**LP64**）上，C 的 `long` 是 **64 位（8 字节）**；而在 64 位 Windows（**LLP64**）上，C 的 `long` 是 **32 位（4 字节）**！

为了确保你的 `extern fn` 和 `struct` 声明在每个平台上都能与准确的 C ABI 相匹配，Zen C 提供了专用的 **`c_*` ABI 基本类型**，以及与指针大小相同的 `usize` 和 `isize`：

| Zen C 类型 | 发射的 C11 类型 | Linux / macOS (LP64) | Windows 64-bit (LLP64) |
| :--- | :--- | :--- | :--- |
| `c_char` | `char` | 1 字节 (8-bit) | 1 字节 (8-bit) |
| `c_uchar` | `unsigned char` | 1 字节 (8-bit) | 1 字节 (8-bit) |
| `c_short` | `short` | 2 字节 (16-bit) | 2 字节 (16-bit) |
| `c_ushort` | `unsigned short` | 2 字节 (16-bit) | 2 字节 (16-bit) |
| `c_int` | `int` | 4 字节 (32-bit) | 4 字节 (32-bit) |
| `c_uint` | `unsigned int` | 4 字节 (32-bit) | 4 字节 (32-bit) |
| `c_long` | `long` | **8 字节 (64-bit)** | **4 字节 (32-bit)** |
| `c_ulong` | `unsigned long` | **8 字节 (64-bit)** | **4 字节 (32-bit)** |
| `c_longlong` | `long long` | 8 字节 (64-bit) | 8 字节 (64-bit) |
| `c_ulonglong` | `unsigned long long` | 8 字节 (64-bit) | 8 字节 (64-bit) |
| `usize` | `size_t` | 8 字节 (64-bit) | 8 字节 (64-bit) |
| `isize` | `ptrdiff_t` | 8 字节 (64-bit) | 8 字节 (64-bit) |
| `f32` / `f64` | `float` / `double` | 4 字节 / 8 字节 | 4 字节 / 8 字节 |
| `void*` | `void*` | 8 字节 (64-bit) | 8 字节 (64-bit) |

> [!IMPORTANT]
> 每当 C 头文件将某个参数或结构体字段声明为 `long` 或 `unsigned long`（例如 `ftell(FILE*)` 或 `struct timespec.tv_nsec`）时，请始终在 Zen C 中将其绑定为 `c_long` 或 `c_ulong`，而不是 `i64` 或 `u64`。使用 `c_long` 可以保证生成的 C 原型在 Linux/macOS 和 Windows 上都与系统头文件相匹配。

---

## 2. FFI 中的字符串与 `@ctype("const char*")`

在 Zen C 的运行时前导定义中，`string` 被直接定义为 C 字符指针的别名：

```c
typedef char* string;
```

每个 Zen C 字符串字面量（例如 `"hello"`）都存储在带有末尾空字符（`'\0'`）的只读静态内存中。将 Zen C 的 `string` 传递给 C 函数需要**零堆分配和零复制**。

### 使用 `@ctype` 保留 `const` 限定符

由于 Zen C 的 `string` 映射为 `char*`，写为 `sql: string` 或 `sql: char*` 的 `extern fn` 参数会在生成的 C 原型中发射为 `string sql`（即 `char* sql`）。如果 C 头文件或 C 定义将该参数声明为 `const char* sql`，C 编译器将会报错提示原型冲突：

```text
error: conflicting types for 'mock_db_exec'; have 'int(MockDb *, char *)'
note: previous definition of 'mock_db_exec' with type 'int(MockDb *, const char *)'
```

为了在生成的原型中发射精确的带 `const` 限定符的 C 类型，同时在调用点保留 Zen C 的 `string` 或指针类型检查，请在参数名称前放置 `@ctype("...")` 属性：

```zenc
extern fn execute_query(
    db: MockDb*,
    @ctype("const char*") sql: string
) -> c_int;
```

你也可以将 `@ctype` 用于其他带 `const` 限定符的 C 指针，例如 `@ctype("const uint8_t*") data: u8*` 或 `@ctype("const void*") src: void*`。

### 将可变字符缓冲区传递给 C

当 C 函数需要向调用方提供的字符缓冲区中写入数据时（例如 `snprintf`、`getcwd` 或 `strerror_r`），请在栈（或堆）上分配一个固定大小的 `char[N]` 数组，并传递其首元素的地址（`&buf[0]`）：

```zenc
let buf: char[64];
let written: c_int = snprintf(&buf[0], 64, "Sensor[%d] = %.2f V", 3, 3.30);
let formatted: string = &buf[0];
```

---

## 3. 调用和编写变长参数函数（`...`）

### 调用 C 变长参数函数

要声明接受可变数量参数的外部 C 函数（如 `printf`、`snprintf` 或 `ioctl`），请在最后一个固定参数后放置 `...`：

```zenc
extern fn snprintf(
    buf: char*,
    size: usize,
    @ctype("const char*") fmt: string,
    ...
) -> c_int;
```

> [!TIP]
> Zen C 针对标准 C 的 `printf`、`sprintf`、`fprintf` 和 `dprintf` 调用内置了格式化字符串分析器（`check_format_string`）。如果在调用 `printf` 时将非整数传递给 `%d` 或将非浮点数传递给 `%f`，`zc` 在 C 编译器运行之前就会在编译期给出警告！

### 在 Zen C 中编写变长参数函数（`va_list`）

你也可以在 Zen C 中编写自己的 C 兼容变长参数函数！包含 `<stdarg.h>` 并使用内置的 `va_list` 类型以及 `va_start`、`va_arg`、`va_copy` 和 `va_end`：

```zenc
include <stdarg.h>

fn sum_c_ints(count: c_int, ...) -> c_int {
    let ap: va_list;
    va_start(ap, count);
    defer va_end(ap); // Guarantees va_end(ap) runs before every return!

    let total: c_int = 0;
    for i in 0..count {
        let next_val: c_int = va_arg(ap, c_int);
        total = total + next_val;
    }
    return total;
}

fn main() {
    // First argument (3) is `count`, followed by the 3 variadic values (1, 2, 3):
    let sum: c_int = sum_c_ints(3, 1, 2, 3);
    println "Sum: {sum}"; // Sum: 6
}
```

请注意 [`sum_c_ints`](file:///home/mark/code/zenc-app/book/sandbox/ch12/list12-2.zc#L3-L14) 中的两个重要细节：
1. **显式传递 `count`**：在 C 变长参数函数中，被调用方无法自动知道在栈/寄存器上传递了多少个 `...` 参数。固定的第一个参数 `count` 告诉循环调用 `va_arg(ap, c_int)` 的次数（因此 `sum_c_ints(3, 1, 2, 3)` 会读取 `3` 个值：`1 + 2 + 3 = 6`）。
2. **使用 `defer` 进行清理**：`defer va_end(ap);` 与 `va_start(ap, count)` 配对使用，这样即使你的变长参数函数有多个提前 `return` 分支，Zen C 也会在每个返回路径之前自动发射 `va_end(ap)`。

---

## 4. 完整的可运行示例

下面是演示 `c_*` ABI 大小、调用 C 的变长参数函数 `snprintf` 写入栈缓冲区以及使用 `va_list` 定义变长参数 Zen C 函数的完整可运行程序（`examples/ch12/ch12-03-c-types-variadics/main.zc`）：

```zenc
// File: examples/ch12/ch12-03-c-types-variadics/main.zc
include <stdarg.h>

// 1. Declaring an external C variadic function
extern fn snprintf(buf: char*, size: usize, @ctype("const char*") fmt: string, ...) -> c_int;

// 2. Defining a variadic Zen C function using va_list, va_start, va_arg, and va_end
fn sum_c_ints(count: c_int, ...) -> c_int {
    let ap: va_list;
    va_start(ap, count);
    defer va_end(ap);

    let total: c_int = 0;
    for i in 0..count {
        let next_val: c_int = va_arg(ap, c_int);
        total = total + next_val;
    }
    return total;
}

fn main() {
    // 1. Portable C ABI primitive sizes
    let sz_c_int: usize = sizeof(c_int);
    let sz_c_long: usize = sizeof(c_long);
    let sz_c_ll: usize = sizeof(c_longlong);
    let sz_ptr: usize = sizeof(void*);
    println "ABI sizes (bytes): c_int={sz_c_int}, c_long={sz_c_long}, c_longlong={sz_c_ll}, void*={sz_ptr}";
    assert(sz_c_int == 4 && sz_c_ll == 8, "Standard C int and long long sizes");

    // 2. Calling a C variadic function (snprintf)
    let buf: char[64];
    let written: c_int = snprintf(&buf[0], 64, "Sensor[%d] = %.2f V", 3, 3.30);
    let formatted: string = &buf[0];
    println "snprintf ({written} bytes): {formatted}";
    assert(written == 18, "Expected 18 characters written by snprintf");

    // 3. Calling a Zen C variadic function
    let sum4: c_int = sum_c_ints(4, 10, 20, 30, 40);
    println "sum_c_ints(4, 10, 20, 30, 40) = {sum4}";
    assert(sum4 == 100, "Variadic sum of 10+20+30+40 should be 100");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run examples/ch12/ch12-03-c-types-variadics/main.zc
ABI sizes (bytes): c_int=4, c_long=8, c_longlong=8, void*=8
snprintf (18 bytes): Sensor[3] = 3.30 V
sum_c_ints(4, 10, 20, 30, 40) = 100
```

---

## 🔍 窥探底层 C 代码

当 `zc` 转译 `sum_c_ints` 时，`va_list` 被零初始化（`va_list ap = {0};`），`va_arg(ap, c_int)` 发射标准 C 的 `va_arg(ap, int)`，而 `defer va_end(ap);` 会在返回 `_z_ret` 之前自动插入 `va_end(ap);`：

```c
ZC_FUNC int sum_c_ints(int count, ...)
{
    {
        va_list ap = {0};
        va_start(ap, count);

        int total = 0;
        for (ZC_AUTO i = 0; i < count; i++) {
            int next_val = va_arg(ap, int);
            (total = (total + next_val));
        }

        // Return value captured into _z_ret so deferred va_end(ap) runs first:
        { int _z_ret = total;
            va_end(ap);
        return _z_ret; }
    }
}
```
