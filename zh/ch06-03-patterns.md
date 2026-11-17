# 模式与解构

模式是 Zen C 中用于匹配简单或复杂类型结构的一种特殊语法。将模式与 `match` 表达式及 `let` 绑定相结合，可以让你解包结构体、在不移动枚举载荷的情况下检查它们，并编写出简洁且穷尽的控制流。

---

## 引用绑定（`ref`）

当对持有非 `Copy` 资源类型的枚举变体进行模式匹配时，按值匹配会将载荷的所有权移入模式变量中。

要在不获取所有权的情况下检查或借用载荷，请使用 **`ref`** 关键字。在 match 分支内部，绑定的变量具有指针类型（`T*`），因此在读取该值时需要解引用（`*text`）：

```zenc
enum Packet {
    Data(string),
}

fn handle_packet(p: Packet*) {
    match *p {
        Packet::Data(ref text) => {
            // text is borrowed by reference: string*
            println "Inspecting packet: {*text}";
        },
    }
    // *p remains valid!
}
```

---

## 结构体与元组解构

解构不仅能用于 `match` 分支，也可以直接用于 `let` 绑定。

```zenc
struct Point {
    x: int;
    y: int;
}

fn pair() -> (int, int) {
    return (10, 20);
}

fn main() {
    let p = Point { x: 3, y: 4 };

    // 简写结构体解构
    let Point { x, y } = p;
    println "{x}, {y}";

    // 重命名结构体解构
    let Point { x: x1, y: y1 } = p;
    println "{x1}, {y1}";

    // 元组解构
    let (a, b) = pair();
    println "{a}, {b}";
}
```

---

## 在 `match` 分支中解构

你还可以在 `let` 语句中或在 `match` 分支内直接解构 `struct` 值，将每个字段绑定到局部变量：

```zenc
// File: examples/ch06/ch06-03-patterns/main.zc

struct Point {
    x: int;
    y: int;
}

enum Packet {
    Ping,
    Data(string),
    Coords(Point),
}

fn describe_packet(pkt: Packet*) -> string {
    match *pkt {
        Packet::Ping() => { return "ping"; },
        Packet::Data(ref text) => {
            println "Inspecting borrowed payload: {*text}";
            return "data";
        },
        Packet::Coords(pt) => {
            let Point { x, y } = pt;
            println "Packet coords: ({x}, {y})";
            return "coords";
        },
    }
    return "unknown";
}

fn main() {
    let p1 = Packet::Ping();
    let p2 = Packet::Data("hello-zen");
    let p3 = Packet::Coords(Point { x: 10, y: 20 });

    assert(describe_packet(&p1) == "ping", "expected ping");
    assert(describe_packet(&p2) == "data", "expected data");
    assert(describe_packet(&p3) == "coords", "expected coords");

    // Destructuring a struct directly in a let binding
    let origin = Point { x: 3, y: 4 };
    let Point { x, y } = origin;
    assert(x + y == 7, "destructured sum must be 7");

    println "All pattern matching checks passed!";
}
```

<span class="caption">代码清单 6-7：跨 `match` 和 `let` 的引用绑定（`ref`）与结构体解构</span>

---

## 使用通配符忽略值

当你不关心匹配值的某些部分时，可以使用 `_`：

```zenc
enum Event {
    Resize(int, int),
    Quit,
}

fn handle(e: Event) {
    match e {
        Event::Resize(w, _h) => {
            println "Width changed: {w}";
        },
        Event::Quit => {
            println "Quit";
        },
    }
}
```

> [!NOTE]
> 在当前编译器中，同一个载荷模式里请避免重复使用纯 `_`（例如 `Resize(_, _)`），因为它可能生成重复的 C 变量名。建议使用 `_w`、`_h` 这类不同的忽略名。

---

## Match 守卫（Guard）的当前状态

Zen C 语法层面允许在模式后面写 `if` 守卫：

```zenc
match n {
    0 => { println "zero"; },
    x if x % 2 == 0 => { println "even"; },
    _ => { println "odd"; },
}
```

> [!WARNING]
> 目前守卫条件会被解析，但在代码生成阶段不会被真正执行。如果你现在需要可靠的守卫语义，请先写宽匹配分支，再在分支体里使用显式 `if`。

---

## 穷尽性与通配符

在对 `enum` 进行匹配时，请显式覆盖每一个变体，或者添加一个兜底捕获的 `_ => { ... }` 分支。通常更推荐使用显式变体分支，这样意图更清晰，也更便于后续维护。

当前编译器行为：非穷尽 `match` 会给出 warning 诊断。实践中应把这个 warning 视作正确性问题并立即修复。

---

## 小结

在本节中，你学习了如何使用引用绑定（`ref`）在不触发资源移动的情况下安全地检查载荷，如何在 `let` 与 `match` 中解构结构体和元组，以及如何有意识地使用通配符。

接下来，在 [第 7 章](ch07-00-modules.md) 中，我们将学习如何将不断扩大的代码库组织成模块！
