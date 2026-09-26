# The match Control Flow Construct

Zen C provides an exceptionally powerful control flow construct called **`match`**. It allows you to compare a value against a series of patterns and execute code based on which pattern matches.

Patterns can be simple values, literals, ranges, wildcards, or the variants of an `enum`. The true superpower of `match` comes when paired with enums: it safely and cleanly **destructures** variant payloads while enforcing **compile-time exhaustiveness**.

---

## Why `match` is Superior to C's `switch`

Traditional C provides the `switch` statement, but `switch` has severe limitations:
- It only works with primitive integer and character values.
- It cannot inspect or destructure payload data.
- It suffers from dangerous **accidental fallthrough** if you forget a `break` statement.
- It does not verify that all enum variants are handled.

Zen C's `match` solves every one of these problems:

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
```

Notice:
1. **Destructuring**: `radius`, `w`, and `h` are bound directly from the enum payload!
2. **No Fallthrough**: When an arm completes, execution automatically leaves the `match` block. No `break` statements are needed.

---

## Exhaustive Matching

Matches in Zen C are **exhaustive**: every possible value or enum variant must be handled.

If you omit a variant from a `match` expression without providing a default wildcard fallback arm, the compiler will reject the code:

```zenc
fn handle_shape(s: Shape) {
    match s {
        Shape::Circle(r) => { println "Circle: {r}"; },
        Shape::Rect(w, h) => { println "Rect: {w}x{h}"; },
        // Error: Shape::Point is not handled!
    }
}
```

This strictness prevents insidious bugs where a new enum variant is added to a system, but some parts of the codebase forget to handle it.

---

## The Catch-All Wildcard (`_`)

When you do not want to list every individual case, or only care about a few specific variants, use the underscore (`_`) as a catch-all pattern:

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

```zenc
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
```

> [!NOTE]
> Logical OR operators (`||`, `or`, `,`) apply to unit variants, literals, and wildcards. Variants with destructuring payload patterns (such as `(radius)`) are matched in individual arms so that their bound variables have clear, unambiguous scopes.

---

## Reference Binding (`ref`)

In [Chapter 4](ch04-02-ownership-and-allocation.md), we learned that types that manage external resources (like heap memory, sockets, or structs implementing `Drop`) adhere to **Move Semantics**.

When you pattern match on an enum carrying a resource-owning type:
- Matching by value (`Some(x)`) moves the payload out of the enum, consuming it.
- To inspect or mutate the payload **without moving ownership**, use the **`ref`** keyword!

### 1. Inspecting Values Without Moving

Using `ref` binds a pointer to the inner value instead of moving it:

```zenc
enum TaskResult {
    Success(string),
    Failure(int),
}

fn inspect_result(res: TaskResult) {
    match res {
        TaskResult::Success(ref msg) => {
            // 'msg' is string* (a borrowed pointer to the string inside res)
            // 'res' is NOT moved or consumed!
            println "Task completed: {*msg}";
        },
        TaskResult::Failure(code) => {
            println "Failed: {code}";
        },
    }

    // 'res' is still valid here because we borrowed via 'ref'!
}
```

### 2. In-Place Mutation via `ref`

You can also use `ref` to modify the value stored directly inside an enum variable in place:

```zenc
enum Counter {
    Value(int),
    Reset,
}

fn main() {
    let c = Counter::Value(10);

    // Matching on an lvalue variable with 'ref' borrows a direct pointer to the payload
    match c {
        Counter::Value(ref val) => {
            // 'val' is int* pointing into 'c'
            *val = *val + 1; // Mutates directly in place!
        },
        Counter::Reset => {
            c = Counter::Value(1);
        },
    }

    match c {
        Counter::Value(v) => {
            println "New count: {v}"; // 11
        },
        Counter::Reset => {},
    }
}
```

---

## Matching Literals and Ranges

While `match` is indispensable for enums, it also works seamlessly on primitive integer, character, and range values:

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
```

---

## A Complete Example: Protocol Event Dispatcher

Let's bring all these concepts together in a complete event-driven networking dispatcher:

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
- How to use the **`ref`** keyword to inspect or mutate enum payloads in place without taking ownership.
- How `Option<T>` and `Result<T, E>` serve as standard enum patterns replacing `NULL` and error codes.

In [Chapter 7](ch07-00-managing-projects.md), we'll explore **Managing Growing Projects**, organizing code into modules, and utilizing the standard library!
