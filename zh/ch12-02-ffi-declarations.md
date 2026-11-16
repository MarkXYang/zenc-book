# 显式 FFI 声明

虽然 `import "header.h" as alias` 对于快速调用非常方便，但生产级系统代码通常更受益于**显式 FFI 声明**。在 Zen C 中显式声明 C 函数、不透明句柄和外部全局变量，可以让编译器获得用于参数校验、返回类型推断和 IDE 自动补全的完整类型信息——甚至完全无需解析 `.h` 文件。

---

## 1. 声明外部 C 函数（`extern fn`）

使用以分号（`;`）结尾的 `extern fn` 来声明在 C 中实现的函数（无论是在 libc 中、链接的静态/动态库中，还是伴随的 `.c` 文件中）：

```zenc
extern fn puts(@ctype("const char*") s: string) -> c_int;
extern fn abs(val: c_int) -> c_int;
extern fn getenv(@ctype("const char*") name: string) -> char*;
```

当你声明一个 `extern fn` 时：
- Zen C 类型检查器会在每个调用点验证参数数量和类型，并知晓准确的返回类型（`c_int`、`char*` 等）。
- 对于自定义 C 函数，`zc` 会发射匹配的 C 函数原型（`ZC_FUNC RetType name(...);`），除非某个头文件已经提供了该原型。
- 对于已知的 C 标准库函数（`puts`、`printf`、`snprintf`、`malloc`、`free`、`strlen`、`fopen`、`abs`、`getenv` 等），`zc` 能够识别该符号名称，并跳过发射重复原型，从而绝不会与 `<stdio.h>` 或 `<stdlib.h>` 中的平台注解（如 `_Nonnull`、`__THROW` 等）发生冲突。

---

## 2. 不透明 C 句柄（`extern struct` 与 `extern union`）

许多 C 语言库（例如 SQLite 的 `sqlite3*`、OpenSSL 的 `SSL_CTX*`、`zlib` 的内部状态或 `stdio` 的 `FILE*`）使用**不透明指针（opaque pointers）**：C 头文件前向声明一个结构体标签而不暴露其字段，迫使调用者完全通过基于指针的 API 函数与该对象交互。

在 Zen C 中，使用 `extern struct Name;` 或 `extern union Name;` 声明不透明 C 结构体和联合体：

```zenc
// Opaque C handle: fields are unknown to Zen C
extern struct sqlite3;

extern fn sqlite3_open(@ctype("const char*") filename: string, ppDb: sqlite3**) -> c_int;
extern fn sqlite3_close(db: sqlite3*) -> c_int;
```

因为 `sqlite3` 被注册为外部不透明结构体：
- 你可以声明类型为 `sqlite3*` 或 `sqlite3**` 的变量和参数。
- Zen C 不会在生成的 C 文件中发射重复的 `typedef struct sqlite3 { ... }` 定义。
- 将不透明 C 构造函数/析构函数对与 Zen C 的 `defer` 语句配合使用，可以在每个返回路径上保证确定性清理：

```zenc
let db: MockDb* = mock_db_open(7);
defer mock_db_close(db); // Automatically called when the scope exits!
```

---

## 3. 外部 C 全局变量（`extern let`）

如果一个 C 库暴露了全局状态变量（例如 POSIX 的 `environ` 或某个库的版本/配置变量），可以在顶层使用 `extern let` 进行声明：

```zenc
extern let g_c_library_version: c_int;
```

`extern let name: Type;` 在 Zen C 的全局符号表中注册类型为 `Type` 的 `name`，而不会在生成的 C 文件中发射重复的变量定义。

---

## 4. 使用 `@link_name` 进行符号重命名

有时 C 符号名称直接在 Zen C 中调用会显得笨拙或不便：
- 它与 Zen C 的关键字冲突（例如 `match`、`def`、`test` 或 `loop`）。
- 它使用了冗长的 C 库前缀（如 `sqlite3_exec`、`raylib_DrawCircleV`），而你希望在简洁、符合惯用法（idiomatic）的 Zen C 名称下暴露它。

可以在任何 `extern fn`、`fn`、`struct` 或 `enum` 上附加 `@link_name("C_Symbol_Name")`，以将其 Zen C 标识符与发射的 C 链接器符号解耦：

```zenc
@link_name("mock_db_exec")
extern fn execute_query(db: MockDb*, @ctype("const char*") sql: string) -> c_int;

@link_name("abs")
extern fn c_abs(val: c_int) -> c_int;
```

当 Zen C 编译 `execute_query(db, "SELECT 1;")` 时，它会对照 `execute_query` 进行类型检查，并在生成的 C11 输出中发射 `mock_db_exec(db, "SELECT 1;")`。

---

## 5. 控制 C 结构体表示（`@crepr`、`@packed`、`@align`）

当跨 Zen C / C 边界按值或按指针传递结构体时，Zen C 结构体默认已经使用标准 C 字段顺序与对齐（`typedef struct Name { ... } Name;`）。针对特殊的 C API 或硬件寄存器，Zen C 提供了三个布局属性：

| 属性 | 生成的 C11 构造 | 用途 |
| :--- | :--- | :--- |
| `@crepr("struct stat")` | 发射 `struct stat` 而非 typedef 别名 `Stat` | 与声明了 `struct tag` 但没有 `typedef` 的 POSIX/C API 进行互操作。 |
| `@packed` | `struct __attribute__((packed)) Name` | 移除结构体字段之间的所有编译器填充字节（例如网络协议头、二进制文件格式）。 |
| `@align(16)` | `struct _Alignas(16) Name` | 强制最小字节对齐（必须是 2 的幂），适用于 SIMD 缓冲区或 DMA 描述符。 |

---

## 6. 将 Zen C 导出到 C（`@export`）与内联 `raw { ... }` 块

互操作性是双向的：

### 导出 Zen C 函数（`@export`）

要从 C、Python（`ctypes`/`cffi`）、Rust 或 C# 中调用 Zen C 函数，请使用 `@export` 注解它：

```zenc
@export
fn zc_compute_checksum(a: c_int, b: c_int) -> c_int {
    return (a * 31) + b;
}
```

`@export` 确保该函数以默认动态符号可见性（`__attribute__((visibility("default")))`）和未修饰的 C 符号名称发射。你可以使用 `zc build --shared` 将 Zen C 模块编译为共享库（`.so` / `.dylib` / `.dll`）：

```bash
$ zc build --shared plugin.zc -o libplugin.so
```

### 嵌入原生 C（`raw { ... }`）

当你需要定义小型 C 辅助函数、包含 C 宏包装器，或直接在 `.zc` 文件内嵌入 mock C 库时，可以将其包裹在 `raw { ... }` 块中。`raw { ... }` 内部的所有内容都会逐字发射到 C11 输出中。

---

## 7. 完整的可运行示例

以下自包含示例（`examples/ch12/ch12-02-ffi-declarations/main.zc`）演示了 `raw { ... }`、不透明 `extern struct MockDb;`、`extern fn`、`@link_name`、`@ctype("const char*")`、`extern let`、`defer` 清理以及 `@export`：

```zenc
// File: examples/ch12/ch12-02-ffi-declarations/main.zc

// 1. Verbatim C block providing a mock C library & opaque handle implementation
raw {
    typedef struct MockDb {
        int id;
        int queries_executed;
    } MockDb;

    static int g_c_library_version = 104;

    MockDb* mock_db_open(int id) {
        MockDb* db = (MockDb*)malloc(sizeof(MockDb));
        db->id = id;
        db->queries_executed = 0;
        return db;
    }

    int mock_db_exec(MockDb* db, const char* sql) {
        (void)sql;
        db->queries_executed += 1;
        return db->queries_executed;
    }

    void mock_db_close(MockDb* db) {
        free(db);
    }
}

// 2. Opaque C struct declaration (fields hidden from Zen C callers)
extern struct MockDb;

// 3. Explicit extern function declarations
extern fn mock_db_open(id: c_int) -> MockDb*;
extern fn mock_db_close(db: MockDb*);

// 4. Symbol renaming with @link_name + exact C const-pointer type override
@link_name("mock_db_exec")
extern fn execute_query(db: MockDb*, @ctype("const char*") sql: string) -> c_int;

@link_name("abs")
extern fn c_abs(val: c_int) -> c_int;

// 5. External C global variable
extern let g_c_library_version: c_int;

// 6. Exporting a Zen C function to C callers (no name mangling, public visibility)
@export
fn zc_compute_checksum(a: c_int, b: c_int) -> c_int {
    return (a * 31) + b;
}

fn main() {
    println "C library version global: {g_c_library_version}";
    assert(g_c_library_version == 104, "Expected C global version 104");

    let db: MockDb* = mock_db_open(7);
    defer mock_db_close(db);

    let q1 = execute_query(db, "SELECT * FROM sensors;");
    let q2 = execute_query(db, "INSERT INTO logs VALUES (1);");
    println "Queries executed on opaque MockDb*: {q2}";
    assert(q1 == 1 && q2 == 2, "Expected 2 queries executed");

    let mag = c_abs(-42);
    let chk = zc_compute_checksum(10, 5);
    println "c_abs(-42) = {mag}, zc_compute_checksum(10, 5) = {chk}";
    assert(mag == 42 && chk == 315, "FFI calls must match expected results");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run examples/ch12/ch12-02-ffi-declarations/main.zc
C library version global: 104
Queries executed on opaque MockDb*: 2
c_abs(-42) = 42, zc_compute_checksum(10, 5) = 315
```

---

## 🔍 窥探底层 C 代码

检查生成的 C11 代码，展示了 `@link_name`、`@ctype`、`defer` 和 `@export` 如何直接转换为整洁的 C11：

```c
// Prototypes emitted for non-stdlib extern fn declarations:
// Notice how @link_name("mock_db_exec") and @ctype("const char*") shape the signature:
ZC_FUNC MockDb* mock_db_open(int id);
ZC_FUNC void mock_db_close(MockDb* db);
ZC_FUNC int mock_db_exec(MockDb* db, const char* sql);

ZC_FUNC int main(void)
{
    MockDb* db = mock_db_open(7);

    // execute_query(...) -> emitted directly as mock_db_exec(...)
    int q1 = mock_db_exec(db, "SELECT * FROM sensors;");
    int q2 = mock_db_exec(db, "INSERT INTO logs VALUES (1);");

    // c_abs(-42) -> emitted directly as abs((-42))
    int mag = abs((-42));
    int chk = zc_compute_checksum(10, 5);

    // Emitted from `defer mock_db_close(db);` at scope exit:
    mock_db_close(db);
}

// Emitted from `@export fn zc_compute_checksum(...)`:
__attribute__((visibility("default"))) ZC_FUNC int zc_compute_checksum(int a, int b)
{
    return ((a * 31) + b);
}
```
