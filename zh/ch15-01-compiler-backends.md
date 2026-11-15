# 15.1 配置编译器后端

`zc` 本身并不直接生成机器码。在将程序转译为 C 之后，它会调用一个**后端 C 编译器**。因为生成的 C 代码是可移植的 GNU C11，所以你可以从多个编译器中进行选择——并向它们传递你在 C 项目中常用的相同标志。

---

## 1. 查看 `zc` 实际运行的命令

`-v`（`--verbose`）标志会打印每个阶段的详细信息，包括准确的 C 编译器命令行：

```console
$ zc build -v main.zc -o app
   Compiling main.zc...
     Command gcc -Wno-parentheses -Wno-unused-value -Wno-unused-variable -Wno-unused-parameter -Wno-unused-function -Wno-unused-but-set-variable -Wno-sign-compare -Wno-missing-field-initializers -o app app.c -lm -I/usr/local/share/zenc ...
    Finished build in 0.22s with 0 errors and 0 warnings
```

从这一行命令中你可以了解到很多信息：

- 默认后端是 **`gcc`**。
- `zc` 将生成的 C 代码写入一个以你的输出目标命名的临时文件（`app.c`），并在成功构建后将其删除。添加 `--emit-c` 标志可以保留该文件。
- `zc` 静默了生成代码无害触发的少量警告（`-Wno-unused-value` 等）。
- **默认不传递 `-O` 标志**，因此普通的 `zc build` 会生成未优化的二进制文件。如果需要优化，请显式指定（见下文）。
- 类似 `-lm` 的库以及标准库包含路径会自动追加在命令后。

---

## 2. 使用 `--cc` 选择 C 编译器

```console
$ zc build main.zc --cc gcc   -o app    # default
$ zc build main.zc --cc clang -o app
$ zc build main.zc --cc zig   -o app    # shorthand for "zig cc"
$ zc build main.zc --cc tcc   -o app    # Tiny C Compiler: very fast builds
```

| 编译器 | 优势 | 注意事项 |
| :--- | :--- | :--- |
| **GCC** | 参考后端；通过了 Zen C 的完整测试套件。 | 默认选用。 |
| **Clang** | 拥有出色的诊断信息、sanitizer 支持以及 LLVM 优化器。 | 完整测试套件支持。 |
| **Zig (`zig cc`)** | 可直接替代 Clang，内置交叉编译目标和 libc 头文件。 | 首次构建较慢，因为 Zig 需要填充缓存（在我们的机器上约 20 秒）；随后的构建非常迅速。 |
| **TCC** | 编译速度几乎瞬时完成，非常适合快速的“编辑-运行”循环。 | 约 98% 的特性可用。不支持 Intel 内联汇编和 `__attribute__((constructor))`。 |
| **cosmocc** | 生成真正可移植的可执行文件（Actually Portable Executables）。 | 参见 [15.3 节](ch15-03-portable-ape.md)。 |

> [!NOTE]
> `--cc` 接受任何命令名称或路径。`zc` 只是在命令行中用它替换 `gcc`，因此像 `--cc aarch64-linux-gnu-gcc` 这样的交叉编译器也能正常工作。

---

## 3. 优化、调试信息与 `--release`

| 标志 | 对生成 C 代码的影响 | 对 C 编译器的影响 |
| :--- | :--- | :--- |
| *(无)* | 发射将 C 代码映射回 `.zc` 代码行的 `#line` 指令 | 无 `-O` 标志，因此构建未优化 |
| `-O0` ... `-O3`, `-Os` | — | 原样转发（`-O3`、`-Os` 等） |
| `-g` | 发射 `#line` 指令（此为默认行为） | — |
| `-g0` | **省略** `#line` 指令（生成的 C 代码更清爽易读） | — |
| `--release` | 与 `-g0` 相同 | 添加 `-O3` |
| `-ggdb`, `-fsanitize=address`, `-march=native`, ... | — | 未知的 `-f…`、`-m…` 等标志会被转发给 C 编译器 |

`#line` 指令的作用是让编译器错误、调试器和崩溃回溯信息指向你的 `.zc` 文件，而不是生成的 C 文件。要为 GDB 或 LLDB 获取完整的 DWARF 调试信息，可以转发 C 编译器的调试标志：

```console
$ zc build main.zc -ggdb -O0 -o app
$ file app
app: ELF 64-bit LSB pie executable, x86-64, ..., with debug_info, not stripped
$ gdb ./app        # breakpoints like "break main.zc:42" work thanks to #line
```

---

## 4. 预处理器宏、包含路径与库

这些标志的行为与它们的 C 语言对应项完全一致，并会被转发给后端：

| 标志 | 含义 |
| :--- | :--- |
| `-DNAME` / `-DNAME=value` | 定义一个预处理器宏 |
| `-I <dir>` | 添加头文件搜索路径（也用于解析 Zen C 导入） |
| `-L <dir>` | 添加库搜索路径 |
| `-l<name>` | 链接 `lib<name>` |

> [!TIP]
> Shell 会去除引号，因此 `-DAPP_VERSION="1.2.0"` 到达 C 编译器时会变成裸标记 `1.2.0`。你可以转义引号（`'-DAPP_VERSION="1.2.0"'`），或者在 C 内部将标记字符串化，正如示例 15-1 中使用 `ZC_STR(APP_VERSION)` 所做的那样。

---

## 5. 构建指令：驻留在源码中的标志

在每次命令行调用中都记住 `-lm -lraylib -I./include` 是非常脆弱且易出错的。Zen C 允许你使用**构建指令（build directives）**将这些标志嵌入到源文件中——即以 `//>` 开头的注释。`zc` 会在编译之前扫描它们：

| 指令 | 示例 | 等价命令 |
| :--- | :--- | :--- |
| `//> link:` | `//> link: -lm` | 链接库或目标文件 |
| `//> lib:` | `//> lib: ./libs` | `-L ./libs` |
| `//> include:` | `//> include: ./include` | `-I ./include` |
| `//> define:` | `//> define: USE_FAST_MATH` | `-DUSE_FAST_MATH` |
| `//> cflags:` | `//> cflags: -Wall -O2` | 传递任意 C 编译器标志 |
| `//> pkg-config:` | `//> pkg-config: gtk+-3.0` | 追加 `pkg-config --cflags --libs` |
| `//> framework:` | `//> framework: Cocoa` | macOS framework 链接 |
| `//> shell:` | `//> shell: make -C vendor` | 在构建期间运行命令 |
| `//> get:` | `//> get: https://.../stb_image.h` | 如果文件不存在则下载 |

两项特性使得构建指令在编写跨平台代码时尤为强大：

- **操作系统保护（OS guards）**——为指令添加 `linux:`、`macos:`（或 `darwin:`）或 `windows:` 前缀，使其仅在对应平台上生效：
  ```zenc
  //> linux: link: -lm
  //> windows: link: -lws2_32
  //> macos: framework: Cocoa
  ```
- **环境变量展开**——`${VAR}` 会被替换为该环境变量的值：
  ```zenc
  //> include: ${HOME}/mylib/include
  ```

---

## 6. 融会贯通

示例 15-1 结合了构建指令、`-D` 宏以及一个用于检查当前构建编译器预定义宏的 `raw` C 块。尝试使用不同的后端和标志构建它，观察输出的变化。

**示例 15-1: `list15-1.zc` —— 检测后端编译器、操作系统和构建标志**

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

使用默认配置（`gcc`，无优化）：

```console
$ zc run -q examples/ch15/ch15-01-compiler-backends/main.zc
App version : dev
Target OS   : linux
C backend   : gcc
Optimization: unoptimized (-O0)
hypot(3, 4) = 5.000000
```

切换到 Clang 并启用优化和版本宏：

```console
$ zc build -q examples/ch15/ch15-01-compiler-backends/main.zc --cc clang -O2 -DAPP_VERSION=1.2.0 -o app
$ ./app
App version : 1.2.0
Target OS   : linux
C backend   : clang (or zig cc)
Optimization: optimized
hypot(3, 4) = 5.000000
```

注意程序输出了 `Target OS: linux`，即使在命令行中并没有给出任何 `-D` 标志。`//> linux: define: ZC_OS_LINUX` 指令为我们完成了这项工作，而在 macOS 或 Windows 上，相应的指令则会生效。

---

## 小结

- `zc` 转译为 C 代码，然后调用后端 C 编译器。使用 `-v` 查看确切的命令。
- 使用 `--cc gcc | clang | zig | tcc | cosmocc`（或任何编译器路径）切换编译器。
- 构建**默认未优化**。使用 `-O2`/`-O3` 或 `--release`。
- `-g`（默认）保留指向 `.zc` 源码的 `#line` 映射。`-g0` 和 `--release` 会去掉它们。转发 `-ggdb` 获取 DWARF 调试信息。
- 将每个文件的链接标志、包含路径和宏放在 `//>` 构建指令中，必要时使用操作系统前缀进行保护。
