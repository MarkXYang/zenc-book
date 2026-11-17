# The `match` Construct

Zen C provides an exceptionally powerful control flow construct called **`match`**. It allows you to compare a value against a series of patterns and execute code based on which pattern matches.

Patterns can be simple values, literals, ranges, wildcards, or the variants of an `enum`. This chapter focuses on `match` control-flow mechanics; the deeper destructuring and `ref` binding patterns are covered in [Chapter 6.3](ch06-03-patterns.md).

---

## Why `match` is Superior to C's `switch`

Traditional C provides the `switch` statement, but `switch` has severe limitations:
- It only works with primitive integer and character values.
- It cannot inspect or destructure payload data.
- It suffers from dangerous **accidental fallthrough** if you forget a `break` statement.
- It does not verify that all enum variants are handled.

Zen C's `match` solves every one of these problems:

**Listing 6-2**
```zenc
enum Shape {
    Circle(float),
    Rect(float, float),
    Point,
}

fn print_area(s: Shape) {
    match s {
        Shape::Circle(radius) => {
            println "Circle area: {3.14159 * radius * radius}";
        },
        Shape::Rect(w, h) => {
            println "Rectangle area: {w * h}";
        },
        Shape::Point => {
            println "Point has zero area";
        },
    }
}

fn main() {
    print_area(Shape::Circle(2.0));
    print_area(Shape::Rect(3.0, 4.0));
    print_area(Shape::Point);
}
```

Output:
```text
Circle area: 12.566360
Rectangle area: 12.000000
Point has zero area
```

Notice:
1. **Destructuring**: `radius`, `w`, and `h` are bound directly from the enum payload!
2. **No Fallthrough**: When an arm completes, execution automatically leaves the `match` block. No `break` statements are needed.

---

## Exhaustive Matching

Matches in Zen C are **exhaustive**: every possible value or enum variant must be handled.

If you omit a variant from a `match` expression without providing a default wildcard fallback arm, the compiler reports a non-exhaustive `match` warning:

```zenc
fn handle_shape(s: Shape) {
    match s {
        Shape::Circle(r) => { println "Circle: {r}"; },
        Shape::Rect(w, h) => { println "Rect: {w}x{h}"; },
        // Error: Shape::Point is not handled!
    }
}
```

Treat this warning as a correctness issue: either handle every variant explicitly or add a deliberate fallback arm.

---

## The Catch-All Wildcard (`_`)

When you do not want to list every individual case, or only care about a few specific variants, use the underscore (`_`) as a catch-all pattern:

**Listing 6-3**
```zenc
enum Status {
    Idle,
    Running,
    Paused,
    Finished,
    Error(int),
}

fn describe_status(s: Status) {
    match s {
        Status::Running => {
            println "System is actively working";
        },
        Status::Error(code) => {
            println "Fatal error code: {code}";
        },
        _ => {
            // Catches Idle, Paused, and Finished
            println "System is inactive or complete";
        },
    }
}

fn main() {
    describe_status(Status::Running);
    describe_status(Status::Error(500));
    describe_status(Status::Idle);
}
```

Output:
```text
System is actively working
Fatal error code: 500
System is inactive or complete
```

### Ignoring Payloads with `_`

You can also use `_` inside a variant pattern to match the variant while ignoring its payload:

```zenc
match s {
    Status::Error(_) => {
        // Matches any Error variant regardless of what error code it holds
        println "An error occurred, but we don't care about the code";
    },
    _ => {},
}
```

---

## Combining Multiple Patterns (`||`, `or`, `,`)

Zen C allows matching multiple patterns in a single match arm using the logical OR operators (`||`, `or`, or commas `,`):

```zenc
match s {
    Status::Idle || Status::Paused => {
        println "System is not consuming CPU cycles";
    },
    Status::Finished => {
        println "Execution halted";
    },
    Status::Error(_) => {
        println "Error encountered";
    },
    Status::Running => {
        println "Processing tasks...";
    },
}
```

Multi-pattern matching also works cleanly with literal values:

**Listing 6-4**
```zenc
fn test_code(http_code: int) {
    match http_code {
        200 || 201 || 204 => {
            println "Success";
        },
        400 or 401 or 404 => {
            println "Client Error";
        },
        500, 502, 503 => {
            println "Server Error";
        },
        _ => {
            println "Other code";
        },
    }
}

fn main() {
    test_code(200);
    test_code(404);
    test_code(500);
}
```

Output:
```text
Success
Client Error
Server Error
```

> [!NOTE]
> Logical OR operators (`||`, `or`, `,`) apply to unit variants, literals, and wildcards. Variants with destructuring payload patterns (such as `(radius)`) are matched in individual arms so that their bound variables have clear, unambiguous scopes.

---

## About `ref` and Advanced Patterns

This chapter keeps `match` focused on arm selection, exhaustiveness, literals, ranges, and practical dispatch. For payload borrowing (`ref`), struct/tuple destructuring, and wildcard precision, continue to [Chapter 6.3](ch06-03-patterns.md).

---

## Matching Literals and Ranges

While `match` is indispensable for enums, it also works seamlessly on primitive integer, character, and range values:

**Listing 6-5**
```zenc
fn classify_http_code(code: int) -> string {
    match code {
        200           => { return "OK"; },
        201           => { return "Created"; },
        204           => { return "No Content"; },
        300 ..< 400   => { return "Redirection"; }, // Exclusive range (300 to 399)
        400 ..= 499   => { return "Client Error"; }, // Inclusive range (400 to 499)
        500 ..= 599   => { return "Server Error"; },
        _             => { return "Unknown Status Code"; },
    }
}

fn main() {
    println "{classify_http_code(200)}";
    println "{classify_http_code(404)}";
}
```

Output:
```text
OK
Client Error
```

---

## A Complete Example: Protocol Event Dispatcher

Let's bring all these concepts together in a complete event-driven networking dispatcher:

**Listing 6-6**
```zenc
enum Packet {
    Ping,
    Pong,
    TextMessage(string),
    DataTransfer(int, int), // offset, length
    Disconnect(int),        // error code (0 = clean exit)
}

impl Packet {
    fn is_disconnect(const self) -> bool {
        match *self {
            Packet::Disconnect(_) => { return true; },
            _ => { return false; },
        }
    }
}

fn dispatch(packet: Packet) {
    match packet {
        Packet::Ping => {
            println "[NET] Received PING -> sending PONG";
        },
        Packet::Pong => {
            println "[NET] Received PONG (heartbeat alive)";
        },
        Packet::TextMessage(msg) => {
            println "[NET] Text message received: '{msg}'";
        },
        Packet::DataTransfer(offset, len) => {
            println "[NET] Data chunk: {len} bytes starting at offset {offset}";
        },
        Packet::Disconnect(code) => {
            if code == 0 {
                println "[NET] Connection closed cleanly by remote host";
            } else {
                println "[NET] Connection terminated with error code: {code}";
            }
        },
    }
}

fn main() {
    println "=== Network Packet Dispatcher ===";

    dispatch(Packet::Ping);
    dispatch(Packet::TextMessage("Hello from Zen C client!"));
    dispatch(Packet::DataTransfer(0, 4096));
    dispatch(Packet::Disconnect(0));
}
```

Output:
```text
=== Network Packet Dispatcher ===
[NET] Received PING -> sending PONG
[NET] Text message received: 'Hello from Zen C client!'
[NET] Data chunk: 4096 bytes starting at offset 0
[NET] Connection closed cleanly by remote host
```

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch06/ch06-02-match/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/ch06-02-match/main.zc), and the chapter capstone application in [`book/examples/ch06/web_events/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/web_events/main.zc).

---

## Summary

In this chapter, you learned:
- How **Enums** in Zen C are first-class tagged unions (sum types) capable of holding unit, single, or multi-payload data.
- How enums transpile into optimized C11 memory layouts using a discriminant tag and an overlapping union payload.
- How to define methods directly on enums using `impl EnumName { ... }`.
- How **`match`** provides safe, exhaustive pattern matching with no risk of accidental fallthrough.
- How to destructure variant payloads directly into local variables.
- How to use the catch-all wildcard (`_`) and combine multiple patterns (`||`, `or`, `,`).
- Where to continue for advanced payload borrowing and destructuring patterns ([Chapter 6.3](ch06-03-patterns.md)).
- How `Option<T>` and `Result<T, E>` serve as standard enum patterns replacing `NULL` and error codes.

In [Chapter 7](ch07-00-modules.md), we'll explore **Modules and Multi-File Projects**, organizing code into modules, and utilizing the standard library!
