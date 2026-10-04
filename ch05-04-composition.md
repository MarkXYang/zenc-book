# Composition with use

## Struct Composition and Mixins (`use`)

Rather than relying on rigid object-oriented class hierarchies, Zen C provides flexible composition and mixin capabilities via the `use` keyword inside struct definitions.

Zen C supports two forms of struct reuse:
1. **Flattened Mixin** (Unnamed `use Type;`)
2. **Named Composition** (`use name: Type;`)

### 1. Flattened Mixin (Unnamed `use Type;`)

When you write `use Type;` without a field name, Zen C **flattens** all the fields of the target type into the outer struct. Furthermore, all methods defined on the embedded type are automatically inherited by the outer struct!

**Listing 5-4: `list5-4.zc`**

```zenc
 1 | struct Entity {
 2 |     id: int;
 3 | }
 4 |
 5 | struct Player {
 6 |     // Mixin (Unnamed): Flattens fields
 7 |     use Entity;  // Adds 'id' to Player directly
 8 |     name: string;
 9 | }
10 |
11 | fn main() {
12 |     // When initializing, provide the flattened fields directly:
13 |     let player = Player {
14 |         id: 1,
15 |         name: "Hero",
16 |     };
17 |
18 |     // Direct access to mixed-in fields:
19 |     println "Player ID: {player.id}, Name: {player.name}";
20 | }
```

Output:
```text
Player ID: 1, Name: Hero
```

> [!NOTE]
> **Mixin Method Forwarding**: If `Entity` implements methods (such as `id_string()`), `player.id_string()` can be called directly on `Player` instances! We will explore this in detail in [Section 5.2](ch05-02-method-syntax.md).

### 2. Named Composition (`use name: Type;`)

Named composition embeds the component as a nested field. It is accessed via `outer.field_name`:

**Listing 5-5: `list5-5.zc`**

```zenc
 1 | struct Match {
 2 |     // Composition (Named): Nests fields
 3 |     use p1: Player; // Accessed via match.p1
 4 |     use p2: Player; // Accessed via match.p2
 5 | }
 6 |
 7 | fn main() {
 8 |     let m = Match {
 9 |         p1: Player { id: 1, name: "Alice" },
10 |         p2: Player { id: 2, name: "Bob" },
11 |     };
12 |
13 |     println "Match: {m.p1.name} (id {m.p1.id}) vs {m.p2.name} (id {m.p2.id})";
14 | }
```

Output:
```text
Match: Alice (id 1) vs Bob (id 2)
```

---

## Mixin Method Forwarding

In [Section 5.1](ch05-01-defining-structs.md), we learned that structs can embed other structs using the `use` keyword. When a struct embeds another type via a mixin, all methods defined on the embedded type are **automatically available** on instances of the outer struct:

**Listing 5-14: `list5-14.zc`**

```zenc
 1 | struct Rectangle {
 2 |     width: int;
 3 |     height: int;
 4 | }
 5 |
 6 | impl Rectangle {
 7 |     fn area(const self) -> int {
 8 |         return self.width * self.height;
 9 |     }
10 | }
11 |
12 | struct Window {
13 |     use Rectangle; // Mixin: flattens fields and inherits Rectangle methods!
14 |     title: string;
15 | }
16 |
17 | fn main() {
18 |     let win = Window {
19 |         width: 800,
20 |         height: 600,
21 |         title: "Main Application",
22 |     };
23 |
24 |     // area() is inherited directly from Rectangle!
25 |     println "Window '{win.title}' area: {win.area()} px";
26 | }
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
