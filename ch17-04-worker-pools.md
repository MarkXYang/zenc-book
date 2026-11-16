# Worker Pools and Task Dispatching

In earlier sections, we looked at raw thread spawning (`Thread::spawn`), lock-based synchronization (`Mutex`, `CondVar`), and point-to-point message passing. In real-world systems software—such as network servers, game engines, background build systems, and database query engines—spawning a brand-new OS thread for every single micro-task incurs high operating-system overhead.

Instead, production systems use **worker pools** (often called thread pools): a fixed group of persistent worker threads that run continuously in the background, consuming tasks from a shared concurrent task queue and publishing results back to collectors.

In this section, we will build a reusable, bounded **`ThreadPool`** in Zen C and examine why Zen C favors explicit 1:1 OS worker pools over complex `async`/`await` state-machine runtimes.

---

## 1. Why Zen C Chooses Worker Pools Over `async`/`await`

In many high-level languages, asynchronous computing is expressed using `async` and `await` keywords that rewrite functions into compiler-generated state machines (or depend on heavy $M:N$ green-thread runtimes like Go or Tokio).

Zen C deliberately removed `async`/`await` syntax in favor of direct **1:1 OS threads** and **worker queues**:

| Aspect | `async`/`await` State Machines | 1:1 OS Thread Pools (`std/thread.zc`) |
| :--- | :--- | :--- |
| **Execution Model** | Hidden compiler-generated coroutines / state enums | Native POSIX operating system threads |
| **Runtime Overhead** | Complex scheduler, poll loops, or viral function colors | Zero runtime overhead; direct OS kernel scheduling |
| **FFI Compatibility** | Cannot easily yield across foreign C library calls | Transparently calls any standard C function without blocking a user-space scheduler |
| **Debugging & Profiling** | Obfuscated stack traces in GDB / LLDB / perf | Standard OS native threads visible in `top`, `gdb`, `lldb`, and Linux `perf` |
| **Memory Predictability** | Variable heap frames or hidden boxing | Fixed stack per thread, bounded queues, and zero unexpected allocations |

With native threads and condition variables, you have full control over allocation, queue depth, priority, and hardware core utilization.

---

## 2. Architecture of a Bounded `ThreadPool`

Our `ThreadPool` coordinates three distinct layers:

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

1. **`Task` & `TaskResult`**: Simple data structs describing the work item and the computed outcome.
2. **`TaskQueue`**: A bounded 16-slot circular buffer protected by a `Mutex` and two `CondVar` primitives (`not_empty` and `not_full`), providing automatic backpressure when the queue is full.
3. **`ThreadPool`**: Spawns $N$ background threads running `worker_loop`, which fetch tasks, perform the computation, and record outputs into a thread-safe `ResultAggregator`.
4. **Graceful Shutdown**: Signaling `stop()` wakes all sleeping worker threads so they can drain remaining tasks and terminate cleanly when `shutdown_and_wait()` joins them.

---

## 3. Implementing the Bounded `TaskQueue`

The `TaskQueue` holds a fixed-size array of `Task` structs with circular `head` and `tail` indices:

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

The `submit` method blocks if the buffer is full until an active worker pops a task and signals `not_full`:

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

Similarly, `next_task` sleeps on `not_empty` until work arrives or shutdown is broadcast:

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

## 4. The Worker Thread Loop and Result Aggregation

Workers run a continuous dispatch loop. When a task arrives, the thread executes the work and posts the result into `ResultAggregator`:

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

## 5. Complete Runnable Example: Listing 17-4

Listing 17-4 combines our `TaskQueue`, `ThreadPool`, and `ResultAggregator` into a complete, runnable program that initializes a 4-worker pool, asynchronously dispatches 8 tasks, and safely waits for all tasks to finish.

**Listing 17-4**: Asynchronous thread pool and task queue (`examples/ch17/ch17-04-worker-pools/main.zc`)

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

Run and verify Listing 17-4 with `zc run -q`:

```console
$ zc run -q examples/ch17/ch17-04-worker-pools/main.zc
Dispatched 8 tasks to ThreadPool
Completed tasks: 8
Total computed sum: 2560
```

---

## Summary of Chapter 17

In this chapter, you explored Zen C's complete concurrency toolkit:

- **1:1 OS Threads (`std/thread.zc`)**: Spawning native threads with `Thread::spawn(fn[=]() { ... })`, joining worker handles with `thread.join()`, and partitioning workloads for lock-free fork-join parallelism.
- **Shared-State Synchronization (`std/sync.zc`)**: Protecting multi-field critical sections with `Mutex` and `RwLock`, running one-time setup across racing threads with `Once`, coordinating phases with `Barrier` and `Semaphore`, and executing lock-free atomic increments with `__atomic_fetch_add`.
- **Message-Passing Channels**: Combining a fixed-capacity ring buffer with `Mutex` and dual `CondVar` variables (`not_empty` and `not_full`) to build a zero-allocation, backpressure-aware producer-consumer channel.
- **Worker Pools**: Organizing persistent OS threads into a reusable `ThreadPool` with a bounded `TaskQueue`, preventing unbounded thread spawning and providing predictable memory usage.

Next, in **[Chapter 18: Polymorphism: Composition and Trait Objects](ch18-00-polymorphism.md)**, we will examine how Zen C achieves runtime polymorphism and dynamic dispatch through fat pointers and C11 virtual method tables (`VTable`).
