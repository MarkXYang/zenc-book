# C 头文件导入与包含

在 Zen C 中使用 C 语言库时，首要问题是如何将 `.h` 头文件引入你的程序。Zen C 提供了两个用于使用 C 头文件的关键字——`import` 和 `include`——各自适用于不同的工作流。

> [!WARNING]
> 不要在一个 `.zc` 文件的顶层编写原生 C 预处理器指令 `#include <stdio.h>` 或 `#define`。Zen C 编译器在 `.zc` 源码中已弃用原生 `#include` 和 `#define` 行（`warning: Preprocessor directive '#include' is deprecated. Use 'import' instead.`）。请始终使用 `import "header.h"`、`include <header.h>` 或 `def` 常量替代。

---

## 1. 带命名空间的 C 头文件导入（`import "header.h" as alias`）

使用 C 头文件且不污染当前文件全局命名空间的最清晰方式是 `import "header.h" as alias;`：

```zenc
//> link: -lm
import "math.h" as c_math;
import "stdio.h" as c_io;

fn main() {
    let angle: f64 = 0.0;
    let c: f64 = c_math::cos(angle);
    println "cos({angle}) = {c}";

    let fp: c_io::FILE* = c_io::fopen("test.txt", "r");
    if fp != NULL {
        c_io::fclose(fp);
    }
}
```

### C 头文件命名空间的底层工作原理

当 `zc` 遇到 `import "math.h" as c_math;`（任何以 `.h` 结尾的导入路径）时，它会创建一个标记为 **C 头文件模块**（`is_c_header = 1`）的特殊模块条目：

1. **发射头文件**：代码生成器在生成的 C 前导部分发射 `#include "math.h"`。（在 C11 中，`#include "math.h"` 首先在本地目录搜索，然后自动回退到系统包含路径，如 `/usr/include/math.h`）。
2. **未修饰符号解析**：对于普通的 Zen C 模块，`math::cos(x)` 会被名称修饰（name-mangled）为 `math__cos(x)`。因为 `c_math` 是一个 C 头文件模块，`zc` 会剥离 `c_math::` 前缀，并直接发射**精确、未修饰的 C 标识符** `cos(x)`（或针对 `c_io::FILE*` 发射 `FILE*`）。
3. **自动符号注册**：通过 `c_math::...` 访问的每个符号都会自动注册到编译器的外部符号表中，因此前端不会报告未声明标识符的错误。

> [!TIP]
> 如果你仅仅希望在生成的 C 文件中发射 `#include "header.h"`，同时在下方显式声明 `extern fn` 签名，也可以直接书写不带 `as` 别名的 `import "header.h";`。

---

## 2. 系统头文件包含与本地头文件包含（`include`）

Zen C 还提供了两种形式的 `include` 关键字：

### 尖括号系统包含（`include <header.h>`）

```zenc
include <stdlib.h>
include <stdarg.h>
```

`include <header.h>` 会逐字将 `#include <header.h>` 发射到生成的 C 前导部分中。由于系统头文件通常依赖复杂的编译器特定宏和内置函数，`zc` 会将解析 `<header.h>` 的工作留给底层的 C 编译器，并期望你通过显式的 `extern fn` 声明、标准库内置项或 `zenc.json` 白名单来引用符号。

### 双引号本地包含（`include "local.h"`）与自动扫描

```zenc
include "sensor_hal.h"
```

当你使用双引号书写 `include "sensor_hal.h"` 时，`zc` 不仅仅只是发射 `#include "sensor_hal.h"`。如果 `"sensor_hal.h"` 在磁盘上相对于你的 `.zc` 文件或项目根目录存在，Zen C 解析器会在编译期对该文件运行其内置的**轻量级 C 头文件扫描器**（`scan_c_header_contents`），并将三类 C 声明自动导入到 Zen C 的符号表中：

| `"local.h"` 中的 C 结构 | Zen C 如何注册它 |
| :--- | :--- |
| `#define HAL_MAX_CHANNELS 8` | 注册为编译期 `def` 整数常量（`HAL_MAX_CHANNELS = 8`），可在 Zen C 表达式和数组边界中使用。 |
| `struct Name`、`union Name` 或 `typedef struct { ... } Alias;` | 注册到 Zen C 的结构体/类型表中，以便你可以直接构造 `Alias{ ... }` 字面量并声明 `Alias*` 指针。 |
| `double hal_apply_calibration(HalCalibration cal, int raw_adc);` | 注册到 Zen C 的函数签名表中并附带映射好的返回类型（`f64`），允许进行类型推断（`let r = hal_apply_calibration(...)`），而无需编写 `extern fn`。 |

---

## 3. 在 `zenc.json` 中配置项目级白名单

如果你的项目在许多 `.zc` 文件中频繁调用系统头文件中的特定 C 函数或使用 C typedef，可以在项目根目录下的 `zenc.json`（或 `.zenc.json`）配置文件中进行一次性注册：

```json
{
    "cflags": "-O2 -Wall",
    "ldflags": "-lz -lm",
    "c_functions": [
        "compress2",
        "uncompress",
        "crc32"
    ],
    "c_types": [
        "z_stream",
        "Bytef",
        "uLongf"
    ]
}
```

当 `zc` 启动时，它会读取 `zenc.json` 并将 `"c_functions"` 中的每个条目预注册为外部函数，将 `"c_types"` 中的每个条目预注册为构建中所有模块可见的已知外部 C 类型。

---

## 4. 完整的可运行示例

让我们将带命名空间的 C 头文件导入（`import "math.h" as c_math` 和 `import "string.h" as c_str`）与本地硬件抽象头文件（`include "sensor_hal.h"`）结合起来。

首先是伴随的 C 头文件（`examples/ch12/ch12-01-c-headers/sensor_hal.h`）：

```c
// File: examples/ch12/ch12-01-c-headers/sensor_hal.h
#ifndef SENSOR_HAL_H
#define SENSOR_HAL_H

#define HAL_MAX_CHANNELS 8
#define HAL_STATUS_OK    0

typedef struct {
    int channel;
    double scale;
    double offset;
} HalCalibration;

static inline double hal_apply_calibration(HalCalibration cal, int raw_adc) {
    return ((double)raw_adc * cal.scale) + cal.offset;
}

#endif
```

下面是使用系统头文件和 `"sensor_hal.h"` 的 Zen C 程序（`examples/ch12/ch12-01-c-headers/main.zc`）：

```zenc
// File: examples/ch12/ch12-01-c-headers/main.zc
//> link: -lm

// 1. Namespaced C header imports
import "math.h" as c_math;
import "string.h" as c_str;

// 2. Local C header include (auto-scans C constants, typedefs, and functions)
include "sensor_hal.h"

fn main() {
    // Calling C math library functions via module namespace
    let side_a: f64 = 3.0;
    let side_b: f64 = 4.0;
    let hyp: f64 = c_math::hypot(side_a, side_b);
    println "hypot({side_a}, {side_b}) = {hyp}";
    assert(hyp == 5.0, "3-4-5 right triangle hypotenuse must be 5.0");

    // Calling C string functions via module namespace
    let label = "Zen C FFI";
    let len: usize = c_str::strlen(label);
    println "strlen(\"{label}\") = {len}";
    assert(len == 9, "Length of 'Zen C FFI' should be 9");

    // Using constants, structs, and functions discovered from "sensor_hal.h"
    let max_ch: int = HAL_MAX_CHANNELS;
    println "HAL_MAX_CHANNELS = {max_ch}, status = {HAL_STATUS_OK}";
    assert(max_ch == 8, "Expected 8 channels from #define");

    let cal = HalCalibration{
        channel: 1,
        scale: 0.025,
        offset: -10.0,
    };
    let reading: f64 = hal_apply_calibration(cal, 1200);
    println "Calibrated Ch#{cal.channel}: {reading} C";
    assert(reading == 20.0, "1200 * 0.025 - 10.0 should equal 20.0");
}
```

使用 `zc run` 运行该示例：

```bash
$ zc run examples/ch12/ch12-01-c-headers/main.zc
hypot(3.000000, 4.000000) = 5.000000
strlen("Zen C FFI") = 9
HAL_MAX_CHANNELS = 8, status = 0
Calibrated Ch#1: 20.000000 C
```

---

## 🔍 窥探底层 C 代码

当 `zc` 转译 `examples/ch12/ch12-01-c-headers/main.zc` 时，它会在 C 翻译单元顶部发射 `#include` 指令，将 `c_math::` 和 `c_str::` 命名空间前缀去除并转为直接的 C 调用（`hypot(...)`、`strlen(...)`），折叠 `HAL_MAX_CHANNELS`（`8`）和 `HAL_STATUS_OK`（`0`），并将 `HalCalibration` 构造为 C99 复合字面量：

```c
// Emitted from `import "math.h" as c_math;` and `import "string.h" as c_str;`
#include "math.h"
#include "string.h"

// Emitted from `include "sensor_hal.h"`
#include "sensor_hal.h"

ZC_FUNC int main(void)
{
    double side_a = 3.0;
    double side_b = 4.0;
    // c_math::hypot(...) -> direct unmangled call to C's hypot()
    double hyp = hypot(side_a, side_b);

    string label = "Zen C FFI";
    // c_str::strlen(...) -> direct unmangled call to C's strlen()
    usize len = strlen(label);

    // HAL_MAX_CHANNELS auto-scanned from #define in sensor_hal.h
    int max_ch = 8;

    // HalCalibration struct literal -> zero-overhead C compound literal
    HalCalibration cal = (HalCalibration){.channel = 1, .scale = 0.025, .offset = (-10.0)};
    double reading = hal_apply_calibration(cal, 1200);
}
```
