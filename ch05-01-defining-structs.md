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

---

## Summary of Struct Basics

In this section, you learned:
- How to define custom struct types with named fields.
- How to instantiate structs with mandatory complete initialization.
- How to zero-initialize all bytes of a struct with `Struct{}`.
- How to read and update fields using uniform dot notation (`.`).
- How to destructure struct fields into local variables with shorthand and renaming.

Next, let's build a complete example program calculating areas of rectangles!
