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

**Listing 6-2: `list6-2.zc`**

```zenc
 1 | enum Shape {
 2 |     Circle(float),
 3 |     Rect(float, float),
 4 |     Point,
 5 | }
 6 |
 7 | fn print_area(s: Shape) {
 8 |     match s {
 9 |         Shape::Circle(radius) => {
10 |             println "Circle area: {3.14159 * radius * radius}";
11 |         },
12 |         Shape::Rect(w, h) => {
13 |             println "Rectangle area: {w * h}";
14 |         },
15 |         Shape::Point => {
16 |             println "Point has zero area";
17 |         },
18 |     }
19 | }
20 |
21 | fn main() {
22 |     print_area(Shape::Circle(2.0));
23 |     print_area(Shape::Rect(3.0, 4.0));
24 |     print_area(Shape::Point);
25 | }
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

**Listing 6-3: `list6-3.zc`**

```zenc
 1 | enum Status {
 2 |     Idle,
 3 |     Running,
 4 |     Paused,
 5 |     Finished,
 6 |     Error(int),
 7 | }
 8 |
 9 | fn describe_status(s: Status) {
10 |     match s {
11 |         Status::Running => {
12 |             println "System is actively working";
13 |         },
14 |         Status::Error(code) => {
15 |             println "Fatal error code: {code}";
16 |         },
17 |         _ => {
18 |             // Catches Idle, Paused, and Finished
19 |             println "System is inactive or complete";
20 |         },
21 |     }
22 | }
23 |
24 | fn main() {
25 |     describe_status(Status::Running);
26 |     describe_status(Status::Error(500));
27 |     describe_status(Status::Idle);
28 | }
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

**Listing 6-4: `list6-4.zc`**

```zenc
 1 | fn test_code(http_code: int) {
 2 |     match http_code {
 3 |         200 || 201 || 204 => {
 4 |             println "Success";
 5 |         },
 6 |         400 or 401 or 404 => {
 7 |             println "Client Error";
 8 |         },
 9 |         500, 502, 503 => {
10 |             println "Server Error";
11 |         },
12 |         _ => {
13 |             println "Other code";
14 |         },
15 |     }
16 | }
17 |
18 | fn main() {
19 |     test_code(200);
20 |     test_code(404);
21 |     test_code(500);
22 | }
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

## Reference Binding (`ref`)

In [Chapter 4](ch04-02-ownership-and-allocation.md), we learned that types that manage external resources (like heap memory, sockets, or structs implementing `Drop`) adhere to **Move Semantics**.

When you pattern match on an enum carrying a resource-owning type:
- Matching by value (`Some(x)`) moves the payload out of the enum, consuming it.
- To inspect or mutate the payload **without moving ownership**, use the **`ref`** keyword!

### 1. Inspecting Values Without Moving

Using `ref` binds a pointer to the inner value instead of moving it:

**Listing 6-5: `list6-5.zc`**

```zenc
 1 | enum TaskResult {
 2 |     Success(string),
 3 |     Failure(int),
 4 | }
 5 |
 6 | fn inspect_result(res: TaskResult) {
 7 |     match res {
 8 |         TaskResult::Success(ref msg) => {
 9 |             // 'msg' is string* (a borrowed pointer to the string inside res)
10 |             // 'res' is NOT moved or consumed!
11 |             println "Task completed: {*msg}";
12 |         },
13 |         TaskResult::Failure(code) => {
14 |             println "Failed: {code}";
15 |         },
16 |     }
17 |
18 |     // 'res' is still valid here because we borrowed via 'ref'!
19 | }
20 |
21 | fn main() {
22 |     let r1 = TaskResult::Success("File uploaded");
23 |     let r2 = TaskResult::Failure(404);
24 |     inspect_result(r1);
25 |     inspect_result(r2);
26 | }
```

Output:
```text
Task completed: File uploaded
Failed: 404
```

### 2. In-Place Mutation via `ref`

You can also use `ref` to modify the value stored directly inside an enum variable in place:

**Listing 6-6: `list6-6.zc`**

```zenc
 1 | enum Counter {
 2 |     Value(int),
 3 |     Reset,
 4 | }
 5 |
 6 | fn main() {
 7 |     let c = Counter::Value(10);
 8 |
 9 |     // Matching on an lvalue variable with 'ref' borrows a direct pointer to the payload
10 |     match c {
11 |         Counter::Value(ref val) => {
12 |             // 'val' is int* pointing into 'c'
13 |             *val = *val + 1; // Mutates directly in place!
14 |         },
15 |         Counter::Reset => {
16 |             c = Counter::Value(1);
17 |         },
18 |     }
19 |
20 |     match c {
21 |         Counter::Value(v) => {
22 |             println "New count: {v}"; // 11
23 |         },
24 |         Counter::Reset => {},
25 |     }
26 | }
```

Output:
```text
New count: 11
```

---

## Matching Literals and Ranges

While `match` is indispensable for enums, it also works seamlessly on primitive integer, character, and range values:

**Listing 6-7: `list6-7.zc`**

```zenc
 1 | fn classify_http_code(code: int) -> string {
 2 |     match code {
 3 |         200           => { return "OK"; },
 4 |         201           => { return "Created"; },
 5 |         204           => { return "No Content"; },
 6 |         300 ..< 400   => { return "Redirection"; }, // Exclusive range (300 to 399)
 7 |         400 ..= 499   => { return "Client Error"; }, // Inclusive range (400 to 499)
 8 |         500 ..= 599   => { return "Server Error"; },
 9 |         _             => { return "Unknown Status Code"; },
10 |     }
11 | }
12 |
13 | fn main() {
14 |     println "{classify_http_code(200)}";
15 |     println "{classify_http_code(404)}";
16 | }
```

Output:
```text
OK
Client Error
```

---

## A Complete Example: Protocol Event Dispatcher

Let's bring all these concepts together in a complete event-driven networking dispatcher:

**Listing 6-8: `list6-8.zc`**

```zenc
 1 | enum Packet {
 2 |     Ping,
 3 |     Pong,
 4 |     TextMessage(string),
 5 |     DataTransfer(int, int), // offset, length
 6 |     Disconnect(int),        // error code (0 = clean exit)
 7 | }
 8 |
 9 | impl Packet {
10 |     fn is_disconnect(const self) -> bool {
11 |         match *self {
12 |             Packet::Disconnect(_) => { return true; },
13 |             _ => { return false; },
14 |         }
15 |     }
16 | }
17 |
18 | fn dispatch(packet: Packet) {
19 |     match packet {
20 |         Packet::Ping => {
21 |             println "[NET] Received PING -> sending PONG";
22 |         },
23 |         Packet::Pong => {
24 |             println "[NET] Received PONG (heartbeat alive)";
25 |         },
26 |         Packet::TextMessage(msg) => {
27 |             println "[NET] Text message received: '{msg}'";
28 |         },
29 |         Packet::DataTransfer(offset, len) => {
30 |             println "[NET] Data chunk: {len} bytes starting at offset {offset}";
31 |         },
32 |         Packet::Disconnect(code) => {
33 |             if code == 0 {
34 |                 println "[NET] Connection closed cleanly by remote host";
35 |             } else {
36 |                 println "[NET] Connection terminated with error code: {code}";
37 |             }
38 |         },
39 |     }
40 | }
41 |
42 | fn main() {
43 |     println "=== Network Packet Dispatcher ===";
44 |
45 |     dispatch(Packet::Ping);
46 |     dispatch(Packet::TextMessage("Hello from Zen C client!"));
47 |     dispatch(Packet::DataTransfer(0, 4096));
48 |     dispatch(Packet::Disconnect(0));
49 | }
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
- How to use the **`ref`** keyword to inspect or mutate enum payloads in place without taking ownership.
- How `Option<T>` and `Result<T, E>` serve as standard enum patterns replacing `NULL` and error codes.

In [Chapter 7](ch07-00-managing-projects.md), we'll explore **Managing Growing Projects**, organizing code into modules, and utilizing the standard library!
