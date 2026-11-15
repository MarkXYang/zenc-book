# 16.2 Arena 与自定义分配器

当每个对象具有独立且不可预测的生命周期时，使用 `alloc<T>` 和 `dealloc<T>` 在堆上分配单个对象非常合适。然而，许多现实系统会分配成百上千个**生命周期完全同步**的小对象：

- **编译器与解析器**：解析文件时创建的每个词法标记（token）和抽象语法树（AST）节点在类型检查和代码生成期间都需要使用，而在编译完成后可以一次性全部丢弃。
- **网络服务器**：处理单个 HTTP 请求期间分配的所有请求头、查询参数和 JSON 节点，在响应发送完毕的瞬间都会变成垃圾。
- **游戏引擎与仿真模拟**：单帧内生成的临时碰撞流形（collision manifold）、粒子指令和 UI 布局节点，都会在这一帧结束时全部丢弃。

每请求或每帧调用数千次 `malloc` 和 `free` 会带来沉重的开销：系统分配器必须搜索空闲列表，在每个内存块旁维护元数据头部，跨线程进行同步，并将小对象散布在不相邻的缓存行上。更糟糕的是，释放复杂的图或树结构需要遍历每个节点来调用 `dealloc<T>`，稍有不慎就会发生内存泄漏或双重释放。

**Arena 分配器**（也称为**区域分配器**或**线性推进/Bump 分配器**）能够同时解决性能与生命周期管理两大难题。

---

## 1. 线性推进分配的工作原理

Zen C 标准库在 `std/arena.zc` 中提供了一个快速且轻量的区域分配器：

```zenc
struct Arena {
    data: void*;
    capacity: usize;
    used: usize;
}
```

当你使用 `Arena::new(capacity)` 创建 arena 时，它只执行**一次**大小为 `capacity` 字节的底层堆分配，并将 `used` 设置为 `0`。随后的每次分配只需将 `used` 向上舍入到 **8 字节对齐边界**（`(self.used + 7) & ~7`），检查 `aligned_used + size <= self.capacity`，推进 `self.used`，并返回指向 `self.data` 的指针：

```
Arena Backing Buffer (capacity = 4096 bytes)
+-----------------+-----------------+----------------------+------------------------+
| AstNode #1      | "ten\0" (+pad)  | AstNode #2           | Free Space             |
| (32 bytes)      | (8 bytes)       | (32 bytes)           | (4024 bytes remaining) |
+-----------------+-----------------+----------------------+------------------------+
^                                                          ^                        ^
data (offset 0)                                            used (offset 72)         capacity (4096)
```

因为 `Arena` 实现了 `Drop` trait（`impl Drop for Arena`），当 `Arena` 变量离开作用域时，其唯一的底层缓冲区会自动被释放——你永远不需要释放分配在 arena 内部的单个对象。

---

## 2. `std/arena.zc` API

导入 `"std/arena.zc"` 即可使用所有 `Arena` 方法：

| 方法 | 签名 | 说明 |
| :--- | :--- | :--- |
| **`Arena::new(cap)`** | `fn new(cap: usize) -> Arena` | 分配一个带有 `cap` 字节底层缓冲区的新 arena（`used = 0`）。 |
| **`arena.alloc<T>()`** | `fn alloc<T>(self) -> T*` | 线性推进分配 `sizeof(T)` 字节（8 字节对齐），**零初始化**该内存，并返回 `T*`（若已满则返回 `NULL`）。 |
| **`arena.alloc_n<T>(count)`** | `fn alloc_n<T>(self, count: usize) -> T*` | 线性推进分配并零初始化包含 `count` 个 `T` 类型元素的连续数组。 |
| **`arena.alloc_bytes(size)`** | `fn alloc_bytes(self, size: usize) -> void*` | 底层 8 字节对齐的线性推进分配，分配 `size` 字节未初始化的内存。 |
| **`arena.dup_str(src)`** | `fn dup_str(self, src: char*) -> char*` | 将以 NUL 结尾的 C 字符串 `src`（包括末尾的 `'\0'`）复制到 arena 中。 |
| **`arena.bytes_used()`** | `fn bytes_used(self) -> usize` | 返回当前推进偏移量（`self.used`）。 |
| **`arena.bytes_free()`** | `fn bytes_free(self) -> usize` | 返回剩余未分配容量（`self.capacity - self.used`）。 |
| **`arena.save()`** | `fn save(self) -> usize` | 返回代表当前 `used` 偏移量的检查点标记（checkpoint mark）。 |
| **`arena.restore(mark)`** | `fn restore(self, mark: usize)` | 在 $O(1)$ 时间内将 `self.used` 回退到 `mark`，回收在 `save()` 之后进行的所有分配。 |
| **`arena.reset()`** | `fn reset(self)` | 在 $O(1)$ 时间内重置 `self.used = 0`，同时保留已分配的底层缓冲区以便重用。 |

---

## 3. 使用 `save()` 与 `restore()` 的作用域检查点

生命周期较长的处理阶段（例如编译一个模块）通常需要一个临时暂存缓冲区来执行单个子步骤（例如对符号名称排序或格式化诊断信息），而无需永久消耗主 arena 中的空间。

无需创建第二次堆分配，只需在临时工作之前使用 `let mark = arena.save()` 记录一个检查点，之后使用 `arena.restore(mark)` 回退 arena：

```zenc
let mark: usize = arena.save();

// Allocate temporary scratch memory inside the same arena
let temp_table: int* = arena.alloc_n<int>(128);
temp_table[0] = 42;

// Rewind `arena.used` back to `mark` in O(1) time!
// Everything allocated BEFORE `mark` remains intact.
arena.restore(mark);
```

```
1. Before save():        [ Permanent AST Nodes (197 B) | Free Space ...                 ]
                                                       ^ mark = 197

2. Scratch allocation:   [ Permanent AST Nodes (197 B) | Scratch (512 B) | Free Space   ]
                                                       ^ mark = 197      ^ used = 712

3. After restore(mark):  [ Permanent AST Nodes (197 B) | Free Space (reclaimed!) ...    ]
                                                       ^ used = 197
```

---

## 4. 完整示例：Arena 分配的表达式树与检查点

示例 16-2 在一个 4 KB 的 `Arena` 内部构建了一个 `(10 + 20) * 3` 的表达式树。每个 `AstNode` 结构体及其标签字符串（`arena.dup_str`）都通过线性推进分配紧挨着存放在同一个连续缓冲区中。随后，它在调用 `arena.save()` 后分配了一个临时的 128 整数暂存表，使用 `arena.restore(mark)` 回收暂存空间的同时验证 AST 依然有效，最后使用 `arena.reset()` 重置整个 arena。

**示例 16-2**：区域分配、字符串复制与检查点机制（`examples/ch16/ch16-02-arenas/main.zc`）

```zenc
// File: examples/ch16/ch16-02-arenas/main.zc
import "std/arena.zc"

struct AstNode {
    op: char;
    value: int;
    label: char*;
    left: AstNode*;
    right: AstNode*;
}

fn make_leaf(arena: Arena*, val: int, text: char*) -> AstNode* {
    let node: AstNode* = arena.alloc<AstNode>();
    *node = AstNode {
        op: '#',
        value: val,
        label: arena.dup_str(text),
        left: NULL,
        right: NULL,
    };
    return node;
}

fn make_binary(arena: Arena*, op: char, left: AstNode*, right: AstNode*) -> AstNode* {
    let node: AstNode* = arena.alloc<AstNode>();
    *node = AstNode {
        op: op,
        value: 0,
        label: arena.dup_str("expr"),
        left: left,
        right: right,
    };
    return node;
}

fn eval_ast(node: AstNode*) -> int {
    if node == NULL { return 0; }
    if node.op == '#' { return node.value; }
    let l = eval_ast(node.left);
    let r = eval_ast(node.right);
    if node.op == '+' { return l + r; }
    if node.op == '*' { return l * r; }
    return 0;
}

fn main() {
    // Allocate a 4 KB backing buffer once; freed automatically on scope exit
    let arena = Arena::new(4096);
    println "Arena initialized: capacity=4096, free={arena.bytes_free()} bytes";

    // 1. Allocate an expression tree `(10 + 20) * 3` inside the arena
    let n10 = make_leaf(&arena, 10, "ten");
    let n20 = make_leaf(&arena, 20, "twenty");
    let sum_node = make_binary(&arena, '+', n10, n20);
    let n3 = make_leaf(&arena, 3, "three");
    let root = make_binary(&arena, '*', sum_node, n3);

    let result = eval_ast(root);
    let used_after_ast = arena.bytes_used();
    println "AST result: ({n10.label} + {n20.label}) * {n3.label} = {result}";
    println "Bytes used by AST: {used_after_ast}";
    assert(result == 90, "(10 + 20) * 3 must equal 90");

    // 2. Scoped checkpoint with `save()` and `restore()`
    let mark: usize = arena.save();
    let scratch: int* = arena.alloc_n<int>(128);
    scratch[0] = 42;
    scratch[127] = 99;
    println "Bytes used with temporary 128-int scratch table: {arena.bytes_used()}";
    assert(arena.bytes_used() > used_after_ast, "Scratch allocation should advance arena offset");

    // Reclaim the temporary scratch table in O(1) while keeping the AST valid!
    arena.restore(mark);
    println "Bytes used after arena.restore(mark): {arena.bytes_used()}";
    assert(arena.bytes_used() == used_after_ast, "restore(mark) must rewind used offset");
    assert(eval_ast(root) == 90, "AST allocated before mark remains intact");

    // 3. Reset the entire arena in O(1) for the next request/frame
    arena.reset();
    println "Bytes used after arena.reset(): {arena.bytes_used()}";
    assert(arena.bytes_used() == 0, "reset() must zero the bump offset");
}
```

使用 `zc run -q` 运行并验证示例 16-2：

```text
$ zc run -q examples/ch16/ch16-02-arenas/main.zc
Arena initialized: capacity=4096, free=4096 bytes
AST result: (ten + twenty) * three = 90
Bytes used by AST: 197
Bytes used with temporary 128-int scratch table: 712
Bytes used after arena.restore(mark): 197
Bytes used after arena.reset(): 0
```

---

## 5. Arena 的最佳实践与常见陷阱

1. **根据阶段峰值容量设定 Arena 大小**：`std/arena.zc` 中的 `Arena` 使用固定容量缓冲区，因此先前返回的 `T*` 指针**永远不会**因 `realloc` 移动而失效。如果某次分配超出了 `arena.bytes_free()`，`arena.alloc<T>()` 将返回 `NULL`。请为该阶段的上限慷慨分配容量，或者在处理不可信输入大小时检查 `NULL`。
2. **切勿在 Arena 中存储包含 RAII 析构函数的类型**：`arena.reset()` 和 `Arena::drop()` 仅回收原始字节，并不会对缓冲区内分配的单个结构体执行 `Drop::drop()`。请在 arena 中存储普通数据结构体、arena 分配的指针以及 `arena.dup_str(...)` 字符串，而不是持有外部文件描述符或独立 `malloc` 句柄的类型。
3. **调用 `restore()` 或 `reset()` 后切勿解引用指针**：一旦 `arena.restore(mark)` 或 `arena.reset()` 回退了推进偏移量，随后的任何 `arena.alloc<T>()` 调用都会覆盖该内存区域。在调用 `restore(mark)` 后，必须立即将 `mark` 之后分配的指针视作失效。
