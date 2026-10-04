# Patterns and Destructuring

Patterns are a special syntax in Zen C for matching against the structure of types, both complex and simple. Combining patterns with `match` expressions and other constructs gives you more control over program control flow.

---

## Reference Binding (`ref`)

When pattern matching on an enum variant that holds a non-`Copy` resource type, the default behavior is to move ownership of the payload into the pattern variable.

To inspect or borrow the payload without taking ownership, use the **`ref`** keyword:

```zenc
enum Packet {
    Data(string),
}

fn handle_packet(p: Packet*) {
    match *p {
        Packet::Data(ref text) => {
            // text is borrowed by reference: string*
            println "Inspecting packet: {text}";
        },
    }
    // *p remains valid!
}
```

---

## Destructuring in `let` Bindings

Patterns can also be used in `let` statements to unpack tuples and structs directly:

```zenc
struct Point { x: int; y: int; }

let p = Point { x: 10, y: 20 };
let Point { x, y } = p;
println "x = {x}, y = {y}";
```

---

## Summary

In this section, you learned how to use reference binding (`ref`) to safely inspect payloads without triggering resource moves, and how to destructure data types across `let` statements.

Next, in [Chapter 7](ch07-00-modules.md), we'll learn how to organize growing codebases into modules!
