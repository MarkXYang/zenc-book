# 在 C 程序中嵌入 Zen C

在[第 12 章](ch12-00-using-c-libraries.md)中，我们探索了如何在 Zen C 中调用现有的 C 库。

在企业级和系统级开发中，反向操作同样至关重要：**从现有的 C、C++ 或 Rust 宿主程序中调用编译好的 Zen C 函数**。你可能希望用 Zen C 编写新的、经过安全验证的子系统或高性能算法，同时保留原有的旧 C 应用程序测试架构。

由于 Zen C 直接转译为干净、无外部依赖的 C11，将 Zen C 嵌入到任何 C 构建流水线中都非常直接，并且无需任何运行时初始化。

---

## 1. 导出兼容 C 的函数（`@export` 与 `@link_name`）

默认情况下，Zen C 会使用名称修饰（例如 `_impl_...` 或模块前缀）为内部函数添加命名空间。为了以稳定、精确的 C 链接名称公开函数，可以使用两个属性：

1. **`@export`**：将符号标记为公开可见（`__attribute__((visibility("default")))`）。
2. **`@link_name("custom_name")`**：覆盖生成的 C 符号名称，使 C 编译器和链接器看到你指定的精确标识符：

```zenc
@export
@link_name("zenc_add")
fn add(a: int, b: int) -> int {
    return a + b;
}
```

转译此代码段将生成一个标准 C 函数：

```c
int32_t zenc_add(int32_t a, int32_t b) {
    return a + b;
}
```

---

## 2. 编译工作流

你可以使用目标文件或共享动态库将 Zen C 集成到 C 项目中：

### 方法 A：静态目标文件编译（`.o`）
1. 将 Zen C 模块转译为目标文件：
   ```bash
   zc transpile zenc_math.zc -o zenc_math.c
   gcc -c zenc_math.c -O2 -o zenc_math.o
   ```
2. 将目标文件直接链接到你的 C 程序中：
   ```bash
   gcc main.c zenc_math.o -o my_app
   ```

### 方法 B：共享动态库（`.so` / `.dylib` / `.dll`）
使用 `-shared` 编译 Zen C 模块：
```bash
zc build zenc_math.zc -shared -o libzenc_math.so
gcc main.c -L. -lzenc_math -Wl,-rpath,. -o my_app
```

---

## 3. 完整示例：代码清单 20-5

代码清单 20-5 展示了一个用 Zen C 编写的高性能数学模块以及调用该模块的配套 C 宿主应用程序。

### 第 1 部分：Zen C 模块（`zenc_math.zc`）

**代码清单 20-5A**：导出的 Zen C 数学库（`examples/ch20/ch20-05-embedding-zc/zenc_math.zc`）

```zenc
// File: examples/ch20/ch20-05-embedding-zc/zenc_math.zc

@export
@link_name("zenc_add")
fn add(a: int, b: int) -> int {
    return a + b;
}

@export
@link_name("zenc_fibonacci")
fn fibonacci(n: int) -> int {
    if n <= 1 {
        return n;
    }
    let a = 0;
    let b = 1;
    for _ in 2..=n {
        let temp = a + b;
        a = b;
        b = temp;
    }
    return b;
}

@export
@link_name("zenc_dot_product")
fn dot_product(a: f32*, b: f32*, len: int) -> f32 {
    let sum: f32 = 0.0;
    for i in 0..len {
        sum += a[i] * b[i];
    }
    return sum;
}
```

### 第 2 部分：宿主 C 程序（`main.c`）

**代码清单 20-5B**：调用 Zen C 的宿主 C 应用程序（`examples/ch20/ch20-05-embedding-zc/main.c`）

```c
// File: examples/ch20/ch20-05-embedding-zc/main.c
#include <stdio.h>
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>

// Declarations of exported Zen C functions
int zenc_add(int a, int b);
int zenc_fibonacci(int n);
float zenc_dot_product(const float *a, const float *b, int len);

int main(void) {
    printf("Embedding Zen C in a C Application\n");

    int sum = zenc_add(15, 27);
    printf("zenc_add(15, 27) = %d\n", sum);
    assert(sum == 42);

    int fib10 = zenc_fibonacci(10);
    printf("zenc_fibonacci(10) = %d\n", fib10);
    assert(fib10 == 55);

    float vec_a[] = {1.0f, 2.0f, 3.0f};
    float vec_b[] = {4.0f, 5.0f, 6.0f};
    float dot = zenc_dot_product(vec_a, vec_b, 3);
    printf("zenc_dot_product = %.1f\n", dot);
    assert(dot == 32.0f);

    printf("Successfully embedded Zen C module into native C host!\n");
    return 0;
}
```

---

## 4. 构建与运行嵌入式应用程序

编译并执行宿主 C 应用程序：

```console
$ zc transpile examples/ch20/ch20-05-embedding-zc/zenc_math.zc -o /tmp/zenc_math.c
$ gcc -c /tmp/zenc_math.c -O2 -o /tmp/zenc_math.o
$ gcc examples/ch20/ch20-05-embedding-zc/main.c /tmp/zenc_math.o -o /tmp/host_app
$ /tmp/host_app
Embedding Zen C in a C Application
zenc_add(15, 27) = 42
zenc_fibonacci(10) = 55
zenc_dot_product = 32.0
Successfully embedded Zen C module into native C host!
```

因为 Zen C 函数作为标准 C 符号进行链接，所以**零胶水代码**、无需运行时初始化函数（如 `init_runtime()`），并且零外部函数开销。

---

## 第 20 章总结

在本章中，你学习了 Zen C 如何提供出色的系统级与安全关键能力：

- **内联汇编（`20.1`）**：使用 `asm { ... }` 生成硬件特定指令，使用 `asm volatile { ... }` 设置 volatile 优化屏障，并通过 `{variable}` 绑定寄存器输入/输出。
- **SIMD 向量化（`20.2`）**：利用 `std/simd.zc` 中的 128 位和 256 位向量类型以及硬件加速运算符（`+`、`-`、`*`、`&`）加速并行数据处理。
- **MISRA C:2012 合规模式（`20.3`）**：使用 `zc --misra` 强制执行严格的航空航天/汽车安全准则，具有静态布尔验证和单出口函数下沉。
- **多语言互操作（`20.4`）**：生成干净的 C++17（`--cpp`）、NVIDIA CUDA（`--cuda`）和 Apple Objective-C（`--objc`）以用于跨语言项目。
- **嵌入 Zen C（`20.5`）**：使用 `@export` 和 `@link_name` 导出未修饰的 C ABI 函数，无缝增强现有的旧 C 代码库。

接下来，在**[第 21 章：实战项目：构建多线程 Web 服务器](ch21-00-final-project.md)**中，我们将综合全书所学的一切知识，从零开始构建一个完整、高性能的多线程 HTTP 服务器！
