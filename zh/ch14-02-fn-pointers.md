# 原始函数指针（`fn*`）

在 [14.1 节](ch14-01-lambdas.md) 中，我们看到 Zen C 闭包（`fn(T) -> R`）带有一个环境指针（`void* ctx`），以便它们可以捕获局部变量。然而，在系统编程中，有两个常见场景需要一个**无状态的、单字长（single-word）机器码指针**，而不包含任何环境结构体：

1. **零开销 C 互操作**：诸如 `<stdlib.h>` 的 `qsort`、`<signal.h>` 的 `signal`、POSIX `pthread_create` 以及 GUI/游戏引擎回调钩子等 C 库函数，都需要原生 C 函数指针（`R (*)(Args)`）。
2. **紧凑的分派表与状态机**：静态查找表、指令解码器和硬件中断向量通常存储函数指针数组，其中每个条目都是零捕获状态的顶层函数。

针对这些场景，Zen C 使用 **`fn*`** 类型语法提供了**原始函数指针（raw function pointers）**。

---

## 1. 声明与使用 `fn*` 类型

虽然 `fn(int, int) -> int` 是闭包类型，但在 `fn` 后面添加 `*`——写作 **`fn*(int, int) -> int`**——则声明了一个原始 C 函数指针。

对比 Zen C 清晰的从左到右的 `fn*` 语法与传统 C 语言的“螺旋法则”声明符语法：

| 含义 | Zen C 语法 | 等价的 C11 语法 |
| :--- | :--- | :--- |
| 指向接收 `int` 并返回 `void` 的函数的指针 | `cb: fn*(int)` | `void (*cb)(int32_t)` |
| 指向接收 `(int, int)` 并返回 `int` 的函数的指针 | `op: fn*(int, int) -> int` | `int32_t (*op)(int32_t, int32_t)` |
| 返回原始函数指针的函数 | `fn select(c: char) -> fn*(int, int) -> int` | `int32_t (*select(char c))(int32_t, int32_t)` |
| 指向原始函数指针的指针（`fn**`） | `pptr: fn**(int, int) -> int` | `int32_t (**pptr)(int32_t, int32_t)` |

### 传递与返回 `fn*`

任何具有匹配参数和返回签名的顶层 Zen C 函数（`fn`）都可以赋值给 `fn*` 变量、作为 `fn*` 参数传递，或从返回 `fn*` 的函数中返回：

```zenc
fn add(a: int, b: int) -> int { return a + b; }
fn sub(a: int, b: int) -> int { return a - b; }
fn mul(a: int, b: int) -> int { return a * b; }

// Accepting a raw function pointer
fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int {
    return op(x, y);
}

// Returning a raw function pointer
fn select_op(symbol: char) -> fn*(int, int) -> int {
    if symbol == '+' { return add; }
    if symbol == '-' { return sub; }
    return mul;
}
```

---

## 2. 使用 `fn*` 构建结构体分派表

你可以将 `fn*` 字段直接嵌入到结构体中，以构建表驱动的命令分派器、状态机或插件注册表：

```zenc
struct OpEntry {
    symbol: char,
    label: string,
    handler: fn*(int, int) -> int,
}

let table: OpEntry[3] = [
    OpEntry { symbol: '+', label: "Add",      handler: add },
    OpEntry { symbol: '-', label: "Subtract", handler: sub },
    OpEntry { symbol: '*', label: "Multiply", handler: mul },
];
```

因为每个 `handler` 字段都是一个原始的 8 字节 C 函数指针，所以 `table` 是一个普通的连续 C 结构体数组，具有零堆分配。

---

## 3. 将 `fn*` 回调传递给 C 语言库（`qsort`）

展示 `fn*` 威力的最佳例子之一是调用来自 `<stdlib.h>` 的 C 标准 `qsort` 函数，该函数使用调用方提供的比较器回调对任意数组进行就地排序：

```c
// Standard C signature in <stdlib.h>:
void qsort(void *base, size_t nmemb, size_t size,
           int (*compar)(const void *, const void *));
```

在 Zen C 中，我们使用 `compar: fn*(const void*, const void*) -> c_int` 声明 `qsort`，并直接传递普通的 Zen C 函数：

```zenc
include <stdlib.h>

extern fn qsort(
    base: void*,
    nmemb: usize,
    size: usize,
    compar: fn*(const void*, const void*) -> c_int
);

fn cmp_ints_asc(a: const void*, b: const void*) -> c_int {
    let va: int = *(int*)a;
    let vb: int = *(int*)b;
    if va < vb { return -1; }
    if va > vb { return 1; }
    return 0;
}
```

---

## 4. 完整的可运行示例

以下是结合了 `fn*` 结构体分派表、返回 `fn*` 的函数、双重函数指针（`fn**`）以及 C 的 `qsort` 的完整程序（`examples/ch14/ch14-02-fn-pointers/main.zc`）：

**代码清单 14-2: 分派表、高阶 `fn*` 与 C `qsort` 互操作**

```zenc
// File: examples/ch14/ch14-02-fn-pointers/main.zc
include <stdlib.h>

// Binding C's standard qsort with a typed raw function pointer `fn*`
extern fn qsort(
    base: void*,
    nmemb: usize,
    size: usize,
    compar: fn*(const void*, const void*) -> c_int
);

fn add(a: int, b: int) -> int { return a + b; }
fn sub(a: int, b: int) -> int { return a - b; }
fn mul(a: int, b: int) -> int { return a * b; }

// 1. Accepting a raw C function pointer (`fn*`)
fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int {
    return op(x, y);
}

// 2. Returning a raw C function pointer (`fn*`)
fn select_op(symbol: char) -> fn*(int, int) -> int {
    if symbol == '+' { return add; }
    if symbol == '-' { return sub; }
    return mul;
}

// 3. Storing raw function pointers in a struct (dispatch table)
struct OpEntry {
    symbol: char,
    label: string,
    handler: fn*(int, int) -> int,
}

// 4. C ABI comparator function for libc's `qsort`
fn cmp_ints_asc(a: const void*, b: const void*) -> c_int {
    let va: int = *(int*)a;
    let vb: int = *(int*)b;
    if va < vb { return -1; }
    if va > vb { return 1; }
    return 0;
}

fn main() {
    let table: OpEntry[3] = [
        OpEntry { symbol: '+', label: "Add",      handler: add },
        OpEntry { symbol: '-', label: "Subtract", handler: sub },
        OpEntry { symbol: '*', label: "Multiply", handler: mul },
    ];

    for i in 0..3 {
        let entry = table[i];
        let h = entry.handler;
        let res = h(12, 4);
        println "{entry.label} (12 {entry.symbol} 4) = {res}";
    }

    let prod = execute_op(select_op('*'), 7, 6);
    println "execute_op(select_op('*'), 7, 6) = {prod}";
    assert(prod == 42, "7 * 6 must equal 42");

    // Pointer-to-function-pointer (`fn**`)
    let op_ptr: fn*(int, int) -> int = select_op('*');
    let pptr: fn**(int, int) -> int = &op_ptr;
    let deref_op = *pptr;
    assert(deref_op(9, 5) == 45, "Dereferenced fn** should call mul(9, 5)");

    // Passing `cmp_ints_asc` directly to C's `qsort`
    let nums: int[5] = [42, 7, 19, 3, 25];
    qsort(&nums[0], 5, sizeof(int), cmp_ints_asc);
    println "Sorted via C qsort: [{nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}, {nums[4]}]";
    assert(nums[0] == 3 && nums[1] == 7 && nums[4] == 42, "Array must be sorted ascending");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run -q examples/ch14/ch14-02-fn-pointers/main.zc
Add (12 + 4) = 16
Subtract (12 - 4) = 8
Multiply (12 * 4) = 48
execute_op(select_op('*'), 7, 6) = 42
Sorted via C qsort: [3, 7, 19, 25, 42]
```

---

## 🔍 窥探底层 C 代码

当 `zc` 转译 `examples/ch14/ch14-02-fn-pointers/main.zc` 时，注意 `select_op`、`execute_op` 和 `struct OpEntry` 如何发射标准 C11 函数指针声明符，且不产生任何包装胶水代码：

```c
typedef struct OpEntry {
    char symbol;
    string label;
    int32_t (*handler)(int32_t, int32_t);
} OpEntry;

// Emitted from `fn select_op(symbol: char) -> fn*(int, int) -> int`:
ZC_FUNC int32_t (*select_op(char symbol))(int32_t, int32_t)
{
    if ((symbol == '+')) { return add; }
    if ((symbol == '-')) { return sub; }
    return mul;
}

// Emitted from `fn execute_op(op: fn*(int, int) -> int, x: int, y: int) -> int`:
ZC_FUNC int32_t execute_op(int32_t (*op)(int32_t, int32_t), int32_t x, int32_t y)
{
    return op(x, y);
}
```

接下来，让我们在 **[14.3 使用迭代器处理元素](ch14-03-iterators.md)** 中将闭包与序列处理结合起来！
