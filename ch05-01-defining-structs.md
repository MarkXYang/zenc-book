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

```zenc
let user1 = User {
    username: "mark",
    email: "mark@example.com",
    sign_in_count: 1,
    active: true,
};

println "User: {user1.username}, Logins: {user1.sign_in_count}";
```

To update a field on an instance declared with `let`, assign directly to the field using dot notation:

```zenc
user1.email = "mark.new@example.com";
user1.sign_in_count = user1.sign_in_count + 1;

println "Updated email: {user1.email}";
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

```zenc
let p = Point { x: 10, y: 20 };

// Unpacks p.x into 'x', and p.y into 'y'
let Point { x, y } = p;

println "x = {x}, y = {y}";
// Output: x = 10, y = 20
```

### Renaming Fields During Destructuring

If you want to assign fields to variables with different names, specify `field_name: new_variable_name`:

```zenc
let Point { x: pos_x, y: pos_y } = p;

println "pos_x = {pos_x}, pos_y = {pos_y}";
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

> [!NOTE]
> **Mixin Method Forwarding**: If `Entity` implements methods (such as `id_string()`), `player.id_string()` can be called directly on `Player` instances! We will explore this in detail in [Section 5.2](ch05-02-method-syntax.md).

### 2. Named Composition (`use name: Type;`)

Named composition embeds the component as a nested field. It is accessed via `outer.field_name`:

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

---

## Low-Level Control: Bitfields & Attributes

Zen C is designed for systems-level control. When writing drivers, network protocols, or memory-constrained embedded systems, you often need exact control over struct layout, padding, and alignment.

### Bitfields

Zen C natively supports C-style bitfields using `field: Type : N;` where `N` is the number of bits allocated to the field:

```zenc
struct Flags {
    is_readable:   u8 : 1; // 1 bit
    is_writable:   u8 : 1; // 1 bit
    is_executable: u8 : 1; // 1 bit
    mode:          u8 : 2; // 2 bits (values 0-3)
    reserved:      u8 : 3; // 3 bits padding out the 8-bit byte
}
```

Bitfield access works seamlessly with standard dot notation:

```zenc
let perms = Flags {
    is_readable: 1,
    is_writable: 1,
    is_executable: 0,
    mode: 2,
    reserved: 0,
};

if perms.is_readable == 1 {
    println "File is readable";
}
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

```zenc
@derive(Copy)
struct Point {
    x: int;
    y: int;
}

fn main() {
    let p1 = Point { x: 1, y: 2 };
    let p2 = p1; // Copied! p1 remains completely valid.

    println "p1: ({p1.x}, {p1.y}), p2: ({p2.x}, {p2.y})";
}
```

> [!CAUTION]
> **Safety Rule**: Types that implement `Copy` must not define a custom destructor (`Drop`).

---

## Working with Pointers to Structs

In systems programming, structs are frequently passed by reference using pointers (`Type*`) to avoid copying large amounts of memory:

```zenc
fn print_user(user: User*) {
    // In Zen C, dot (.) automatically dereferences pointers!
    println "User: {user.username} <{user.email}>";
}

fn main() {
    let u = User {
        username: "mark",
        email: "mark@example.com",
        sign_in_count: 5,
        active: true,
    };

    print_user(&u); // Pass pointer to u
}
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
