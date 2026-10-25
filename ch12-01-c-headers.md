# 12.1 C Header Imports vs Includes

When working with C libraries in Zen C, the first question is how to bring a `.h` header file into your program. Zen C provides two keywords for consuming C headers—`import` and `include`—each designed for a distinct workflow.

> [!WARNING]
> Do not write raw C preprocessor `#include <stdio.h>` or `#define` directives at the top level of a `.zc` file. The Zen C compiler deprecates raw `#include` and `#define` lines in `.zc` source (`warning: Preprocessor directive '#include' is deprecated. Use 'import' instead.`). Always use `import "header.h"`, `include <header.h>`, or `def` constants instead.

---

## 1. Namespaced C Header Imports (`import "header.h" as alias`)

The cleanest way to consume a C header without polluting your file's global namespace is `import "header.h" as alias;`:

```zc
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

### How C Header Namespaces Work Under the Hood

When `zc` sees `import "math.h" as c_math;` (any import path ending in `.h`), it creates a special module entry marked as a **C header module** (`is_c_header = 1`):

1. **Header Emission**: The code generator emits `#include "math.h"` in the C preamble. (In C11, `#include "math.h"` searches local directories first and automatically falls back to system include paths like `/usr/include/math.h`).
2. **Unmangled Symbol Resolution**: For normal Zen C modules, `math::cos(x)` is name-mangled into `math__cos(x)`. Because `c_math` is a C header module, `zc` strips the `c_math::` prefix and emits the **exact, unmangled C identifier** `cos(x)` (or `FILE*` for `c_io::FILE*`).
3. **Automatic Symbol Registration**: Every symbol accessed through `c_math::...` is automatically registered in the compiler's external symbol table so the frontend does not complain about undeclared identifiers.

> [!TIP]
> You can also write `import "header.h";` without an `as` alias if you simply want `#include "header.h"` emitted in the generated C file while declaring explicit `extern fn` signatures below it.

---

## 2. System vs. Local Header Includes (`include`)

Zen C also provides the `include` keyword in two forms:

### Angle-Bracket System Includes (`include <header.h>`)

```zc
include <stdlib.h>
include <stdarg.h>
```

`include <header.h>` emits `#include <header.h>` verbatim into the generated C preamble. Because system headers often rely on complex compiler-specific macros and intrinsics, `zc` leaves parsing `<header.h>` to the underlying C compiler and expects you to reference symbols either via explicit `extern fn` declarations, standard library builtins, or `zenc.json` whitelists.

### Quoted Local Includes (`include "local.h"`) and Auto-Scanning

```zc
include "sensor_hal.h"
```

When you write `include "sensor_hal.h"` with double quotes, `zc` does more than just emit `#include "sensor_hal.h"`. If `"sensor_hal.h"` exists on disk relative to your `.zc` file or project root, the Zen C parser runs its built-in **lightweight C header scanner** (`scan_c_header_contents`) on the file at compile time and automatically imports three categories of C declarations into Zen C's symbol table:

| C Construct in `"local.h"` | How Zen C Registers It |
| :--- | :--- |
| `#define HAL_MAX_CHANNELS 8` | Registered as a compile-time `def` integer constant (`HAL_MAX_CHANNELS = 8`) usable in Zen C expressions and array bounds. |
| `struct Name`, `union Name`, or `typedef struct { ... } Alias;` | Registered in Zen C's struct/type table so you can construct `Alias{ ... }` literals and declare `Alias*` pointers directly. |
| `double hal_apply_calibration(HalCalibration cal, int raw_adc);` | Registered in Zen C's function signature table with its mapped return type (`f64`), allowing type inference (`let r = hal_apply_calibration(...)`) without writing `extern fn`. |

---

## 3. Project-Wide Whitelisting in `zenc.json`

If your project frequently calls specific C functions or uses C typedefs from system headers across many `.zc` files, you can register them once in a `zenc.json` (or `.zenc.json`) configuration file in your project root:

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

When `zc` starts up, it reads `zenc.json` and pre-registers every entry in `"c_functions"` as an external function and every entry in `"c_types"` as a known external C type across all modules in the build.

---

## 4. Complete Runnable Example

Let's combine namespaced C header imports (`import "math.h" as c_math` and `import "string.h" as c_str`) with a local hardware-abstraction header (`include "sensor_hal.h"`).

First, here is the companion C header file (`examples/ch12/ch12-01-c-headers/sensor_hal.h`):

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

And here is the Zen C program (`examples/ch12/ch12-01-c-headers/main.zc`) that consumes both system headers and `"sensor_hal.h"`:

```zc
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

Run the example with `zc run`:

```bash
$ zc run examples/ch12/ch12-01-c-headers/main.zc
hypot(3.000000, 4.000000) = 5.000000
strlen("Zen C FFI") = 9
HAL_MAX_CHANNELS = 8, status = 0
Calibrated Ch#1: 20.000000 C
```

---

## 🔍 Peek at the C

When `zc` transpiles `examples/ch12/ch12-01-c-headers/main.zc`, it emits `#include` directives at the top of the C translation unit, strips the `c_math::` and `c_str::` namespace prefixes into direct C calls (`hypot(...)`, `strlen(...)`), folds `HAL_MAX_CHANNELS` (`8`) and `HAL_STATUS_OK` (`0`), and constructs `HalCalibration` as a C99 compound literal:

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
