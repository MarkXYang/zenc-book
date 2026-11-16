# Appendix C: Zen C Standard Library Comprehensive Tour

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

The `std/math.zc` module provides mathematical constants and standard trigonometric, exponential, and rounding functions. Functions are organized under the `Math` namespace struct:

**Listing C-1**
```zenc
import "std/math.zc";

fn main() {
    let radius = 5.0;
    let area = Math::PI() * Math::pow(radius, 2.0);
    let hypotenuse = Math::sqrt(3.0 * 3.0 + 4.0 * 4.0);

    println "Area: {area}, Hypotenuse: {hypotenuse}";
}
```

Output:
```text
Area: 78.539816, Hypotenuse: 5.000000
```

Other numerics modules include:
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

#### Path Manipulation (`std/path.zc`)

The `std/path.zc` module provides cross-platform file path manipulation:

**Listing C-2**
```zenc
import "std/path.zc";

fn main() {
    let p = Path::new("/var/log");
    let full = p.join("app.log");

    println "Path: {full.c_str()}";
}
```

Output:
```text
Path: /var/log/app.log
```

#### Filesystem I/O (`std/fs.zc`)

The `std/fs.zc` module provides high-level file reading and writing utilities:

**Listing C-3**
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

Output (assuming `config.txt` contains `server_port=8080`):
```text
Config content: server_port=8080
```

---

### 4. Time and System

#### Clocks and Timers (`std/time.zc`)

The `std/time.zc` module provides high-resolution timestamps, elapsed intervals, and thread sleep:

**Listing C-4**
```zenc
import "std/time.zc";

fn main() {
    let start = Time::now(); // Milliseconds timestamp

    Time::sleep_ms(50);      // Sleep for 50 ms

    let elapsed = Time::now() - start;
    println "Elapsed: {elapsed} ms";
}
```

Output:
```text
Elapsed: 50 ms
```

#### Environment Variables (`std/env.zc`)

The `std/env.zc` module provides access to process environment variables and CLI parameters:

**Listing C-5**
```zenc
import "std/env.zc";

fn main() {
    // Env::get returns Option<string>
    let user = Env::get("USER").unwrap_or("guest");
    println "Logged in as: {user}";

    // Or inspect explicitly using is_some()
    let user_opt = Env::get("USER");
    if user_opt.is_some() {
        println "Found user: {user_opt.unwrap()}";
    }
}
```

Output:
```text
Logged in as: mark
Found user: mark
```

Other system modules include:
- **`std/process.zc`**: Spawning child processes, inspecting exit statuses, and signal handling.
- **`std/thread.zc` & `std/sync.zc`**: Native OS threads, mutexes, and synchronization barriers (covered in [Chapter 17: Concurrency](ch17-00-concurrency.md)).

---

### 5. Text, Formats, and Parsing

Zen C provides powerful built-in text manipulation, data format serialization, and cryptographic hashing tools:

#### A. JSON Parsing and Building (`std/json.zc`)

`std/json.zc` implements a complete DOM-style JSON parser and builder supporting objects, arrays, strings, numbers, booleans, and null:

**Listing C-6**
```zenc
import "std/json.zc";

fn main() {
    // 1. Building a JSON object dynamically
    let obj = JsonValue::object();
    obj.set("name", JsonValue::string("Zen C"));
    obj.set("version", JsonValue::number(1.0));
    obj.set("active", JsonValue::bool(true));

    // Access fields safely with Option extractors
    let name = obj.get_string("name").unwrap_or("unknown");
    let version = obj.get_int("version").unwrap_or(0);
    println "JSON object: {name}, version {version}";

    // Serialize directly to a JSON string
    let serialized = obj.to_string();
    println "Serialized: {serialized}";

    // 2. Parsing raw JSON
    let raw = "[\"apple\", \"banana\", \"cherry\"]";
    let res = JsonValue::parse(raw);
    if res.is_ok() {
        let arr = res.unwrap();
        println "Parsed array with {arr.length()} elements";
        let first = arr.at(0).unwrap();
        println "First item: {first.as_string().unwrap_or(\"none\")}";
        dealloc<JsonValue>(arr);
    }
}
```

Output:
```text
JSON object: Zen C, version 1
Serialized: {"active":true,"name":"Zen C","version":1}
Parsed array with 3 elements
First item: apple
```

#### B. Unicode and UTF-8 Utilities (`std/utf8.zc`)

Zen C handles Unicode code points natively via the `rune` primitive type, and `std/utf8.zc` provides character classification, validation, and encoding utilities:

**Listing C-7**
```zenc
import "std/utf8.zc";

fn main() {
    let text = "Hello, 🚀 Zen C!";

    // Validate whether a byte stream is well-formed UTF-8
    let is_valid = Utf8::is_valid(text, strlen(text));
    println "Is valid UTF-8: {is_valid}";

    // Calculate byte length of a single Unicode code point
    let r: rune = '🚀';
    println "Rune '🚀' byte length: {Utf8::rune_len(r)} bytes";

    // Encode a rune into a raw byte buffer
    let buf: char[5];
    let written = Utf8::encode(r, buf);
    buf[written] = 0;
    println "Encoded {written} bytes into buffer";
}
```

Output:
```text
Is valid UTF-8: true
Rune '🚀' byte length: 4 bytes
Encoded 4 bytes into buffer
```

#### C. Regular Expressions (`std/regex.zc`)

Regular expressions in Zen C are backed by the high-performance TRE regex engine, offering POSIX extended regular expressions:

**Listing C-8**
```zenc
import "std/regex.zc";

fn main() {
    // Compile a regular expression pattern
    let re = Regex::compile("[0-9]+");
    let text = "Order ID: 12345";

    // Fast boolean match check
    let matches = re.is_match(text);
    println "Contains digits: {matches}";

    // Extract match coordinates and text
    let m_opt = re.find(text);
    if m_opt.is_some() {
        let m = m_opt.unwrap();
        println "Matched: '{m.as_string()}' at offset {m.start}";
    }
}
```

Output:
```text
Contains digits: true
Matched: '12345' at offset 10
```

> [!NOTE]
> `std/regex.zc` includes the vendored TRE engine via `@link`. Ensure your include search paths include the compiler root when compiling regex code from arbitrary directories (`zc run -I $ZC_ROOT ...`).

#### D. Data Encoding: Base64 and Hex (`std/encoding/`)

The standard library includes dedicated modules for Base64 and hexadecimal conversions under `std/encoding/`:

**Listing C-9**
```zenc
import "std/encoding/base64.zc";
import "std/encoding/hex.zc";

fn main() {
    let message = "Hello, Zen C!";
    let len = strlen(message);

    // 1. Base64 encoding
    let b64 = Base64::encode((u8*)message, len);
    println "Base64: {b64.c_str()}"; // "SGVsbG8sIFplbiBDIQ=="

    // 2. Hexadecimal encoding
    let hex = Hex::encode((u8*)message, len);
    println "Hex:    {hex.c_str()}"; // "48656c6c6f2c205a656e204321"
}
```

Output:
```text
Base64: SGVsbG8sIFplbiBDIQ==
Hex:    48656c6c6f2c205a656e204321
```

#### E. Cryptographic Hashing (`std/crypto/`)

`std/crypto/sha256.zc` provides FIPS 180-4 compliant SHA-256 computation:

**Listing C-10**
```zenc
import "std/crypto/sha256.zc";

fn main() {
    let payload = "Hello, Zen C!";

    // Generate SHA-256 hex digest
    let digest = Sha256::hash(payload);
    println "SHA-256 digest: {digest.c_str()}";
}
```

Output:
```text
SHA-256 digest: 631bd37eb71f8dbf091bbd1e7203055072f27f042491ad5a796437ffdc5696f8
```

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
