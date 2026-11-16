# Modules and Imports

In Zen C, programs are organized into **Modules**. A module is a self-contained unit of code containing functions, structs, enums, constants, and type aliases.

Unlike traditional C, which uses textual `#include` copy-pasting, Zen C features a modern, semantic module system with clean namespace scoping, selective importing, circular dependency detection, and compile-time encapsulation.

---

## 1. Defining and Importing a Module

In Zen C, **every `.zc` file is automatically a module**. There is no special keyword required to declare a module name.

Suppose we have a helper file named `math_utils.zc`:

```zenc
// math_utils.zc
def PI = 3.14159265;

fn add(a: int, b: int) -> int {
    return a + b;
}

fn multiply(a: int, b: int) -> int {
    return a * b;
}
```

To use `math_utils.zc` from our `main.zc`, we use the `import` statement:

**Listing 7-1**
```zenc
// main.zc
import "math_utils.zc";

fn main() {
    // Access symbols using the file's base name as the namespace
    let sum = math_utils::add(10, 20);
    let prod = math_utils::multiply(6, 7);

    println "Sum: {sum}, Product: {prod}";
}
```

Output:
```text
Sum: 30, Product: 42
```


### Module Path Resolution

When resolving the path inside `import "path"`, the `zc` compiler searches the filesystem in the following order:

1. **Absolute Path**: If the path starts with `/` (Unix) or `C:\` (Windows).
2. **Relative to Current File**: Searches the directory containing the currently compiling `.zc` file.
3. **Current Working Directory (`.`)**: Searches the working directory where the `zc` command was invoked.
4. **Include Flags (`-I`)**: Any directories specified on the command line via `-I <path>`.
5. **Standard Library Path (`$ZC_ROOT`)**: Searches `$ZC_ROOT/std` or `$ZC_ROOT`.
6. **System Paths**: System installation directories (e.g., `/usr/local/share/zenc` and `/usr/share/zenc`).

---

## 2. Namespace Aliasing (`as alias`)

If a module has a long filename, or if multiple modules share the same base name, you can assign a custom namespace alias using the `as` keyword:

**Listing 7-2**
```zenc
// main.zc
import "math_utils.zc" as math;

fn main() {
    let sum = math::add(15, 27);
    let area = PI * 10.0 * 10.0; // Manifest constant folded at compile time

    println "Sum: {sum}, Area: {area}";
}
```

Output:
```text
Sum: 42, Area: 314.159265
```

> [!NOTE]
> **Manifest Constants (`def`) Across Modules**: Constants declared with `def` are evaluated at compile time and folded directly into expressions across modules. Functions and methods are qualified with the module namespace (e.g. `math::add`).

### Wildcard Import (`as *`)

To import all symbols from a module directly into the current scope without qualifying them with a namespace prefix, use `as *`:

**Listing 7-3**
```zenc
import "math_utils.zc" as *;

fn main() {
    // Directly call functions without math_utils:: prefix
    let sum = add(10, 20);
    println "Sum: {sum}";
}
```

Output:
```text
Sum: 30
```

> [!WARNING]
> While `as *` can be convenient in small scripts or test files, excessive use of wildcard imports in large codebases can lead to namespace pollution and symbol collision. Using explicit namespaces or selective imports is recommended for production code.

---

## 3. Selective Imports (`import { ... } from "..."`)

Zen C allows you to cherry-pick specific symbols from a module using selective import syntax:

**Listing 7-4**
```zenc
import { add, multiply } from "math_utils.zc";

fn main() {
    let sum = add(5, 12);
    let prod = multiply(4, 3);
    println "Result: {sum}, {prod}";
}
```

Output:
```text
Result: 17, 12
```

You can also alias individual symbols during selective import:

**Listing 7-5**
```zenc
import { add as sum_func, multiply as prod_func } from "math_utils.zc";

fn main() {
    let res = sum_func(100, 200);
    println "Result: {res}";
}
```

Output:
```text
Result: 300
```

---

---

## Summary

In this section, you learned:
- How every `.zc` file in Zen C is automatically an independent module.
- How to import modules using `import "path.zc";`.
- How to use namespace aliases (`import "path.zc" as my_mod;`) and wildcard imports (`as *`).
- How to selectively import symbols with `import { a, b } from "path.zc";`.

Next, let's explore Directory Modules and Re-exports!
