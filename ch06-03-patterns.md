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

## Destructuring in `let` Bindings and `match` Arms

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
        Packet::Ping() => return "ping",
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

<span class="caption">Listing 6-9: Reference binding (`ref`) and struct destructuring across `match` and `let`</span>

## Exhaustiveness and Wildcards

When matching on an `enum`, cover every variant explicitly or add a catch-all `_ => { ... }` arm. Explicit variant arms are generally preferred because the compiler will alert you if you add a new enum variant later and forget to handle it.

---

## Summary

In this section, you learned how to use reference binding (`ref`) to safely inspect payloads without triggering resource moves, and how to destructure data types across `match` arms and `let` statements.

Next, in [Chapter 7](ch07-00-modules.md), we'll learn how to organize growing codebases into modules!
