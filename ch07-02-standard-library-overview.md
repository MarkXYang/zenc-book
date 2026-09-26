# Standard Library Overview

Zen C includes a rich, modern **Standard Library** (`std`). It provides high-performance data structures, I/O abstractions, system utilities, and mathematical operations directly out of the box—with zero external dependencies.

Unlike traditional C, which requires assembling disparate third-party libraries for basic data structures (like dynamic vectors or hash maps), Zen C standardizes these essential tools into a cohesive, memory-safe library.

---

## 1. Importing the Standard Library

The standard library lives in the `std/` directory distributed alongside the `zc` compiler. You can import any standard module by referencing its path relative to `std/`:

```zenc
import "std/math.zc";
import "std/time.zc";
import "std/path.zc";
```

### The `ZC_ROOT` Environment Variable

When compiling, `zc` automatically locates the standard library relative to the compiler binary's directory. If you are developing with custom compiler installations or in non-standard containerized environments, you can explicitly point the compiler to the standard library root using the `ZC_ROOT` environment variable:

```bash
export ZC_ROOT=/home/mark/code/Zen-C
zc run my_program.zc
```

---

## 2. Core Module Categories

The standard library is structured into several focused functional domains:

### 1. Mathematics & Numerics

- **`std/math.zc`**: Mathematical constants and standard trigonometric, exponential, and rounding functions. Functions are organized under the `Math` namespace struct:
  ```zenc
  import "std/math.zc";

  fn main() {
      let radius = 5.0;
      let area = Math::PI() * Math::pow(radius, 2.0);
      let hypotenuse = Math::sqrt(3.0 * 3.0 + 4.0 * 4.0);

      println "Area: {area}, Hypotenuse: {hypotenuse}";
  }
  ```
- **`std/complex.zc`**: Complex number arithmetic (`Complex`).
- **`std/bigint.zc` & `std/bigfloat.zc`**: Arbitrary-precision integer and floating-point computations.
- **`std/bits.zc`**: Bitwise rotation (`rotl`, `rotr`), population count, and leading zero detection.
- **`std/simd.zc`**: Hardware-accelerated vectorized types using compiler SIMD intrinsics.

---

### 2. Common Collections

Zen C provides idiomatic collection types that manage their own dynamic heap memory using automatic cleanup (`Drop`):

- **`std/vec.zc`**: A growable, generic dynamic array (`Vec<T>`).
- **`std/string.zc`**: A heap-allocated, UTF-8 validated growable string (`String`).
- **`std/map.zc`**: A fast, generic hash map (`Map<V>`).
- **`std/set.zc`**: A generic hash set (`Set<T>`).
- **`std/queue.zc`**: A FIFO ring-buffer queue (`Queue<T>`).
- **`std/stack.zc`**: A LIFO stack (`Stack<T>`).
- **`std/slice.zc`**: Lightweight, non-owning contiguous memory views (`Slice<T>`).

> [!NOTE]
> We will explore `Vec<T>`, `String`, and `Map<V>` in comprehensive depth in [Chapter 8: Common Collections](ch08-00-common-collections.md).

---

### 3. Filesystem and Paths

- **`std/path.zc`**: Cross-platform file path manipulation:
  ```zenc
  import "std/path.zc";

  fn main() {
      let p = Path::new("/var/log");
      let full = p.join("app.log");

      println "Path: {full.c_str()}";
  }
  ```
- **`std/fs.zc`**: High-level file reading and writing utilities:
  ```zenc
  import "std/fs.zc";

  fn main() {
      // Reading an entire file into a String
      let result = File::read_all("config.txt");
      if result.is_ok() {
          let content = result.unwrap();
          println "Config content: {content.c_str()}";
      }
  }
  ```

---

### 4. Time and System

- **`std/time.zc`**: High-resolution timestamps, elapsed intervals, and thread sleep:
  ```zenc
  import "std/time.zc";

  fn main() {
      let start = Time::now(); // Milliseconds timestamp

      Time::sleep_ms(50);      // Sleep for 50 ms

      let elapsed = Time::now() - start;
      println "Elapsed: {elapsed} ms";
  }
  ```
- **`std/env.zc`**: Inspecting process environment variables and CLI parameters:
  ```zenc
  import "std/env.zc";

  fn main() {
      let user = env::get("USER");
      println "Logged in as: {user}";
  }
  ```
- **`std/process.zc`**: Spawning child processes, inspecting exit statuses, and signal handling.
- **`std/thread.zc` & `std/sync.zc`**: Native OS threads, mutexes, and synchronization barriers (covered in [Chapter 16: Concurrency](ch16-00-concurrency.md)).

---

### 5. Text, Formats, and Parsing

- **`std/json.zc`**: DOM-style JSON parser and serializer with support for nested objects and arrays.
- **`std/utf8.zc`**: Unicode code point decoding and validation.
- **`std/regex.zc`**: Regular expression evaluation based on the TRE engine.
- **`std/encoding.zc` & `std/crypto/`**: Base64, hex encoding, and cryptographic hashing (SHA-256).

---

### 6. Error Handling Primitives

- **`std/option.zc`**: The `Option<T>` tagged union (`Some(T)` and `None`) for safe handling of optional values without `NULL`.
- **`std/result.zc`**: The `Result<T, E>` tagged union (`Ok(T)` and `Err(E)`) for robust recoverable error propagation.

We explore safe error handling in depth in [Chapter 9: Error Handling](ch09-00-error-handling.md).

---

## 3. Complete Standard Library Reference

| Module | Purpose | Key Types / Functions |
| :--- | :--- | :--- |
| **`std/math.zc`** | Mathematical constants and functions | `Math::PI()`, `Math::sqrt()`, `Math::sin()` |
| **`std/vec.zc`** | Growable generic dynamic array | `Vec<T>`, `push()`, `pop()`, `get()` |
| **`std/string.zc`** | Dynamic heap-allocated UTF-8 string | `String`, `c_str()`, `append()`, `length()` |
| **`std/map.zc`** | Generic Hash Map | `Map<V>`, `insert()`, `get()`, `remove()` |
| **`std/set.zc`** | Generic Hash Set | `Set<T>`, `contains()`, `add()` |
| **`std/queue.zc`** | FIFO Ring Buffer Queue | `Queue<T>`, `push()`, `pop()` |
| **`std/stack.zc`** | LIFO Stack | `Stack<T>`, `push()`, `pop()`, `peek()` |
| **`std/slice.zc`** | Non-owning memory views | `Slice<T>` |
| **`std/path.zc`** | Cross-platform file path manipulation | `Path`, `join()`, `extension()`, `c_str()` |
| **`std/fs.zc`** | Filesystem and file I/O operations | `File`, `open()`, `read_all()`, `write_string()` |
| **`std/io.zc`** | Standard I/O streams and formatting | `print`, `println`, `eprintln` |
| **`std/time.zc`** | High-resolution clocks and timers | `Time::now()`, `Time::sleep_ms()`, `Duration` |
| **`std/env.zc`** | Process environment variables | `env::get()`, `env::set()` |
| **`std/process.zc`** | Process execution and lifecycle | `Process`, `exit()`, `pid()` |
| **`std/thread.zc`** | Multithreading primitives | `Thread::spawn()`, `join()` |
| **`std/sync.zc`** | Concurrency synchronization | `Mutex`, `CondVar`, `Atomic` |
| **`std/json.zc`** | JSON parsing and building | `Json::parse()`, `JsonValue` |
| **`std/regex.zc`** | Regular expressions | `Regex::compile()`, `is_match()` |
| **`std/random.zc`** | Pseudo-random number generator | `Random::int()`, `Random::float()` |
| **`std/simd.zc`** | Native hardware SIMD vectors | `f32x4`, `f64x2`, `i32x4` |
| **`std/bits.zc`** | Low-level bitwise operations | `rotl()`, `rotr()`, `popcount()` |
| **`std/complex.zc`** | Complex numbers arithmetic | `Complex` |
| **`std/bigint.zc`** | Arbitrary-precision integer math | `BigInt` |
| **`std/bigfloat.zc`** | Arbitrary-precision floating point | `BigFloat` |
| **`std/arena.zc`** | Fast regional memory allocator | `Arena`, `alloc()` |
| **`std/utf8.zc`** | Unicode and UTF-8 utilities | `utf8_decode()`, `rune` validation |
| **`std/option.zc`** | Optional values sum type | `Option<T>`, `Some`, `None` |
| **`std/result.zc`** | Recoverable error sum type | `Result<T, E>`, `Ok`, `Err` |

---

## Summary

In this chapter, you learned:
- How **Modules** in Zen C are created implicitly from `.zc` files without boilerplate package manifests.
- How to control symbol visibility and namespaces with `import ... as alias`, `as *`, and selective `import { ... } from "..."`.
- How to structure multi-file projects using **Directory Modules** (`mod.zc`).
- How to achieve zero-overhead encapsulation with **`opaque struct`** (private fields with stack allocation) and **`opaque alias`** (strict nominal typing).
- How the `zc` compiler guarantees architectural cleanliness through **Compile-Time Circular Dependency Detection**.
- How the **Zen C Standard Library (`std`)** provides built-in, production-grade solutions for math, I/O, collections, systems, and threading.

> [!TIP]
> You can find and run the standard library demonstration in [`book/examples/ch07/ch07-02-standard-library/`](file:///home/mark/code/zenc-app/book/examples/ch07/ch07-02-standard-library/) and the complete multi-module capstone application in [`book/examples/ch07/project_manager/`](file:///home/mark/code/zenc-app/book/examples/ch07/project_manager/).

In [Chapter 8](ch08-00-common-collections.md), we'll dive into the details of Zen C's most important standard collections: **Vectors (`Vec<T>`)**, **Strings**, and **Hash Maps (`Map<V>`)**!
