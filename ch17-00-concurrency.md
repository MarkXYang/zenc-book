# Chapter 17: Concurrency

Modern hardware scales across multiple CPU cores rather than ever-higher single-core clock speeds. Writing software that harnesses those cores safely and predictably involves two closely related concepts:

- **Concurrency**: Structuring a program as multiple independent tasks that make progress over overlapping time periods (such as handling thousands of network connections or coordinating producer and consumer stages).
- **Parallelism**: Executing multiple computations at the exact same physical instant across separate CPU cores (such as partitioning a large numerical array across 4 or 16 hardware threads).

Unlike managed languages that bundle a heavy $M:N$ garbage-collected runtime (such as Go or Java) or languages that require complex lifetime/Pin viral annotations across every function signature, Zen C takes a pragmatic systems approach:

1. **Direct 1:1 OS Threads (`std/thread.zc`)**: Every `Thread::spawn` creates a native operating-system thread (`pthread_t`) with zero hidden scheduler threads or runtime startup overhead. Closures (`fn[=]() { ... }` and `fn[&]() { ... }`) cross thread boundaries seamlessly via an automatic heap-allocated closure trampoline (`_z_thread_trampoline`).
2. **RAII Synchronization Primitives (`std/sync.zc`)**: `Mutex`, `RwLock`, `CondVar`, `Once`, `Barrier`, and `Semaphore` wrap native POSIX synchronization primitives in clean Zen C structs that implement `Drop` for automatic cleanup, while C11/GCC hardware atomic builtins (`__atomic_fetch_add`, `__atomic_load_n`, etc.) provide lock-free performance for counters and state flags.
3. **Message-Passing Channels**: Combining ring buffers or `Queue<T>` with `Mutex` and `CondVar` lets threads communicate by transferring work items through bounded channels with automatic producer backpressure and graceful shutdown.
4. **Asynchronous Worker Pools (`ThreadPool`)**: Organizing persistent OS worker threads to consume tasks from a bounded concurrent queue with backpressure, eliminating the overhead of spawning fresh threads per task while ensuring predictable memory usage without complex runtime schedulers.

## Choosing the Right Concurrency Model

| Concurrency Pattern | Core Primitives | Best Suited For |
| :--- | :--- | :--- |
| **Data-Parallel Fork-Join** | `Thread::spawn`, `thread.join()`, disjoint slices/structs | Partitioning CPU-bound arrays, image tiles, or batch calculations across $N$ cores with zero locking during computation. |
| **Shared-State Synchronization** | `Mutex`, `RwLock`, `Once`, `Barrier`, `Semaphore`, hardware atomics | Protecting shared in-memory caches, connection registries, one-time initialization, and high-frequency telemetry counters. |
| **Message Passing & Channels** | Bounded ring buffer / `Queue<T>` + `Mutex` + `CondVar` | Decoupling producer threads from consumer workers with natural backpressure and clean queue draining. |
| **Asynchronous Worker Pools** | `ThreadPool`, `TaskQueue`, `ResultAggregator` | High-throughput task dispatch across persistent worker threads with bounded memory and predictable OS scheduling. |

## What You Will Learn in This Chapter

1. **[17.1 Using Threads to Run Code Simultaneously](ch17-01-threads.md)**: Spawning and joining native OS threads with `Thread::spawn` and `thread.join()`, how Zen C's closure trampoline transfers captured context across threads, avoiding loop-variable capture races, and building a 4-thread fork-join computation.
2. **[17.2 Shared-State Concurrency: Mutex and Atomics](ch17-02-mutex-sync.md)**: Protecting critical sections with `Mutex`, `RwLock`, `Once`, `Barrier`, and `Semaphore` from `std/sync.zc`, executing lock-free atomic read-modify-write operations, and preventing deadlocks.
3. **[17.3 Message Passing with Queues](ch17-03-message-passing.md)**: Building a bounded, thread-safe MPMC work channel using a ring buffer, `Mutex`, and dual condition variables (`not_empty` and `not_full`), handling spurious wakeups, and draining worker pools cleanly on shutdown.
4. **[17.4 Asynchronous Worker Pools and Task Dispatching](ch17-04-worker-pools.md)**: Building a bounded `ThreadPool` and `TaskQueue`, understanding why Zen C favors 1:1 OS worker pools over `async`/`await` state machines, dispatching tasks asynchronously, and aggregating results across workers.
