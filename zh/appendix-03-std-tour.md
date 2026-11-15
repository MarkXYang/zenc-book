# 附录 C：Zen C 标准库全景导览

# 标准库概览

Zen C 包含丰富且现代化的**标准库**（`std`）。它开箱即用，直接提供高性能数据结构、I/O 抽象、系统实用工具和数学运算——且零外部依赖。

与传统 C 语言不同（传统 C 需要为基础数据结构如动态向量或哈希表拼凑各种零散的第三方库），Zen C 将这些基础工具标准化为一个高内聚、内存安全的统一样式库。

---

## 1. 导入标准库

标准库位于随 `zc` 编译器一起分发的 `std/` 目录中。你可以通过引用相对于 `std/` 的路径来导入任何标准模块：

```zenc
import "std/math.zc";
import "std/time.zc";
import "std/path.zc";
```

### `ZC_ROOT` 环境变量

在编译时，`zc` 会自动定位相对于编译器二进制文件目录的标准库。如果你使用自定义编译器安装或在非标准容器化环境中进行开发，可以通过 `ZC_ROOT` 环境变量显式向编译器指定标准库根路径：

```bash
export ZC_ROOT=/home/mark/code/Zen-C
zc run my_program.zc
```

---

## 2. 核心模块分类

标准库划分为若干专注于特定功能的领域：

### 1. 数学与数值计算

`std/math.zc` 模块提供数学常数以及标准三角函数、指数和取整函数。函数组织在 `Math` 命名空间结构体下：

**代码清单 7-12：`list7-12.zc`**

```zenc
 1 | import "std/math.zc";
 2 |
 3 | fn main() {
 4 |     let radius = 5.0;
 5 |     let area = Math::PI() * Math::pow(radius, 2.0);
 6 |     let hypotenuse = Math::sqrt(3.0 * 3.0 + 4.0 * 4.0);
 7 |
 8 |     println "Area: {area}, Hypotenuse: {hypotenuse}";
 9 | }
```

输出：
```text
Area: 78.539816, Hypotenuse: 5.000000
```

其他数值模块包括：
- **`std/complex.zc`**：复数算术运算（`Complex`）。
- **`std/bigint.zc` 与 `std/bigfloat.zc`**：任意精度整数与浮点数计算。
- **`std/bits.zc`**：按位循环移位（`rotl`、`rotr`）、置 1 位计数（popcount）与前导零检测。
- **`std/simd.zc`**：利用编译器 SIMD 内建函数的硬件加速向量化类型。

---

### 2. 常用集合类型

Zen C 提供了惯用集合类型，它们通过自动清理机制（`Drop`）自主管理其动态堆内存：

- **`std/vec.zc`**：可扩容的通用泛型动态数组（`Vec<T>`）。
- **`std/string.zc`**：堆分配且经过 UTF-8 验证的可扩容字符串（`String`）。
- **`std/map.zc`**：快速的泛型哈希表（`Map<V>`）。
- **`std/set.zc`**：泛型哈希集合（`Set<T>`）。
- **`std/queue.zc`**：FIFO 环形缓冲区队列（`Queue<T>`）。
- **`std/stack.zc`**：LIFO 栈（`Stack<T>`）。
- **`std/slice.zc`**：轻量级非拥有的连续内存视图（`Slice<T>`）。

> [!NOTE]
> 我们将在[第 8 章：常用集合类型](ch08-00-common-collections.md)中全面深入地探讨 `Vec<T>`、`String` 和 `Map<V>`。

---

### 3. 文件系统与路径

#### 路径操作（`std/path.zc`）

`std/path.zc` 模块提供跨平台的文件路径操作：

**代码清单 7-13：`list7-13.zc`**

```zenc
 1 | import "std/path.zc";
 2 |
 3 | fn main() {
 4 |     let p = Path::new("/var/log");
 5 |     let full = p.join("app.log");
 6 |
 7 |     println "Path: {full.c_str()}";
 8 | }
```

输出：
```text
Path: /var/log/app.log
```

#### 文件系统 I/O（`std/fs.zc`）

`std/fs.zc` 模块提供高层文件读写实用工具：

**代码清单 7-14：`list7-14.zc`**

```zenc
 1 | import "std/fs.zc";
 2 |
 3 | fn main() {
 4 |     // Reading an entire file into a String
 5 |     let result = File::read_all("config.txt");
 6 |     if result.is_ok() {
 7 |         let content = result.unwrap();
 8 |         println "Config content: {content.c_str()}";
 9 |     }
10 | }
```

输出（假定 `config.txt` 包含 `server_port=8080`）：
```text
Config content: server_port=8080
```

---

### 4. 时间与系统

#### 时钟与计时器（`std/time.zc`）

`std/time.zc` 模块提供高精度时间戳、耗时间隔测量与线程休眠功能：

**代码清单 7-15：`list7-15.zc`**

```zenc
 1 | import "std/time.zc";
 2 |
 3 | fn main() {
 4 |     let start = Time::now(); // Milliseconds timestamp
 5 |
 6 |     Time::sleep_ms(50);      // Sleep for 50 ms
 7 |
 8 |     let elapsed = Time::now() - start;
 9 |     println "Elapsed: {elapsed} ms";
10 | }
```

输出：
```text
Elapsed: 50 ms
```

#### 环境变量（`std/env.zc`）

`std/env.zc` 模块提供对进程环境变量和命令行参数的访问：

**代码清单 7-16：`list7-16.zc`**

```zenc
 1 | import "std/env.zc";
 2 |
 3 | fn main() {
 4 |     // Env::get returns Option<string>
 5 |     let user = Env::get("USER").unwrap_or("guest");
 6 |     println "Logged in as: {user}";
 7 |
 8 |     // Or inspect explicitly using is_some()
 9 |     let user_opt = Env::get("USER");
10 |     if user_opt.is_some() {
11 |         println "Found user: {user_opt.unwrap()}";
12 |     }
13 | }
```

输出：
```text
Logged in as: mark
Found user: mark
```

其他系统模块包括：
- **`std/process.zc`**：创建子进程、检查退出状态与信号处理。
- **`std/thread.zc` 与 `std/sync.zc`**：原生操作系统线程、互斥锁与同步屏障（在[第 16 章：并发](ch16-00-concurrency.md)中讨论）。

---

### 5. 文本、格式与解析

Zen C 提供了强大的内置文本操作、数据格式序列化与密码学哈希工具：

#### A. JSON 解析与构建（`std/json.zc`）

`std/json.zc` 实现了完整的 DOM 风格 JSON 解析器与构建器，支持对象、数组、字符串、数字、布尔值和 null：

**代码清单 7-17：`list7-17.zc`**

```zenc
 1 | import "std/json.zc";
 2 |
 3 | fn main() {
 4 |     // 1. Building a JSON object dynamically
 5 |     let obj = JsonValue::object();
 6 |     obj.set("name", JsonValue::string("Zen C"));
 7 |     obj.set("version", JsonValue::number(1.0));
 8 |     obj.set("active", JsonValue::bool(true));
 9 |
10 |     // Access fields safely with Option extractors
11 |     let name = obj.get_string("name").unwrap_or("unknown");
12 |     let version = obj.get_int("version").unwrap_or(0);
13 |     println "JSON object: {name}, version {version}";
14 |
15 |     // Serialize directly to a JSON string
16 |     let serialized = obj.to_string();
17 |     println "Serialized: {serialized}";
18 |
19 |     // 2. Parsing raw JSON
20 |     let raw = "[\"apple\", \"banana\", \"cherry\"]";
21 |     let res = JsonValue::parse(raw);
22 |     if res.is_ok() {
23 |         let arr = res.unwrap();
24 |         println "Parsed array with {arr.length()} elements";
25 |         let first = arr.at(0).unwrap();
26 |         println "First item: {first.as_string().unwrap_or(\"none\")}";
27 |         dealloc<JsonValue>(arr);
28 |     }
29 | }
```

输出：
```text
JSON object: Zen C, version 1
Serialized: {"active":true,"name":"Zen C","version":1}
Parsed array with 3 elements
First item: apple
```

#### B. Unicode 与 UTF-8 实用工具（`std/utf8.zc`）

Zen C 通过 `rune` 原生类型原生处理 Unicode 码点，`std/utf8.zc` 提供了字符分类、验证和编码工具：

**代码清单 7-18：`list7-18.zc`**

```zenc
 1 | import "std/utf8.zc";
 2 |
 3 | fn main() {
 4 |     let text = "Hello, 🚀 Zen C!";
 5 |
 6 |     // Validate whether a byte stream is well-formed UTF-8
 7 |     let is_valid = Utf8::is_valid(text, strlen(text));
 8 |     println "Is valid UTF-8: {is_valid}";
 9 |
10 |     // Calculate byte length of a single Unicode code point
11 |     let r: rune = '🚀';
12 |     println "Rune '🚀' byte length: {Utf8::rune_len(r)} bytes";
13 |
14 |     // Encode a rune into a raw byte buffer
15 |     let buf: char[5];
16 |     let written = Utf8::encode(r, buf);
17 |     buf[written] = 0;
18 |     println "Encoded {written} bytes into buffer";
19 | }
```

输出：
```text
Is valid UTF-8: true
Rune '🚀' byte length: 4 bytes
Encoded 4 bytes into buffer
```

#### C. 正则表达式（`std/regex.zc`）

Zen C 中的正则表达式由高性能的 TRE 正则表达式引擎提供支持，提供 POSIX 扩展正则表达式功能：

**代码清单 7-19：`list7-19.zc`**

```zenc
 1 | import "std/regex.zc";
 2 |
 3 | fn main() {
 4 |     // Compile a regular expression pattern
 5 |     let re = Regex::compile("[0-9]+");
 6 |     let text = "Order ID: 12345";
 7 |
 8 |     // Fast boolean match check
 9 |     let matches = re.is_match(text);
10 |     println "Contains digits: {matches}";
11 |
12 |     // Extract match coordinates and text
13 |     let m_opt = re.find(text);
14 |     if m_opt.is_some() {
15 |         let m = m_opt.unwrap();
16 |         println "Matched: '{m.as_string()}' at offset {m.start}";
17 |     }
18 | }
```

输出：
```text
Contains digits: true
Matched: '12345' at offset 10
```

> [!NOTE]
> `std/regex.zc` 通过 `@link` 引入了内嵌的 TRE 引擎。从任意目录编译正则表达式代码时，请确保包含路径包含编译器根目录（`zc run -I $ZC_ROOT ...`）。

#### D. 数据编码：Base64 与 Hex（`std/encoding/`）

标准库在 `std/encoding/` 下包含用于 Base64 和十六进制转换的专用模块：

**代码清单 7-20：`list7-20.zc`**

```zenc
 1 | import "std/encoding/base64.zc";
 2 | import "std/encoding/hex.zc";
 3 |
 4 | fn main() {
 5 |     let message = "Hello, Zen C!";
 6 |     let len = strlen(message);
 7 |
 8 |     // 1. Base64 encoding
 9 |     let b64 = Base64::encode((u8*)message, len);
10 |     println "Base64: {b64.c_str()}"; // "SGVsbG8sIFplbiBDIQ=="
11 |
12 |     // 2. Hexadecimal encoding
13 |     let hex = Hex::encode((u8*)message, len);
14 |     println "Hex:    {hex.c_str()}"; // "48656c6c6f2c205a656e204321"
15 | }
```

输出：
```text
Base64: SGVsbG8sIFplbiBDIQ==
Hex:    48656c6c6f2c205a656e204321
```

#### E. 密码学哈希（`std/crypto/`）

`std/crypto/sha256.zc` 提供了符合 FIPS 180-4 规范的 SHA-256 计算：

**代码清单 7-21：`list7-21.zc`**

```zenc
 1 | import "std/crypto/sha256.zc";
 2 |
 3 | fn main() {
 4 |     let payload = "Hello, Zen C!";
 5 |
 6 |     // Generate SHA-256 hex digest
 7 |     let digest = Sha256::hash(payload);
 8 |     println "SHA-256 digest: {digest.c_str()}";
 9 | }
```

输出：
```text
SHA-256 digest: 631bd37eb71f8dbf091bbd1e7203055072f27f042491ad5a796437ffdc5696f8
```

---

### 6. 错误处理原语

- **`std/option.zc`**：`Option<T>` 和类型（`Some(T)` 与 `None`），用于在无需 `NULL` 的情况下安全处理可选值。
- **`std/result.zc`**：`Result<T, E>` 和类型（`Ok(T)` 与 `Err(E)`），用于稳健的可恢复错误传播。

我们在[第 9 章：错误处理](ch09-00-error-handling.md)中深入探讨了安全错误处理。

---

## 3. 完整标准库参考速查表

| 模块 | 用途 | 核心类型 / 函数 |
| :--- | :--- | :--- |
| **`std/math.zc`** | 数学常数与函数 | `Math::PI()`, `Math::sqrt()`, `Math::sin()` |
| **`std/vec.zc`** | 可扩容泛型动态数组 | `Vec<T>`, `push()`, `pop()`, `get()` |
| **`std/string.zc`** | 动态堆分配 UTF-8 字符串 | `String`, `c_str()`, `append()`, `length()` |
| **`std/map.zc`** | 泛型哈希表 | `Map<V>`, `insert()`, `get()`, `remove()` |
| **`std/set.zc`** | 泛型哈希集合 | `Set<T>`, `contains()`, `add()` |
| **`std/queue.zc`** | FIFO 环形缓冲区队列 | `Queue<T>`, `push()`, `pop()` |
| **`std/stack.zc`** | LIFO 栈 | `Stack<T>`, `push()`, `pop()`, `peek()` |
| **`std/slice.zc`** | 非拥有内存视图 | `Slice<T>` |
| **`std/path.zc`** | 跨平台文件路径操作 | `Path`, `join()`, `extension()`, `c_str()` |
| **`std/fs.zc`** | 文件系统与文件 I/O 操作 | `File`, `open()`, `read_all()`, `write_string()` |
| **`std/io.zc`** | 标准 I/O 流与格式化 | `print`, `println`, `eprintln` |
| **`std/time.zc`** | 高精度时钟与计时器 | `Time::now()`, `Time::sleep_ms()`, `Duration` |
| **`std/env.zc`** | 进程环境变量 | `env::get()`, `env::set()` |
| **`std/process.zc`** | 进程执行与生命周期 | `Process`, `exit()`, `pid()` |
| **`std/thread.zc`** | 多线程原语 | `Thread::spawn()`, `join()` |
| **`std/sync.zc`** | 并发同步原语 | `Mutex`, `CondVar`, `Atomic` |
| **`std/json.zc`** | JSON 解析与构建 | `Json::parse()`, `JsonValue` |
| **`std/regex.zc`** | 正则表达式 | `Regex::compile()`, `is_match()` |
| **`std/random.zc`** | 伪随机数生成器 | `Random::int()`, `Random::float()` |
| **`std/simd.zc`** | 原生硬件 SIMD 向量 | `f32x4`, `f64x2`, `i32x4` |
| **`std/bits.zc`** | 底层位运算 | `rotl()`, `rotr()`, `popcount()` |
| **`std/complex.zc`** | 复数算术运算 | `Complex` |
| **`std/bigint.zc`** | 任意精度整数数学 | `BigInt` |
| **`std/bigfloat.zc`** | 任意精度浮点数数学 | `BigFloat` |
| **`std/arena.zc`** | 快速区域内存分配器 | `Arena`, `alloc()` |
| **`std/utf8.zc`** | Unicode 与 UTF-8 实用工具 | `utf8_decode()`, `rune` 验证 |
| **`std/option.zc`** | 可选值和类型 | `Option<T>`, `Some`, `None` |
| **`std/result.zc`** | 可恢复错误和类型 | `Result<T, E>`, `Ok`, `Err` |

---

## 本章小结

在本章中，你学习了：
- Zen C 中的**模块**如何直接从 `.zc` 文件隐式创建，无需样板包清单。
- 如何通过 `import ... as alias`、`as *` 以及选择性 `import { ... } from "..."` 控制符号可见性与命名空间。
- 如何使用**目录模块**（`mod.zc`）组织多文件项目。
- 如何通过 **`opaque struct`**（私有字段配合栈分配）和 **`opaque alias`**（严格名义类型化）实现零开销封装。
- `zc` 编译器如何通过**编译期循环依赖检测**保证架构的整洁性。
- **Zen C 标准库（`std`）**如何为数学、I/O、集合、系统和线程提供内置的生产级解决方案。

> [!TIP]
> 你可以在 [`book/examples/ch07/ch07-02-standard-library/`](file:///home/mark/code/zenc-app/book/examples/ch07/ch07-02-standard-library/) 中找到并运行标准库演示，在 [`book/examples/ch07/project_manager/`](file:///home/mark/code/zenc-app/book/examples/ch07/project_manager/) 中找到完整的多模块收官应用程序。

在[第 8 章](ch08-00-common-collections.md)中，我们将深入探讨 Zen C 最重要的标准集合类型：**向量（`Vec<T>`）**、**字符串**以及**哈希表（`Map<V>`）**！
