# 内联汇编与 volatile

在操作系统内核、设备驱动程序、实时控制循环以及对性能要求严苛的 DSP 例程中，软件往往需要执行无法通过高层语言的可移植结构来表示的特定 CPU 指令。

Zen C 通过 `asm { ... }` 块提供对**内联汇编**的一等公民支持，并通过 `asm volatile { ... }` 提供 **volatile 屏障**支持。与标准 C 中原始的字符串拼接不同，Zen C 的内联汇编允许使用 `{var}` 语法直接插值局部变量，并自动完成寄存器约束映射。

---

## 1. 基础汇编块

最简单的内联汇编形式包含纯机器指令，没有任何输入或输出操作数：

```zenc
fn cpu_pause() {
    asm { pause }
}

fn memory_barrier() {
    asm volatile {
        mfence
    }
}
```

- **`asm { ... }`**：生成一条内联汇编指令。如果编译器优化器确定其输出未被使用，则可能会对该指令重新排序或将其消除。
- **`asm volatile { ... }`**：保证编译器在优化期间**绝不会重新排序、提升或消除**该汇编块。这对于内存屏障（`mfence`、`dmb`）、MMIO 寄存器和缓存刷新至关重要。

---

## 2. 带有操作数与变量绑定的扩展汇编

当你的汇编例程需要读取或写入 Zen C 变量时，请在冒号（`:`）后使用 `out(...)`、`in(...)`、`inout(...)` 和 `clobber(...)` 指定操作数：

```zenc
fn add_fast(a: int, b: int) -> int {
    let result: int;
    asm {
        "mov {a}, {result}"
        "add {b}, {result}"
        : out(result)
        : in(a), in(b)
        : clobber("cc")
    }
    return result;
}
```

### 操作数分区：

1. **输出操作数（`: out(var)`）**：指定由汇编片段写入的变量。编译器将其映射到输出寄存器（`"=r"`）。
2. **输入操作数（`: in(var)`）**：指定由汇编片段读取的变量（`"r"`）。
3. **输入输出操作数（`: inout(var)`）**：指定同时作为输入和输出、就地修改的变量（`"+r"`）。
4. **破坏列表（`: clobber(...)`）**：通知编译器哪些硬件资源或状态标志被修改了：
   - `"cc"`：条件代码寄存器（被 `add`、`cmp`、`sub` 修改的标志位）。
   - `"memory"`：表明汇编代码读取/写入了任意内存，强制执行编译器优化屏障。

---

## 3. 🔍 窥探底层 C 代码：`zc` 如何下沉内联汇编

当你在 `add_fast` 上运行 `zc transpile` 时，`zc` 会自动将 `{var}` 引用转换为 GCC/Clang 的位置操作数编号（`%0`、`%1`、`%2`）：

```c
int32_t add_fast(int32_t a, int32_t b) {
    int32_t result;
    __asm__(
        "mov %1, %0\n"
        "add %2, %0\n"
        : "=r"(result)
        : "r"(a), "r"(b)
        : "cc"
    );
    return result;
}
```

这种设计将具名变量绑定的安全性与 GCC/Clang 内联汇编的原生速度和零开销下沉完美结合。

---

## 4. 完整示例：代码清单 20-1

代码清单 20-1 演示了基础 pause 指令、volatile 内存屏障、扩展输入/输出操作数绑定以及变量就地修改。

**代码清单 20-1**：内联汇编与 volatile 屏障（`examples/ch20/ch20-01-inline-assembly/main.zc`）

```zenc
// File: examples/ch20/ch20-01-inline-assembly/main.zc

// 1. Basic assembly block: CPU pause instruction in spinlock or delay
fn cpu_pause() {
    asm { pause }
}

// 2. Volatile memory barrier: prevent compiler and CPU memory reordering
fn memory_barrier() {
    asm volatile {
        mfence
    }
}

// 3. Extended inline assembly with inputs, outputs, and condition code clobber
fn add_fast(a: int, b: int) -> int {
    let result: int;
    asm {
        "mov {a}, {result}"
        "add {b}, {result}"
        : out(result)
        : in(a), in(b)
        : clobber("cc")
    }
    return result;
}

// 4. Inout constraint: modifying a variable in-place via register (+r)
fn double_in_place(x: int) -> int {
    let val = x;
    asm {
        "shl $1, {val}"
        : inout(val)
        :
        : clobber("cc")
    }
    return val;
}

fn main() {
    println "Testing inline assembly in Zen C...";

    cpu_pause();
    memory_barrier();

    let sum = add_fast(40, 2);
    println "add_fast(40, 2) = {sum}";
    assert(sum == 42, "add_fast failed");

    let doubled = double_in_place(21);
    println "double_in_place(21) = {doubled}";
    assert(doubled == 42, "double_in_place failed");

    println "Inline assembly executed successfully!";
}
```

使用 `zc run -q` 运行并验证代码清单 20-1：

```console
$ zc run -q examples/ch20/ch20-01-inline-assembly/main.zc
Testing inline assembly in Zen C...
add_fast(40, 2) = 42
double_in_place(21) = 42
Inline assembly executed successfully!
```

---

## 本节小结

- 对于可以被优化或移动的处理器特定指令，使用 `asm { ... }`。
- 对于绝不能被重新排序或消除的硬件屏障、内存屏障和 MMIO 访问，使用 `asm volatile { ... }`。
- 在汇编字符串内部使用 `{variable_name}` 来整洁地绑定变量，避免容易出错的手动数字寄存器编号。
- 使用 `out(...)`、`in(...)`、`inout(...)` 和 `clobber(...)` 向编译器声明数据流与寄存器破坏约束。
