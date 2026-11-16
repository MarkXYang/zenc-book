# 性能对比：循环 vs 迭代器

对于任何系统程序员而言，一个很自然的问题是：**与手写的 C 索引循环相比，使用迭代器和闭包的运行时开销是多少？**

因为 Zen C 在调用你的后端 C 编译器（`gcc` 或 `clang`）之前，会将整个程序及其导入的标准库模块转译为**单个 C11 翻译单元**，所以我们可以通过检查生成的 C11 代码以及 C 优化器如何对其进行转换，以完全精确的方式回答这个问题。

---

## 1. 遍历向量的四种方式

让我们对比计算完全相同结果的四种方式——在包含 `100,000` 个元素的 `Vec<int>` 中，计算所有偶数乘 3 的总和（`val * 3`）：

1. **`sum_indexed_loop`**：传统的索引循环（`for i in 0..n`），直接读取 `(*v).data[i]`。
2. **`sum_for_in_ref`**：引用迭代器循环（`for ptr in (*v).iter_ref()`），通过 `VecIterRef<int>` 生成 `int*` 指针。
3. **`sum_for_in_val`**：值迭代器循环（`for val in *v`），通过 `VecIter<int>` 生成 `Option<int>` 副本。
4. **`sum_closure_forEach`**：高阶组合器（`(*v).iterator().forEach(fn[&](val: int) { ... })`），对每个元素调用一个按引用捕获的闭包。

**代码清单 14-4: 在 100,000 个整数上对比四种迭代策略**

```zenc
// File: examples/ch14/ch14-04-performance/main.zc
import "std/vec.zc"
import "std/time.zc"

def NUM_ITEMS = 100000;

fn now_us() -> u64 {
    let tv: timeval;
    gettimeofday(&tv, NULL);
    return (u64)tv.tv_sec * 1000000 + (u64)tv.tv_usec;
}

// 1. Direct indexed loop over contiguous memory
fn sum_indexed_loop(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    let n = (*v).length();
    for i in 0..n {
        let val = (*v).data[i];
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 2. Reference iterator (`VecIterRef<T>`) yielding `int*` pointers
fn sum_for_in_ref(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    for ptr in (*v).iter_ref() {
        let val = *ptr;
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 3. Value iterator (`VecIter<T>`) yielding `Option<int>` copies
fn sum_for_in_val(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    for val in *v {
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    }
    return total;
}

// 4. Higher-order closure combinator (`VecIter::forEach`)
fn sum_closure_forEach(v: Vec<int>*) -> i64 {
    let total: i64 = 0;
    (*v).iterator().forEach(fn[&](val: int) {
        if (val & 1) == 0 {
            total += (i64)(val * 3);
        }
    });
    return total;
}

fn main() {
    let data = Vec<int>::with_capacity(NUM_ITEMS);
    for i in 0..NUM_ITEMS {
        data.push(i + 1);
    }

    let t0 = now_us();
    let s1 = sum_indexed_loop(&data);
    let t1 = now_us();
    let s2 = sum_for_in_ref(&data);
    let t2 = now_us();
    let s3 = sum_for_in_val(&data);
    let t3 = now_us();
    let s4 = sum_closure_forEach(&data);
    let t4 = now_us();

    println "Indexed loop sum:       {s1} ({t1 - t0} us)";
    println "for-in ref (&vec) sum:  {s2} ({t2 - t1} us)";
    println "for-in val (vec) sum:   {s3} ({t3 - t2} us)";
    println "VecIter::forEach sum:   {s4} ({t4 - t3} us)";

    assert(s1 == 7500150000, "Expected sum of even numbers * 3 in 1..100000");
    assert(s1 == s2 && s2 == s3 && s3 == s4, "All four approaches must produce identical results");
}
```

在默认（未优化）模式和 `-O3` 发布模式下分别运行该示例，观察优化如何缩小差距（在 **第 12 代 Intel Core i7-12850HX**（24 线程）、**32 GB 内存**、运行 **Ubuntu 26.04.1 LTS (Linux 7.0.0-38-generic x86_64)** 及 **GCC 15.2.0** 的机器上测得）：

```bash
$ zc run -q examples/ch14/ch14-04-performance/main.zc
Indexed loop sum:       7500150000 (356 us)
for-in ref (&vec) sum:  7500150000 (1487 us)
for-in val (vec) sum:   7500150000 (1959 us)
VecIter::forEach sum:   7500150000 (1241 us)

$ zc run -O3 -q examples/ch14/ch14-04-performance/main.zc
Indexed loop sum:       7500150000 (120 us)
for-in ref (&vec) sum:  7500150000 (288 us)
for-in val (vec) sum:   7500150000 (403 us)
VecIter::forEach sum:   7500150000 (453 us)
```

---

## 2. 🔍 窥探底层 C 代码：编译器实际发射了什么

让我们对比 `sum_for_in_val`、`sum_for_in_ref` 和 `sum_closure_forEach` 转译出的 C11 代码，探究为何 `for ... in` 循环在 `--release`（`-O3`）下具有零成本，以及闭包组合器在何时存在细微的权衡。

### `for val in *v` 与 `for ptr in (*v).iter_ref()`：内联后的零成本

在生成的 C11 文件中，`sum_for_in_val` 和 `sum_for_in_ref` 分别调用 `VecIter__int32_t__next` 和 `VecIterRef__int32_t__next`：

```c
// Generated for `sum_for_in_ref`:
VecIterRef__int32_t __it = Vec__int32_t__iter_ref(v);
for (; 1; ) {
    VecIterResult__int32_t __opt = VecIterRef__int32_t__next(&__it);
    if (VecIterResult__int32_t__is_none(&__opt)) {
        break;
    }
    int32_t* ptr = VecIterResult__int32_t__unwrap(&__opt);
    int32_t val = (*ptr);
    if (((val & 1) == 0)) {
        total += (int64_t)(val * 3);
    }
}
```

因为 `VecIterRef__int32_t__next`、`is_none` 和 `unwrap` 都是在**完全相同的 `.c` 翻译单元**中定义的微小静态/可内联 C 函数：
- 在 `-O2` 或 `--release`（`-O3`）下，`gcc` 和 `clang` 会将这三个调用完全内联。
- 标量聚合替换（SROA, Scalar Replacement of Aggregates）消除了 `VecIterRef__int32_t` 和 `VecIterResult__int32_t` 结构体，将 `__it.idx` 和 `__it.count` 转化为 CPU 寄存器。
- 生成的机器码与 `sum_indexed_loop` **逐条指令完全相同**（包括 SIMD 自动向量化）！

### `VecIter::forEach` / `filter` / `fold`：闭包分派的权衡

现在观察 `sum_closure_forEach` 在 C11 中发射的内容：

```c
VecIter__int32_t__forEach(
    (VecIter__int32_t[]){ Vec__int32_t__iterator(v) },
    ({
        struct Lambda_0_Ctx *_z_ctx_0 = malloc(sizeof(struct Lambda_0_Ctx));
        _z_ctx_0->total = &total;
        (z_closure_T){ .func = _lambda_0, .ctx = _z_ctx_0, .drop = _lambda_0_drop };
    })
);
```

请注意 Zen C 中闭包组合器的三个架构特征：
1. **单次上下文分配**：当闭包捕获变量时（`[=]` 或 `[&]`），`zc` 会在进入组合器之前分配一次小型上下文结构体（`malloc(sizeof(struct Lambda_0_Ctx))`），并在组合器返回时自动释放。
2. **逐项函数指针调用**：在 `VecIter<T>::forEach` 内部，`f(self.data[self.idx])` 通过 `z_closure_T` 函数指针调用 `_c.func(_c.ctx, item)`。除非后端 C 编译器内联了 `VecIter__int32_t__forEach` 并将 `_c.func` 去虚化（devirtualize）为对 `_lambda_0` 的直接调用（在 `-O3` 且组合器位于同一翻译单元时，`gcc`/`clang` 经常能做到这一点），否则通过函数指针调用会阻止循环体的 SIMD 自动向量化。
3. **`filter` 中的中间分配**：因为 `VecIter<T>::filter(...)` 返回一个新鲜物化（materialized）的 `Vec<T>` 而非惰性适配器结构体，链式调用 `.filter(...).iterator().fold(...)` 会为过滤后的元素分配一个临时 `Vec<T>`。

---

## 3. Zen C 中的实用性能准则

| 惯用法 | 堆分配次数 | 在 `-O2`/`-O3` 下是否内联 / 自动向量化？ | 何时选择它 |
| :--- | :--- | :--- | :--- |
| **`for i in 0..n`** | **0** | **是** | 紧凑的数值计算内核、矩阵/SIMD 数学计算，或当你需要随机访问相邻索引时（`data[i - 1]`、`data[i + 1]`）。 |
| **`for ptr in &vec`** (`VecIterRef<T>`) | **0** | **是** | 遍历 `Vec<String>` 或大型结构体且无需复制元素时的**默认首选**。 |
| **`for val in vec`** (`VecIter<T>`) | **0** | **是** | 遍历小型值类型（`int`、`f64`、指针）或自定义生成器结构体（`Fibonacci`）的最简洁选择。 |
| **`vec.iterator().fold(...)` / `.find(...)` / `.any(...)`** | **1** 个微型上下文结构体（若有捕获） | 在 `-O3` 下通常会去虚化 | 富有表现力的数据查询、配置过滤以及可读性重于纳秒级循环开销的应用程序逻辑。 |
| **`vec.iterator().filter(...)`** | **1** 个新 `Vec<T>`（+ 1 个上下文结构体） | 分配过滤后的 `Vec<T>` | 当你确实需要一个仅包含匹配项的新 `Vec<T>` 时！ |

---

## 第 14 章小结

在本章中，你掌握了 Zen C 的函数式编程工具箱：
- **Lambda 与闭包（`14.1`）**：编写简洁的箭头 lambda（`x -> expr`）与块 lambda（`fn(x: T) -> R { ... }`），按值（`[=]`）或按引用（`[&]`）捕获环境状态，并传递带有自动 RAII 上下文清理的 `fn(T) -> R` 闭包。
- **原始函数指针（`14.2`）**：在分派表和类似 `qsort` 的 C 库回调中使用 `fn*(Args) -> Ret` 作为无状态的 8 字节 C ABI 函数指针。
- **迭代器（`14.3`）**：使用 `VecIter<T>` 与 `VecIterRef<T>`，链式调用函数式组合器（`filter`、`fold`、`find`、`any`、`all`、`forEach`），并通过 `.iterator()` 和 `.next()` 构建自定义零分配迭代器。
- **性能分析（`14.4`）**：理解 `for ... in` 循环在 `--release` 下如何单态化并内联为零开销 C 循环，并知晓何时选用 `for ptr in &vec` 与 `VecIter<T>` 组合器。

接下来，在 **[第 15 章：zc 工具链与编译器后端](ch15-00-toolchain.md)** 中，我们将探索 `zc` 如何协调调度 `gcc`、`clang`、`tcc` 和 Zig CC，如何检查生成的 C11 代码，以及如何构建可在任意系统运行的可执行文件（Actually Portable Executables, APE）！
