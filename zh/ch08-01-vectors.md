# 向量（Vec）

Zen C 中最常用且功能最丰富的动态集合是**向量**（`Vec<T>`），由 `std/vec.zc` 提供。向量是分配在堆上的连续且可动态伸缩的数组。

当你需要存储相同类型的元素序列，且事先不知道元素的确切数量，或者列表需要在程序运行期间动态增长和缩小时，向量是理想的选择。

---

## `Vec<T>` 的内部内存布局

在 Zen C 中，`Vec<T>` 被定义为一个简单的 3 字（word）结构体：

```zenc
struct Vec<T> {
    data: T*;
    len:  usize;
    cap:  usize;
}
```

- **`data`**：指向包含实际元素的堆分配连续缓冲区的指针。
- **`len`**：当前存储在向量中的元素数量。
- **`cap`**：已分配堆缓冲区的总容量（在需要重新分配之前缓冲区可容纳的最大元素数）。

当你向向量推入新元素且 `len == cap` 时，向量会自动触发动态扩容（`grow()`）：
1. 将当前容量翻倍（$8 \to 16 \to 32 \to 64 \to \dots$）。
2. 通过 `realloc` 重新分配堆缓冲区。
3. 更新 `data` 和 `cap`，保证均摊 $O(1)$ 的追加时间。

---

## 创建向量

要使用向量，请导入 `std/vec.zc`。Zen C 提供了两种构造方法：

### 1. `Vec<T>::new()`（惰性分配）
创建一个空的向量，其中 `data = NULL`、`len = 0` 且 `cap = 0`。在推入第一个元素之前不会发生堆分配！

### 2. `Vec<T>::with_capacity(cap)`（预分配）
如果你事先知道向量将容纳多少元素，预先分配容量可以避免重复的 `realloc` 调用和缓冲区拷贝。

**代码清单 8-4: `list8-4.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     // 1. Lazy allocation: 0 initial capacity
 5 |     let v = Vec<int>::new();
 6 |     println "Initial length: {v.length()}, capacity: {v.cap}";
 7 |
 8 |     // Pushing elements triggers growth
 9 |     v.push(10);
10 |     v.push(20);
11 |     v.push(30);
12 |
13 |     println "After 3 pushes -> length: {v.length()}, capacity: {v.cap}";
14 |     println "First: {v.first()}, Last: {v.last()}";
15 |     println "Element at index 1: {v[1]}";
16 |
17 |     // 2. Pre-allocated capacity: avoids resizing overhead
18 |     let preallocated = Vec<int>::with_capacity(64);
19 |     println "Preallocated capacity: {preallocated.cap}";
20 | }
```

输出：
```text
Initial length: 0, capacity: 0
After 3 pushes -> length: 3, capacity: 8
First: 10, Last: 30
Element at index 1: 20
Preallocated capacity: 64
```

---

## 修改元素：插入、删除与弹出

除了 `push()`，`Vec<T>` 还提供了对添加和移除元素的细粒度控制：

- **`insert(idx, item)`**：在位置 `idx` 插入 `item`，并将所有后续元素向右移动。如果 `idx > len` 则 panic。
- **`remove(idx) -> T`**：移除并返回 `idx` 处的元素，并将后续元素向左移动。如果 `idx >= len` 则 panic。
- **`pop() -> T`**：移除并返回末尾元素。如果向量为空则 panic。
- **`pop_opt() -> Option<T>`**：`pop()` 的安全变体。如果成功弹出元素则返回 `Some(val)`，如果向量已空则返回 `None()`。
- **`clear()`**：将 `len` 重置为 `0` 但不释放已分配的堆缓冲区，允许你重用已分配的容量。

**代码清单 8-5: `list8-5.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let v = Vec<int>::new();
 5 |     v.push(10);
 6 |     v.push(20);
 7 |     v.push(30);
 8 |
 9 |     // Insert 15 at index 1: [10, 15, 20, 30]
10 |     v.insert(1, 15);
11 |     println "After insert(1, 15), length: {v.length()}";
12 |
13 |     // Remove element at index 2 (which is 20): [10, 15, 30]
14 |     let removed = v.remove(2);
15 |     println "Removed element: {removed}";
16 |
17 |     // Pop the last element (30): [10, 15]
18 |     let popped = v.pop();
19 |     println "Popped element: {popped}";
20 |
21 |     // Safe pop using pop_opt():
22 |     let opt = v.pop_opt();
23 |     if opt.is_some() {
24 |         println "Safely popped: {opt.unwrap()}";
25 |     }
26 |
27 |     println "Remaining length: {v.length()}";
28 | }
```

输出：
```text
After insert(1, 15), length: 4
Removed element: 20
Popped element: 30
Safely popped: 15
Remaining length: 1
```

---

## 读取元素与边界检查

你可以使用以下方式访问向量中的元素：
1. **索引语法（`v[idx]`）**或 **`v.get(idx)`**：返回元素的副本。
2. **`v.get_ref(idx) -> T*`**：返回指向向量缓冲区内元素的直接指针。这对于检查或修改大型结构体且不产生拷贝开销特别有用。
3. **`v.first()`** 与 **`v.last()`**：分别返回第一个和最后一个元素的副本。

> [!CAUTION]
> 与数组一样，向量索引从 0 开始（`0` 到 `len - 1`）。如果尝试访问超出此范围的索引，Zen C 会立即 panic 并报错 `Panic: Index out of bounds`，从而防止缓冲区溢出和读取未初始化的内存！

---

## 遍历向量

Zen C 提供了两种惯用的方式来遍历向量：

### 1. 按值遍历（`for x in v`）
在迭代期间使用每个元素的副本。

### 2. 按引用遍历（`for x in &v`）
产生指向向量中每个元素的指针（`T*`）。这允许你在不进行拷贝的情况下检查元素，或者使用指针解引用（`*x`）**就地修改元素**：

**代码清单 8-6: `list8-6.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let scores = Vec<int>::new();
 5 |     scores.push(45);
 6 |     scores.push(58);
 7 |     scores.push(72);
 8 |
 9 |     println "--- Original Scores ---";
10 |     for s in &scores {
11 |         println "Score: {*s}";
12 |     }
13 |
14 |     // In-place mutation: curve every score by +10
15 |     for s in &scores {
16 |         *s = *s + 10;
17 |     }
18 |
19 |     println "\n--- Curved Scores ---";
20 |     for s in &scores {
21 |         println "Curved score: {*s}";
22 |     }
23 | }
```

输出：
```text
--- Original Scores ---
Score: 45
Score: 58
Score: 72

--- Curved Scores ---
Curved score: 55
Curved score: 68
Curved score: 82
```

---

## 函数式迭代器组合子

`Vec<T>` 与 Zen C 的函数式迭代器组合子无缝集成。调用 `.iterator()` 会生成一个 `VecIter<T>`，支持：

- **`filter(predicate)`**：将满足布尔谓词的元素收集到一个新的 `Vec<T>` 中。
- **`fold(initial, accumulator)`**：将向量元素归约为单个累加值。
- **`find(predicate)`**：对首个匹配的元素返回 `Option<T>::Some(val)`，未找到则返回 `None()`。
- **`forEach(callback)`**：对每个元素执行指定函数。

**代码清单 8-7: `list8-7.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let nums = Vec<int>::new();
 5 |     nums.push(1);
 6 |     nums.push(2);
 7 |     nums.push(3);
 8 |     nums.push(4);
 9 |     nums.push(5);
10 |
11 |     // 1. Filter: select even numbers
12 |     let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
13 |     println "Evens count: {evens.length()}";
14 |     for e in &evens {
15 |         println "  Even: {*e}";
16 |     }
17 |
18 |     // 2. Fold: sum all numbers
19 |     let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
20 |     println "Sum: {sum}";
21 |
22 |     // 3. Find: find first value greater than 3
23 |     let found = nums.iterator().find(fn(x: int) -> bool { return x > 3; });
24 |     if found.is_some() {
25 |         println "First number > 3: {found.unwrap()}";
26 |     }
27 | }
```

输出：
```text
Evens count: 2
  Even: 2
  Even: 4
Sum: 15
First number > 3: 4
```

---

## `Vec` 上的运算符重载

Zen C 为 `Vec<T>` 重载了常用运算符，使代码更加富有表现力和简洁：

| 运算符 | 语法 | 方法 | 说明 |
| :--- | :--- | :--- | :--- |
| `+` | `v1 + &v2` | `add` | 将两个向量拼接成一个新的向量。 |
| `+=` | `v1 += &v2` | `add_assign` | 将 `v2` 中的元素就地追加到 `v1` 中。 |
| `<<` | `v << item` | `shl` | 将 `item` 追加到末尾（流式推入）。 |
| `>>` | `v >> &out` | `shr` | 将末尾元素弹出到 `out` 中（流式弹出）。 |
| `*` | `v * n` | `mul` | 返回一个将元素重复 $n$ 次的新向量。 |
| `*=` | `v *= n` | `mul_assign` | 就地将元素重复 $n$ 次。 |
| `==` | `v1 == &v2` | `eq` | 检查结构相等性（长度相同且元素逐字节相同）。 |
| `!=` | `v1 != &v2` | `neq` | 检查结构不等性。 |
| `[]` | `v[i]` | `index` | 直接进行基于零的元素索引。 |

**代码清单 8-8: `list8-8.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let a = Vec<int>::new();
 5 |     a << 10; // Stream push
 6 |     a << 20;
 7 |
 8 |     let b = Vec<int>::new();
 9 |     b << 30;
10 |     b << 40;
11 |
12 |     // Concatenate into a new vector
13 |     let c = a + &b;
14 |     println "Concatenated length: {c.length()}";
15 |
16 |     // Stream pop
17 |     let popped: int = 0;
18 |     c >> &popped;
19 |     println "Popped via >>: {popped}";
20 |
21 |     // Repeat vector elements
22 |     let repeated = a * 2;
23 |     println "Repeated length: {repeated.length()}";
24 |
25 |     // Structural equality
26 |     let a_copy = a.clone();
27 |     println "a == a_copy: {a == &a_copy}";
28 | }
```

输出：
```text
Concatenated length: 4
Popped via >>: 40
Repeated length: 4
a == a_copy: true
```

---

## 自定义结构体向量

向量可以与用户定义的结构体无缝协作：

**代码清单 8-9: `list8-9.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | struct Task {
 4 |     id: int;
 5 |     priority: int;
 6 | }
 7 |
 8 | fn main() {
 9 |     let tasks = Vec<Task>::new();
10 |     tasks.push(Task { id: 101, priority: 1 });
11 |     tasks.push(Task { id: 102, priority: 3 });
12 |     tasks.push(Task { id: 103, priority: 2 });
13 |
14 |     for t in &tasks {
15 |         println "Task #{(*t).id} (Priority: {(*t).priority})";
16 |     }
17 | }
```

输出：
```text
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

---

## 内存管理与移动语义

`Vec<T>` 自动实现了 `Drop` trait：

```zenc
impl Drop for Vec {
    fn drop(self) {
        self.free();
    }
}
```

- **作用域退出**：当向量变量离开作用域时，其 `drop()` 方法会自动调用，安全地释放其堆缓冲区（`dealloc<T>(self.data)`）。
- **使用 `.clone()` 进行深拷贝**：赋值或传递向量会传递 3 字结构体的值副本。要创建一个拥有独立堆缓冲区的副本，请调用 `v.clone()`。
- **使用 `.forget()` 转移所有权**：如果你希望将底层堆缓冲区与向量分离（例如将原始缓冲区传递给 C 库函数且不被 `Drop` 释放），请调用 `v.forget()`。这会将 `data`、`len` 和 `cap` 清零。

---

## 完整示例

这是一个演示创建、修改、迭代、运算符和自定义结构体使用的完整程序：

**代码清单 8-10: `list8-10.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | struct Task {
 4 |     id: int;
 5 |     priority: int;
 6 | }
 7 |
 8 | fn main() {
 9 |     println "=== 1. Basic Vector Operations ===";
10 |     let v = Vec<int>::new();
11 |     v.push(10);
12 |     v.push(20);
13 |     v.push(30);
14 |
15 |     println "Length: {v.length()}, First: {v.first()}, Last: {v.last()}";
16 |     println "Element at index 1: {v[1]}";
17 |
18 |     println "\n=== 2. Insert, Remove, and Pop ===";
19 |     v.insert(1, 15);
20 |     println "After insert(1, 15), length: {v.length()}";
21 |
22 |     let removed = v.remove(2);
23 |     println "Removed element at index 2: {removed}";
24 |
25 |     let popped = v.pop();
26 |     println "Popped last element: {popped}";
27 |
28 |     let opt = v.pop_opt();
29 |     if opt.is_some() {
30 |         println "Safely popped: {opt.unwrap()}";
31 |     }
32 |
33 |     println "\n=== 3. Iteration by Reference and Mutation ===";
34 |     for x in &v {
35 |         *x = *x * 5;
36 |     }
37 |     for x in &v {
38 |         println "Mutated value: {*x}";
39 |     }
40 |
41 |     println "\n=== 4. Functional Combinators ===";
42 |     let nums = Vec<int>::new();
43 |     nums.push(1);
44 |     nums.push(2);
45 |     nums.push(3);
46 |     nums.push(4);
47 |     nums.push(5);
48 |
49 |     let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
50 |     println "Filtered evens count: {evens.length()}";
51 |     for e in &evens {
52 |         println "  Even: {*e}";
53 |     }
54 |
55 |     let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
56 |     println "Sum of nums: {sum}";
57 |
58 |     let first_even = nums.iterator().find(fn(x: int) -> bool { return x % 2 == 0; });
59 |     if first_even.is_some() {
60 |         println "First even number found: {first_even.unwrap()}";
61 |     }
62 |
63 |     println "\n=== 5. Operator Overloading ===";
64 |     let v2 = Vec<int>::new();
65 |     v2 << 100;
66 |     v2 << 200;
67 |
68 |     let combined = v + &v2;
69 |     println "Combined vector length: {combined.length()}";
70 |     for item in &combined {
71 |         println "  Combined item: {*item}";
72 |     }
73 |
74 |     let popped_val: int = 0;
75 |     v2 >> &popped_val;
76 |     println "Popped from v2 via >>: {popped_val}";
77 |
78 |     let repeated = v * 2;
79 |     println "Repeated vector length: {repeated.length()}";
80 |
81 |     println "\n=== 6. Vector of Custom Structs ===";
82 |     let task_list = Vec<Task>::new();
83 |     task_list.push(Task { id: 101, priority: 1 });
84 |     task_list.push(Task { id: 102, priority: 3 });
85 |     task_list.push(Task { id: 103, priority: 2 });
86 |
87 |     for t in &task_list {
88 |         println "Task #{(*t).id} (Priority: {(*t).priority})";
89 |     }
90 | }
```

输出：
```text
=== 1. Basic Vector Operations ===
Length: 3, First: 10, Last: 30
Element at index 1: 20

=== 2. Insert, Remove, and Pop ===
After insert(1, 15), length: 4
Removed element at index 2: 20
Popped last element: 30
Safely popped: 15

=== 3. Iteration by Reference and Mutation ===
Mutated value: 50

=== 4. Functional Combinators ===
Filtered evens count: 2
  Even: 2
  Even: 4
Sum of nums: 15
First even number found: 2

=== 5. Operator Overloading ===
Combined vector length: 3
  Combined item: 50
  Combined item: 100
  Combined item: 200
Popped from v2 via >>: 200
Repeated vector length: 2

=== 6. Vector of Custom Structs ===
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

> [!TIP]
> 你可以在 [`book/examples/ch08/ch08-01-vectors/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-01-vectors/main.zc) 中找到并运行本节的完整可执行示例。

---

现在你已经掌握了向量，接下来让我们探索**[字符串](ch08-02-strings.md)**！
