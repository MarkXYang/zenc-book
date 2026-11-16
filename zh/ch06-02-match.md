# `match` 结构

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

**代码清单 6-2**
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

**代码清单 6-3**
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

**代码清单 6-4**
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

在 [第 4 章](ch04-01-move-semantics.md) 中，我们了解到管理外部资源（如堆内存、套接字或实现 `Drop` 的结构体）的类型遵循**移动语义**。

当你对携带资源类型的枚举进行模式匹配时：
- 按值匹配（`Some(x)`）会将载荷从枚举中移出并消耗掉。
- 要在**不转移所有权**的情况下检查或修改载荷，请使用 **`ref`** 关键字！

### 1. 在不发生移动的情况下检查值

使用 `ref` 会绑定一个指向内部值的指针，而不是将其移出：

**代码清单 6-5**
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

fn main() {
    let r1 = TaskResult::Success("File uploaded");
    let r2 = TaskResult::Failure(404);
    inspect_result(r1);
    inspect_result(r2);
}
```

输出：
```text
Task completed: File uploaded
Failed: 404
```

### 2. 通过 `ref` 就地修改

你还可以使用 `ref` 就地修改直接存储在枚举变量内部的值：

**代码清单 6-6**
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

输出：
```text
New count: 11
```

---

## 匹配字面量与范围

虽然 `match` 对枚举而言不可或缺，但它也能无缝用于原始整数、字符和范围值：

**代码清单 6-7**
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

输出：
```text
OK
Client Error
```

---

## 综合示例：协议事件分发器

让我们在一个完整的事件驱动网络分发器中融合所有这些概念：

**代码清单 6-8**
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

在 [第 7 章](ch07-00-modules.md) 中，我们将探索**模块与多文件项目**、将代码组织进模块，以及使用标准库！
