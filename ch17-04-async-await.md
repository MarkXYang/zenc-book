# 17.4 Asynchronous Programming with `async`/`await`

Alongside native OS threads (`std/thread.zc`) and synchronization primitives (`std/sync.zc`), Zen C provides built-in **`async fn`** and **`await`** syntax for structuring asynchronous task pipelines.

Understanding how `zc` compiles `async` and `await` down to pure C11 gives you complete clarity into its performance characteristics—and shows how you can combine `async fn` state machines with OS worker threads when you want true multi-core parallelism.

---

## 1. Writing `async fn` and `await`

You declare an asynchronous function by placing the `async` keyword before `fn`, and you drive an `async fn` call to completion using the prefix `await` keyword:

```zenc
async fn score_chunk(chunk_id: int, base: int) -> int {
    let acc = 0;
    for i in 1..=5 {
        acc += (base + i) * chunk_id;
    }
    return acc;
}

async fn run_scoring_pipeline(seed: int) -> int {
    let s1: int = await score_chunk(1, seed);
    let s2: int = await score_chunk(2, seed + 5);
    let s3: int = await score_chunk(3, seed + 10);
    return s1 + s2 + s3;
}
```

Notice that `await` can be used both inside another `async fn` (such as `run_scoring_pipeline`) and directly inside a synchronous function like `main()` (`let total: int = await run_scoring_pipeline(10);`)—you do not need to pull in an external third-party runtime library just to `await` an `async fn` from `main()`.

---

## 2. 🔍 Peek at the C: Stack-Allocated `*_Future` State Machines

What does `zc transpile` emit when you write `async fn score_chunk(chunk_id: int, base: int) -> int`?

Instead of heap-allocating a boxed future or spinning up a hidden background thread behind your back, `zc` generates a **stack-allocated C11 Future struct** and four companion functions:

```c
// 1. Generated state struct holding the poll state, return slot, and arguments
struct score_chunk_Future {
    int _state;
    int32_t _result;
    int32_t chunk_id;
    int32_t base;
};

// 2. Initializes the Future state machine in state 0
void score_chunk_init(struct score_chunk_Future *f, int32_t chunk_id, int32_t base) {
    f->_state = 0;
    f->chunk_id = chunk_id;
    f->base = base;
}

// 3. The underlying task body
int32_t _impl_score_chunk(int32_t chunk_id, int32_t base) {
    ...
}

// 4. Poll function matching Zen C's built-in `typedef int (*PollFn)(void*);`
int score_chunk_poll(void *ctx) {
    struct score_chunk_Future *f = ctx;
    if (f->_state > 0) return 1;
    f->_state = 1;
    f->_result = _impl_score_chunk(f->chunk_id, f->base);
    return 1;
}

// 5. Result extractor once polling returns 1 (ready)
int32_t score_chunk_get(struct score_chunk_Future *f) {
    return f->_result;
}
```

And when you write `let s1: int = await score_chunk(1, seed);`, the compiler lowers the `await` expression into a zero-allocation C statement expression that initializes `_f` on the stack, polls `score_chunk_poll(&_f)` until ready, and extracts the result with `score_chunk_get(&_f)`:

```c
int32_t s1 = ({
    struct score_chunk_Future _f;
    score_chunk_init(&_f, 1, seed);
    while (!score_chunk_poll(&_f));
    score_chunk_get(&_f);
});
```

---

## 3. Comparing Async Models: Zen C vs. Rust vs. Go

Understanding this lowering clarifies how Zen C's concurrency model compares to other systems and application languages:

| Characteristic | Zen C (`async`/`await` + `std/thread.zc`) | Rust (`Future` + Tokio/async-std) | Go (`go func()`) |
| :--- | :--- | :--- | :--- |
| **Memory Allocation per `await`** | **0 heap allocations** (stack `struct <fn>_Future`) | 0 heap allocations unless `Box::pin` / `dyn Future` | Heap-allocated growable goroutine stack (~2 KB+) |
| **Can `main()` call `await` directly?** | **Yes** (built-in poll loop lowering) | No (requires `#[tokio::main]` / `block_on` executor) | Yes (goroutines run on built-in runtime) |
| **Runtime Binary Overhead** | **Zero** (pure C11 functions + optional `pthread`) | Executor library linked per binary | Full Go scheduler + garbage collector |
| **Parallelism Across CPU Cores** | Explicit via `Thread::spawn(fn[=]() { ... })` | Multi-threaded work-stealing executor | Automatic $M:N$ runtime scheduler |

Because `await func(...)` drives the generated `struct func_Future` on the current thread by default, sequential `await` statements run deterministically with **zero thread-creation overhead**. When you want two `async fn` tasks to execute in **parallel** on separate CPU cores, launch them inside `Thread::spawn` workers!

---

## 4. Complete Example: Composing Async Pipelines and Parallel Tasks

Listing 17-4 demonstrates both ways of driving `async fn` tasks:
1. **Part A**: Composing three sequential `await score_chunk(...)` stages inside `async fn run_scoring_pipeline(seed: int)` with zero heap allocations.
2. **Part B**: Spawning two background OS threads with `Thread::spawn` that execute `await score_chunk(...)` in parallel across CPU cores and write their results back before joining.

**Listing 17-4**: Asynchronous pipelines and parallel async execution (`examples/ch17/ch17-04-async-await/main.zc`)

```zenc
// File: examples/ch17/ch17-04-async-await/main.zc
import "std/thread.zc"

// 1. `async fn` generates `struct score_chunk_Future` plus `_init`, `_poll`, and `_get`
async fn score_chunk(chunk_id: int, base: int) -> int {
    let acc = 0;
    for i in 1..=5 {
        acc += (base + i) * chunk_id;
    }
    return acc;
}

// 2. Composing multiple `async fn` calls with `await`
async fn run_scoring_pipeline(seed: int) -> int {
    let s1: int = await score_chunk(1, seed);
    let s2: int = await score_chunk(2, seed + 5);
    let s3: int = await score_chunk(3, seed + 10);
    return s1 + s2 + s3;
}

fn main() {
    // Part A: High-level `await` on a composed `async fn` pipeline
    let pipeline_total: int = await run_scoring_pipeline(10);
    println "Async pipeline total: {pipeline_total}";
    // s1: (11+12+13+14+15)*1 = 65
    // s2: (16+17+18+19+20)*2 = 180
    // s3: (21+22+23+24+25)*3 = 345
    // Total = 65 + 180 + 345 = 590
    assert(pipeline_total == 590, "Pipeline total should be 590");

    // Part B: Running two `async fn` tasks in parallel on background OS threads
    let bg_result_a = 0;
    let bg_result_b = 0;
    let out_a: int* = &bg_result_a;
    let out_b: int* = &bg_result_b;

    let t1 = Thread::spawn(fn[=]() {
        *out_a = await score_chunk(4, 20);
    }).unwrap();

    let t2 = Thread::spawn(fn[=]() {
        *out_b = await score_chunk(5, 30);
    }).unwrap();

    t1.join().unwrap();
    t2.join().unwrap();

    println "Background async task A: {bg_result_a}";
    println "Background async task B: {bg_result_b}";
    // bg_result_a: (21+22+23+24+25)*4 = 115 * 4 = 460
    // bg_result_b: (31+32+33+34+35)*5 = 165 * 5 = 825
    assert(bg_result_a == 460 && bg_result_b == 825, "Parallel async results must match");
    println "Combined parallel total: {bg_result_a + bg_result_b}";
}
```

Run and verify Listing 17-4 with `zc run -q`:

```text
$ zc run -q examples/ch17/ch17-04-async-await/main.zc
Async pipeline total: 590
Background async task A: 460
Background async task B: 825
Combined parallel total: 1285
```

---

## Summary of Chapter 17

In this chapter, you explored Zen C's complete concurrency toolkit:

- **1:1 OS Threads (`std/thread.zc`)**: Spawning native threads with `Thread::spawn(fn[=]() { ... })`, joining worker handles with `thread.join()`, and partitioning workloads for lock-free fork-join parallelism.
- **Shared-State Synchronization (`std/sync.zc`)**: Protecting multi-field critical sections with `Mutex` and `RwLock`, running one-time setup across racing threads with `Once`, coordinating phases with `Barrier` and `Semaphore`, and executing lock-free single-word increments with `__atomic_fetch_add`.
- **Message-Passing Channels**: Combining a fixed-capacity ring buffer with `Mutex` and dual `CondVar` variables (`not_empty` and `not_full`) to build a zero-allocation, backpressure-aware producer-consumer worker pool with clean `close()` / `broadcast()` shutdown.
- **Asynchronous Pipelines (`async` / `await`)**: Understanding how `zc` compiles `async fn` into stack-allocated `struct <fn>_Future` state machines and combining `await` with `Thread::spawn` for parallel task execution.

Next, in **[Chapter 18: Polymorphism: Composition and Trait Objects](ch18-00-polymorphism.md)**, we will examine how Zen C achieves runtime polymorphism and dynamic dispatch through fat pointers and C11 virtual method tables (`VTable`).
