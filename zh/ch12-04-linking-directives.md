# 12.4 链接与构建指令

在传统的 C 语言项目中，引入头文件仅仅完成了一半工作——你还必须维护一个单独的 `Makefile`、`CMakeLists.txt` 或 `meson.build` 文件，以便将包含目录（`-I`）、库搜索路径（`-L`）、链接器库（`-l`）和预处理器宏（`-D`）传递给编译器。

Zen C 通过**源码内嵌的 `//>` 构建指令**以及 **`@link("file.c")` 属性**消除了这种摩擦。当你运行 `zc build` 或 `zc run` 时，Zen C 编译器会自动扫描你的 `.zc` 入口文件——以及它导入的每一个 `.zc` 模块——并自动组装完整的 C 编译器和链接器命令。

---

## 1. 源码内嵌的 `//>` 构建指令

以 `//>` 开头的任何注释行都会被 Zen C 的构建指令扫描器（`scan_build_directives`）解析。由于 `zc` 也会扫描导入的模块，针对 SQLite、Raylib 或 OpenSSL 的 Zen C 封装模块只需声明一次自己的链接器标志，任何导入该模块的应用程序都会自动继承其链接标志。

| 指令 | 示例 | 对 C 编译器 / 链接器调用的影响 |
| :--- | :--- | :--- |
| `//> link:` | `//> link: -lm -lz` 或 `//> link: m z` | 追加链接器标志（`-lm -lz`）或静态归档库（`./libfoo.a`）。不带 `-` 或文件后缀的裸名称会自动添加 `-l` 前缀。 |
| `//> cflags:` | `//> cflags: -O2 -Wall -mavx2` | 追加自定义编译器标志到 C 编译器调用中。 |
| `//> include:` | `//> include: ./include /opt/include` | 为每个以空格分隔的目录路径添加 `-I<path>`。 |
| `//> lib:` | `//> lib: ./lib /usr/local/lib` | 为每个以空格分隔的目录路径添加 `-L<path>` 库搜索标志。 |
| `//> framework:` | `//> framework: Cocoa IOKit CoreVideo` | 添加 `-framework Cocoa -framework IOKit -framework CoreVideo`（适用于 macOS / Darwin 目标）。 |
| `//> define:` | `//> define: ENABLE_TELEMETRY=1 FAST_CRC` | 向 C 编译器传递 `-DENABLE_TELEMETRY=1 -DFAST_CRC`，**并**为 Zen C 的 `@cfg(...)` 条件编译注册 `ENABLE_TELEMETRY` 和 `FAST_CRC`！ |
| `//> pkg-config:` | `//> pkg-config: zlib sdl2` | 为指定的包运行 `pkg-config --cflags` 和 `pkg-config --libs`，并将它们的标志合并到构建中。 |

---

## 2. 操作系统条件前缀与 `${ENV_VAR}` 展开

### 目标操作系统前缀（`linux:`、`macos:`、`windows:`）

原生 C 库在 Linux、macOS 和 Windows 上通常需要不同的链接器标志。你可以在任何 `//>` 指令前添加操作系统选择器前缀（`linux:`、`macos:` / `darwin:` 或 `windows:`）：

```zenc
// Cross-platform build directives in a single .zc file:
//> linux: link: -lm -lpthread -ldl
//> macos: framework: Cocoa IOKit CoreVideo
//> windows: link: -lgdi32 -lwinmm -lws2_32
```

当 `zc` 在 Linux 上运行时，它会执行 `//> linux:` 指令并忽略 `macos:` 和 `windows:`。

### 环境变量展开（`${VAR}`）

构建指令在解析路径或标志之前还支持 `${ENV_VAR}` 插值。这在 SDK 安装在用户特定目录或 CI 配置目录时尤其有用：

```zenc
//> include: ${OPENSSL_ROOT_DIR}/include
//> lib: ${OPENSSL_ROOT_DIR}/lib
//> link: -lssl -lcrypto
```

如果引用的 `${VAR}` 环境变量未设置，`zc` 会输出描述性的警告（`Warning: Environment variable 'OPENSSL_ROOT_DIR' not found in directive`），以便你立即发现环境配置问题。

---

## 3. 编译伴随 C 文件（`@link("file.c")`）

许多 C 库以单文件或合并（amalgamation）C 源码的形式分发——例如 `sqlite3.c`、`stb_image` 实现文件，或者你自身仓库中的自定义硬件/校验和代码。

无需预先手动将 `.c` 文件编译为 `.o` 目标文件，只需在你的 `.zc` 文件顶层放置 `@link("path/to/file.c")` 属性：

```zenc
@link("examples/ch12/ch12-04-linking-directives/crc16.c")
extern fn compute_crc16_ccitt(@ctype("const uint8_t*") data: u8*, len: usize) -> u16;
```

当 `zc` 解析 `@link("path/to/file.c")` 时，它会解析该路径（检查当前工作目录、项目根目录 `ZC_ROOT` 以及标准库根目录），并将该 `.c` 文件与转译出的 Zen C 代码一同直接传递给 C 编译器。

---

## 4. 完整的可运行示例

让我们看看 `//> cflags:`、`//> link:` 和 `//> define:` 如何与 `@cfg(...)` 条件编译以及 C 语言实现的 CRC-16-CCITT 配合工作（`examples/ch12/ch12-04-linking-directives/main.zc`）：

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

使用 `zc run` 运行该示例：

```bash
$ zc run examples/ch12/ch12-04-linking-directives/main.zc
Telemetry: ACTIVE (enabled via //> define: ENABLE_TELEMETRY=1)
sqrt(2.0) = 1.414214
CRC-16-CCITT("123456789") = 0x29B1
```

---

## 🔍 窥探底层 C 代码

当 `zc` 处理 `//> define: ENABLE_TELEMETRY=1` 时，它既向 C 编译器传递 `-DENABLE_TELEMETRY=1`，又在 C 翻译单元顶部发射 `#define ZC_CFG_ENABLE_TELEMETRY 1`，从而让 `@cfg(ENABLE_TELEMETRY)` 能够保护生成的函数：

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
