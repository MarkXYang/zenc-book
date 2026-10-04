# C Header Imports vs Includes

## 7. C Header Imports vs Includes

Zen C bridges modern module semantics with C header interoperability through two mechanisms:

### Method 1: Trusted Header Import (`import "header.h" as alias`)

You can import standard C headers directly using `import` with the `.h` extension and an optional namespace:

**Listing 7-10: `list7-10.zc`**

```zenc
 1 | //> link: -lm
 2 | import "math.h" as c_math;
 3 |
 4 | fn main() {
 5 |     // Directly call C standard library functions under the namespace
 6 |     let angle = 3.14159 / 4.0;
 7 |     let s = c_math::sin(angle);
 8 |     let c = c_math::cos(angle);
 9 |     println "sin: {s}, cos: {c}";
10 | }
```

Output:
```text
sin: 0.707106, cos: 0.707107
```

The compiler registers the C header as a module and automatically directs calls to the underlying C library.

### Method 2: Raw Preprocessor Include (`include <header.h>`)

When you need precise control over C signatures or FFI bindings, use `include <...>` paired with `extern fn`:

**Listing 7-11: `list7-11.zc`**

```zenc
 1 | include <stdio.h>
 2 |
 3 | extern fn puts(str: const char*) -> c_int;
 4 |
 5 | fn main() {
 6 |     puts("Direct C standard I/O call");
 7 | }
```

Output:
```text
Direct C standard I/O call
```

- **`import "file.h"`**: Registers the header as a named Zen C module.
- **`include <file.h>`**: Emits a raw `#include <file.h>` preprocessor directive into the generated C output.

---
