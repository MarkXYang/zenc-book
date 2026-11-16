# Using Threads to Run Code Simultaneously

In most operating systems, an executing program's code runs in a **process**, and the operating system manages multiple processes at once. Within a single process, you can also have independent parts that run simultaneously across multiple CPU cores. The operating system features that execute these independent parts are called **threads**.

Zen C's standard library module `std/thread.zc` provides a **1:1 threading model**: each `Thread` instance maps directly to one native OS thread (`pthread_t` on Linux, macOS, and BSD). There is no hidden green-thread scheduler or runtime garbage collector between your code and the OS kernel.

---

## 1. Spawning and Joining Threads (`std/thread.zc`)

Import `"std/thread.zc"` to access the `Thread` struct and helper functions:

| Function / Method | Signature | Description |
| :--- | :--- | :--- |
| **`Thread::spawn(func)`** | `fn spawn(func: fn()) -> Result<Thread>` | Creates and immediately starts a new OS thread executing the zero-argument closure `func`. |
| **`thread.join()`** | `fn join(self) -> Result<bool>` | Blocks the calling thread until `thread` finishes executing and releases its OS resources. |
| **`thread.detach()`** | `fn detach(self) -> Result<bool>` | Detaches `thread` so it runs independently in the background; its OS resources are reclaimed automatically upon exit. |
| **`thread.cancel()`** | `fn cancel(self) -> Result<bool>` | Sends a cancellation request to `thread` (`pthread_cancel`). |
| **`sleep_ms(ms)`** | `fn sleep_ms(ms: int)` | Pauses the current thread for `ms` milliseconds. |

Because thread creation can fail if the operating system reaches its process thread limit (`EAGAIN`), `Thread::spawn` returns a `Result<Thread>`. You should always check `.is_ok()` or `.unwrap()` the returned handle, and call `.join()` before `main()` exits so the process does not terminate while worker threads are still running:

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

## 2. Under the Hood: How Closures Cross Thread Boundaries

In [Section 14.1](ch14-01-lambdas.md), we saw that a Zen C closure `fn()` is represented in C11 as a 24-byte `z_closure_T` struct containing three fields:

```c
typedef struct {
    void *func;          // Pointer to the generated C function
    void *ctx;           // Heap-allocated struct holding captured variables
    void (*drop)(void*); // Cleanup function to free `ctx`
} z_closure_T;
```

When you pass a closure to `Thread::spawn(func)`, the spawning thread might return from its current scope *before* the new OS thread even begins executing. How does `std/thread.zc` prevent the caller's scope exit from freeing `func.ctx` while the worker thread is still using it?

Look at what `Thread::spawn` and `_z_thread_trampoline` do inside `std/thread.zc`:

1. **Heap Copy of the Closure Descriptor**: `Thread::spawn` allocates a heap copy of the `z_closure_T` descriptor (`ctx`) and copies `func` into it.
2. **Ownership Transfer of `drop`**: `Thread::spawn` zeroes out `((z_closure_T*)&func)->drop = NULL;` on the caller's stack copy so the spawning thread does **not** free the captured environment when `Thread::spawn` returns.
3. **Automatic Cleanup on Thread Exit**: `pthread_create` launches `_z_thread_trampoline(ctx)`, which invokes `f(closure->ctx)` and then immediately calls `if (closure->drop) closure->drop(closure->ctx);` and `free(closure);` as the thread finishes!

---

## 3. Capturing Data Safely: `fn[=]()` vs. `fn[&]()`

When spawning multiple threads inside a `for` loop, pay close attention to how your closure captures variables from the enclosing scope:

### Pitfall: Capturing a Loop Counter by Reference (`fn[&]()`)

If you capture a mutable loop index `w` by reference (`fn[&]()`), all worker threads receive a pointer (`int*`) to the **same** stack variable `w`. By the time a worker thread wakes up and dereferences `*w`, the loop in `main()` may have already incremented `w` to `4`!

### Best Practice: Capture Per-Worker Values or Pointers with `fn[=]()`

Instead, bind each worker's dedicated task pointer (or worker ID) to a local variable inside the loop body and capture it **by value** (`fn[=]() { ... }`). That way, each thread's heap-allocated closure context receives its own private copy of the pointer or ID:

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
> **Stack Lifetime Rule for Borrowed Pointers**: When a spawned thread accesses stack data from the parent function via a pointer (such as `task_ptr` pointing into `tasks: WorkerTask[4]`), the parent function **must** call `thread.join()` on every worker *before* the stack frame containing `tasks` returns. Never `detach()` a thread that holds pointers into a caller's stack frame!

---

## 4. Complete Example: Fork-Join Parallel Sum of Squares

The fastest concurrent programs are often those that require **no locks at all** during the computation phase. In the **fork-join** pattern:

1. **Fork**: Partition the input range into $N$ disjoint slices and give each worker thread exclusive access to its own output slot (`WorkerTask`).
2. **Compute**: All $N$ threads run simultaneously on separate CPU cores without contending on any shared cache line or mutex.
3. **Join & Reduce**: After `th.join()` completes for all workers, the main thread combines the $N$ partial results in deterministic order.

Listing 17-1 partitions the range `1..=1000` across 4 OS threads (250 integers per thread) to compute $\sum_{i=1}^{1000} i^2 = 333,833,500$.

**Listing 17-1**: Fork-join parallel computation across 4 OS threads (`examples/ch17/ch17-01-threads/main.zc`)

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

Run and verify Listing 17-1 with `zc run -q`:

```text
$ zc run -q examples/ch17/ch17-01-threads/main.zc
Worker 0 (1..=250): partial_sum = 5239625
Worker 1 (251..=500): partial_sum = 36552125
Worker 2 (501..=750): partial_sum = 99114625
Worker 3 (751..=1000): partial_sum = 192927125
Total sum of squares (1..=1000): 333833500
```
