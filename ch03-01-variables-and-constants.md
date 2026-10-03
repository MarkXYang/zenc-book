# Variables and Constants

Zen C distinguishes between **variables** (storage locations in memory) and **manifest constants** (values evaluated at compile time). Understanding how both work ensures your programs remain safe, readable, and efficient.

---

## Manifest Constants (`def`)

Values that exist purely at compile-time are declared using the `def` keyword. Manifest constants are folded directly into the generated machine code during transpilation and do not occupy runtime stack space.

```zenc
def MAX_BUFFER_SIZE = 1024;
def PI = 3.14159265;
```

You can use manifest constants as array lengths, loop boundaries, and configuration limits:

```zenc
def MAX_BUFFER_SIZE = 1024;
let buffer: char[MAX_BUFFER_SIZE]; // Valid array size at compile-time
```

---

## Variables (`let`)

Variables are declared using the `let` keyword. By default, variables declared with `let` are mutable:

```zenc
let x = 10;
x = 20; // OK: x is modified
```

### Type Inference

Zen C features automatic type inference. You don't need to manually specify the type if the initial value clearly indicates it:

```zenc
let count = 42;       // Inferred as int
let price = 19.99;    // Inferred as f64
let message = "Hello"; // Inferred as string
```

Under the hood, Zen C transpiles type-inferred variables to `auto` (C23) or GCC's `__auto_type` extension without any runtime penalty.

---

## Read-Only Variables (`const`)

If you want a variable stored in memory to be immutable and read-only, qualify its type with `const`:

```zenc
let y: const int = 10;
// y = 20; // Error: cannot assign to const variable
```

### `def` vs `const` Variables

| Feature | `def` (Manifest Constant) | `let x: const T` (Read-only Variable) |
| :--- | :--- | :--- |
| **Storage** | Compile-time literal (folded in code) | Stack or data segment memory |
| **Addressable (`&`)** | No | Yes (has a memory address) |
| **Array sizing** | Can size fixed arrays | Depends on C compiler VLA rules |

---

## Putting It All Together

**Listing 3-1: `list3-1.zc`**

```zenc
 1 | fn main() {
 2 |     def PI = 3.14159265;
 3 |     let x = 10;
 4 |     x = 20;
 5 |     let count = 42;
 6 |     let price = 19.99;
 7 |     let message = "Hello";
 8 |     let y: const int = 10;
 9 |
10 |     println "PI: {PI}, x: {x}, count: {count}, price: {price}, message: {message}, y: {y}";
11 | }
```

Output:
```text
PI: 3.141593, x: 20, count: 42, price: 19.990000, message: Hello, y: 10
```

Next, let's explore Zen C's primitive and compound data types!
