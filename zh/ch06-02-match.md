# match 控制流结构

Zen C 提供了一个极其强大的控制流结构——**`match`**。它允许你将一个值与一系列模式进行比对，并根据匹配到的模式执行相应的代码。

模式可以是简单值、字面量、范围、通配符，也可以是 `enum` 的各个变体。`match` 最强大的地方在于与枚举搭配使用：它既能安全、清晰地**解构**变体载荷，又能强制保证**编译期穷尽性**。

---

## 为什么 match 优于 C 的 switch

传统 C 语言提供了 `switch` 语句，但 `switch` 存在严重的局限性：
- 它只能处理原始整数和字符值。
- 它无法检查或解构载荷数据。
- 如果忘记写 `break` 语句，会发生危险的**意外直通（fallthrough）**。
- 它不会验证所有枚举变体是否都得到了处理。

Zen C 的 `match` 解决了上述所有问题：

**代码清单 6-2：`list6-2.zc`**

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

输出：
```text
Circle area: 12.566360
Rectangle area: 12.000000
Point has zero area
```

请注意：
1. **解构**：`radius`、`w` 和 `h` 直接从枚举载荷中绑定！
2. **无直通（No Fallthrough）**：当一个分支执行完毕后，执行流程会自动离开 `match` 块。不需要任何 `break` 语句。

---

## 穷尽性匹配

Zen C 中的 match 是**穷尽的（exhaustive）**：必须处理所有可能的值或枚举变体。

如果你在 `match` 表达式中遗漏了某个变体，且未提供默认的通配符回退分支，编译器将拒绝编译代码：

```zenc
fn handle_shape(s: Shape) {
    match s {
        Shape::Circle(r) => { println "Circle: {r}"; },
        Shape::Rect(w, h) => { println "Rect: {w}x{h}"; },
        // Error: Shape::Point is not handled!
    }
}
```

这种严格性防止了潜在的隐患：在系统中添加新的枚举变体时，代码库的某些部分可能会忘记对其进行处理。

---

## 通配符捕获全部（`_`）

当你不想列出每个具体情况，或者只关心少数特定变体时，可以使用下划线（`_`）作为通配捕获模式：

**代码清单 6-3：`list6-3.zc`**

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

输出：
```text
System is actively working
Fatal error code: 500
System is inactive or complete
```

### 使用 `_` 忽略载荷

你还可以在变体模式中使用 `_` 来匹配变体，同时忽略其载荷：

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

## 组合多重模式（`||`、`or`、`,`）

Zen C 允许使用逻辑或运算符（`||`、`or` 或逗号 `,`）在单个 match 分支中匹配多个模式：

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

多模式匹配同样非常适用于字面量值：

**代码清单 6-4：`list6-4.zc`**

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

输出：
```text
Success
Client Error
Server Error
```

> [!NOTE]
> 逻辑或运算符（`||`、`or`、`,`）适用于单元变体、字面量和通配符。带有解构载荷模式的变体（例如 `(radius)`）应在各自独立的分支中进行匹配，以便其绑定的变量具有清晰明确的作用域。

---

## 引用绑定（`ref`）

在 [第 4 章](ch04-02-ownership-and-allocation.md) 中，我们了解到管理外部资源（如堆内存、套接字或实现 `Drop` 的结构体）的类型遵循**移动语义**。

当你对携带资源类型的枚举进行模式匹配时：
- 按值匹配（`Some(x)`）会将载荷从枚举中移出并消耗掉。
- 要在**不转移所有权**的情况下检查或修改载荷，请使用 **`ref`** 关键字！

### 1. 在不发生移动的情况下检查值

使用 `ref` 会绑定一个指向内部值的指针，而不是将其移出：

**代码清单 6-5：`list6-5.zc`**

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

输出：
```text
Task completed: File uploaded
Failed: 404
```

### 2. 通过 `ref` 就地修改

你还可以使用 `ref` 就地修改直接存储在枚举变量内部的值：

**代码清单 6-6：`list6-6.zc`**

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

输出：
```text
New count: 11
```

---

## 匹配字面量与范围

虽然 `match` 对枚举而言不可或缺，但它也能无缝用于原始整数、字符和范围值：

**代码清单 6-7：`list6-7.zc`**

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

输出：
```text
OK
Client Error
```

---

## 综合示例：协议事件分发器

让我们在一个完整的事件驱动网络分发器中融合所有这些概念：

**代码清单 6-8：`list6-8.zc`**

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

输出：
```text
=== Network Packet Dispatcher ===
[NET] Received PING -> sending PONG
[NET] Text message received: 'Hello from Zen C client!'
[NET] Data chunk: 4096 bytes starting at offset 0
[NET] Connection closed cleanly by remote host
```

> [!TIP]
> 你可以在 [`book/examples/ch06/ch06-02-match/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/ch06-02-match/main.zc) 中找到并运行本节的完整示例，在 [`book/examples/ch06/web_events/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/web_events/main.zc) 中找到本章的高潮总结应用程序。

---

## 小结

在本章中，你学习了：
- Zen C 中的**枚举**是一等带标签联合体（和类型），能够持有单元、单载荷或多载荷数据。
- 枚举如何利用判别标签和重叠联合体载荷转译为优化的 C11 内存布局。
- 如何使用 `impl EnumName { ... }` 直接在枚举上定义方法。
- **`match`** 如何提供安全、穷尽的模式匹配，且完全没有意外直通的风险。
- 如何将变体载荷直接解构到局部变量中。
- 如何使用通配符（`_`）以及组合多重模式（`||`、`or`、`,`）。
- 如何使用 **`ref`** 关键字在不获取所有权的情况下就地检查或修改枚举载荷。
- `Option<T>` 和 `Result<T, E>` 如何作为标准枚举模式替代 `NULL` 和错误码。

在 [第 7 章](ch07-00-managing-projects.md) 中，我们将探索**管理不断增长的项目**、将代码组织进模块，以及使用标准库！
