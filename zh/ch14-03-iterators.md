# 使用迭代器处理元素序列

**迭代器模式（iterator pattern）**允许你依次对序列中的各项执行任务，而无需手动管理循环索引、边界检查或终止条件。

在 Zen C 中，迭代器驱动了两个符合人体工程学的语言与库特性：
1. **原生的 `for item in collection` 循环**，适用于任何实现了 `iterator()` 和 `next()` 协议的类型。
2. **`VecIter<T>` 上的高阶组合器方法**（例如 `.filter(...)`、`.fold(...)`、`.find(...)`、`.any(...)`、`.all(...)` 和 `.forEach(...)`），它们接收我们在 [14.1 节](ch14-01-lambdas.md) 中学习编写的闭包。

---

## 1. `Iterator<T>` 与 `Iterable<T>` 协议

在 `std/iter.zc` 中，Zen C 定义了两个描述迭代工作原理的基础 trait：

```zenc
// From std/iter.zc:
import "./option.zc"

trait Iterator<T> {
    fn next(self) -> Option<T>;
}

trait Iterable<T> {
    fn iterator(self) -> Iterator<T>;
}
```

在 Zen C 中，任何结构体只要满足以下条件即可自动参与 `for item in expr` 循环：
1. 在表达式上调用 `.iterator()` 返回一个迭代器状态结构体，并且
2. 在该迭代器结构体上调用 `.next()` 返回一个 `Option<T>`（或具有 `.is_none()` 和 `.unwrap()` 的类似 Option 的结果），为每个元素生成 `Some(item)`，在序列耗尽时生成 `None()`。

---

## 2. 按值迭代（`VecIter<T>`）vs. 按引用迭代（`VecIterRef<T>`）

当遍历 `Vec<T>`（来自 `std/vec.zc`）时，Zen C 提供了两种迭代器模式：

| 表达式 | 调用的方法 | 迭代器类型 | 生成的项 | 最佳适用场景... |
| :--- | :--- | :--- | :--- | :--- |
| `for x in vec` 或 `vec.iterator()` | `Vec::iterator(self)` | `VecIter<T>` | `T`（元素副本） | `T` 是小型标量或值类型（`int`、`f64`、小型结构体），或者你想要链式调用 `VecIter<T>` 组合器（`filter`、`fold`、`any`、`all`）。 |
| `for ptr in &vec` 或 `vec.iter_ref()` | `Vec::iter_ref(self)` | `VecIterRef<T>` | `T*`（指向就地元素的指针） | `T` 是拥有堆内存的类型（`String`、`Vec<U>`）或大型结构体，你希望就地检查或修改它，而无需复制或触发 `Drop`。 |

```zenc
import "std/vec.zc"

let nums = Vec<int>::new();
nums.push(10);
nums.push(20);

// 1. Value iteration: yields `int` copies
for val in nums {
    println "Value: {val}";
}

// 2. Reference iteration: yields `int*` pointers into the vector's buffer
for ptr in &nums {
    *ptr += 5; // Mutates element in place!
}
```

---

## 3. 使用闭包消费与适配 `VecIter<T>`

调用 `vec.iterator()` 会返回一个带有丰富函数式方法的 `VecIter<T>` 游标，这些方法接收闭包（`fn(T) -> ...`）：

| 方法 | 签名 | 说明 |
| :--- | :--- | :--- |
| **`filter`** | `fn filter(self, pred: fn(T) -> bool) -> Vec<T>` | 对剩余的每一项评估 `pred(item)`，并将所有匹配项收集到一个新的 `Vec<T>` 中。 |
| **`fold`** | `fn fold(self, init: T, f: fn(T, T) -> T) -> T` | 从 `init` 开始，通过反复应用 `acc = f(acc, item)` 将所有剩余项归约为单个累加值。 |
| **`find`** | `fn find(self, pred: fn(T) -> bool) -> Option<T>` | 短路操作，返回使 `pred(item)` 为 `true` 的第一个项的 `Some(item)`，若均不匹配则返回 `None()`。 |
| **`any`** | `fn any(self, pred: fn(T) -> bool) -> bool` | 短路操作，如果至少有一个项使 `pred(item)` 返回 `true` 则返回 `true`。 |
| **`all`** | `fn all(self, pred: fn(T) -> bool) -> bool` | 短路操作，如果每个项都使 `pred(item)` 返回 `true` 则返回 `true`。 |
| **`forEach`** | `fn forEach(self, f: fn(T))` | 对每个剩余项调用 `f(item)` 以产生副作用。 |
| **`count`** | `fn count(self) -> usize` | 返回迭代器中剩余的项数。 |
| **`collect`** | `fn collect(self) -> Vec<T>` | 将所有剩余项抽取（drain）到新分配的 `Vec<T>` 中。 |

因为这些方法接收完整的 Zen C 闭包（`fn(...)`），所以你的谓词和归约器可以捕获周围函数中的局部变量：

```zenc
let min_passing = 75;

// `min_passing` is captured from the enclosing scope!
let passing = scores.iterator().filter([=] s -> s >= min_passing);
let total   = passing.iterator().fold(0, (acc, x) -> acc + x);
```

---

## 4. 实现自定义迭代器

你并不局限于仅迭代标准库集合。你可以通过定义一个带有 `.iterator(self)` 和 `.next(self) -> Option<T>` 的结构体，创建自己的惰性、零分配生成器！

例如，让我们构建一个 `Fibonacci` 结构体，它惰性地按需生成前 `max_steps` 个斐波那契数（`0, 1, 1, 2, 3, 5, 8, 13, ...`），而无需分配数组：

```zenc
import "std/option.zc"

struct Fibonacci {
    curr: int,
    next_val: int,
    step: int,
    max_steps: int,
}

impl Fibonacci {
    fn new(max_steps: int) -> Fibonacci {
        return Fibonacci {
            curr: 0,
            next_val: 1,
            step: 0,
            max_steps: max_steps,
        };
    }

    fn iterator(self) -> Fibonacci {
        return self;
    }

    fn next(self) -> Option<int> {
        if self.step >= self.max_steps {
            return Option<int>::None();
        }
        let yielded = self.curr;
        let upcoming = self.curr + self.next_val;
        self.curr = self.next_val;
        self.next_val = upcoming;
        self.step += 1;
        return Option<int>::Some(yielded);
    }
}
```

因为 `Fibonacci` 定义了 `iterator` 和 `next`，所以你可以直接在 `for` 循环中使用它：

```zenc
for n in Fibonacci::new(8) {
    print "{n} "; // 0 1 1 2 3 5 8 13
}
```

---

## 5. 完整的可运行示例

以下是结合了 `VecIter<T>` 组合器（`filter`、`fold`、`find`、`any`、`all`）、引用迭代（`&scores`）以及我们的自定义 `Fibonacci` 迭代器的完整可运行程序（`examples/ch14/ch14-03-iterators/main.zc`）：

**代码清单 14-3: `VecIter<T>` 组合器与自定义 `Fibonacci` 迭代器**

```zenc
// File: examples/ch14/ch14-03-iterators/main.zc
import "std/vec.zc"
import "std/option.zc"
import "std/slice.zc"

// Custom stateful iterator generating the first `max_steps` Fibonacci numbers
struct Fibonacci {
    curr: int,
    next_val: int,
    step: int,
    max_steps: int,
}

impl Fibonacci {
    fn new(max_steps: int) -> Fibonacci {
        return Fibonacci {
            curr: 0,
            next_val: 1,
            step: 0,
            max_steps: max_steps,
        };
    }

    fn iterator(self) -> Fibonacci {
        return self;
    }

    fn next(self) -> Option<int> {
        if self.step >= self.max_steps {
            return Option<int>::None();
        }
        let yielded = self.curr;
        let upcoming = self.curr + self.next_val;
        self.curr = self.next_val;
        self.next_val = upcoming;
        self.step += 1;
        return Option<int>::Some(yielded);
    }
}

fn main() {
    let scores = Vec<int>::new();
    scores.push(45);
    scores.push(82);
    scores.push(91);
    scores.push(60);
    scores.push(77);
    scores.push(95);

    // 1. filter() with a closure capturing a threshold
    let min_passing = 75;
    let passing = scores.iterator().filter([=] s -> s >= min_passing);
    println "Passing scores (>= {min_passing}): {passing.length()}";
    assert(passing.length() == 4, "Expected 4 passing scores (82, 91, 77, 95)");

    // 2. fold() to sum all passing scores
    let passing_sum = passing.iterator().fold(0, (acc, x) -> acc + x);
    println "Sum of passing scores: {passing_sum}";
    assert(passing_sum == 345, "82 + 91 + 77 + 95 should equal 345");

    // 3. find(), any(), and all()
    let first_honors = scores.iterator().find(s -> s >= 90);
    assert(first_honors.is_some() && first_honors.unwrap() == 91, "First score >= 90 is 91");

    let has_perfect = scores.iterator().any(s -> s == 100);
    let all_positive = scores.iterator().all(s -> s > 0);
    println "has_perfect={has_perfect}, all_positive={all_positive}";
    assert(!has_perfect && all_positive, "No 100s, all scores > 0");

    // 4. Reference iteration (`&scores`) vs. value iteration (`scores`)
    let bonus_count = 0;
    for score_ptr in &scores {
        if *score_ptr >= 90 {
            bonus_count += 1;
        }
    }
    println "Scores >= 90 via reference iterator: {bonus_count}";
    assert(bonus_count == 2, "Expected 2 scores >= 90 (91 and 95)");

    // 5. Using our custom Fibonacci iterator in a native `for ... in` loop
    let fib = Fibonacci::new(8);
    let fib_sum = 0;
    print "First 8 Fibonacci numbers:";
    for n in fib {
        print " {n}";
        fib_sum += n;
    }
    println "";
    println "Sum of first 8 Fibonacci numbers: {fib_sum}";
    assert(fib_sum == 33, "0 + 1 + 1 + 2 + 3 + 5 + 8 + 13 = 33");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run -q examples/ch14/ch14-03-iterators/main.zc
Passing scores (>= 75): 4
Sum of passing scores: 345
has_perfect=false, all_positive=true
Scores >= 90 via reference iterator: 2
First 8 Fibonacci numbers: 0 1 1 2 3 5 8 13
Sum of first 8 Fibonacci numbers: 33
```

---

## 🔍 窥探底层 C 代码：`for n in fib` 如何脱糖

当 `zc` 转译 `for n in fib` 时，它**不**使用虚方法表（`vtable`）或堆装箱（heap boxing）。相反，它在栈分配的 `Fibonacci` 结构体上静态解析 `Fibonacci__iterator` 和 `Fibonacci__next`：

```c
Fibonacci __it = Fibonacci__iterator(&fib);
for (; 1; ) {
    Option__int32_t __opt = Fibonacci__next(&__it);
    if (Option__int32_t__is_none(&__opt)) {
        break;
    }
    int32_t n = Option__int32_t__unwrap(&__opt);
    {
        fprintf(stdout, " %d", n);
        (fib_sum = (fib_sum + n));
    }
}
```

这些迭代器循环和闭包组合器的性能与手写的索引循环相比如何？让我们在 **[14.4 性能对比：循环 vs 迭代器](ch14-04-performance.md)** 中一探究竟！
