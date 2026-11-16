# Composition with use

## Struct Composition and Mixins (`use`)

Rather than relying on rigid object-oriented class hierarchies, Zen C provides flexible composition and mixin capabilities via the `use` keyword inside struct definitions.

Zen C supports two forms of struct reuse:
1. **Flattened Mixin** (Unnamed `use Type;`)
2. **Named Composition** (`use name: Type;`)

### 1. Flattened Mixin (Unnamed `use Type;`)

When you write `use Type;` without a field name, Zen C **flattens** all the fields of the target type into the outer struct. Furthermore, all methods defined on the embedded type are automatically inherited by the outer struct!

**Listing 5-8**
```zenc
struct Entity {
    id: int;
}

struct Player {
    // Mixin (Unnamed): Flattens fields
    use Entity;  // Adds 'id' to Player directly
    name: string;
}

fn main() {
    // When initializing, provide the flattened fields directly:
    let player = Player {
        id: 1,
        name: "Hero",
    };

    // Direct access to mixed-in fields:
    println "Player ID: {player.id}, Name: {player.name}";
}
```

Output:
```text
Player ID: 1, Name: Hero
```

> [!NOTE]
> **Mixin Method Forwarding**: If `Entity` implements methods (such as `id_string()`), `player.id_string()` can be called directly on `Player` instances! This works because `use` forwards the embedded struct's methods, which you learned to define in [Method Syntax](ch05-03-method-syntax.md).

### 2. Named Composition (`use name: Type;`)

Named composition embeds the component as a nested field. It is accessed via `outer.field_name`:

**Listing 5-9**
```zenc
struct Match {
    // Composition (Named): Nests fields
    use p1: Player; // Accessed via match.p1
    use p2: Player; // Accessed via match.p2
}

fn main() {
    let m = Match {
        p1: Player { id: 1, name: "Alice" },
        p2: Player { id: 2, name: "Bob" },
    };

    println "Match: {m.p1.name} (id {m.p1.id}) vs {m.p2.name} (id {m.p2.id})";
}
```

Output:
```text
Match: Alice (id 1) vs Bob (id 2)
```

---

## Mixin Method Forwarding

In [Section 5.1](ch05-01-defining-structs.md), we learned that structs can embed other structs using the `use` keyword. When a struct embeds another type via a mixin, all methods defined on the embedded type are **automatically available** on instances of the outer struct:

**Listing 5-10**
```zenc
struct Rectangle {
    width: int;
    height: int;
}

impl Rectangle {
    fn area(const self) -> int {
        return self.width * self.height;
    }
}

struct Window {
    use Rectangle; // Mixin: flattens fields and inherits Rectangle methods!
    title: string;
}

fn main() {
    let win = Window {
        width: 800,
        height: 600,
        title: "Main Application",
    };

    // area() is inherited directly from Rectangle!
    println "Window '{win.title}' area: {win.area()} px";
}
```

Output:
```text
Window 'Main Application' area: 480000 px
```

This mixin pattern provides the code-reuse benefits of object-oriented inheritance while preserving flat, predictable C struct memory layouts.

---

---

## Summary

In this section, you learned:
- How Zen C replaces traditional class inheritance with flexible struct composition via `use`.
- How unnamed mixins (`use Type;`) flatten fields directly into the parent struct.
- How named composition (`use name: Type;`) nests fields cleanly.
- How methods defined on mixin types are automatically forwarded and callable on the outer struct.

In [Chapter 6](ch06-00-enums.md), we'll explore **Enums and Pattern Matching**!
