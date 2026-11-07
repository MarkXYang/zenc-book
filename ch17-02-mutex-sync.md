# 17.2 Shared-State Concurrency: Mutex and Atomics

In [Section 17.1](ch17-01-threads.md), each worker thread wrote to its own separate `WorkerTask` slot, so no two threads ever modified the same memory address. In many systems, however—such as shared bank ledgers, connection pools, telemetry counters, or in-memory caches—multiple threads must read and update **shared state** concurrently.

---

## 1. Why Unsynchronized Mutation Causes Data Races

Suppose two threads increment a shared integer `counter += 1` at the same time without synchronization. At the CPU instruction level, `counter += 1` is not a single indivisible action—it is a three-step **read-modify-write** sequence:

1. **Load** `counter` from RAM into a CPU register (`r0 = 0`).
2. **Add** `1` to the register (`r0 = 1`).
3. **Store** the register back to RAM (`counter = 1`).

If Thread A and Thread B both load `0` into their local registers before either stores its result back, both threads write `1` to `counter`—silently losing an update! Worse, if a thread modifies a multi-field struct or resizes a `Vec<T>` while another thread reads it, the reader can observe a half-written struct or dereference a freed pointer.

Zen C provides two complementary tools for eliminating data races:
- **Synchronization Primitives (`std/sync.zc`)** for protecting multi-field critical sections and coordinating thread phases.
- **Hardware Atomic Operations (`__atomic_*`)** for single-variable counters and flags.

---

## 2. Synchronization Primitives in `std/sync.zc`

All synchronization primitives in `std/sync.zc` implement the `Drop` trait (`impl Drop for Mutex`, `RwLock`, `CondVar`, `Once`, `Barrier`, `Semaphore`), so their underlying OS handles (`pthread_mutex_t`, `pthread_rwlock_t`, etc.) are destroyed automatically when the struct leaves scope.

| Type | Key Methods | Purpose |
| :--- | :--- | :--- |
| **`Mutex`** | `Mutex::new()`, `.lock()`, `.unlock()`, `.try_lock()` | **Mutual Exclusion**: Ensures at most one thread executes a critical section at any instant. |
| **`RwLock`** | `RwLock::new()`, `.rdlock()`, `.wrlock()`, `.unlock()`, `.try_rdlock()`, `.try_wrlock()` | **Reader-Writer Lock**: Allows multiple concurrent readers (`.rdlock()`) OR a single exclusive writer (`.wrlock()`). |
| **`Once`** | `Once::new()`, `.call(fn())` | **One-Time Initialization**: Guarantees that an initialization closure runs **exactly once**, even when called simultaneously by many threads. |
| **`Barrier`** | `Barrier::new(count)`, `.wait()` | **Phase Rendezvous**: Blocks arriving threads at `.wait()` until all `count` threads reach the barrier, then releases them together. |
| **`Semaphore`** | `Semaphore::new(permits)`, `.wait()`, `.try_wait()`, `.post()`, `.value()` | **Counting Semaphore**: Limits the number of threads concurrently accessing a bounded resource pool (e.g., max 8 open database connections). |
| **`CondVar`** | `CondVar::new()`, `.wait(&mutex)`, `.signal()`, `.broadcast()` | **Condition Variable**: Puts threads to sleep until a state predicate changes (covered in depth in [Section 17.3](ch17-03-message-passing.md)). |

### Pairing `mutex.lock()` with `defer mutex.unlock()`

Whenever your critical section spans multiple statements or contains early `return` paths, pair `.lock()` with `defer` so the mutex is guaranteed to be unlocked when the scope exits:

```zenc
fn withdraw(ledger: SharedLedger*, amount: i64) -> bool {
    ledger.mutex.lock();
    defer ledger.mutex.unlock();

    if ledger.balance < amount {
        return false; // `defer` automatically unlocks `ledger.mutex` here!
    }
    ledger.balance -= amount;
    return true;
}
```

---

## 3. Lock-Free Hardware Atomics

When you only need to increment a single integer counter or flip a boolean flag across threads, acquiring and releasing an OS `Mutex` is overkill. Because Zen C compiles directly through `gcc` or `clang`, you can invoke hardware atomic instructions (such as `lock xadd` on x86_64 or `ldadd` on ARM64) inside a `raw` block or via `extern` wrappers:

| Builtin Operation | Example Usage | Description |
| :--- | :--- | :--- |
| **`__atomic_fetch_add`** | `__atomic_fetch_add(&counter, 1, __ATOMIC_SEQ_CST)` | Atomically adds to `counter` and returns its previous value. |
| **`__atomic_fetch_sub`** | `__atomic_fetch_sub(&counter, 1, __ATOMIC_SEQ_CST)` | Atomically subtracts from `counter` and returns its previous value. |
| **`__atomic_load_n`** | `__atomic_load_n(&flag, __ATOMIC_ACQUIRE)` | Atomically reads the current value of `flag`. |
| **`__atomic_store_n`** | `__atomic_store_n(&flag, 1, __ATOMIC_RELEASE)` | Atomically writes a new value to `flag`. |
| **`__atomic_exchange_n`** | `__atomic_exchange_n(&state, 2, __ATOMIC_SEQ_CST)` | Atomically replaces `state` and returns its old value. |

> [!TIP]
> **When to Use Atomics vs. `Mutex`**: Use hardware atomics for **independent single-word counters or status flags** (like `atomic_ops` or a `shutdown_requested` flag). Whenever an invariant spans **two or more fields** (for example, updating both `ledger.balance` and `ledger.tx_count` together so a reader never sees the new balance with the old transaction count), protect the fields with a `Mutex` or `RwLock`.

---

## 4. Complete Example: Thread-Safe Ledger with `Mutex`, `Once`, and Atomics

Listing 17-2 spawns 4 worker threads that each perform 2,500 deposits of `10` units into a `SharedLedger`:
1. Every worker calls `ledger.once.call(...)` on entry, verifying that the `1000`-unit opening bonus is applied **only once** across all 4 racing threads.
2. Each deposit updates `ledger.balance` and `ledger.tx_count` together inside a `Mutex` critical section.
3. Each iteration also increments `ledger.atomic_ops` using a lock-free `__atomic_fetch_add`.

**Listing 17-2**: Coordinating shared state with `Mutex`, `Once`, and hardware atomics (`examples/ch17/ch17-02-mutex-sync/main.zc`)

```zenc
// File: examples/ch17/ch17-02-mutex-sync/main.zc
import "std/thread.zc"
import "std/sync.zc"
import "std/vec.zc"

def NUM_THREADS = 4;
def TRANSFERS_PER_THREAD = 2500;

struct SharedLedger {
    mutex: Mutex;
    once: Once;
    balance: i64;
    tx_count: i64;
    init_calls: int;
    atomic_ops: i64;
}

fn record_deposits(ledger: SharedLedger*, amount: i64, iterations: int) {
    // `Once::call` guarantees the initialization closure runs exactly once across all threads
    let l_ptr = ledger;
    ledger.once.call(fn[=]() {
        l_ptr.init_calls += 1;
        l_ptr.balance += 1000; // Initial opening bonus
    });

    for i in 0..iterations {
        // 1. Critical section protected by `Mutex`
        ledger.mutex.lock();
        ledger.balance += amount;
        ledger.tx_count += 1;
        ledger.mutex.unlock();

        // 2. Lock-free hardware atomic increment
        raw {
            __atomic_fetch_add(&ledger->atomic_ops, 1, __ATOMIC_SEQ_CST);
        }
    }
}

fn main() {
    let ledger = SharedLedger {
        mutex: Mutex::new(),
        once: Once::new(),
        balance: 0,
        tx_count: 0,
        init_calls: 0,
        atomic_ops: 0,
    };

    let threads = Vec<Thread>::with_capacity(NUM_THREADS);
    let ledger_ptr: SharedLedger* = &ledger;

    for t in 0..NUM_THREADS {
        let res = Thread::spawn(fn[=]() {
            record_deposits(ledger_ptr, 10, TRANSFERS_PER_THREAD);
        });
        assert(res.is_ok(), "Failed to spawn worker thread");
        threads.push(res.unwrap());
    }

    for i in (usize)0..threads.length() {
        let th = threads.get(i);
        th.join().unwrap();
    }

    println "One-time init calls: {ledger.init_calls}";
    println "Total transactions:  {ledger.tx_count}";
    println "Final balance:       {ledger.balance}";
    println "Atomic operations:   {ledger.atomic_ops}";

    assert(ledger.init_calls == 1, "Once::call must execute only once");
    assert(ledger.tx_count == 10000, "4 * 2500 = 10000 transactions");
    assert(ledger.balance == 101000, "1000 opening bonus + 10000 * 10 = 101000");
    assert(ledger.atomic_ops == 10000, "Atomic counter must be exact without locks");
}
```

Run and verify Listing 17-2 with `zc run -q`:

```text
$ zc run -q examples/ch17/ch17-02-mutex-sync/main.zc
One-time init calls: 1
Total transactions:  10000
Final balance:       101000
Atomic operations:   10000
```

---

## 5. Three Rules for Preventing Deadlocks

A **deadlock** occurs when two or more threads wait forever for locks held by each other. Follow three rules to keep your `Mutex` and `RwLock` code deadlock-free:

1. **Never Re-Lock a Non-Recursive `Mutex` on the Same Thread**: Calling `mutex.lock()` twice in a row on the same thread without an intervening `mutex.unlock()` will block the thread on itself forever.
2. **Acquire Multiple Locks in a Consistent Global Order**: If an operation must lock both Account A and Account B, always lock the account with the smaller `id` first (`if a.id < b.id { ... }`). When every thread acquires locks in the exact same order, a circular wait is mathematically impossible.
3. **Keep Critical Sections Short and Non-Blocking**: Never perform slow network I/O, `sleep_ms()`, or unknown user callbacks while holding a `Mutex`. Copy the data you need under the lock, unlock immediately, and perform the slow work outside the critical section.
