# 15.1 Configuring Compiler Backends

`zc` does not generate machine code itself. After transpiling your program to C, it invokes a **backend C compiler**. Because the generated C is portable GNU C11, you can choose from several compilers — and pass them the same flags you would in a C project.

---

## 1. Seeing What `zc` Actually Runs

The `-v` (`--verbose`) flag prints every phase, including the exact C compiler command line:

```console
$ zc build -v main.zc -o app
   Compiling main.zc...
     Command gcc -Wno-parentheses -Wno-unused-value -Wno-unused-variable -Wno-unused-parameter -Wno-unused-function -Wno-unused-but-set-variable -Wno-sign-compare -Wno-missing-field-initializers -o app app.c -lm -I/usr/local/share/zenc ...
    Finished build in 0.22s with 0 errors and 0 warnings
```

From that one line you can learn a lot:

- The default backend is **`gcc`**.
- `zc` writes the generated C to a temporary file named after your output (`app.c`) and deletes it after a successful build. Add `--emit-c` to keep it.
- `zc` silences a handful of warnings that the generated code triggers harmlessly (`-Wno-unused-value`, ...).
- **No `-O` flag is passed by default**, so a plain `zc build` produces an unoptimized binary. Ask for optimization explicitly (see below).
- Libraries such as `-lm` and the standard library include paths are appended automatically.

---

## 2. Choosing a C Compiler with `--cc`

```console
$ zc build main.zc --cc gcc   -o app    # default
$ zc build main.zc --cc clang -o app
$ zc build main.zc --cc zig   -o app    # shorthand for "zig cc"
$ zc build main.zc --cc tcc   -o app    # Tiny C Compiler: very fast builds
```

| Compiler | Strengths | Notes |
| :--- | :--- | :--- |
| **GCC** | The reference backend; passes the full Zen C test suite. | Default. |
| **Clang** | Excellent diagnostics, sanitizers, and the LLVM optimizer. | Full test-suite support. |
| **Zig (`zig cc`)** | Drop-in Clang with built-in cross-compilation targets and libc headers. | The very first build is slow while Zig fills its cache (about 20 seconds on our machine); later builds are fast. |
| **TCC** | Compiles almost instantly, which is great for quick edit-run loops. | About 98% of features work. No Intel inline assembly and no `__attribute__((constructor))`. |
| **cosmocc** | Produces Actually Portable Executables. | See [15.3](ch15-03-portable-ape.md). |

> [!NOTE]
> `--cc` accepts any command name or path. `zc` simply substitutes it for `gcc` in the command line, so a cross compiler such as `--cc aarch64-linux-gnu-gcc` works too.

---

## 3. Optimization, Debug Info, and `--release`

| Flag | Effect on the generated C | Effect on the C compiler |
| :--- | :--- | :--- |
| *(none)* | Emits `#line` directives mapping C back to `.zc` lines | No `-O` flag, so the build is unoptimized |
| `-O0` ... `-O3`, `-Os` | — | Forwarded as-is (`-O3`, `-Os`, ...) |
| `-g` | Emits `#line` directives (this is the default) | — |
| `-g0` | **Omits** `#line` directives (cleaner C to read) | — |
| `--release` | Same as `-g0` | Adds `-O3` |
| `-ggdb`, `-fsanitize=address`, `-march=native`, ... | — | Unknown `-f…`, `-m…`, and other flags are forwarded to the C compiler |

The `#line` directives are what let compiler errors, debuggers, and crash backtraces point at your `.zc` file instead of the generated C. To get full DWARF debug information for GDB or LLDB, forward a C compiler debug flag:

```console
$ zc build main.zc -ggdb -O0 -o app
$ file app
app: ELF 64-bit LSB pie executable, x86-64, ..., with debug_info, not stripped
$ gdb ./app        # breakpoints like "break main.zc:42" work thanks to #line
```

---

## 4. Preprocessor Macros, Include Paths, and Libraries

These flags behave exactly like their C counterparts and are forwarded to the backend:

| Flag | Meaning |
| :--- | :--- |
| `-DNAME` / `-DNAME=value` | Define a preprocessor macro |
| `-I <dir>` | Add a header search path (also used to resolve Zen C imports) |
| `-L <dir>` | Add a library search path |
| `-l<name>` | Link against `lib<name>` |

> [!TIP]
> Shells strip quotes, so `-DAPP_VERSION="1.2.0"` reaches the C compiler as the bare token `1.2.0`. Either escape the quotes (`'-DAPP_VERSION="1.2.0"'`) or stringify the token in C, as Listing 15-1 does with `ZC_STR(APP_VERSION)`.

---

## 5. Build Directives: Flags That Live in Your Source

Remembering `-lm -lraylib -I./include` on every command line is fragile. Zen C lets you embed those flags in the source file with **build directives** — comments that start with `//>`. `zc` scans them before compiling:

| Directive | Example | Equivalent |
| :--- | :--- | :--- |
| `//> link:` | `//> link: -lm` | Link a library or object file |
| `//> lib:` | `//> lib: ./libs` | `-L ./libs` |
| `//> include:` | `//> include: ./include` | `-I ./include` |
| `//> define:` | `//> define: USE_FAST_MATH` | `-DUSE_FAST_MATH` |
| `//> cflags:` | `//> cflags: -Wall -O2` | Pass arbitrary C compiler flags |
| `//> pkg-config:` | `//> pkg-config: gtk+-3.0` | Append `pkg-config --cflags --libs` |
| `//> framework:` | `//> framework: Cocoa` | macOS framework linking |
| `//> shell:` | `//> shell: make -C vendor` | Run a command during the build |
| `//> get:` | `//> get: https://.../stb_image.h` | Download a file if it does not exist yet |

Two features make directives especially useful for cross-platform code:

- **OS guards** — prefix a directive with `linux:`, `macos:` (or `darwin:`), or `windows:` to apply it only on that platform:
  ```zenc
  //> linux: link: -lm
  //> windows: link: -lws2_32
  //> macos: framework: Cocoa
  ```
- **Environment expansion** — `${VAR}` is replaced with the environment variable's value:
  ```zenc
  //> include: ${HOME}/mylib/include
  ```

---

## 6. Putting It Together

Listing 15-1 combines build directives, `-D` macros, and a `raw` C block that checks the predefined macros of whichever compiler is building it. Build it with different backends and flags to watch the output change.

**Listing 15-1: `list15-1.zc` — Detecting the backend compiler, OS, and build flags**

```zenc
// File: examples/ch15/ch15-01-compiler-backends/main.zc
//
// Build directives: zc reads these `//>` comments before compiling and
// forwards them to the backend C compiler.
//> link: -lm
//> linux: define: ZC_OS_LINUX
//> macos: define: ZC_OS_MACOS
//> windows: define: ZC_OS_WINDOWS

include <math.h>

// A raw C block can inspect the predefined macros of whichever backend
// compiler (`--cc`) is used to build the generated C file.
raw {
    // Turn a bare token such as `-DAPP_VERSION=1.2.0` into the string "1.2.0".
    #define ZC_STR_(x) #x
    #define ZC_STR(x) ZC_STR_(x)

    static const char *app_version(void) {
        #ifdef APP_VERSION
        return ZC_STR(APP_VERSION);
        #else
        return "dev";
        #endif
    }

    static const char *target_os(void) {
        #if defined(ZC_OS_LINUX)
        return "linux";
        #elif defined(ZC_OS_MACOS)
        return "macos";
        #elif defined(ZC_OS_WINDOWS)
        return "windows";
        #else
        return "unknown";
        #endif
    }

    static const char *backend_name(void) {
        #if defined(__TINYC__)
        return "tcc";
        #elif defined(__clang__)
        return "clang (or zig cc)";
        #elif defined(__GNUC__)
        return "gcc";
        #else
        return "unknown C compiler";
        #endif
    }

    static const char *opt_mode(void) {
        #if defined(__OPTIMIZE__)
        return "optimized";
        #else
        return "unoptimized (-O0)";
        #endif
    }
}

extern fn app_version() -> const char*;
extern fn target_os() -> const char*;
extern fn backend_name() -> const char*;
extern fn opt_mode() -> const char*;

fn main() {
    println "App version : {app_version()}";
    println "Target OS   : {target_os()}";
    println "C backend   : {backend_name()}";
    println "Optimization: {opt_mode()}";

    // sqrt comes from libm, linked via the `//> link: -lm` directive.
    let hyp = sqrt(3.0 * 3.0 + 4.0 * 4.0);
    println "hypot(3, 4) = {hyp}";
}
```

With the defaults (`gcc`, no optimization):

```console
$ zc run -q examples/ch15/ch15-01-compiler-backends/main.zc
App version : dev
Target OS   : linux
C backend   : gcc
Optimization: unoptimized (-O0)
hypot(3, 4) = 5.000000
```

Switching to Clang with optimization and a version macro:

```console
$ zc build -q examples/ch15/ch15-01-compiler-backends/main.zc --cc clang -O2 -DAPP_VERSION=1.2.0 -o app
$ ./app
App version : 1.2.0
Target OS   : linux
C backend   : clang (or zig cc)
Optimization: optimized
hypot(3, 4) = 5.000000
```

Notice that the program reports `Target OS: linux` even though no `-D` flag was given on the command line. The `//> linux: define: ZC_OS_LINUX` directive did that for us, and on macOS or Windows the matching directive would apply instead.

---

## Summary

- `zc` transpiles to C and then calls a backend C compiler. Use `-v` to see the exact command.
- Switch compilers with `--cc gcc | clang | zig | tcc | cosmocc` (or any compiler path).
- Builds are **unoptimized by default**. Use `-O2`/`-O3` or `--release`.
- `-g` (the default) keeps `#line` mappings to your `.zc` source. `-g0` and `--release` drop them. Forward `-ggdb` for DWARF debug info.
- Put per-file link flags, include paths, and macros in `//>` build directives, guarded by OS when needed.
