# Data Types

Every value in Zen C is of a specific **data type**, which determines how much memory is allocated and how the binary bits are interpreted.

Zen C is a strongly typed language with two categories of data types: **Scalar Types** (single values) and **Compound Types** (groupings of multiple values).

---

## Scalar Types

A scalar type represents a single value. Zen C provides four primary scalar types: integers, floating-point numbers, booleans, and characters.

### 1. Integer Types

An integer is a number without a fractional component. Zen C provides explicitly-sized integer types as well as architecture-dependent integer types:

| Type | Bits | Signed Range | Unsigned Range |
| :--- | :--- | :--- | :--- |
| `i8` / `u8` | 8-bit | -128 to 127 | 0 to 255 |
| `i16` / `u16` | 16-bit | -32,768 to 32,767 | 0 to 65,535 |
| `i32` / `int` / `u32` | 32-bit | -2,147,483,648 to 2,147,483,647 | 0 to 4,294,967,295 |
| `i64` / `u64` | 64-bit | -9.22 × 10¹⁸ to 9.22 × 10¹⁸ | 0 to 1.84 × 10¹⁹ |
| `usize` / `isize` | Pointer size | 32-bit or 64-bit depending on architecture |

```zenc
let small_num: u8 = 255;
let id: i32 = -100;
let size: usize = 1024;
```

### 2. Floating-Point Types

Zen C has two primitive floating-point types representing numbers with decimal points:

- `f32`: Single-precision float (32-bit IEEE 754).
- `f64` / `double`: Double-precision float (64-bit IEEE 754).

```zenc
let x: f32 = 3.14;
let y: f64 = 2.718281828459045;
```

### 3. Boolean Type

The boolean type in Zen C is `bool`. It has two possible values: `true` and `false`:

```zenc
let is_active: bool = true;
let is_finished: bool = false;
```

### 4. Character and String Types

- `char`: Represents a single 8-bit ASCII character or byte.
- `string`: Represents a UTF-8 null-terminated string.

```zenc
let letter: char = 'A';
let greeting: string = "Hello, world!";
```

---

## Compound Types: Fixed-Size Arrays (`T[N]`)

An **array** is a fixed-length sequence of elements of the same type stored contiguously in memory.

```zenc
let numbers: i32[5] = [10, 20, 30, 40, 50];
```

### Accessing Array Elements

Array elements are indexed starting at `0`:

```zenc
let first = numbers[0]; // 10
let third = numbers[2]; // 30

numbers[0] = 99; // Modify first element
```

Next, let's look at functions in Zen C!
