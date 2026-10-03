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

**Listing 7-1: `list7-1.zc`**

```zenc
 1 | // main.zc
 2 | import "math_utils.zc";
 3 |
 4 | fn main() {
 5 |     // Access symbols using the file's base name as the namespace
 6 |     let sum = math_utils::add(10, 20);
 7 |     let prod = math_utils::multiply(6, 7);
 8 |
 9 |     println "Sum: {sum}, Product: {prod}";
10 | }
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

**Listing 7-2: `list7-2.zc`**

```zenc
 1 | // main.zc
 2 | import "math_utils.zc" as math;
 3 |
 4 | fn main() {
 5 |     let sum = math::add(15, 27);
 6 |     let area = PI * 10.0 * 10.0; // Manifest constant folded at compile time
 7 |
 8 |     println "Sum: {sum}, Area: {area}";
 9 | }
```

Output:
```text
Sum: 42, Area: 314.159265
```

> [!NOTE]
> **Manifest Constants (`def`) Across Modules**: Constants declared with `def` are evaluated at compile time and folded directly into expressions across modules. Functions and methods are qualified with the module namespace (e.g. `math::add`).

### Wildcard Import (`as *`)

To import all symbols from a module directly into the current scope without qualifying them with a namespace prefix, use `as *`:

**Listing 7-3: `list7-3.zc`**

```zenc
 1 | import "math_utils.zc" as *;
 2 |
 3 | fn main() {
 4 |     // Directly call functions without math_utils:: prefix
 5 |     let sum = add(10, 20);
 6 |     println "Sum: {sum}";
 7 | }
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

**Listing 7-4: `list7-4.zc`**

```zenc
 1 | import { add, multiply } from "math_utils.zc";
 2 |
 3 | fn main() {
 4 |     let sum = add(5, 12);
 5 |     let prod = multiply(4, 3);
 6 |     println "Result: {sum}, {prod}";
 7 | }
```

Output:
```text
Result: 17, 12
```

You can also alias individual symbols during selective import:

**Listing 7-5: `list7-5.zc`**

```zenc
 1 | import { add as sum_func, multiply as prod_func } from "math_utils.zc";
 2 |
 3 | fn main() {
 4 |     let res = sum_func(100, 200);
 5 |     println "Result: {res}";
 6 | }
```

Output:
```text
Result: 300
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

**Listing 7-6: `list7-6.zc`**

```zenc
 1 | // main.zc
 2 | import "./network";
 3 |
 4 | fn main() {
 5 |     connect("127.0.0.1", DEFAULT_PORT);
 6 | }
```

Output:
```text
Connecting to 127.0.0.1:8080...
```

Or import the directory module with an explicit namespace:

**Listing 7-7: `list7-7.zc`**

```zenc
 1 | // main.zc
 2 | import "network/mod.zc" as net;
 3 |
 4 | fn main() {
 5 |     net::connect("127.0.0.1", net::DEFAULT_PORT);
 6 | }
```

Output:
```text
Connecting to 127.0.0.1:8080...
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

**Listing 7-8: `list7-8.zc`**

```zenc
 1 | // main.zc
 2 | import "user.zc" as user;
 3 |
 4 | fn main() {
 5 |     let u = user::user_new(101, "Alice", "secret_hash_987");
 6 |
 7 |     // OK: Accessing data through public API
 8 |     println "User ID: {user::user_get_id(u)}, Name: {user::user_get_name(u)}";
 9 |
10 |     // COMPILE ERROR: Cannot access private field 'password_hash' of opaque struct
11 |     // println "Hash: {u.password_hash}";
12 | }
```

Output:
```text
User ID: 101, Name: Alice
```

If an external file attempts to access a private field directly (e.g., uncommenting line 10), the compiler rejects the code at compile time:

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

fn user_id_to_int(uid: UserID) -> int {
    return uid;
}

fn make_account_id(val: int) -> AccountID {
    return val; // Conversion allowed inside defining module
}

fn account_id_to_int(aid: AccountID) -> int {
    return aid;
}
```

Outside of `types.zc`:

**Listing 7-9: `list7-9.zc`**

```zenc
 1 | // main.zc
 2 | import "types.zc";
 3 |
 4 | fn main() {
 5 |     let uid: UserID = make_user_id(101);
 6 |     let aid: AccountID = make_account_id(5001);
 7 |
 8 |     println "Domain types: UserID = {user_id_to_int(uid)}, AccountID = {account_id_to_int(aid)}";
 9 |
10 |     // COMPILE ERROR: Type validation failed. Expected 'int32_t', but got 'UserID'
11 |     // let raw_int: int = uid;
12 |
13 |     // COMPILE ERROR: Cannot assign AccountID to UserID!
14 |     // let wrong: UserID = aid;
15 | }
```

Output:
```text
Domain types: UserID = 101, AccountID = 5001
```

If we uncomment either invalid assignment, the compiler prevents domain type confusion at compile time:

```text
error: Type validation failed. Expected 'int32_t', but got 'UserID'
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
