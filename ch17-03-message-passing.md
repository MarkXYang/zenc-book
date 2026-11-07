# 17.3 Message Passing with Queues

A popular alternative to shared-memory locking is **message passing**, summarized by the classic concurrency proverb:

> *"Do not communicate by sharing memory; instead, share memory by communicating."*

In a message-passing architecture, producer threads package work items into structs and push them into a thread-safe **channel** (a concurrent FIFO queue), while a pool of worker threads pulls jobs from the channel and processes them independently. This pattern forms the backbone of multithreaded HTTP servers (as we will build in [Chapter 21](ch21-00-final-project.md)), background logging pipelines, and task schedulers.

---

## 1. Anatomy of a Bounded Concurrent Channel

If a consumer worker checks an empty queue in a tight `while queue.is_empty() {}` spin loop, it burns 100% of a CPU core doing nothing. Conversely, if a fast producer pushes millions of tasks per second into an unbounded queue while consumers are slow, the process can exhaust system RAM.

A **bounded concurrent ring-buffer channel** solves both problems by combining four pieces inside a single struct:

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

1. **A Fixed-Capacity Ring Buffer (`buffer: Job[N]`, `head`, `tail`, `count`)**: Stores up to $N$ in-flight jobs in contiguous memory with **zero heap allocations** per message.
2. **A `Mutex` (`mutex`)**: Protects the ring buffer indices (`head`, `tail`, `count`) and the `closed` flag.
3. **Two Condition Variables (`not_empty: CondVar` and `not_full: CondVar`)**:
   - When `count == 0`, consumers call `self.not_empty.wait(&self.mutex)` to atomically release `self.mutex` and sleep until a producer calls `self.not_empty.signal()` (or `close()` calls `broadcast()`).
   - When `count == QUEUE_CAPACITY`, producers call `self.not_full.wait(&self.mutex)` to sleep until a consumer pops a job and calls `self.not_full.signal()`—providing automatic **backpressure**.

---

## 2. Why `CondVar::wait` Must Always Use a `while` Loop

Look closely at the waiting pattern inside `recv()`:

```zenc
self.mutex.lock();
while self.count == 0 && !self.closed {
    self.not_empty.wait(&self.mutex);
}
```

Why must you write `while self.count == 0 && !self.closed` instead of `if self.count == 0`?

1. **Stolen Wakeups Across Multiple Workers**: When a producer enqueues 1 job and wakes a waiting consumer, another active worker thread might acquire `self.mutex` first and pop that job before the awakened thread re-acquires the lock. Re-checking the condition in a `while` loop ensures the thread goes back to sleep if the queue is empty again.
2. **OS Spurious Wakeups**: POSIX `pthread_cond_wait` is permitted by specification to wake a thread occasionally even if no thread called `signal()` (due to OS signal delivery or futex contention). A `while` loop makes spurious wakeups completely harmless.

---

## 3. Graceful Shutdown with `close()` and `broadcast()`

How do worker threads know when all work is finished so they can exit their loop and join cleanly?

Instead of sending magic "poison pill" sentinel values for every worker, add a `closed: bool` flag to the channel:

```zenc
fn close(self) {
    self.mutex.lock();
    self.closed = true;
    self.not_empty.broadcast();
    self.not_full.broadcast();
    self.mutex.unlock();
}
```

When `close()` sets `self.closed = true` and calls `self.not_empty.broadcast()`, **every** sleeping worker wakes up:
- If there are still queued jobs (`self.count > 0`), workers continue popping and processing them until the buffer is completely drained.
- Once `self.count == 0` **and** `self.closed == true`, `recv()` returns `Option<Job>::None()`, signaling each worker loop to `break` and exit cleanly!

---

## 4. Complete Example: Producer-Consumer Worker Pool with Backpressure

Listing 17-3 builds an 8-slot bounded `JobChannel`, spawns 3 consumer worker threads, sends 20 `Job` messages from the main producer thread (automatically exercising `not_full` backpressure whenever 8 jobs are in flight), closes the channel, and verifies that all 20 jobs are processed exactly once.

**Listing 17-3**: Bounded message-passing channel and worker pool (`examples/ch17/ch17-03-message-passing/main.zc`)

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

Run and verify Listing 17-3 with `zc run -q`:

```text
$ zc run -q examples/ch17/ch17-03-message-passing/main.zc
Jobs processed by worker pool: 20
Aggregated square checksum:    2870
```
