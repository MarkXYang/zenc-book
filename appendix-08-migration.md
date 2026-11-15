# Appendix H: Migrating Older Zen C Code

As Zen C matured toward its current design, a small set of experimental keywords and syntactic forms were removed to keep the language predictable, transparent, and true to C11 semantics. If you are updating older Zen C code or snippets from early previews, use this guide to translate removed constructs to their modern equivalents.

---

## 1. `autofree` → Deterministic `defer` or `Drop`

Early Zen C prototypes experimented with an `autofree` keyword for automatic heap freeing. It was removed because hidden deallocations obscured ownership and interacted poorly with C FFI boundaries.

**Old (Removed):**

```zenc
autofree let buf = malloc(1024);
```

**Modern Zen C:**

```zenc
let buf = malloc(1024);
defer free(buf);
```

For reusable resource types (files, sockets, buffers), implement `Drop` on your `struct` so cleanup runs deterministically whenever the value leaves scope.

---

## 2. `async` / `await` → `std/thread.zc` and Worker Pools

Early drafts planned `async` / `await` coroutine syntax. Zen C intentionally removed `async`/`await` in favor of explicit OS threads (`Thread::spawn` in `std/thread.zc`), `Mutex`/`CondVar` (`std/sync.zc`), and bounded worker thread pools—avoiding hidden heap-allocated state machines, function coloring, and runtime schedulers.

**Old (Removed):**

```zenc
async fn fetch_data() -> string { ... }
let res = await fetch_data();
```

**Modern Zen C:**

```zenc
import "std/thread.zc"

let handle = Thread::spawn(fn() {
    // Perform blocking I/O or computation on a real OS thread
}).unwrap();
handle.join();
```

For concurrent servers handling many clients, see the bounded worker pool architecture in [Chapter 21](ch21-02-multithreaded.md).

---

## 3. Removed Control-Flow Keywords (`do-while`, `repeat`, `guard`, `unless`)

Zen C trimmed redundant control-flow keywords to keep a single obvious way to express each loop or early exit:

| Removed Syntax | Modern Zen C Replacement |
| :--- | :--- |
| `do { body(); } while cond;` | `loop { body(); if !cond { break; } }` |
| `repeat 5 { work(); }` | `for i in 0..5 { work(); }` |
| `guard cond else { return; }` | `if !cond { return; }` |
| `unless cond { work(); }` | `if !cond { work(); }` |

---

## 4. Top-Level Constants (`const` → `def`)

Older snippets occasionally used `const` for top-level compile-time constants. In modern Zen C, declare compile-time constants with `def`:

**Old:**

```zenc
const MAX_CLIENTS = 128;
```

**Modern Zen C:**

```zenc
def MAX_CLIENTS = 128;
```

---

## 5. Unit Enum Variants (`None` → `None()`)

Unit variants of generic or payload enums are constructed with parentheses:

**Old:**

```zenc
let x = MyOption<int>::None;
```

**Modern Zen C:**

```zenc
let x = MyOption<int>::None();
```
