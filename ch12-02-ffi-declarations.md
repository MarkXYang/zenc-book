# 12.2 Explicit FFI Declarations

While `import "header.h" as alias` is convenient for quick calls, production systems code often benefits from **explicit FFI declarations**. Declaring C functions, opaque handles, and external globals explicitly in Zen C gives the compiler full type information for argument validation, return-type inference, and IDE autocompletion—even without parsing a `.h` file.

---

## 1. Declaring External C Functions (`extern fn`)

Use `extern fn` terminated by a semicolon (`;`) to declare a function implemented in C (either in libc, a linked static/dynamic library, or a companion `.c` file):

```zenc
extern fn puts(@ctype("const char*") s: string) -> c_int;
extern fn abs(val: c_int) -> c_int;
extern fn getenv(@ctype("const char*") name: string) -> char*;
```

When you declare an `extern fn`:
- The Zen C type checker verifies the argument count and types at every call site and knows the exact return type (`c_int`, `char*`, etc.).
- For custom C functions, `zc` emits a matching C function prototype (`ZC_FUNC RetType name(...);`) unless a header has already provided it.
- For known C standard library functions (`puts`, `printf`, `snprintf`, `malloc`, `free`, `strlen`, `fopen`, `abs`, `getenv`, etc.), `zc` recognizes the symbol name and skips emitting a duplicate prototype so it never conflicts with `<stdio.h>` or `<stdlib.h>` platform annotations (`_Nonnull`, `__THROW`, etc.).

---

## 2. Opaque C Handles (`extern struct` and `extern union`)

Many C libraries (such as SQLite's `sqlite3*`, OpenSSL's `SSL_CTX*`, `zlib`'s internal state, or `stdio`'s `FILE*`) use **opaque pointers**: the C header forward-declares a struct tag without exposing its fields, forcing callers to interact with the object exclusively through pointer-based API functions.

In Zen C, declare opaque C structs and unions with `extern struct Name;` or `extern union Name;`:

```zenc
// Opaque C handle: fields are unknown to Zen C
extern struct sqlite3;

extern fn sqlite3_open(@ctype("const char*") filename: string, ppDb: sqlite3**) -> c_int;
extern fn sqlite3_close(db: sqlite3*) -> c_int;
```

Because `sqlite3` is registered as an external opaque struct:
- You can declare variables and parameters of type `sqlite3*` or `sqlite3**`.
- Zen C does not emit a duplicate `typedef struct sqlite3 { ... }` definition in the generated C file.
- Pairing opaque C constructor/destructor pairs with Zen C's `defer` statement guarantees deterministic cleanup on every return path:

```zenc
let db: MockDb* = mock_db_open(7);
defer mock_db_close(db); // Automatically called when the scope exits!
```

---

## 3. External C Global Variables (`extern let`)

If a C library exposes a global state variable (such as POSIX `environ` or a library version/configuration variable), declare it at the top level with `extern let`:

```zenc
extern let g_c_library_version: c_int;
```

`extern let name: Type;` registers `name` with type `Type` in Zen C's global symbol table without emitting a duplicate variable definition in the generated C file.

---

## 4. Symbol Renaming with `@link_name`

Sometimes a C symbol name is awkward to call directly from Zen C:
- It collides with a Zen C keyword (such as `match`, `def`, `test`, or `guard`).
- It uses a verbose C library prefix (`sqlite3_exec`, `raylib_DrawCircleV`) that you want to expose under a clean, idiomatic Zen C name.

Attach `@link_name("C_Symbol_Name")` to any `extern fn`, `fn`, `struct`, or `enum` to decouple its Zen C identifier from the emitted C linker symbol:

```zenc
@link_name("mock_db_exec")
extern fn execute_query(db: MockDb*, @ctype("const char*") sql: string) -> c_int;

@link_name("abs")
extern fn c_abs(val: c_int) -> c_int;
```

When Zen C compiles `execute_query(db, "SELECT 1;")`, it type-checks the call against `execute_query` and emits `mock_db_exec(db, "SELECT 1;")` in the generated C11 output.

---

## 5. Controlling C Struct Representation (`@crepr`, `@packed`, `@align`)

When passing structs by value or pointer across the Zen C / C boundary, Zen C structs already use standard C field ordering and alignment (`typedef struct Name { ... } Name;`). For specialized C APIs or hardware registers, Zen C provides three layout attributes:

| Attribute | Generated C11 Construct | Purpose |
| :--- | :--- | :--- |
| `@crepr("struct stat")` | Emits `struct stat` instead of typedef `Stat` | Interoperating with POSIX/C APIs that declare `struct tag` without a `typedef`. |
| `@packed` | `struct __attribute__((packed)) Name` | Removes all compiler padding bytes between struct fields (e.g., network headers, binary file formats). |
| `@align(16)` | `struct _Alignas(16) Name` | Forces a minimum byte alignment (must be a power of two) for SIMD buffers or DMA descriptors. |

---

## 6. Exporting Zen C to C (`@export`) and Inline `raw { ... }` Blocks

Interoperability works in both directions:

### Exporting Zen C Functions (`@export`)

To call a Zen C function from C, Python (`ctypes`/`cffi`), Rust, or C#, annotate it with `@export`:

```zenc
@export
fn zc_compute_checksum(a: c_int, b: c_int) -> c_int {
    return (a * 31) + b;
}
```

`@export` ensures the function is emitted with default dynamic symbol visibility (`__attribute__((visibility("default")))`) and an unmangled C symbol name. You can compile your Zen C module into a shared library (`.so` / `.dylib` / `.dll`) using `zc build --shared`:

```bash
$ zc build --shared plugin.zc -o libplugin.so
```

### Embedding Verbatim C (`raw { ... }`)

When you need to define a small C helper function, include a C macro wrapper, or embed a mock C library directly inside a `.zc` file, wrap it in a `raw { ... }` block. Everything inside `raw { ... }` is emitted verbatim into the C11 output.

---

## 7. Complete Runnable Example

The following self-contained example (`examples/ch12/ch12-02-ffi-declarations/main.zc`) demonstrates `raw { ... }`, an opaque `extern struct MockDb;`, `extern fn`, `@link_name`, `@ctype("const char*")`, `extern let`, `defer` cleanup, and `@export`:

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

Run the example with `zc run`:

```bash
$ zc run examples/ch12/ch12-02-ffi-declarations/main.zc
C library version global: 104
Queries executed on opaque MockDb*: 2
c_abs(-42) = 42, zc_compute_checksum(10, 5) = 315
```

---

## 🔍 Peek at the C

Inspecting the generated C11 code shows how `@link_name`, `@ctype`, `defer`, and `@export` translate directly into clean C11:

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
