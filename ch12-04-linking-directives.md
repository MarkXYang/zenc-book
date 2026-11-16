# Linking and Build Directives

In traditional C projects, importing a header file is only half the battle—you also have to maintain a separate `Makefile`, `CMakeLists.txt`, or `meson.build` file to pass include directories (`-I`), library search paths (`-L`), linker libraries (`-l`), and preprocessor macros (`-D`) to the compiler.

Zen C eliminates this friction with **source-embedded `//>` build directives** and the **`@link("file.c")` attribute**. When you run `zc build` or `zc run`, the Zen C compiler scans your `.zc` entry file—and every `.zc` module it imports—to assemble the complete C compiler and linker command automatically.

---

## 1. Source-Embedded `//>` Build Directives

Any comment line starting with `//>` is parsed by Zen C's build-directive scanner (`scan_build_directives`). Because `zc` scans imported modules as well, a Zen C wrapper module for SQLite, Raylib, or OpenSSL can declare its own linker flags once, and any application that imports that module inherits its link flags automatically.

| Directive | Example | Effect on C Compiler / Linker Invocation |
| :--- | :--- | :--- |
| `//> link:` | `//> link: -lm -lz` or `//> link: m z` | Appends linker flags (`-lm -lz`) or static archives (`./libfoo.a`). Bare names without `-` or a file extension are automatically prefixed with `-l`. |
| `//> cflags:` | `//> cflags: -O2 -Wall -mavx2` | Appends custom compiler flags to the C compiler invocation. |
| `//> include:` | `//> include: ./include /opt/include` | Adds `-I<path>` for each space-separated directory path. |
| `//> lib:` | `//> lib: ./lib /usr/local/lib` | Adds `-L<path>` library search flags for each space-separated directory path. |
| `//> framework:` | `//> framework: Cocoa IOKit CoreVideo` | Adds `-framework Cocoa -framework IOKit -framework CoreVideo` (for macOS / Darwin targets). |
| `//> define:` | `//> define: ENABLE_TELEMETRY=1 FAST_CRC` | Passes `-DENABLE_TELEMETRY=1 -DFAST_CRC` to the C compiler **and** registers `ENABLE_TELEMETRY` and `FAST_CRC` for Zen C `@cfg(...)` conditional compilation! |
| `//> pkg-config:` | `//> pkg-config: zlib sdl2` | Runs `pkg-config --cflags` and `pkg-config --libs` for the specified packages and merges their flags into the build. |

---

## 2. OS-Conditional Prefixes and `${ENV_VAR}` Expansion

### Target OS Prefixes (`linux:`, `macos:`, `windows:`)

Native C libraries often require different linker flags on Linux, macOS, and Windows. You can prefix any `//>` directive with an operating system selector (`linux:`, `macos:` / `darwin:`, or `windows:`):

```zenc
// Cross-platform build directives in a single .zc file:
//> linux: link: -lm -lpthread -ldl
//> macos: framework: Cocoa IOKit CoreVideo
//> windows: link: -lgdi32 -lwinmm -lws2_32
```

When `zc` runs on Linux, it executes the `//> linux:` directives and ignores `macos:` and `windows:`.

### Environment Variable Expansion (`${VAR}`)

Build directives also support `${ENV_VAR}` interpolation before parsing paths or flags. This is especially useful when SDKs are installed in user-specific or CI-configured locations:

```zenc
//> include: ${OPENSSL_ROOT_DIR}/include
//> lib: ${OPENSSL_ROOT_DIR}/lib
//> link: -lssl -lcrypto
```

If an environment variable referenced by `${VAR}` is not set, `zc` emits a descriptive warning (`Warning: Environment variable 'OPENSSL_ROOT_DIR' not found in directive`) so you can spot misconfigured environments immediately.

---

## 3. Compiling Companion C Files (`@link("file.c")`)

Many C libraries are distributed as single-file or amalgamation C sources—such as `sqlite3.c`, `stb_image` implementation files, or custom hardware/checksum routines in your own repository.

Instead of compiling `.c` files manually into `.o` object files first, place the `@link("path/to/file.c")` attribute at the top level of your `.zc` file:

```zenc
@link("examples/ch12/ch12-04-linking-directives/crc16.c")
extern fn compute_crc16_ccitt(@ctype("const uint8_t*") data: u8*, len: usize) -> u16;
```

When `zc` parses `@link("path/to/file.c")`, it resolves the path (checking the current working directory, the project root `ZC_ROOT`, and the standard library root) and passes the `.c` file directly to the C compiler alongside the transpiled Zen C code.

---

## 4. Complete Runnable Example

Let's see how `//> cflags:`, `//> link:`, and `//> define:` work together with `@cfg(...)` conditional compilation and a C CRC-16-CCITT implementation (`examples/ch12/ch12-04-linking-directives/main.zc`):

```zenc
// File: examples/ch12/ch12-04-linking-directives/main.zc
// 1. Source-embedded build directives
//> cflags: -O2 -Wall
//> link: -lm
//> define: ENABLE_TELEMETRY=1

import "math.h" as c_math;

// 2. Conditional compilation driven by //> define: ENABLE_TELEMETRY=1
@cfg(ENABLE_TELEMETRY)
fn telemetry_banner() -> string {
    return "Telemetry: ACTIVE (enabled via //> define: ENABLE_TELEMETRY=1)";
}

@cfg(not(ENABLE_TELEMETRY))
fn telemetry_banner() -> string {
    return "Telemetry: DISABLED";
}

// 3. Companion C implementation (or linked via @link("crc16.c"))
raw {
    uint16_t compute_crc16_inline(const uint8_t* data, size_t len) {
        uint16_t crc = 0xFFFF;
        for (size_t i = 0; i < len; i++) {
            crc ^= (uint16_t)data[i] << 8;
            for (int bit = 0; bit < 8; bit++) {
                if (crc & 0x8000) {
                    crc = (uint16_t)((crc << 1) ^ 0x1021);
                } else {
                    crc = (uint16_t)(crc << 1);
                }
            }
        }
        return crc;
    }
}

extern fn compute_crc16_inline(@ctype("const uint8_t*") data: u8*, len: usize) -> u16;

fn main() {
    println "{telemetry_banner()}";

    // Linked against libm (-lm) via //> link: -lm
    let root2: f64 = c_math::sqrt(2.0);
    println "sqrt(2.0) = {root2}";
    assert(root2 > 1.414 && root2 < 1.415, "sqrt(2.0) should be ~1.4142");

    // Calling our C CRC-16-CCITT implementation on ASCII "123456789"
    let payload: u8[9] = [49, 50, 51, 52, 53, 54, 55, 56, 57];
    let crc: u16 = compute_crc16_inline(&payload[0], 9);
    println "CRC-16-CCITT(\"123456789\") = 0x{crc:X}";
    assert(crc == 0x29B1, "Standard CRC-16-CCITT of '123456789' is 0x29B1");
}
```

Run the example with `zc run`:

```bash
$ zc run examples/ch12/ch12-04-linking-directives/main.zc
Telemetry: ACTIVE (enabled via //> define: ENABLE_TELEMETRY=1)
sqrt(2.0) = 1.414214
CRC-16-CCITT("123456789") = 0x29B1
```

---

## 🔍 Peek at the C

When `zc` processes `//> define: ENABLE_TELEMETRY=1`, it both passes `-DENABLE_TELEMETRY=1` to the C compiler and emits `#define ZC_CFG_ENABLE_TELEMETRY 1` at the top of the C translation unit so `@cfg(ENABLE_TELEMETRY)` guards the generated functions:

```c
// Emitted from `//> define: ENABLE_TELEMETRY=1`:
#ifndef ZC_CFG_ENABLE_TELEMETRY
#define ZC_CFG_ENABLE_TELEMETRY 1
#endif

// Emitted from `@cfg(ENABLE_TELEMETRY)` and `@cfg(not(ENABLE_TELEMETRY))`:
#if defined(ZC_CFG_ENABLE_TELEMETRY)
ZC_FUNC string telemetry_banner(void)
{
    return "Telemetry: ACTIVE (enabled via //> define: ENABLE_TELEMETRY=1)";
}
#endif

#if !defined(ZC_CFG_ENABLE_TELEMETRY)
ZC_FUNC string telemetry_banner(void)
{
    return "Telemetry: DISABLED";
}
#endif
```
