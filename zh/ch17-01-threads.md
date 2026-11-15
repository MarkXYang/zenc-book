# 17.1 使用线程同时运行代码

在大多数操作系统中，正在执行的程序代码运行在一个**进程（process）**中，操作系统会同时管理多个进程。在单个进程内部，你也可以拥有在多个 CPU 核心上同时运行的独立部分。执行这些独立部分的操作系统功能被称为**线程（thread）**。

Zen C 的标准库模块 `std/thread.zc` 提供了 **1:1 线程模型**：每个 `Thread` 实例直接映射到一个原生 OS 线程（在 Linux、macOS 和 BSD 上为 `pthread_t`）。在你的代码与操作系统内核之间，没有任何隐藏的绿色线程调度器或运行时垃圾回收器。

---

## 1. 创建与汇合线程（`std/thread.zc`）

导入 `"std/thread.zc"` 即可使用 `Thread` 结构体和辅助函数：

| 函数 / 方法 | 签名 | 说明 |
| :--- | :--- | :--- |
| **`Thread::spawn(func)`** | `fn spawn(func: fn()) -> Result<Thread>` | 创建并立即启动一个执行无参闭包 `func` 的新 OS 线程。 |
| **`thread.join()`** | `fn join(self) -> Result<bool>` | 阻塞调用线程，直到 `thread` 执行完毕并释放其 OS 资源。 |
| **`thread.detach()`** | `fn detach(self) -> Result<bool>` | 分离（detach）`thread`，使其在后台独立运行；退出时自动回收其 OS 资源。 |
| **`thread.cancel()`** | `fn cancel(self) -> Result<bool>` | 向 `thread` 发送取消请求（`pthread_cancel`）。 |
| **`sleep_ms(ms)`** | `fn sleep_ms(ms: int)` | 暂停当前线程 `ms` 毫秒。 |

由于在操作系统达到进程线程上限（`EAGAIN`）时线程创建可能会失败，因此 `Thread::spawn` 返回一个 `Result<Thread>`。你应该始终检查 `.is_ok()` 或对返回的句柄进行 `.unwrap()`，并在 `main()` 退出之前调用 `.join()`，以防止进程在工作线程仍在运行时意外终止：

```zenc
import "std/thread.zc"

fn main() {
    let handle = Thread::spawn(fn() {
        println "Hello from a spawned OS thread!";
    }).unwrap();

    // Wait for the spawned thread to finish before exiting `main`
    handle.join().unwrap();
}
```

---

## 2. 深入底层：闭包如何跨越线程边界

在[14.1 节](ch14-01-lambdas.md)中，我们看到 Zen C 闭包 `fn()` 在 C11 中被表示为一个 24 字节的 `z_closure_T` 结构体，包含三个字段：

```c
typedef struct {
    void *func;          // Pointer to the generated C function
    void *ctx;           // Heap-allocated struct holding captured variables
    void (*drop)(void*); // Cleanup function to free `ctx`
} z_closure_T;
```

当你将闭包传递给 `Thread::spawn(func)` 时，创建线程可能会在新 OS 线程开始执行*之前*就已经从其当前作用域返回。`std/thread.zc` 是如何防止调用者的作用域退出在工作线程仍在使用 `func.ctx` 时将其释放的？

来看看 `Thread::spawn` 和 `_z_thread_trampoline` 在 `std/thread.zc` 内部的具体工作流程：

1. **堆上复制闭包描述符**：`Thread::spawn` 在堆上分配一个 `z_closure_T` 描述符（`ctx`）的副本，并将 `func` 复制到其中。
2. **所有权转移与清空 `drop`**：`Thread::spawn` 将调用者栈副本上的 `drop` 清零：`((z_closure_T*)&func)->drop = NULL;`，这样当 `Thread::spawn` 返回时，创建线程就**不会**释放捕获的环境。
3. **线程退出时自动清理**：`pthread_create` 启动 `_z_thread_trampoline(ctx)`，它调用 `f(closure->ctx)`，然后在线程结束时立即调用 `if (closure->drop) closure->drop(closure->ctx);` 和 `free(closure);`！

---

## 3. 安全捕获数据：`fn[=]()` 与 `fn[&]()`

在 `for` 循环中创建多个线程时，请特别注意闭包如何从外层作用域捕获变量：

### 陷阱：通过引用捕获循环计数器（`fn[&]()`）

如果你通过引用（`fn[&]()`）捕获可变的循环索引 `w`，所有工作线程都会接收到一个指向**同一个**栈变量 `w` 的指针（`int*`）。当某个工作线程苏醒并解引用 `*w` 时，`main()` 中的循环可能已经将 `w` 递增到了 `4`！

### 最佳实践：使用 `fn[=]()` 捕获每个工作线程专属的值或指针

相反，应该在循环体内部将每个工作线程专属的任务指针（或工作线程 ID）绑定到一个局部变量上，并**按值**（`fn[=]() { ... }`）捕获它。这样，每个线程堆分配的闭包上下文都会接收到该指针或 ID 的私有副本：

```zenc
for w in 0..NUM_WORKERS {
    tasks[w] = WorkerTask { worker_id: w, ... };

    // Copy the pointer to `tasks[w]` by value into this thread's closure context
    let task_ptr: WorkerTask* = &tasks[w];
    let spawned = Thread::spawn(fn[=]() {
        run_partition(task_ptr);
    });
    threads.push(spawned.unwrap());
}
```

> [!IMPORTANT]
> **借用指针的栈生命周期规则**：当新创建的线程通过指针访问父函数的栈数据时（例如 `task_ptr` 指向 `tasks: WorkerTask[4]`），父函数**必须**在包含 `tasks` 的栈帧返回*之前*对每个工作线程调用 `thread.join()`。切勿将持有指向调用者栈帧指针的线程进行 `detach()`！

---

## 4. 完整示例：Fork-Join 并行计算平方和

最快速的并发程序往往是在计算阶段**完全不需要加锁**的程序。在 **Fork-Join**（分叉-汇合）模式中：

1. **Fork（分叉）**：将输入范围划分为 $N$ 个不相交的切片，并让每个工作线程独占其自己的输出槽位（`WorkerTask`）。
2. **Compute（计算）**：所有 $N$ 个线程在独立的 CPU 核心上同时运行，不会在任何共享缓存行或互斥锁上发生争用。
3. **Join & Reduce（汇合与规约）**：在所有工作线程的 `th.join()` 完成后，主线程按确定性顺序组合这 $N$ 个部分结果。

示例 17-1 将范围 `1..=1000` 划分到 4 个 OS 线程上（每个线程处理 250 个整数），计算出 $\sum_{i=1}^{1000} i^2 = 333,833,500$。

**示例 17-1**：跨 4 个 OS 线程的 Fork-Join 并行计算（`examples/ch17/ch17-01-threads/main.zc`）

```zenc
// File: examples/ch17/ch17-01-threads/main.zc
import "std/thread.zc"
import "std/vec.zc"

def NUM_WORKERS = 4;
def ITEMS_PER_WORKER = 250;

struct WorkerTask {
    worker_id: int;
    start_val: int;
    count: int;
    partial_sum: i64;
}

fn run_partition(task: WorkerTask*) {
    let sum: i64 = 0;
    for i in 0..task.count {
        let v: i64 = (i64)(task.start_val + i);
        sum += v * v;
    }
    task.partial_sum = sum;
}

fn main() {
    let tasks: WorkerTask[4];
    let threads = Vec<Thread>::with_capacity(NUM_WORKERS);

    // 1. Partition 1..=1000 across 4 OS threads (250 numbers per thread)
    for w in 0..NUM_WORKERS {
        tasks[w] = WorkerTask {
            worker_id: w,
            start_val: w * ITEMS_PER_WORKER + 1,
            count: ITEMS_PER_WORKER,
            partial_sum: 0,
        };

        let task_ptr: WorkerTask* = &tasks[w];
        let spawned = Thread::spawn(fn[=]() {
            run_partition(task_ptr);
        });
        assert(spawned.is_ok(), "Thread::spawn should succeed");
        threads.push(spawned.unwrap());
    }

    // 2. Join every worker thread before reading its partial_sum
    for i in (usize)0..threads.length() {
        let th = threads.get(i);
        let joined = th.join();
        assert(joined.is_ok(), "Thread::join should succeed");
    }

    // 3. Aggregate deterministic partial sums in worker order
    let total_sum_of_squares: i64 = 0;
    for w in 0..NUM_WORKERS {
        let lo = tasks[w].start_val;
        let hi = lo + tasks[w].count - 1;
        let part = tasks[w].partial_sum;
        println "Worker {w} ({lo}..={hi}): partial_sum = {part}";
        total_sum_of_squares += part;
    }

    // Formula: n(n + 1)(2n + 1) / 6 for n = 1000 -> 1000 * 1001 * 2001 / 6 = 333833500
    println "Total sum of squares (1..=1000): {total_sum_of_squares}";
    assert(total_sum_of_squares == 333833500, "Sum of squares 1..=1000 must equal 333833500");
}
```

使用 `zc run -q` 运行并验证示例 17-1：

```text
$ zc run -q examples/ch17/ch17-01-threads/main.zc
Worker 0 (1..=250): partial_sum = 5239625
Worker 1 (251..=500): partial_sum = 36552125
Worker 2 (501..=750): partial_sum = 99114625
Worker 3 (751..=1000): partial_sum = 192927125
Total sum of squares (1..=1000): 333833500
```
