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

```zenc
// main.zc
import "math_utils.zc" as math;

fn main() {
    let sum = math::add(15, 27);
    let area = PI * 10.0 * 10.0; // Manifest constant folded at compile time

    println "Sum: {sum}, Area: {area}";
}
```

> [!NOTE]
> **Manifest Constants (`def`) Across Modules**: Constants declared with `def` are evaluated at compile time and folded directly into expressions across modules. Functions and methods are qualified with the module namespace (e.g. `math::add`).

### Wildcard Import (`as *`)

To import all symbols from a module directly into the current scope without qualifying them with a namespace prefix, use `as *`:

```zenc
import "math_utils.zc" as *;

fn main() {
    // Directly call functions without math_utils:: prefix
    let sum = add(10, 20);
    println "Sum: {sum}";
}
```

> [!WARNING]
> While `as *` can be convenient in small scripts or test files, excessive use of wildcard imports in large codebases can lead to namespace pollution and symbol collision. Using explicit namespaces or selective imports is recommended for production code.

---

## 3. Selective Imports (`import { ... } from "..."`)

Zen C allows you to cherry-pick specific symbols from a module using selective import syntax:

```zenc
import { add, multiply } from "math_utils.zc";

fn main() {
    let sum = add(5, 12);
    let prod = multiply(4, 3);
    println "Result: {sum}, {prod}";
}
```

You can also alias individual symbols during selective import:

```zenc
import { add as sum_func, multiply as prod_func } from "math_utils.zc";

fn main() {
    let res = sum_func(100, 200);
    println "Result: {res}";
}
```

---

## 4. Directory Modules (`mod.zc`)

As projects grow, related functionality is often grouped into folders. Zen C supports **Directory Modules** using the `mod.zc` convention (similar to Rust's `mod.rs` or Python's `__init__.py`).

Consider the following project directory structure:

```text
my_project/
├── main.zc
└── network/
    ├── mod.zc
    ├── packet.zc
    └── socket.zc
```

Inside `network/mod.zc`, we define the public interface of the `network` module and import its internal submodules:

```zenc
// network/mod.zc
import "./packet.zc" as packet;

def DEFAULT_PORT = 8080;

fn connect(host: string, port: int) {
    println "Connecting to {host}:{port}...";
}
```

From `main.zc`, you can import the entire `network` folder directly:

```zenc
// main.zc
import "./network";

fn main() {
    connect("127.0.0.1", DEFAULT_PORT);
}
```

Or import the directory module with an explicit namespace:

```zenc
// main.zc
import "network/mod.zc" as net;

fn main() {
    net::connect("127.0.0.1", net::DEFAULT_PORT);
}
```

### Re-Exporting Modules (`export import`)

A module can re-export another module or submodule using `export import`:

```zenc
// network/mod.zc
export import "./packet.zc" as packet;
```

Now, any consumer that imports `network` can also access `packet` through the `network` namespace!

---

## 5. Encapsulation and Data Hiding (`opaque`)

Encapsulation is a cornerstone of robust software engineering. In traditional C, making struct fields private requires creating an "opaque pointer" (`typedef struct User User;`) and dynamically allocating every instance on the heap via `malloc()`. This adds pointer indirection and allocation overhead.

Zen C provides zero-overhead encapsulation via the **`opaque`** keyword.

### `opaque struct`: Private Fields with Stack Allocation

When a struct is declared with `opaque`, its fields are strictly private to the defining module (`.zc` file):

```zenc
// user.zc
opaque struct User {
    id: int,
    username: string,
    password_hash: string,
}

// Public constructor
fn user_new(id: int, name: string, hash: string) -> User {
    return User {
        id: id,
        username: name,
        password_hash: hash,
    };
}

// Public accessor functions
fn user_get_id(u: User) -> int {
    return u.id;
}

fn user_get_name(u: User) -> string {
    return u.username;
}
```

Now, in `main.zc`:

```zenc
// main.zc
import "user.zc" as user;

fn main() {
    let u = user::user_new(101, "Alice", "secret_hash_987");

    // OK: Accessing data through public API
    println "User ID: {user::user_get_id(u)}, Name: {user::user_get_name(u)}";

    // COMPILE ERROR: Cannot access private field 'password_hash' of opaque struct
    // println "Hash: {u.password_hash}";
}
```

If an external file attempts to access a private field directly, the compiler rejects the code at compile time:

```text
error: Cannot access private field 'password_hash' of opaque struct 'user__User'
```

> [!NOTE]
> **Stack Allocation Efficiency**: Because the compiler knows the size and memory layout of `User`, an `opaque struct` can be allocated directly on the stack or embedded inside other structs without dynamic heap allocation!

---

### `opaque alias`: Strong Nominal Types

In Zen C, type aliases (`alias NewName = OldType`) are normally transparent (structural), meaning they can be implicitly used interchangeably with their underlying type.

However, when qualified with `opaque`, the type alias becomes a **Nominal Type**:

```zenc
// types.zc
opaque alias UserID = int;
opaque alias AccountID = int;

fn make_user_id(val: int) -> UserID {
    return val; // Conversion allowed inside defining module
}

fn make_account_id(val: int) -> AccountID {
    return val; // Conversion allowed inside defining module
}
```

Outside of `types.zc`:

```zenc
// main.zc
import "types.zc";

fn main() {
    let uid: UserID = make_user_id(101);
    let aid: AccountID = make_account_id(5001);

    // COMPILE ERROR: Type validation failed. Expected 'int32_t', but got 'UserID'
    // let raw_int: int = uid;

    // COMPILE ERROR: Cannot assign AccountID to UserID!
    // let wrong: UserID = aid;
}
```

`opaque alias` prevents accidental confusion between identifiers (such as passing a `UserID` where an `AccountID` is expected), catching critical domain logic bugs at compile time with zero runtime cost.

---

## 6. Compile-Time Circular Dependency Detection

Circular dependencies between modules can cause brittle coupling, initialization order bugs, and compilation slowdowns.

The `zc` compiler maintains an active import tracking stack during compilation. If module `A` imports module `B`, and module `B` attempts to import module `A`, the compiler immediately halts with a clean diagnostic:

```text
error: Circular import detected: '/path/to/module_a.zc'
```

This strictness ensures that your software architecture remains clean, hierarchical, and acyclic.

---

## 7. C Header Imports vs Includes

Zen C bridges modern module semantics with C header interoperability through two mechanisms:

### Method 1: Trusted Header Import (`import "header.h" as alias`)

You can import standard C headers directly using `import` with the `.h` extension and an optional namespace:

```zenc
//> link: -lm
import "math.h" as c_math;

fn main() {
    // Directly call C standard library functions under the namespace
    let angle = 3.14159 / 4.0;
    let s = c_math::sin(angle);
    let c = c_math::cos(angle);
    println "sin: {s}, cos: {c}";
}
```

The compiler registers the C header as a module and automatically directs calls to the underlying C library.

### Method 2: Raw Preprocessor Include (`include <header.h>`)

When you need precise control over C signatures or FFI bindings, use `include <...>` paired with `extern fn`:

```zenc
include <stdio.h>

extern fn puts(str: const char*) -> c_int;

fn main() {
    puts("Direct C standard I/O call");
}
```

- **`import "file.h"`**: Registers the header as a named Zen C module.
- **`include <file.h>`**: Emits a raw `#include <file.h>` preprocessor directive into the generated C output.

---

## Summary of Module Features

| Feature | Syntax | Description |
| :--- | :--- | :--- |
| **Basic Import** | `import "foo.zc";` | Imports module under `foo::` namespace |
| **Namespace Alias** | `import "foo.zc" as f;` | Imports module under `f::` namespace |
| **Wildcard Import** | `import "foo.zc" as *;` | Imports symbols directly into local scope |
| **Selective Import** | `import { a, b as c } from "foo.zc";` | Imports only specified symbols |
| **Directory Module** | `import "./network";` | Resolves to `network/mod.zc` |
| **Re-export** | `export import "./sub.zc";` | Re-exports submodule to importers |
| **Opaque Struct** | `opaque struct User { ... }` | Private fields, accessible only within module |
| **Opaque Alias** | `opaque alias ID = int;` | Nominal type wrapper, strict type checking |
| **C Header Module** | `import "math.h" as c_math;` | Direct namespace access to C header |
| **C Include** | `include <stdio.h>` | Emits `#include` in generated C code |

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch07/ch07-01-modules-and-imports/`](file:///home/mark/code/zenc-app/book/examples/ch07/ch07-01-modules-and-imports/).

Now that we know how to structure multi-file projects and enforce encapsulation, let's explore the rich capabilities of the **Zen C Standard Library** in [Section 7.2](ch07-02-standard-library-overview.md)!
