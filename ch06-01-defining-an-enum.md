# Defining an Enum

An **enum** (short for *enumeration*) allows you to define a type by enumerating its possible variants. Unlike traditional C enums, which are simply named integers, Zen C enums are **Tagged Unions** (also known as *Sum Types* or *Algebraic Data Types*).

Each variant of an enum can independently store data of different types, or no data at all.

---

## Defining an Enum

To define an enum, use the `enum` keyword followed by the enum's name in `UpperCamelCase`. Inside curly braces `{ }`, list the variants separated by commas:

```zenc
enum Status {
    Idle,
    Running,
    Finished,
    Error(int),
}
```

In this example, `Status` can be in one of four states:
- `Idle`, `Running`, and `Finished` do not carry any payload data.
- `Error(int)` carries an integer error code (such as `404` or `500`).

---

## Kinds of Enum Variants

Zen C supports three primary kinds of enum variants:

### 1. Unit Variants (No Payload)

Variants without parentheses hold no payload data. They act as type-safe state flags:

```zenc
enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
}
```

### 2. Single-Payload Variants

Variants can hold a single piece of data by specifying the type inside parentheses `(Type)`:

```zenc
enum Shape {
    Circle(float),      // Radius
    Point,              // No payload (unit variant)
}
```

### 3. Multi-Payload (Tuple) Variants

Variants can store multiple values by specifying comma-separated types inside parentheses `(Type1, Type2, ...)`:

```zenc
enum Shape {
    Circle(float),        // Single payload: radius
    Rect(float, float),   // Multi payload: width and height
    Point,                // Unit variant: at origin
}
```

### Comprehensive Example: Modeling Events

Enums shine when grouping heterogeneous operations under a single, unified type:

```zenc
enum WebEvent {
    PageLoad,                     // Unit variant
    PageUnload,                   // Unit variant
    KeyPress(char),               // Single payload
    Click(int, int),              // Multi payload: x, y coordinates
    Paste(string),                // Single payload: text string
    ChangeColor(int, int, int),   // Multi payload: RGB values
}
```

Notice how much cleaner and safer this is compared to creating six separate structs or managing an unsafe C `void*` pointer!

---

## Instantiating Enum Variants

To instantiate an enum variant, use the double colon (`::`) namespace operator on the enum name:

```zenc
fn main() {
    // Instantiating unit variants:
    let load_event = WebEvent::PageLoad;
    let unload_event = WebEvent::PageUnload;

    // Instantiating payload variants with arguments:
    let press_event = WebEvent::KeyPress('q');
    let click_event = WebEvent::Click(100, 250);
    let paste_event = WebEvent::Paste("Hello, Zen C!");
    let color_event = WebEvent::ChangeColor(255, 128, 0);
}
```

> [!TIP]
> **Optional Parentheses on Unit Variants**: For unit variants without payloads, `WebEvent::PageLoad` and `WebEvent::PageLoad()` are both valid. The version without parentheses is idiomatic.

---

## Under the Hood: Tagged Union Memory Layout

How does Zen C implement enums without garbage collection overhead while maintaining C ABI compatibility?

When compiling to GNU C11, the `zc` compiler transpiles an enum into an optimized **Tagged Union**:

1. **A Discriminant Tag**: A C `typedef enum` assigning each variant an integer tag (`Status__Idle_Tag = 0`, `Status__Running_Tag = 1`, etc.).
2. **An Overlapping `union`**: A C `union data` containing fields for each variant's payload.
3. **A Container Struct**: A C `struct` that bundles the tag and the union together.

For example, our `Status` enum transpiles conceptually into the following C11 code:

```c
// Conceptually generated C11 representation
typedef enum {
    Status__Idle_Tag,
    Status__Running_Tag,
    Status__Finished_Tag,
    Status__Error_Tag,
} Status_Tag;

struct Status {
    Status_Tag tag;
    union {
        int Error;
    } data;
};
```

### Memory Efficiency

Because all variant payloads share the same memory in the union, the total memory consumed by an enum instance is simply:

$$\text{Total Size} = \text{sizeof(Tag)} + \text{sizeof(Largest Payload)} + \text{Alignment Padding}$$

For instance, if an enum has variants `Char(u8)` (1 byte) and `Coordinate(f64, f64)` (16 bytes), all instances share the 16-byte payload space. When an instance is a `Char`, only 1 byte of the union is used; when it is a `Coordinate`, all 16 bytes are used.

```text
+-------------------+-----------------------------------------------+
|   Tag (4 bytes)   |              Payload Union (16 bytes)         |
+-------------------+-----------------------------------------------+
| Status__Error_Tag | Error Code: 404 (4 bytes) | Unused (12 bytes) |
+-------------------+---------------------------+-------------------+
```

---

## Methods on Enums (`impl EnumName`)

Just like structs in [Section 5.2](ch05-02-method-syntax.md), enums can have methods attached to them using `impl` blocks!

Inside an enum method:
- The receiver is `self` (or `const self`).
- Because `self` is a pointer to the enum instance (`Status* self`), you can dereference `*self` to pattern match on the active variant:

```zenc
enum Status {
    Idle,
    Running,
    Finished,
    Error(int),
}

impl Status {
    // Read-only inspection method
    fn is_terminal(const self) -> bool {
        match *self {
            Status::Finished => { return true; },
            Status::Error(_) => { return true; },
            _ => { return false; },
        }
    }

    // Extraction method with fallback
    fn error_or_default(const self, default_code: int) -> int {
        match *self {
            Status::Error(code) => { return code; },
            _ => { return default_code; },
        }
    }
}

fn main() {
    let s1 = Status::Running;
    let s2 = Status::Error(500);

    println "Is s1 terminal? {s1.is_terminal()}"; // false
    println "Is s2 terminal? {s2.is_terminal()}"; // true
    println "s2 error code: {s2.error_or_default(0)}"; // 500
}
```

---

## The Standard Library's `Option` and `Result`

Zen C replaces error codes and error-prone `NULL` pointers with two standard enums:

### 1. `Option<T>`: Representing Optional Values

Instead of returning a pointer that might be `NULL` (requiring manual null checks), functions can return an `Option<T>`:

```zenc
enum Option<T> {
    Some(T),
    None,
}
```

If a value is present, it is wrapped in `Option::Some(value)`. If absent, it is `Option::None`.

### 2. `Result<T, E>`: Recoverable Errors

Instead of returning integer status codes or setting global `errno` variables, functions that might fail return `Result<T, E>`:

```zenc
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

We will dive deeply into `Option` and `Result` in [Chapter 9: Error Handling](ch09-00-error-handling.md).

---

## Summary of Enum Syntax

| Feature | Syntax Example | Notes |
| :--- | :--- | :--- |
| **Enum Declaration** | `enum Status { Idle, Error(int) }` | Commas separate variants |
| **Unit Variant** | `Status::Idle` | No payload data |
| **Single Payload** | `Status::Error(404)` | Stores one value |
| **Tuple Payload** | `Shape::Rect(10.0, 20.0)` | Stores multiple values |
| **Memory Model** | Tag + Union payload | Zero heap allocation overhead |
| **Methods** | `impl Status { fn is_ok(const self) -> bool { ... } }` | Implements behaviors on enums |

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch06/ch06-01-defining-an-enum/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch06/ch06-01-defining-an-enum/main.zc).

Now that we know how to define and instantiate enums, let's learn how to safely inspect and extract their values using **The `match` Control Flow Construct**!
