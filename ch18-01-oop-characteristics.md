# 18.1 Object-Oriented Characteristics of Zen C

Is Zen C an object-oriented programming language? The answer depends on which parts of the object-oriented tradition you value. In his original formulation and in the *Design Patterns* ("Gang of Four") tradition, object-oriented design centers on three core ideas:

1. **Objects Package Data and Behavior**: Structs hold state and `impl` blocks attach methods that operate on `self`.
2. **Encapsulation**: Objects hide their internal representation details so external callers cannot violate data invariants.
3. **Code Reuse and Polymorphism**: New types can reuse existing fields and behavior without copy-pasting code, and different types can be treated uniformly through shared contracts.

Zen C embraces all three goals while deliberately rejecting **implementation class inheritance** (`class Derived : public Base`). Let's see why—and how Zen C's composition model solves the same problems more cleanly.

---

## 1. Objects and Encapsulation

In Zen C, data (`struct`) and behavior (`impl`) are declared separately, keeping the physical memory layout of a `struct` 100% transparent and C-ABI compatible while providing clean `instance.method()` syntax:

- **Module-Level Encapsulation (`opaque struct`)**: As we saw in [Section 7.3](ch07-03-encapsulation.md), marking a struct `opaque struct` allows external modules to allocate it on the stack and pass it by value while restricting direct field access (`obj.field`) to the defining module.
- **Invariant-Preserving Methods**: Even within a module, grouping state transitions into dedicated methods (such as clamping `hp` to `0..=max_hp` inside `apply_damage` and `heal`) ensures invariants are enforced in one place.

---

## 2. Why Zen C Uses Composition (`use`) Instead of Class Inheritance

In traditional class-hierarchy languages, inheritance serves two unrelated roles at once: **sharing implementation code** (inheriting fields and methods from a parent class) and **subtyping** (allowing a `Child*` to be passed where a `Base*` is expected). Tying those two roles together creates well-known engineering hazards:

- **The Diamond Problem**: If `FlyingCar` inherits from both `Airplane` and `Car`, and both inherit from `Vehicle`, how many copies of `Vehicle`'s fields exist in memory, and which `move()` method wins?
- **Tight Coupling to Base Class Layout**: Adding a field or virtual method to a base class changes the size and layout of every derived class across the entire program.
- **Hidden Per-Object `vptr` Overhead**: In C++, adding even a single `virtual` method to a class silently adds an 8-byte hidden `vptr` pointer to **every instance** of that class, breaking raw C struct compatibility.

### Combining Primary Mixins (`use Base;`) and Named Components (`use field: Part;`)

In [Section 5.4](ch05-04-composition.md), we introduced the `use` keyword inside structs. When building larger entity architectures (such as game objects, UI widgets, or network protocol handlers), Zen C distinguishes two ways of embedding components:

1. **Primary Flattened Mixin (`use Transform2D;` at offset `0`)**:
   - Placing an unnamed `use Transform2D;` as the **first field** embeds `Transform2D`'s fields (`x`, `y`) directly at byte offset `0` of the outer struct and **automatically forwards all `Transform2D` methods** (`hero.translate(8, 15)`).
   - Under the hood in C11, calling `hero.translate(8, 15)` passes `(Transform2D*)&hero` to `Transform2D__translate`—which works with zero overhead because `Transform2D`'s fields sit right at offset `0` of `Player`!
2. **Named Component Composition (`use health: HealthPool;`)**:
   - When an entity owns additional subsystems (`HealthPool`, `Inventory`, `PhysicsBody`) placed at non-zero byte offsets after the first field, embed them as **named components** (`use health: HealthPool;` or `health: HealthPool;`).
   - Callers invoke methods clearly through the component namespace (`hero.health.apply_damage(65)`), avoiding method-name collisions and keeping every sub-struct's pointer offset exact.

```
Player Memory Layout (24 bytes total, 0 hidden vptr bytes):
Offset:  0..3     4..7     8..11       12..15          16..23
       +--------+--------+-----------+---------------+---------------+
       |   x    |   y    | health.hp | health.max_hp |   callsign    |
       +--------+--------+-----------+---------------+---------------+
       |<-- Transform2D ->|<------ HealthPool ------>|<-- string --->|
       (Unnamed mixin @ 0) (Named component @ +8)
```

> [!IMPORTANT]
> **One Unnamed Method-Forwarding Mixin at Offset `0`**: Because forwarded methods on an unnamed `use Base;` mixin cast the outer struct pointer `(Base*)&outer` (offset `0`), only the **first** embedded struct at byte offset `0` should use unnamed `use Base;` when forwarding methods that access `self` fields. Always use named composition (`use name: Component;`) for second and subsequent embedded components!

---

## 3. Complete Example: Entity Composition with `Transform2D` and `HealthPool`

Listing 18-1 builds a `Player` entity that mixes in `Transform2D` at offset `0` (inheriting `.translate()` and `.manhattan_dist()` directly on `Player`) and composes a `HealthPool` component (`hero.health.apply_damage(...)`, `hero.health.heal(...)`) that enforces the invariant $0 \le \text{hp} \le \text{max\_hp}$.

**Listing 18-1**: Struct composition, method forwarding, and invariant encapsulation (`examples/ch18/ch18-01-oop-characteristics/main.zc`)

```zenc
// File: examples/ch18/ch18-01-oop-characteristics/main.zc

// 1. Primary spatial base mixed in at offset 0 via unnamed `use Transform2D;`
struct Transform2D {
    x: int;
    y: int;
}

impl Transform2D {
    fn translate(self, dx: int, dy: int) {
        self.x += dx;
        self.y += dy;
    }

    fn manhattan_dist(self) -> int {
        let ax = self.x < 0 ? -self.x : self.x;
        let ay = self.y < 0 ? -self.y : self.y;
        return ax + ay;
    }
}

// 2. Reusable health component with encapsulated invariant (`0 <= hp <= max_hp`)
struct HealthPool {
    hp: int;
    max_hp: int;
}

impl HealthPool {
    fn apply_damage(self, amount: int) {
        if amount <= 0 {
            return;
        }
        self.hp -= amount;
        if self.hp < 0 {
            self.hp = 0;
        }
    }

    fn heal(self, amount: int) {
        if amount <= 0 {
            return;
        }
        self.hp += amount;
        if self.hp > self.max_hp {
            self.hp = self.max_hp;
        }
    }

    fn is_alive(self) -> bool {
        return self.hp > 0;
    }
}

// `Player` combines an unnamed primary mixin (`use Transform2D;` at offset 0)
// with named component composition (`use health: HealthPool;`)
struct Player {
    use Transform2D;
    use health: HealthPool;
    callsign: string;
}

impl Player {
    fn new(callsign: string, start_x: int, start_y: int, max_hp: int) -> Player {
        return Player {
            x: start_x,
            y: start_y,
            health: HealthPool { hp: max_hp, max_hp: max_hp },
            callsign: callsign,
        };
    }

    fn status_report(self) -> string {
        return "{self.callsign} @ ({self.x}, {self.y}) [HP: {self.health.hp}/{self.health.max_hp}]";
    }
}

fn main() {
    let hero = Player::new("Vanguard", 2, -3, 100);

    // 1. Call methods forwarded automatically from the primary `Transform2D` mixin
    hero.translate(8, 15); // (2 + 8, -3 + 15) = (10, 12)
    let dist = hero.manhattan_dist();
    println "After translate: {hero.status_report()}, dist={dist}";
    assert(hero.x == 10 && hero.y == 12 && dist == 22, "Transform2D mixin methods must update x and y");

    // 2. Call methods on the composed `health` component
    hero.health.apply_damage(65);
    println "After 65 damage: {hero.status_report()}";
    assert(hero.health.hp == 35 && hero.health.is_alive(), "HP should be 35 and alive");

    // 3. Invariant enforcement: healing clamps to `max_hp`, lethal damage clamps to 0
    hero.health.heal(200);
    assert(hero.health.hp == 100, "Heal must clamp to max_hp (100)");

    hero.health.apply_damage(250);
    println "After 250 damage: {hero.status_report()}, alive={hero.health.is_alive()}";
    assert(hero.health.hp == 0 && !hero.health.is_alive(), "Lethal damage must clamp hp to 0");
}
```

Run and verify Listing 18-1 with `zc run -q`:

```text
$ zc run -q examples/ch18/ch18-01-oop-characteristics/main.zc
After translate: Vanguard @ (10, 12) [HP: 100/100], dist=22
After 65 damage: Vanguard @ (10, 12) [HP: 35/100]
After 250 damage: Vanguard @ (10, 12) [HP: 0/100], alive=false
```
