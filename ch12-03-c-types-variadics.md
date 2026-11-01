# 12.3 C Types, Strings, and Variadics

Even though Zen C compiles directly to C11, writing portable FFI bindings requires attention to three details of the C ABI: **platform-dependent integer widths**, **`const`-qualified string pointers**, and **C variadic argument lists (`...`)**.

---

## 1. Portable C ABI Types (`c_*`) vs. Fixed-Width Types

In Zen C, standard integer types like `int` (`int32_t`), `uint` (`uint32_t`), `i64` (`int64_t`), and `u64` (`uint64_t`) have **fixed bit widths** across every operating system and CPU architecture.

In C, however, primitive types like `int`, `long`, and `char` have **implementation-defined widths** that vary by platform ABI. Most notably, on 64-bit Linux and macOS (**LP64**), C's `long` is **64 bits (8 bytes)**, whereas on 64-bit Windows (**LLP64**), C's `long` is **32 bits (4 bytes)**!

To ensure your `extern fn` and `struct` declarations match the exact C ABI on every platform, Zen C provides dedicated **`c_*` ABI primitive types** alongside pointer-sized `usize` and `isize`:

| Zen C Type | Emitted C11 Type | Linux / macOS (LP64) | Windows 64-bit (LLP64) |
| :--- | :--- | :--- | :--- |
| `c_char` | `char` | 1 byte (8-bit) | 1 byte (8-bit) |
| `c_uchar` | `unsigned char` | 1 byte (8-bit) | 1 byte (8-bit) |
| `c_short` | `short` | 2 bytes (16-bit) | 2 bytes (16-bit) |
| `c_ushort` | `unsigned short` | 2 bytes (16-bit) | 2 bytes (16-bit) |
| `c_int` | `int` | 4 bytes (32-bit) | 4 bytes (32-bit) |
| `c_uint` | `unsigned int` | 4 bytes (32-bit) | 4 bytes (32-bit) |
| `c_long` | `long` | **8 bytes (64-bit)** | **4 bytes (32-bit)** |
| `c_ulong` | `unsigned long` | **8 bytes (64-bit)** | **4 bytes (32-bit)** |
| `c_longlong` | `long long` | 8 bytes (64-bit) | 8 bytes (64-bit) |
| `c_ulonglong` | `unsigned long long` | 8 bytes (64-bit) | 8 bytes (64-bit) |
| `usize` | `size_t` | 8 bytes (64-bit) | 8 bytes (64-bit) |
| `isize` | `ptrdiff_t` | 8 bytes (64-bit) | 8 bytes (64-bit) |
| `f32` / `f64` | `float` / `double` | 4 bytes / 8 bytes | 4 bytes / 8 bytes |
| `void*` | `void*` | 8 bytes (64-bit) | 8 bytes (64-bit) |

> [!IMPORTANT]
> Whenever a C header declares a parameter or struct field as `long` or `unsigned long` (such as `ftell(FILE*)` or `struct timespec.tv_nsec`), always bind it as `c_long` or `c_ulong` in Zen C rather than `i64` or `u64`. Using `c_long` guarantees that the generated C prototype matches the system header on both Linux/macOS and Windows.

---

## 2. Strings and `@ctype("const char*")` Across FFI

In Zen C's runtime preamble, `string` is defined as a direct alias for a C character pointer:

```c
typedef char* string;
```

Every Zen C string literal (such as `"hello"`) is stored in read-only static memory with a trailing null byte (`'\0'`). Passing a Zen C `string` to a C function requires **zero heap allocation and zero copying**.

### Preserving `const` Qualifiers with `@ctype`

Because Zen C's `string` maps to `char*`, an `extern fn` parameter written as `sql: string` or `sql: char*` emits `string sql` (`char* sql`) in the generated C prototype. If the C header or C definition declares that parameter as `const char* sql`, the C compiler will report a conflicting prototype error:

```text
error: conflicting types for 'mock_db_exec'; have 'int(MockDb *, char *)'
note: previous definition of 'mock_db_exec' with type 'int(MockDb *, const char *)'
```

To emit an exact `const`-qualified C type in the generated prototype while keeping Zen C's `string` or pointer type checking at call sites, place the `@ctype("...")` attribute before the parameter name:

```zenc
extern fn execute_query(
    db: MockDb*,
    @ctype("const char*") sql: string
) -> c_int;
```

You can also use `@ctype` for other `const`-qualified C pointers, such as `@ctype("const uint8_t*") data: u8*` or `@ctype("const void*") src: void*`.

### Passing Mutable Character Buffers to C

When a C function writes into a caller-provided character buffer (such as `snprintf`, `getcwd`, or `strerror_r`), allocate a fixed-size `char[N]` array on the stack (or heap) and pass the address of its first element (`&buf[0]`):

```zenc
let buf: char[64];
let written: c_int = snprintf(&buf[0], 64, "Sensor[%d] = %.2f V", 3, 3.30);
let formatted: string = &buf[0];
```

---

## 3. Calling and Authoring Variadic Functions (`...`)

### Calling C Variadic Functions

To declare an external C function that accepts a variable number of arguments (like `printf`, `snprintf`, or `ioctl`), place `...` after the last fixed parameter:

```zenc
extern fn snprintf(
    buf: char*,
    size: usize,
    @ctype("const char*") fmt: string,
    ...
) -> c_int;
```

> [!TIP]
> Zen C includes a built-in format-string analyzer (`check_format_string`) for standard C `printf`, `sprintf`, `fprintf`, and `dprintf` calls. If you pass a non-integer to `%d` or a non-float to `%f` when calling `printf`, `zc` warns you at compile time before the C compiler even runs!

### Authoring Variadic Functions in Zen C (`va_list`)

You can also write your own C-compatible variadic functions in Zen C! Include `<stdarg.h>` and use the built-in `va_list` type along with `va_start`, `va_arg`, `va_copy`, and `va_end`:

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

Notice two important details in [`sum_c_ints`](file:///home/mark/code/zenc-app/book/sandbox/ch12/list12-2.zc#L3-L14):
1. **Passing `count` explicitly**: In C variadic functions, the callee does not automatically know how many `...` arguments were passed on the stack/registers. The fixed first parameter `count` tells the loop how many times to call `va_arg(ap, c_int)` (so `sum_c_ints(3, 1, 2, 3)` reads `3` values: `1 + 2 + 3 = 6`).
2. **Cleanup with `defer`**: `defer va_end(ap);` pairs with `va_start(ap, count)` so that even if your variadic function has multiple early `return` branches, Zen C automatically emits `va_end(ap)` before every return path.

---

## 4. Complete Runnable Example

Here is the complete, runnable program (`examples/ch12/ch12-03-c-types-variadics/main.zc`) demonstrating `c_*` ABI sizes, calling C's variadic `snprintf` into a stack buffer, and defining a variadic Zen C function with `va_list`:

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

Run the example with `zc run`:

```bash
$ zc run examples/ch12/ch12-03-c-types-variadics/main.zc
ABI sizes (bytes): c_int=4, c_long=8, c_longlong=8, void*=8
snprintf (18 bytes): Sensor[3] = 3.30 V
sum_c_ints(4, 10, 20, 30, 40) = 100
```

---

## 🔍 Peek at the C

When `zc` transpiles `sum_c_ints`, `va_list` is zero-initialized (`va_list ap = {0};`), `va_arg(ap, c_int)` emits standard C `va_arg(ap, int)`, and `defer va_end(ap);` automatically inserts `va_end(ap);` before returning `_z_ret`:

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
