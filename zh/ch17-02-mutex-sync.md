# 共享状态并发：互斥锁与原子操作

在[17.1 节](ch17-01-threads.md)中，每个工作线程写入其自己独立的 `WorkerTask` 槽位，因此任意两个线程绝不会修改相同的内存地址。然而，在许多系统中——例如共享银行账本、连接池、遥测计数器或内存缓存——多个线程必须并发地读取和更新**共享状态**。

---

## 1. 为什么无同步的突变会导致数据竞争

假设两个线程在没有同步的情况下同时递增一个共享整数 `counter += 1`。在 CPU 指令级别，`counter += 1` 并不是一个单一且不可分割的操作——它是一个分为三步的**读-改-写（read-modify-write）**序列：

1. **加载（Load）**：将 `counter` 从 RAM 加载到 CPU 寄存器中（`r0 = 0`）。
2. **累加（Add）**：在寄存器中加 `1`（`r0 = 1`）。
3. **存储（Store）**：将寄存器的值写回 RAM（`counter = 1`）。

如果线程 A 和线程 B 在任何一方将结果写回之前都将 `0` 加载到了各自的局部寄存器中，那么两个线程都会向 `counter` 写入 `1`——从而神不知鬼不觉地丢失了一次更新！更糟糕的是，如果一个线程在修改多字段结构体或扩容 `Vec<T>` 的同时另一个线程正在读取它，读者可能会观察到写了一半的残缺结构体，或者解引用已被释放的指针。

Zen C 提供了两套互补的工具来消除数据竞争：
- **同步原语（`std/sync.zc`）**：用于保护多字段临界区并协调线程阶段。
- **硬件原子操作（`__atomic_*`）**：用于单变量计数器和标志位。

---

## 2. `std/sync.zc` 中的同步原语

`std/sync.zc` 中的所有同步原语都实现了 `Drop` trait（`impl Drop for Mutex`, `RwLock`, `CondVar`, `Once`, `Barrier`, `Semaphore`），因此当结构体离开作用域时，其底层 OS 句柄（`pthread_mutex_t`、`pthread_rwlock_t` 等）会被自动销毁。

| 类型 | 关键方法 | 用途 |
| :--- | :--- | :--- |
| **`Mutex`** | `Mutex::new()`, `.lock()`, `.unlock()`, `.try_lock()` | **互斥锁**：确保在任何瞬间至多只有一个线程执行临界区。 |
| **`RwLock`** | `RwLock::new()`, `.rdlock()`, `.wrlock()`, `.unlock()`, `.try_rdlock()`, `.try_wrlock()` | **读写锁**：允许多个并发读者（`.rdlock()`）或单个独占写者（`.wrlock()`）。 |
| **`Once`** | `Once::new()`, `.call(fn())` | **一次性初始化**：保证初始化闭包**恰好运行一次**，即使被多个线程同时调用也是如此。 |
| **`Barrier`** | `Barrier::new(count)`, `.wait()` | **阶段屏障（Rendezvous）**：在 `.wait()` 处阻塞到达的线程，直到全部 `count` 个线程均到达屏障，然后将它们一并释放。 |
| **`Semaphore`** | `Semaphore::new(permits)`, `.wait()`, `.try_wait()`, `.post()`, `.value()` | **计数信号量**：限制并发访问有界资源池的线程数量（例如最多 8 个打开的数据库连接）。 |
| **`CondVar`** | `CondVar::new()`, `.wait(&mutex)`, `.signal()`, `.broadcast()` | **条件变量**：使线程休眠，直到某个状态谓词发生改变（将在 [17.3 节](ch17-03-message-passing.md)中深入介绍）。 |

### 搭配 `defer mutex.unlock()` 使用 `mutex.lock()`

每当你的临界区跨越多条语句或包含提前 `return` 路径时，请将 `.lock()` 与 `defer` 搭配使用，以确保在作用域退出时互斥锁一定会被解锁：

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

## 3. 无锁硬件原子操作

当你只需要在多线程间递增单个整数计数器或翻转一个布尔标志时，获取和释放 OS `Mutex` 会显得杀鸡用牛刀。因为 Zen C 直接经由 `gcc` 或 `clang` 编译，你可以在 `raw` 块内或通过 `extern` 包装器直接调用硬件原子指令（例如 x86_64 上的 `lock xadd` 或 ARM64 上的 `ldadd`）：

| 内置操作 | 使用示例 | 说明 |
| :--- | :--- | :--- |
| **`__atomic_fetch_add`** | `__atomic_fetch_add(&counter, 1, __ATOMIC_SEQ_CST)` | 原子地累加到 `counter` 并返回其先前的值。 |
| **`__atomic_fetch_sub`** | `__atomic_fetch_sub(&counter, 1, __ATOMIC_SEQ_CST)` | 原子地从 `counter` 递减并返回其先前的值。 |
| **`__atomic_load_n`** | `__atomic_load_n(&flag, __ATOMIC_ACQUIRE)` | 原子地读取 `flag` 的当前值。 |
| **`__atomic_store_n`** | `__atomic_store_n(&flag, 1, __ATOMIC_RELEASE)` | 原子地向 `flag` 写入新值。 |
| **`__atomic_exchange_n`** | `__atomic_exchange_n(&state, 2, __ATOMIC_SEQ_CST)` | 原子地替换 `state` 并返回其旧值。 |

> [!TIP]
> **何时使用原子操作 vs. `Mutex`**：对于**独立的单字计数器或状态标志**（如 `atomic_ops` 或 `shutdown_requested` 标志），请使用硬件原子操作。每当不变式跨越**两个或更多字段**时（例如，同时更新 `ledger.balance` 和 `ledger.tx_count`，使读者永远不会看到带有旧交易计数的新余额），请使用 `Mutex` 或 `RwLock` 保护这些字段。

---

## 4. 完整示例：结合 `Mutex`、`Once` 与原子操作的线程安全账本

代码清单 17-2 创建了 4 个工作线程，每个线程向 `SharedLedger` 执行 2,500 次存入 `10` 单位的操作：
1. 每个工作线程进入时都会调用 `ledger.once.call(...)`，验证跨所有 4 个竞争线程，`1000` 单位的开户奖励**只被应用了一次**。
2. 每次存款都在 `Mutex` 临界区内同时更新 `ledger.balance` 和 `ledger.tx_count`。
3. 每次迭代还使用无锁的 `__atomic_fetch_add` 递增 `ledger.atomic_ops`。

**代码清单 17-2**：使用 `Mutex`、`Once` 和硬件原子操作协调共享状态（`examples/ch17/ch17-02-mutex-sync/main.zc`）

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

使用 `zc run -q` 运行并验证代码清单 17-2：

```text
$ zc run -q examples/ch17/ch17-02-mutex-sync/main.zc
One-time init calls: 1
Total transactions:  10000
Final balance:       101000
Atomic operations:   10000
```

---

## 5. 预防死锁的三条准则

当两个或多个线程无限期地等待被对方持有的锁时，就会发生**死锁（deadlock）**。遵循以下三条准则可确保你的 `Mutex` 和 `RwLock` 代码远离死锁：

1. **切勿在同一个线程上重复锁定非递归 `Mutex`**：在同一个线程上连续调用两次 `mutex.lock()` 而中间没有执行 `mutex.unlock()`，会导致该线程永远等待自身释放锁。
2. **按照一致的全局顺序获取多个锁**：如果某个操作必须同时锁定账户 A 和账户 B，始终先锁定 `id` 较小的账户（`if a.id < b.id { ... }`）。当每个线程以完全相同的顺序获取锁时，环路等待（circular wait）在数学上是不可能的。
3. **保持临界区简短且非阻塞**：在持有 `Mutex` 的期间，绝不要执行缓慢的网络 I/O、`sleep_ms()` 或未知的用户回调。在锁保护下复制你所需的数据，立即解锁，然后在临界区外部执行耗时操作。
