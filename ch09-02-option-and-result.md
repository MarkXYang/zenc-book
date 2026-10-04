# Recoverable Errors with Result and Option

Most errors do not require the program to crash. When a function fails because a requested file does not exist or user input could not be parsed, the calling code should be given the opportunity to take corrective action: retrying the operation, asking the user for different input, or reporting a clean error message.

Zen C models recoverable errors using two foundational standard library types:
1. **`Option<T>`**: Represents optional presence—either a value is present (`Some(v)`), or it is absent (`None()`).
2. **`Result<T>`**: Represents a computation that either succeeded with a value (`Ok(v)`), or failed with an error message (`Err(message)`).

Both types are available by importing `std/option.zc` and `std/result.zc`.

---

## 1. The `Option<T>` Type

In traditional C, absent values are represented by `NULL` pointers or magic sentinel integers like `-1`. This approach has two fatal flaws:
- If a function returns a non-pointer (such as an integer index), it must designate an out-of-band integer as "not found".
- Nothing in the C type system forces the caller to check for `NULL` before dereferencing, leading to null pointer dereference crashes.

Zen C's `Option<T>` solves this by making the possibility of absence explicit in the type system:

```zenc
import "std/option.zc"

struct Option<T> {
    is_some: bool;
    val: T;
}
```

### Creating and Inspecting Options

You construct an option using `Option<T>::Some(v)` or `Option<T>::None()`:

```zenc
fn find_port(ports: int[4], target: int) -> Option<int> {
    for i in 0..4 {
        if ports[i] == target {
            return Option<int>::Some(i);
        }
    }
    return Option<int>::None();
}
```

To consume an `Option<T>`, you can inspect its status using helper methods:

```zenc
let result = find_port(ports, 8080);

if result.is_some() {
    println "Port found at index: {result.unwrap()}";
}

// Or provide a safe default fallback:
let fallback_idx = find_port(ports, 9000).unwrap_or(-1);
```

---

## 2. The `Result<T>` Type

While `Option<T>` expresses *whether* something succeeded or failed, it does not explain *why* it failed. For rich error context, Zen C provides `Result<T>`:

```zenc
import "std/result.zc"

struct Result<T> {
    is_ok: bool;
    val: T;
    err: char*;
}
```

An instance of `Result<T>` contains either:
- **`Ok(val)`**: A successful computation yielding `val`.
- **`Err(err)`**: A failure carrying an error message string.

### Working with `Result<T>`

Let's write a function that validates and parses port strings:

**Listing 9-2: `list9-2.zc`**

```zenc
import "std/result.zc"

fn parse_port(port_str: string) -> Result<int> {
    if port_str == "8080" {
        return Result<int>::Ok(8080);
    }
    if port_str == "443" {
        return Result<int>::Ok(443);
    }
    return Result<int>::Err("Invalid port number string");
}

fn main() {
    let r1 = parse_port("8080");
    if r1.is_ok() {
        println "Listening on port {r1.unwrap()}";
    }

    let r2 = parse_port("99999");
    if r2.is_err() {
        println "Configuration error: {r2.err}";
    }
}
```

Output:
```text
Listening on port 8080
Configuration error: Invalid port number string
```

---

## 3. Propagating Errors with the Try Operator (`?`)

When writing functions that call multiple sub-operations that might fail, writing manual `if res.is_err() { return res; }` checks after every single line creates deeply nested boilerplate.

Zen C provides the **`?`** try operator to make error propagation concise:

```zenc
fn start_service(port_str: string) -> Result<int> {
    // If parse_port returns Err, the ? operator automatically returns early
    let port = parse_port(port_str)?;

    println "Port validated: {port}";
    return Result<int>::Ok(port);
}
```

### How the `?` Operator Works

When appended to an expression returning `Result<T>`, the `?` operator evaluates as follows:
1. If the result is `Ok(val)`, it unwraps `val` and continues execution in the current function.
2. If the result is `Err(msg)`, it halts the current function immediately and returns `Result<T>::Err(msg)` to the caller.

---

> [!TIP]
> ### 🔍 Peek at the C: How `?` Desugars
> In GNU C11, the `?` try operator desugars to an efficient GNU statement expression:
>
> ```c
> int32_t port = ({
>     Result__int32_t _try = parse_port(port_str);
>     if (!_try.is_ok) return Result__int32_t__Err(_try.err);
>     _try.val;
> });
> ```
>
> There is zero dynamic allocation and zero exception table lookup. It is as fast as hand-written C return code checks!

---

Next, let's explore how to guarantee resource cleanup along error paths using `defer`!
