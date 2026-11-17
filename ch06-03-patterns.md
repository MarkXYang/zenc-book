# Patterns and Destructuring

Patterns are a special syntax in Zen C for matching against the structure of types, both complex and simple. Combining patterns with `match` expressions and `let` bindings lets you unpack structs, inspect enum payloads without moving them, and write concise, exhaustive control flow.

---

## Reference Binding (`ref`)

When pattern matching on an enum variant that holds a non-`Copy` resource type, matching by value moves ownership of the payload into the pattern variable.

To inspect or borrow the payload without taking ownership, use the **`ref`** keyword. Inside the match arm, the bound variable has pointer type (`T*`), so you dereference it (`*text`) when reading the value:

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

## Struct and Tuple Destructuring

Destructuring is not limited to `match` arms. You can also destructure directly in `let` bindings.

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

    // Shorthand struct destructuring
    let Point { x, y } = p;
    println "{x}, {y}";

    // Renamed struct destructuring
    let Point { x: x1, y: y1 } = p;
    println "{x1}, {y1}";

    // Tuple destructuring
    let (a, b) = pair();
    println "{a}, {b}";
}
```

---

## Destructuring in `match` Arms

You can also destructure `struct` values directly inside `let` statements or inside `match` arms to bind each field to a local variable:

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

<span class="caption">Listing 6-7: Reference binding (`ref`) and struct destructuring across `match` and `let`</span>

---

## Ignoring Values with Wildcards

Use `_` when you do not care about part of a matched value:

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
> In the current compiler, avoid repeating plain `_` more than once in the same payload pattern (for example `Resize(_, _)`), because it can generate duplicate C variable names. Prefer distinct ignored names such as `_w` and `_h`.

---

## Match Guards: Current State

Zen C's parser accepts `if` guards after a pattern:

```zenc
match n {
    0 => { println "zero"; },
    x if x % 2 == 0 => { println "even"; },
    _ => { println "odd"; },
}
```

> [!WARNING]
> At the moment, guard conditions are parsed but not enforced during code generation. If you need reliable guard behavior today, keep the `match` arm broad and put an explicit `if` inside the arm body.

---

## Exhaustiveness and Wildcards

When matching on an `enum`, cover every variant explicitly or add a catch-all `_ => { ... }` arm. Explicit variant arms are generally preferred because they make intent clear and keep behavior stable as enums evolve.

Current compiler behavior: non-exhaustive enum matches produce a warning diagnostic. Treat that warning as a correctness issue and fix it immediately.

---

## Summary

In this section, you learned how to use reference binding (`ref`) to safely inspect payloads without triggering resource moves, how to destructure structs and tuples in both `let` and `match`, and how to use wildcards intentionally.

Next, in [Chapter 7](ch07-00-modules.md), we'll learn how to organize growing codebases into modules!
