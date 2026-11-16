# 工作池与任务分发

在前面的小节中，我们探讨了原生线程创建（`Thread::spawn`）、基于锁的同步（`Mutex`、`CondVar`）以及点对点消息传递。在诸如网络服务器、游戏引擎、后台构建系统以及数据库查询引擎等现实系统级软件中，为每一个微任务都创建一个全新的 OS 线程会带来过高的操作系统开销。

取而代之的是，生产环境系统通常使用**工作池**（通常称为线程池）：一组在后台持续运行的固定持久工作线程，从共享的并发任务队列中消费任务，并将结果发布回收集器中。

在本节中，我们将在 Zen C 中构建一个可复用的有界 **`ThreadPool`**，并深入探讨为什么 Zen C 倾向于使用显式的 1:1 OS 工作池，而非复杂的 `async`/`await` 状态机运行时。

---

## 1. 为什么 Zen C 选择工作池而非 `async`/`await`

在许多高级语言中，异步计算通常使用 `async` 和 `await` 关键字表达，这会将函数重写为编译器生成的状态机（或者依赖于像 Go 或 Tokio 那样沉重的 $M:N$ 绿色线程运行时）。

Zen C 深思熟虑后移除了 `async`/`await` 语法，转而采用直接的 **1:1 OS 线程**与**工作队列**：

| 方面 | `async`/`await` 状态机 | 1:1 OS 线程池（`std/thread.zc`） |
| :--- | :--- | :--- |
| **执行模型** | 隐藏的编译器生成协程 / 状态枚举 | 原生 POSIX 操作系统线程 |
| **运行时开销** | 复杂的调度器、轮询循环（poll loops）或具传染性的函数颜色（function coloring） | 零运行时开销；直接由操作系统内核调度 |
| **FFI 兼容性** | 无法轻易跨越外部 C 语言库调用进行让出（yield） | 透明调用任何标准 C 函数，不会阻塞用户态调度器 |
| **调试与性能剖析** | 在 GDB / LLDB / perf 中堆栈追踪混淆难懂 | 在 `top`、`gdb`、`lldb` 以及 Linux `perf` 中清晰可见的标准 OS 原生线程 |
| **内存可预测性** | 可变的堆帧或隐式装箱（boxing） | 每线程固定大小的栈、有界队列以及零意外内存分配 |

借助原生线程和条件变量，你可以对内存分配、队列深度、优先级以及硬件核心利用率拥有绝对的掌控权。

---

## 2. 有界 `ThreadPool` 的架构

我们的 `ThreadPool` 协调三个独立的层级：

```
                           +----------------------------------------+
                           |           Caller / Dispatcher          |
                           +----------------------------------------+
                                                |
                                    pool.dispatch(task)
                                                v
                           +----------------------------------------+
                           |  TaskQueue (Bounded Ring Buffer, 16)   |
                           |  - mutex: Mutex                        |
                           |  - not_empty: CondVar (wakes workers)  |
                           |  - not_full:  CondVar (backpressure)   |
                           +----------------------------------------+
                                        /       |       \
                                      /         |         \
                                    v           v           v
                            +-----------+ +-----------+ +-----------+
                            | Worker 0  | | Worker 1  | | Worker 2  |  (N OS Threads)
                            +-----------+ +-----------+ +-----------+
                                    \           |           /
                                      \         |         /
                                        v       v       v
                           +----------------------------------------+
                           |            ResultAggregator            |
                           |  - mutex: Mutex                        |
                           |  - results: Vec<TaskResult>            |
                           +----------------------------------------+
```

1. **`Task` 与 `TaskResult`**：描述工作项与计算结果的纯数据结构体。
2. **`TaskQueue`**：由一个 `Mutex` 和两个 `CondVar` 原语（`not_empty` 与 `not_full`）保护的有界 16 槽位循环缓冲区，在队列满时提供自动背压。
3. **`ThreadPool`**：创建 $N$ 个运行 `worker_loop` 的后台线程，它们获取任务、执行计算并将输出记录到线程安全的 `ResultAggregator` 中。
4. **优雅停机（Graceful Shutdown）**：发出 `stop()` 信号会唤醒所有休眠的工作线程，以便它们排空剩余任务，并在 `shutdown_and_wait()` 汇合（join）它们时干净地终止。

---

## 3. 实现有界 `TaskQueue`

`TaskQueue` 持有一个固定大小的 `Task` 结构体数组，带有循环的 `head` 和 `tail` 索引：

```zenc
def POOL_QUEUE_CAP = 16;

@derive(Copy)
struct Task {
    id: int;
    base: int;
    multiplier: int;
}

struct TaskQueue {
    tasks: Task[16];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    shutdown: bool;
}
```

如果缓冲区已满，`submit` 方法会阻塞，直到某个活跃的工作线程取出一个任务并发出 `not_full` 信号：

```zenc
fn submit(self, task: Task) -> bool {
    self.mutex.lock();
    while self.count == (usize)POOL_QUEUE_CAP && !self.shutdown {
        self.not_full.wait(&self.mutex);
    }
    if self.shutdown {
        self.mutex.unlock();
        return false;
    }

    self.tasks[self.tail] = task;
    self.tail = (self.tail + 1) % (usize)POOL_QUEUE_CAP;
    self.count += 1;

    self.not_empty.signal();
    self.mutex.unlock();
    return true;
}
```

类似地，`next_task` 会在 `not_empty` 上休眠，直到有新任务到来或广播停机信号：

```zenc
fn next_task(self) -> Option<Task> {
    self.mutex.lock();
    while self.count == 0 && !self.shutdown {
        self.not_empty.wait(&self.mutex);
    }
    if self.count == 0 {
        self.mutex.unlock();
        return Option<Task>::None();
    }

    let task = self.tasks[self.head];
    self.head = (self.head + 1) % (usize)POOL_QUEUE_CAP;
    self.count -= 1;

    self.not_full.signal();
    self.mutex.unlock();
    return Option<Task>::Some(task);
}
```

---

## 4. 工作线程循环与结果聚合

工作线程运行在一个持续的分发循环中。当任务到达时，线程执行工作并将结果提交给 `ResultAggregator`：

```zenc
fn worker_loop(queue: TaskQueue*, agg: ResultAggregator*) {
    while true {
        let task_opt = queue.next_task();
        if task_opt.is_none() {
            break; // Queue stopped and empty: exit cleanly
        }
        let task = task_opt.unwrap();

        // Perform calculation: sum of (base + i) * multiplier
        let acc = 0;
        for i in 1..=5 {
            acc += (task.base + i) * task.multiplier;
        }

        agg.record(TaskResult {
            task_id: task.id,
            value: acc,
        });
    }
}
```

---

## 5. 完整的可运行示例：代码清单 17-4

代码清单 17-4 将我们的 `TaskQueue`、`ThreadPool` 和 `ResultAggregator` 组合成一个完整的可运行程序，该程序初始化一个包含 4 个工作线程的线程池，异步分发 8 个任务，并安全地等待所有任务完成。

**代码清单 17-4**：异步线程池与任务队列（`examples/ch17/ch17-04-worker-pools/main.zc`）

```zenc
// File: examples/ch17/ch17-04-worker-pools/main.zc
import "std/thread.zc"
import "std/sync.zc"
import "std/option.zc"
import "std/vec.zc"

def POOL_QUEUE_CAP = 16;

@derive(Copy)
struct Task {
    id: int;
    base: int;
    multiplier: int;
}

@derive(Copy)
struct TaskResult {
    task_id: int;
    value: int;
}

// Bounded concurrent queue for dispatching tasks to worker threads
struct TaskQueue {
    tasks: Task[16];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    shutdown: bool;
}

impl TaskQueue {
    fn new() -> TaskQueue {
        let q: TaskQueue;
        q.head = 0;
        q.tail = 0;
        q.count = 0;
        q.mutex = Mutex::new();
        q.not_empty = CondVar::new();
        q.not_full = CondVar::new();
        q.shutdown = false;
        return q;
    }

    fn submit(self, task: Task) -> bool {
        self.mutex.lock();
        while self.count == (usize)POOL_QUEUE_CAP && !self.shutdown {
            self.not_full.wait(&self.mutex);
        }
        if self.shutdown {
            self.mutex.unlock();
            return false;
        }

        self.tasks[self.tail] = task;
        self.tail = (self.tail + 1) % (usize)POOL_QUEUE_CAP;
        self.count += 1;

        self.not_empty.signal();
        self.mutex.unlock();
        return true;
    }

    fn next_task(self) -> Option<Task> {
        self.mutex.lock();
        while self.count == 0 && !self.shutdown {
            self.not_empty.wait(&self.mutex);
        }
        if self.count == 0 {
            self.mutex.unlock();
            return Option<Task>::None();
        }

        let task = self.tasks[self.head];
        self.head = (self.head + 1) % (usize)POOL_QUEUE_CAP;
        self.count -= 1;

        self.not_full.signal();
        self.mutex.unlock();
        return Option<Task>::Some(task);
    }

    fn stop(self) {
        self.mutex.lock();
        self.shutdown = true;
        self.not_empty.broadcast();
        self.not_full.broadcast();
        self.mutex.unlock();
    }
}

// Thread-safe collector for aggregating completed task results
struct ResultAggregator {
    mutex: Mutex;
    results: Vec<TaskResult>;
    total_computed: int;
}

impl ResultAggregator {
    fn new() -> ResultAggregator {
        return ResultAggregator {
            mutex: Mutex::new(),
            results: Vec<TaskResult>::new(),
            total_computed: 0,
        };
    }

    fn record(self, res: TaskResult) {
        self.mutex.lock();
        self.results.push(res);
        self.total_computed += res.value;
        self.mutex.unlock();
    }
}

// Fixed-size ThreadPool coordinating worker threads
struct ThreadPool {
    queue: TaskQueue;
    workers: Vec<Thread>;
    aggregator: ResultAggregator;
}

fn worker_loop(queue: TaskQueue*, agg: ResultAggregator*) {
    while true {
        let task_opt = queue.next_task();
        if task_opt.is_none() {
            break;
        }
        let task = task_opt.unwrap();

        // Perform computation: sum (base + i) * multiplier for i in 1..=5
        let acc = 0;
        for i in 1..=5 {
            acc += (task.base + i) * task.multiplier;
        }

        agg.record(TaskResult {
            task_id: task.id,
            value: acc,
        });
    }
}

impl ThreadPool {
    fn new(num_workers: usize) -> ThreadPool {
        return ThreadPool {
            queue: TaskQueue::new(),
            workers: Vec<Thread>::with_capacity(num_workers),
            aggregator: ResultAggregator::new(),
        };
    }

    fn start(self, num_workers: usize) {
        let q_ptr: TaskQueue* = &self.queue;
        let agg_ptr: ResultAggregator* = &self.aggregator;

        for _ in 0..num_workers {
            let res = Thread::spawn(fn[=]() {
                worker_loop(q_ptr, agg_ptr);
            });
            assert(res.is_ok(), "Thread::spawn should succeed");
            self.workers.push(res.unwrap());
        }
    }

    fn dispatch(self, task: Task) -> bool {
        return self.queue.submit(task);
    }

    fn shutdown_and_wait(self) {
        self.queue.stop();
        for i in (usize)0..self.workers.length() {
            let th = self.workers.get(i);
            th.join().unwrap();
        }
    }
}

fn main() {
    let pool = ThreadPool::new(4);
    pool.start(4);

    // Dispatch 8 tasks across the 4-worker pool
    // Task 1: base=10, mult=1 -> (11+12+13+14+15)*1 = 65
    // Task 2: base=15, mult=2 -> (16+17+18+19+20)*2 = 180
    // Task 3: base=20, mult=3 -> (21+22+23+24+25)*3 = 345
    // Task 4: base=25, mult=4 -> (26+27+28+29+30)*4 = 560
    // Task 5: base=30, mult=5 -> (31+32+33+34+35)*5 = 825
    // Task 6: base=10, mult=2 -> 65 * 2 = 130
    // Task 7: base=10, mult=3 -> 65 * 3 = 195
    // Task 8: base=10, mult=4 -> 65 * 4 = 260
    // Total = 65 + 180 + 345 + 560 + 825 + 130 + 195 + 260 = 2560
    let dispatched = 0;
    for id in 1..=8 {
        let base = (id <= 5) ? (id * 5 + 5) : 10;
        let mult = (id <= 5) ? id : (id - 4);
        let ok = pool.dispatch(Task { id: id, base: base, multiplier: mult });
        if ok {
            dispatched += 1;
        }
    }
    println "Dispatched {dispatched} tasks to ThreadPool";

    pool.shutdown_and_wait();

    let completed_count = pool.aggregator.results.length();
    let total_sum = pool.aggregator.total_computed;

    println "Completed tasks: {completed_count}";
    println "Total computed sum: {total_sum}";

    assert(completed_count == 8, "All 8 tasks must complete");
    assert(total_sum == 2560, "Sum of all tasks must equal 2560");
}
```

使用 `zc run -q` 运行并验证代码清单 17-4：

```console
$ zc run -q examples/ch17/ch17-04-worker-pools/main.zc
Dispatched 8 tasks to ThreadPool
Completed tasks: 8
Total computed sum: 2560
```

---

## 第 17 章小结

在本章中，你探索了 Zen C 完整的并发工具集：

- **1:1 OS 线程（`std/thread.zc`）**：使用 `Thread::spawn(fn[=]() { ... })` 创建原生线程，使用 `thread.join()` 汇合工作线程句柄，以及对工作负载进行分区以实现无锁的 Fork-Join 并行计算。
- **共享状态同步（`std/sync.zc`）**：使用 `Mutex` 和 `RwLock` 保护多字段临界区，使用 `Once` 跨竞争线程执行一次性初始化设置，使用 `Barrier` 和 `Semaphore` 协调阶段，以及使用 `__atomic_fetch_add` 执行无锁原子自增。
- **消息传递通道**：将固定容量环形缓冲区与 `Mutex` 及双 `CondVar` 变量（`not_empty` 与 `not_full`）相结合，构建零内存分配、感知背压的生产者-消费者通道。
- **工作池**：将持久 OS 线程组织为一个带有界 `TaskQueue` 的可复用 `ThreadPool`，防止无休止地创建线程并提供可预测的内存占用。

接下来，在**[第 18 章：多态：组合与 Trait 对象](ch18-00-polymorphism.md)**中，我们将研究 Zen C 如何通过胖指针（fat pointer）和 C11 虚方法表（`VTable`）实现运行时多态与动态分发。
