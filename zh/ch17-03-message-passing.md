# 使用队列进行消息传递

相比于共享内存加锁，一种广受欢迎的替代方案是**消息传递（message passing）**，经典并发名言对此进行了生动的概括：

> *“不要通过共享内存来通信，而要通过通信来共享内存。”*

在消息传递架构中，生产者线程将工作项打包进结构体中并推送到线程安全的**通道（channel）**（一种并发 FIFO 队列）中，而工作线程池则从该通道拉取任务并独立进行处理。这种模式构成了多线程 HTTP 服务器（正如我们将在[第 21 章](ch21-00-final-project.md)中构建的那样）、后台日志处理流水线以及任务调度器的支柱。

---

## 1. 有界并发通道的解剖

如果消费者工作线程在一个紧凑的 `while queue.is_empty() {}` 自旋循环中检查空队列，它会白白耗尽 100% 的单个 CPU 核心却什么也没做。反之，如果高速生产者在消费者缓慢的情况下每秒向无界队列推送数百万个任务，该进程可能会耗尽系统 RAM。

**有界并发环形缓冲区通道**通过在一个结构体中融合四个组成部分，同时解决了这两个问题：

```
                   JobChannel (Bounded Ring Buffer, Capacity = 8)
                 +-----+-----+-----+-----+-----+-----+-----+-----+
Producer(s) ---> | J1  | J2  | J3  |  .  |  .  |  .  |  .  |  .  | ---> Consumer Worker(s)
  send(job)      +-----+-----+-----+-----+-----+-----+-----+-----+        recv() -> Option<Job>
                     ^                 ^
                   head              tail

  Synchronization:
  - mutex:     Protects `buffer`, `head`, `tail`, `count`, and `closed`
  - not_empty: CondVar signaled when a job is pushed (wakes sleeping consumers)
  - not_full:  CondVar signaled when a job is popped (wakes blocked producers)
```

1. **固定容量环形缓冲区（`buffer: Job[N]`、`head`、`tail`、`count`）**：在连续内存中存储最多 $N$ 个在途任务，每条消息**零堆分配**。
2. **一个互斥锁（`mutex`）**：保护环形缓冲区索引（`head`、`tail`、`count`）和 `closed` 标志。
3. **两个条件变量（`not_empty: CondVar` 与 `not_full: CondVar`）**：
   - 当 `count == 0` 时，消费者调用 `self.not_empty.wait(&self.mutex)` 原子地释放 `self.mutex` 并休眠，直到生产者调用 `self.not_empty.signal()`（或 `close()` 调用 `broadcast()`）。
   - 当 `count == QUEUE_CAPACITY` 时，生产者调用 `self.not_full.wait(&self.mutex)` 进行休眠，直到消费者取出一个任务并调用 `self.not_full.signal()`——从而提供自动**背压（backpressure）**。

---

## 2. 为什么 `CondVar::wait` 必须始终使用 `while` 循环

仔细观察 `recv()` 内部的等待模式：

```zenc
self.mutex.lock();
while self.count == 0 && !self.closed {
    self.not_empty.wait(&self.mutex);
}
```

为什么必须写成 `while self.count == 0 && !self.closed` 而不是 `if self.count == 0`？

1. **多工作线程之间的抢占唤醒（Stolen Wakeups）**：当生产者排队入队 1 个任务并唤醒一个等待中的消费者时，另一个处于活跃状态的工作线程可能会抢先获取 `self.mutex` 并在被唤醒的线程重新获取锁之前取出该任务。在 `while` 循环中重新检查条件可以确保在队列再次变空时线程能够重新进入休眠。
2. **OS 伪唤醒（Spurious Wakeups）**：POSIX `pthread_cond_wait` 在规范上允许线程偶尔被意外唤醒，即便没有任何线程调用 `signal()`（例如由于操作系统信号递送或 futex 争用）。使用 `while` 循环可以使伪唤醒变得完全无害。

---

## 3. 使用 `close()` 和 `broadcast()` 实现优雅停机

工作线程如何知道所有工作何时完成，以便它们可以退出循环并干净地汇合（join）？

无需为每个工作线程发送特殊的“毒丸（poison pill）”哨兵值，只需向通道中添加一个 `closed: bool` 标志：

```zenc
fn close(self) {
    self.mutex.lock();
    self.closed = true;
    self.not_empty.broadcast();
    self.not_full.broadcast();
    self.mutex.unlock();
}
```

当 `close()` 设置 `self.closed = true` 并调用 `self.not_empty.broadcast()` 时，**所有**正在休眠的工作线程都会被唤醒：
- 如果队列中仍有残留任务（`self.count > 0`），工作线程会继续取出并处理它们，直到缓冲区彻底被排空。
- 一旦 `self.count == 0` **且** `self.closed == true`，`recv()` 就会返回 `Option<Job>::None()`，通知每个工作线程循环执行 `break` 并干净地退出！

---

## 4. 完整示例：带有背压的生产者-消费者工作池

代码清单 17-3 构建了一个 8 槽位的有界 `JobChannel`，创建了 3 个消费者工作线程，从主生产者线程发送 20 条 `Job` 消息（每当有 8 个任务在途时自动触发 `not_full` 背压），关闭通道，并验证全部 20 个任务都被恰好处理了一次。

**代码清单 17-3**：有界消息传递通道与工作池（`examples/ch17/ch17-03-message-passing/main.zc`）

```zenc
// File: examples/ch17/ch17-03-message-passing/main.zc
import "std/thread.zc"
import "std/sync.zc"
import "std/option.zc"
import "std/vec.zc"

def QUEUE_CAPACITY = 8;

@derive(Copy)
struct Job {
    id: int;
    payload: int;
}

// Bounded thread-safe FIFO ring-buffer channel with backpressure
struct JobChannel {
    buffer: Job[8];
    head: usize;
    tail: usize;
    count: usize;
    mutex: Mutex;
    not_empty: CondVar;
    not_full: CondVar;
    closed: bool;
}

impl JobChannel {
    fn new() -> JobChannel {
        let ch: JobChannel;
        ch.head = 0;
        ch.tail = 0;
        ch.count = 0;
        ch.mutex = Mutex::new();
        ch.not_empty = CondVar::new();
        ch.not_full = CondVar::new();
        ch.closed = false;
        return ch;
    }

    // Producer: block if ring buffer is full, then enqueue and wake one consumer
    fn send(self, job: Job) -> bool {
        self.mutex.lock();
        while self.count == (usize)QUEUE_CAPACITY && !self.closed {
            self.not_full.wait(&self.mutex);
        }
        if self.closed {
            self.mutex.unlock();
            return false;
        }

        self.buffer[self.tail] = job;
        self.tail = (self.tail + 1) % (usize)QUEUE_CAPACITY;
        self.count += 1;

        self.not_empty.signal();
        self.mutex.unlock();
        return true;
    }

    // Consumer: block while empty (unless closed), then dequeue and wake one producer
    fn recv(self) -> Option<Job> {
        self.mutex.lock();
        while self.count == 0 && !self.closed {
            self.not_empty.wait(&self.mutex);
        }
        if self.count == 0 {
            self.mutex.unlock();
            return Option<Job>::None();
        }

        let job = self.buffer[self.head];
        self.head = (self.head + 1) % (usize)QUEUE_CAPACITY;
        self.count -= 1;

        self.not_full.signal();
        self.mutex.unlock();
        return Option<Job>::Some(job);
    }

    // Close the channel and wake all waiting producers and consumers
    fn close(self) {
        self.mutex.lock();
        self.closed = true;
        self.not_empty.broadcast();
        self.not_full.broadcast();
        self.mutex.unlock();
    }
}

struct ResultCollector {
    mutex: Mutex;
    processed_count: int;
    checksum: i64;
}

fn worker_loop(ch: JobChannel*, collector: ResultCollector*) {
    while true {
        let job_opt = ch.recv();
        if job_opt.is_none() {
            break; // Channel is closed and all queued jobs have been drained
        }
        let job = job_opt.unwrap();
        let computed: i64 = (i64)job.payload * (i64)job.payload;

        collector.mutex.lock();
        collector.processed_count += 1;
        collector.checksum += computed;
        collector.mutex.unlock();
    }
}

fn main() {
    let channel = JobChannel::new();
    let collector = ResultCollector {
        mutex: Mutex::new(),
        processed_count: 0,
        checksum: 0,
    };

    let ch_ptr: JobChannel* = &channel;
    let col_ptr: ResultCollector* = &collector;

    // 1. Spawn 3 worker threads consuming from the 8-slot bounded channel
    let workers = Vec<Thread>::with_capacity(3);
    for w in 0..3 {
        let res = Thread::spawn(fn[=]() {
            worker_loop(ch_ptr, col_ptr);
        });
        assert(res.is_ok(), "Worker spawn should succeed");
        workers.push(res.unwrap());
    }

    // 2. Send 20 jobs through the 8-slot channel (triggers producer backpressure automatically)
    for id in 1..=20 {
        let sent = channel.send(Job { id: id, payload: id });
        assert(sent, "Channel send should succeed while open");
    }

    // 3. Close the channel so workers exit once all 20 jobs are drained
    channel.close();

    // 4. Wait for all workers to finish
    for i in (usize)0..workers.length() {
        let th = workers.get(i);
        th.join().unwrap();
    }

    println "Jobs processed by worker pool: {collector.processed_count}";
    println "Aggregated square checksum:    {collector.checksum}";
    assert(collector.processed_count == 20, "All 20 jobs must be processed");
    assert(collector.checksum == 2870, "Sum of squares 1..=20 must equal 2870");
}
```

使用 `zc run -q` 运行并验证代码清单 17-3：

```text
$ zc run -q examples/ch17/ch17-03-message-passing/main.zc
Jobs processed by worker pool: 20
Aggregated square checksum:    2870
```
