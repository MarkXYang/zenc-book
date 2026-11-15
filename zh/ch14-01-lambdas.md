# 14.1 Lambda 与闭包捕获

**Lambda**（或**闭包**，closure）是一个可以绑定到变量或作为参数直接传递给其他函数的匿名函数。与普通的顶层 `fn` 声明不同，闭包可以从定义它的词法作用域中**捕获**变量。

---

## 1. 箭头语法 vs. 块语法

Zen C 提供了两种互补的书写闭包的语法，具体取决于你的 lambda 体是一个单独的表达式还是多语句块：

### 简洁的箭头语法（`x -> expr` 与 `(a, b) -> expr`）

对于单表达式 lambda，列出参数名称（或带括号的参数列表），后跟 `->` 以及返回表达式：

```zenc
let factor = 3;

// Single parameter arrow lambda
let triple = x -> x * factor;

// Multi-parameter arrow lambda
let weighted_sum = (a, b) -> (a * factor) + b;
```

### 显式块语法（`fn(x: T) -> R { ... }`）

当你的闭包需要显式的参数/返回类型注解、多个语句、局部变量或提前 `return` 分支时，请使用 `fn(...) -> R { ... }` 块语法：

```zenc
let factor = 3;

let triple_block = fn(x: int) -> int {
    let scaled = x * factor;
    return scaled;
};
```

---

## 2. 捕获环境：按值（`[=]`）vs. 按引用（`[&]`）

当 lambda 引用外层函数的变量时，该变量如何在闭包内部存储？Zen C 通过两种捕获模式为你提供了显式控制：

| 捕获模式 | 箭头语法 | 块语法 | 语义 |
| :--- | :--- | :--- | :--- |
| **按值（默认）** | `x -> x + offset` 或 `[=] x -> x + offset` | `fn(x: int) -> int { ... }` 或 `fn[=](x: int) -> int { ... }` | 在创建时将每个捕获变量的当前值复制到闭包的上下文中。 |
| **按引用** | `[&] x -> total += x` | `fn[&](x: int) { total += x; }` | 存储指向每个被捕获变量的指针（`T*`），使得闭包内部的修改直接更新外层变量。 |

### 按值捕获（`[=]`）

默认情况下（或当前缀为 `[=]` 时），闭包对其使用的任何外层变量获取一个独立的**快照（snapshot）**。在闭包创建*之后*修改外层变量不会改变闭包内部看到的值：

```zenc
let offset = 10;
let add_snapshot = [=] x -> x + offset;

offset = 999; // Does NOT affect `add_snapshot`
println "{add_snapshot(5)}"; // Prints 15 (5 + 10)
```

### 按引用捕获（`[&]`）

当你希望闭包累积状态或修改周围作用域中的变量时，请在箭头 lambda 前加上 `[&]`，或在块 lambda 前加上 `fn[&]`：

```zenc
let running_total = 0;

// Arrow syntax with reference capture:
let add_to_total = [&] x -> running_total += x;
add_to_total(10);
add_to_total(25); // running_total is now 35

// Block syntax with reference capture:
let accumulate_pair = fn[&](a: int, b: int) -> int {
    running_total += (a + b);
    return running_total;
};
accumulate_pair(3, 4); // running_total is now 42
```

---

## 3. 接收闭包的高阶函数（`fn(T) -> R`）

要编写一个接收闭包作为参数的函数，请使用 `fn(ParamTypes) -> ReturnType`（当闭包返回 `void` 时写作 `fn(ParamTypes)`）对参数进行注解：

```zenc
fn apply_twice(f: fn(int) -> int, x: int) -> int {
    return f(f(x));
}
```

然后你可以将任何 lambda 表达式——包括捕获了局部变量的 lambda——直接传递给 `apply_twice`：

```zenc
let base = 4;
let result = apply_twice([=] x -> x + base, 10); // (10 + 4) + 4 = 18
```

---

## 4. 完整的可运行示例

以下是一个完整的示例（`examples/ch14/ch14-01-lambdas/main.zc`），演示了箭头和块 lambda、按值快照（`[=]`）、高阶闭包参数（`fn(int) -> int`）以及引用修改（`[&]` 与 `fn[&]`）：

**示例 14-1: `list14-1.zc` —— Lambda、闭包捕获模式与高阶函数**

```zenc
// File: examples/ch14/ch14-01-lambdas/main.zc

// Higher-order function accepting a Zen C closure `fn(int) -> int`
fn apply_twice(f: fn(int) -> int, x: int) -> int {
    return f(f(x));
}

fn main() {
    // 1. Concise arrow syntax vs. explicit block syntax
    let factor = 3;
    let triple_arrow = x -> x * factor;
    let triple_block = fn(x: int) -> int { return x * factor; };

    println "triple_arrow(7) = {triple_arrow(7)}";
    println "triple_block(7) = {triple_block(7)}";
    assert(triple_arrow(7) == 21 && triple_block(7) == 21, "Both lambdas should return 21");

    // 2. Capture by value (default / `[=]`): snapshots `offset` at creation time
    let offset = 10;
    let add_snapshot = [=] x -> x + offset;
    offset = 999; // Mutating `offset` later does NOT affect `add_snapshot`
    let snap_res = add_snapshot(5);
    println "add_snapshot(5) (captured offset=10) = {snap_res}";
    assert(snap_res == 15, "Value capture must use the snapshot (10), not 999");

    // 3. Passing a closure inline to a higher-order function
    let base = 4;
    let twice_res = apply_twice([=] x -> x + base, 10);
    println "apply_twice(x + 4, 10) = {twice_res}";
    assert(twice_res == 18, "10 + 4 + 4 should equal 18");

    // 4. Capture by reference (`[&]`): mutates outer variables directly
    let running_total = 0;
    let add_to_total = [&] x -> running_total += x;
    add_to_total(10);
    add_to_total(25);
    println "running_total after arrow [&] calls = {running_total}";
    assert(running_total == 35, "10 + 25 should equal 35");

    // Block syntax with reference capture `fn[&](...)`
    let accumulate_pair = fn[&](a: int, b: int) -> int {
        running_total += (a + b);
        return running_total;
    };
    let final_total = accumulate_pair(3, 4);
    println "running_total after block fn[&] call = {final_total}";
    assert(running_total == 42 && final_total == 42, "35 + (3 + 4) should equal 42");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run -q examples/ch14/ch14-01-lambdas/main.zc
triple_arrow(7) = 21
triple_block(7) = 21
add_snapshot(5) (captured offset=10) = 15
apply_twice(x + 4, 10) = 18
running_total after arrow [&] calls = 35
running_total after block fn[&] call = 42
```

---

## 🔍 窥探底层 C 代码：闭包如何编译为 C11

标准 C11 并没有闭包的概念。`zc` 如何将捕获变量的 lambda 编译为具有确定性内存管理的可移植 C11 呢？

1. **运行时闭包结构体（`z_closure_T`）**：
   在 Zen C 的运行时前导定义中，每个闭包值都由一个三指针结构体表示：
   ```c
   typedef struct z_closure_T {
       void *func;            // Pointer to the generated C function
       void *ctx;             // Pointer to the captured environment struct
       void (*drop)(void*);   // Destructor to free `ctx` when the closure is dropped
   } z_closure_T;
   ```
2. **生成的上下文结构体与蹦床函数（Trampoline Function）**：
   对于按值捕获的 lambda（`[=] x -> x + base`），`zc` 会生成一个保存 `base` 副本的上下文结构体（`int32_t base;`）；而对于按引用捕获的 lambda（`fn[&](a: int, b: int)`），`zc` 则会生成一个保存指针的上下文结构体（`int32_t* running_total;`）：
   ```c
   struct Lambda_4_Ctx {
       int32_t* running_total;
   };

   static void _lambda_4_drop(void* _ctx) {
       free(_ctx);
   }

   int32_t _lambda_4(void* _ctx, int32_t a, int32_t b) {
       struct Lambda_4_Ctx* ctx = (struct Lambda_4_Ctx*)_ctx;
       ((*ctx->running_total) = ((*ctx->running_total) + (a + b)));
       return (*ctx->running_total);
   }
   ```
3. **闭包上下文的 RAII 清理**：
   当 `apply_twice(z_closure_T f, int32_t x)` 执行结束时，`zc` 会在返回前自动调用 `if (__z_drop_flag_f && f.drop) f.drop(f.ctx);`，自动释放闭包的堆上下文！

如果你需要将回调传递给期望单个 8 字节 C 函数指针且没有 `void* _ctx` 参数的 C 库函数（如 `qsort` 或 `signal`），该怎么办？让我们在 **[14.2 原始函数指针（`fn*`）](ch14-02-fn-pointers.md)** 中探索 **`fn*` 原始函数指针**！
