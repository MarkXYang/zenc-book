# 切片

*切片（slice）* 是一种轻量级的、非所有权的视图，用于查看内存中连续的元素序列。将一部分元素子集传递给函数时，你无需复制整个数组或 vector，而是可以传递一个 `Slice<T>` 来借用一段元素范围，既无需内存分配也不转移所有权。

---

## 切片的剖析

在底层，`Slice<T>`（定义在 `std/slice.zc` 中）是一个简单的胖指针（fat pointer），包含两个字段：

1. 指向首元素的指针（`data: T*`）。
2. 该视图中的元素数量（`len: usize`）。

因为切片并不拥有它所指向的内存，所以创建、子切片或按值传递 `Slice<T>` 是一项零开销操作——它仅复制两个机器字，绝不会执行堆分配。

## 创建并遍历切片

你可以使用 `Slice<T>::from_array(ptr, len)` 或 `Slice<T>::new(data, len)` 在任何连续缓冲区上构建 `Slice<T>`——无论是栈数组、堆分配还是子范围：

```zenc
// File: examples/ch04/ch04-03-slices/main.zc

import "std/slice.zc"

fn sum_slice(items: Slice<int>) -> int {
    let total = 0;
    for x in items {
        total += x;
    }
    return total;
}

fn find_max(items: Slice<int>) -> int {
    assert(items.len > 0, "slice must be non-empty");
    let best = items.data[0];
    for x in items {
        if x > best {
            best = x;
        }
    }
    return best;
}

fn main() {
    let scores: int[5] = [10, 25, 15, 40, 30];

    // Non-owning views over the stack array (zero heap allocation)
    let all = Slice<int>::from_array(&scores[0], 5);
    let middle = Slice<int>::new(&scores[1], 3);

    println "all.len = {all.len}, sum = {sum_slice(all)}";
    println "middle.len = {middle.len}, sum = {sum_slice(middle)}";
    println "max in middle = {find_max(middle)}";

    assert(sum_slice(all) == 120, "sum of all must be 120");
    assert(sum_slice(middle) == 80, "sum of middle must be 80");
    assert(find_max(middle) == 40, "max in middle must be 40");

    println "All slice checks passed!";
}
```

<span class="caption">代码清单 4-3：创建非所有权 `Slice<int>` 视图并进行遍历</span>

## 切片的安全规则

由于切片是非所有权视图，请牢记以下两个不变式：

1. **生命周期**：绝不要返回或存储生命周期长于其底层所指数组或堆缓冲区的 `Slice<T>`（否则 `data` 会变成悬垂指针）。
2. **边界**：在直接通过 `items.data[idx]` 进行索引之前，务必检查 `items.len`，或者使用 `for x in items` 进行安全遍历。

> ### 🔍 窥探底层 C 代码
>
> `Slice<int>` 会编译为一个普通的双字段 C 结构体（`struct Slice_int { int *data; size_t len; };`）。将其传递给 `sum_slice` 会直接在 ABI 上传递这两个寄存器，而无需触碰 `malloc` 或 `free`。

接下来，让我们探索使用 `defer` 和 `Drop` 进行确定性清理！
