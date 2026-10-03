# Defining and Instantiating Structs

Structs allow you to create custom, named data types that bundle multiple values together. Each value in a struct is called a **field**, and each field has an explicit identifier name and type.

---

## Defining a Struct

To define a struct, use the `struct` keyword followed by the struct name in `UpperCamelCase` (PascalCase). Inside curly braces `{ }`, declare each field name followed by a colon `:` and its data type, terminated by a semicolon `;` (or a comma `,`):

```zenc
struct User {
    username: string;
    email: string;
    sign_in_count: u64;
    active: bool;
}
```

Fields can be any valid Zen C type:
- Primitive scalar types (`int`, `u32`, `f64`, `bool`, `char`, `string`)
- Pointers (`void*`, `User*`)
- Fixed-size arrays (`[int; 4]`)
- Other struct types (nested structs)

```zenc
struct Point {
    x: int;
    y: int;
}

struct Rectangle {
    top_left: Point;
    width: int;
    height: int;
}
```

---

## Instantiating Structs

To create an instance of a struct, write the name of the struct followed by curly braces containing `key: value` pairs for the fields:

```zenc
let user1 = User {
    username: "mark",
    email: "mark@example.com",
    sign_in_count: 1,
    active: true,
};
```

> [!TIP]
> **Trailing Commas**: Adding a comma after the final field initializer is valid and encouraged in multi-line initializers to make future diffs cleaner.

### Complete Field Initialization Rule

By default, Zen C requires that **all fields** defined on the struct are provided in the struct literal. If any field is omitted, the compiler will reject the initialization with a helpful diagnostic:

```zenc
let incomplete = User {
    username: "mark",
    email: "mark@example.com",
    // Missing sign_in_count and active!
};
```

**Compiler Error:**
```text
error: Missing field 'sign_in_count' in initializer for struct 'User'
  --> src/main.zc:12:18
   |
12 |     let incomplete = User {
   |                      ^ here
   = help: All struct fields must be initialized
```

This strictness eliminates the common C pitfall where uninitialized struct fields hold garbage memory values.

### Zero-Initialization with `Struct{}`

If you want to quickly zero-initialize an entire struct (equivalent to C's `memset(&s, 0, sizeof(s))` or C11's `(struct User){0}`), you can instantiate it with empty braces `{}`:

```zenc
let blank_user = User {};
// blank_user.username is NULL (0)
// blank_user.sign_in_count is 0
// blank_user.active is false
```

You can also declare a variable with a type annotation without an immediate initializer:

```zenc
let u: User;
u.username = "alice";
u.email = "alice@example.com";
u.sign_in_count = 0;
u.active = true;
```

---

## Accessing and Updating Fields

To access values stored in a struct, use **dot notation** (`.`):

**Listing 5-1: `list5-1.zc`**

```zenc
 1 | let user1 = User {
 2 |     username: "mark",
 3 |     email: "mark@example.com",
 4 |     sign_in_count: 1,
 5 |     active: true,
 6 | };
 7 |
 8 | println "User: {user1.username}, Logins: {user1.sign_in_count}";
 9 |
10 | // Update fields on a mutable instance declared with 'let':
11 | user1.email = "mark.new@example.com";
12 | user1.sign_in_count = user1.sign_in_count + 1;
13 |
14 | println "Updated email: {user1.email}";
```

Output:
```text
User: mark, Logins: 1
Updated email: mark.new@example.com
```

For nested structs, chain dot accessors:

```zenc
let rect = Rectangle {
    top_left: Point { x: 0, y: 10 },
    width: 100,
    height: 50,
};

println "Top-left X: {rect.top_left.x}, Y: {rect.top_left.y}";
rect.top_left.x = 20;
```

---

## Destructuring Structs

Zen C supports **pattern-based destructuring** on struct variables. This lets you extract one or more fields into distinct local variables in a single statement.

### Shorthand Destructuring

When the local variable names match the struct field names:

**Listing 5-2: `list5-2.zc`**

```zenc
 1 | let p = Point { x: 10, y: 20 };
 2 |
 3 | // Unpacks p.x into 'x', and p.y into 'y'
 4 | let Point { x, y } = p;
 5 |
 6 | println "x = {x}, y = {y}";
```

Output:
```text
x = 10, y = 20
```

### Renaming Fields During Destructuring

If you want to assign fields to variables with different names, specify `field_name: new_variable_name`:

**Listing 5-3: `list5-3.zc`**

```zenc
 1 | let Point { x: pos_x, y: pos_y } = p;
 2 |
 3 | println "pos_x = {pos_x}, pos_y = {pos_y}";
```

Output:
```text
pos_x = 10, pos_y = 20
```

Destructuring is especially useful when working with function return values, processing configuration options, or unpacking geometric coordinates.

---

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

## Low-Level Control: Bitfields & Attributes

Zen C is designed for systems-level control. When writing drivers, network protocols, or memory-constrained embedded systems, you often need exact control over struct layout, padding, and alignment.

### Bitfields

Zen C natively supports C-style bitfields using `field: Type : N;` where `N` is the number of bits allocated to the field:

**Listing 5-6: `list5-6.zc`**

```zenc
 1 | struct Flags {
 2 |     is_readable:   u8 : 1; // 1 bit
 3 |     is_writable:   u8 : 1; // 1 bit
 4 |     is_executable: u8 : 1; // 1 bit
 5 |     mode:          u8 : 2; // 2 bits (values 0-3)
 6 |     reserved:      u8 : 3; // 3 bits padding out the 8-bit byte
 7 | }
 8 |
 9 | fn main() {
10 |     let perms = Flags {
11 |         is_readable: 1,
12 |         is_writable: 1,
13 |         is_executable: 0,
14 |         mode: 2,
15 |         reserved: 0,
16 |     };
17 |
18 |     if perms.is_readable == 1 {
19 |         println "File is readable";
20 |     }
21 | }
```

Output:
```text
File is readable
```

### Packing with `@packed`

By default, the C compiler aligns struct fields on natural boundary multiples (e.g. 4 bytes or 8 bytes) by inserting invisible padding bytes. In binary protocol headers or file formats, padding causes field offsets to mismatch.

Add `@packed` above a struct definition to instruct the compiler to eliminate all padding:

```zenc
@packed
struct EthernetHeader {
    dest_mac:   [u8; 6];
    src_mac:    [u8; 6];
    ether_type: u16;
} // Exact binary size: 14 bytes (no padding between fields)
```

### Alignment with `@align(N)`

To enforce custom memory alignment boundaries (for example, 16-byte or 32-byte alignment required by SIMD instructions):

```zenc
@align(16)
struct Vector4 {
    x: f32;
    y: f32;
    z: f32;
    w: f32;
}
```

You can also combine attributes:

```zenc
@packed @align(4)
struct HardwarePacket {
    id: u8;
    payload_len: u16;
}
```

### Opting Into Copy Semantics (`@derive(Copy)`)

As introduced in [Chapter 4](ch04-02-ownership-and-allocation.md), structs in Zen C default to move semantics to prevent accidental double frees. However, plain data structs containing only primitive values can opt into implicit copying using the `@derive(Copy)` attribute:

**Listing 5-7: `list5-7.zc`**

```zenc
 1 | @derive(Copy)
 2 | struct Point {
 3 |     x: int;
 4 |     y: int;
 5 | }
 6 |
 7 | fn main() {
 8 |     let p1 = Point { x: 1, y: 2 };
 9 |     let p2 = p1; // Copied! p1 remains completely valid.
10 |
11 |     println "p1: ({p1.x}, {p1.y}), p2: ({p2.x}, {p2.y})";
12 | }
```

Output:
```text
p1: (1, 2), p2: (1, 2)
```

> [!CAUTION]
> **Safety Rule**: Types that implement `Copy` must not define a custom destructor (`Drop`).

---

## Working with Pointers to Structs

In systems programming, structs are frequently passed by reference using pointers (`Type*`) to avoid copying large amounts of memory:

**Listing 5-8: `list5-8.zc`**

```zenc
 1 | struct User {
 2 |     username: string;
 3 |     email: string;
 4 |     sign_in_count: int;
 5 |     active: bool;
 6 | }
 7 |
 8 | fn print_user(user: User*) {
 9 |     // In Zen C, dot (.) automatically dereferences pointers!
10 |     println "User: {user.username} <{user.email}>";
11 | }
12 |
13 | fn main() {
14 |     let u = User {
15 |         username: "mark",
16 |         email: "mark@example.com",
17 |         sign_in_count: 5,
18 |         active: true,
19 |     };
20 |
21 |     print_user(&u); // Pass pointer to u
22 | }
```

Output:
```text
User: mark <mark@example.com>
```

> [!IMPORTANT]
> **Unified Dot Operator**: In traditional C, you must write `ptr->field` or `(*ptr).field`. In Zen C, dot syntax (`.`) works uniformly on both **struct values** and **struct pointers**! The compiler automatically transpiles `user.username` to `user->username` in C.

### Safe Navigation Operator (`?.`)

When working with potentially null pointers, Zen C provides the **safe navigation operator** (`?.`). If the pointer is `NULL`, accessing a field evaluates safely to zero/null rather than triggering a segmentation fault:

```zenc
let valid_ptr: User* = &u;
let safe_count = valid_ptr?.sign_in_count; // Evaluates to 5

let null_ptr: User* = NULL;
let zero_count = null_ptr?.sign_in_count; // Evaluates safely to 0 (no segfault!)
```

---

## Summary of Struct Syntax

| Feature | Syntax Example | Notes |
| :--- | :--- | :--- |
| **Definition** | `struct Point { x: int; y: int; }` | Semicolons or commas separate fields |
| **Literal Init** | `Point { x: 10, y: 20 }` | All fields must be explicitly initialized |
| **Zero Init** | `Point {}` | Initializes all bytes to zero |
| **Field Access** | `p.x` or `ptr.x` | Unified dot notation for values and pointers |
| **Destructuring** | `let Point { x, y } = p;` | Extracts fields into local variables |
| **Renamed Destruct** | `let Point { x: px, y: py } = p;` | Renames extracted fields |
| **Flattened Mixin** | `use Point;` | Embeds fields and methods into enclosing struct |
| **Named Composition** | `use origin: Point;` | Member component field |
| **Bitfields** | `flags: u8 : 1;` | Custom bit-width integer fields |
| **Attributes** | `@packed`, `@align(N)` | Control memory padding and alignment |
| **Safe Navigation** | `ptr?.field` | Safe dereference returning 0/NULL if null |

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch05/ch05-01-defining-structs/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch05/ch05-01-defining-structs/main.zc).

Now that we know how to define and instantiate structs, let's learn how to attach behavior to them using **Method Syntax and `impl` Blocks**!
