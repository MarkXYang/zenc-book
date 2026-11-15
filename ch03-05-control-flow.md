# Control Flow

The ability to control execution flow based on conditions, pattern matching, or repetition is fundamental to programming. Zen C provides modern conditional expressions, powerful `match` pattern matching, reference binding, rich range and enumerated loops, labeled loop control, and early-return guard clauses.

---

## Conditionals

### 1. `if`, `else if`, and `else`

Standard conditional branching tests boolean conditions:

**Listing 3-8: `list3-8.zc`**

```zenc
 1 | let x = 15;
 2 |
 3 | if x > 10 {
 4 |     println "Large";
 5 | } else if x > 5 {
 6 |     println "Medium";
 7 | } else {
 8 |     println "Small";
 9 | }
```

Output:
```text
Large
```

### 2. Ternary Operator

For concise inline choices, Zen C supports the standard ternary operator:

```zenc
let y = x > 10 ? 1 : 0;
```

### 3. `if` Expressions

`if` blocks in Zen C can act as expressions that evaluate to a value:

```zenc
let category = if (x > 100) { "huge" } else if (x > 10) { "large" } else { "small" };
```

---

## Pattern Matching (`match`)

Zen C features pattern matching via `match`, offering a safe, expression-driven alternative to C's traditional `switch` statement.

### 1. Value and Range Matching

`match` arms can match single literals, multiple OR conditions (`||`, `or`, `,`), or numeric ranges:

**Listing 3-9: `list3-9.zc`**

```zenc
 1 | let val = 12;
 2 |
 3 | match val {
 4 |     1         => { println "One"; },
 5 |     2 || 3    => { println "Two or Three"; },    // OR with ||
 6 |     4 or 5    => { println "Four or Five"; },    // OR with 'or'
 7 |     6, 7, 8   => { println "Six to Eight"; },    // OR with comma
 8 |     10 .. 15  => { println "10 to 14"; },        // Exclusive range
 9 |     10 ..< 15 => { println "10 to 14 (Explicit)"; }, // Exclusive range
10 |     20 ..= 25 => { println "20 to 25 (Inclusive)"; }, // Inclusive range
11 |     _         => { println "Other"; },           // Wildcard fallback
12 | }
```

Output:
```text
10 to 14
```

### 2. Destructuring Enums

`match` can destructure tagged union enums directly:

**Listing 3-10: `list3-10.zc`**

```zenc
 1 | enum Shape {
 2 |     Circle(f64),
 3 |     Rect(f64, f64),
 4 |     Point,
 5 | }
 6 |
 7 | fn main() {
 8 |     let shape = Shape::Circle(5.0);
 9 |
10 |     match shape {
11 |         Shape::Circle(r)  => { println "Circle radius: {r}"; },
12 |         Shape::Rect(w, h) => { println "Rectangle area: {w * h}"; },
13 |         Shape::Point      => { println "Point"; },
14 |     }
15 | }
```

Output:
```text
Circle radius: 5.000000
```

---

## Reference Binding (`ref`)

When pattern matching move-only types (such as `Option`, `Result`, or non-Copy structs), extracting a field by default moves ownership. Use the `ref` keyword inside patterns to inspect a value by reference without consuming it:

**Listing 3-11: `list3-11.zc`**

```zenc
 1 | import "std/option.zc";
 2 |
 3 | fn main() {
 4 |     let opt = Option<int>::Some(42);
 5 |
 6 |     match opt {
 7 |         Option::Some(ref n) => {
 8 |             // 'n' is a pointer/reference to the value inside 'opt'
 9 |             // 'opt' is NOT moved or destroyed here
10 |             println "Inspected value: {*n}";
11 |         },
12 |         Option::None => {},
13 |     }
14 | }
```

Output:
```text
Inspected value: 42
```

---

## Loops and Iteration

Zen C provides rich loop constructs: range loops, array/collection loops, enumerated loops, `while`, and labeled infinite `loop` blocks.

### 1. Range Loops (`for ..`)

Iterate over numeric ranges with optional step increments:

```zenc
// Exclusive range: 0 to 9
for i in 0..10 {
    println "{i}";
}

// Explicit exclusive range (0 to 9)
for i in 0..<10 {
    println "{i}";
}

// Inclusive range: 0 to 10
for i in 0..=10 {
    println "{i}";
}

// Custom step size
for i in 0..10 step 2 {
    println "Step 2: {i}"; // 0, 2, 4, 6, 8
}

// Descending loop
for i in 10..0 step -1 {
    println "Countdown: {i}";
}

// Repeat N times (ignoring counter)
for _ in 0..5 {
    println "Repeating...";
}
```

### 2. Array and Collection Iteration

Iterate directly over elements of fixed-size arrays or standard collections:

**Listing 3-12: `list3-12.zc`**

```zenc
 1 | let arr: int[5] = [10, 20, 30, 40, 50];
 2 |
 3 | for val in arr {
 4 |     println "Element: {val}";
 5 | }
```

Output:
```text
Element: 10
Element: 20
Element: 30
Element: 40
Element: 50
```

### 3. Enumerated Loops (`index, value`)

Access both the current index and element value simultaneously:

**Listing 3-13: `list3-13.zc`**

```zenc
 1 | let arr: int[3] = [100, 200, 300];
 2 |
 3 | // i = 0, 1, 2; val = 100, 200, 300
 4 | for i, val in arr {
 5 |     println "arr[{i}] = {val}";
 6 | }
```

Output:
```text
arr[0] = 100
arr[1] = 200
arr[2] = 300
```

### 4. `while` Loops

Zen C has a single conditional loop, `while`. When the body must run at least once before the condition is tested (what C calls `do … while`), loop unconditionally and `break` at the bottom:

**Listing 3-14: `list3-14.zc`**

```zenc
 1 | // Standard while loop
 2 | let count = 3;
 3 | while count > 0 {
 4 |     println "Count: {count}";
 5 |     count--;
 6 | }
 7 |
 8 | // Run the body once before testing the condition
 9 | let x = 0;
10 | while true {
11 |     println "Executed at least once!";
12 |     x++;
13 |     if !(x < 0) {
14 |         break;
15 |     }
16 | }
```

> **Note:** Earlier versions of Zen C had a `do { … } while cond;` loop. It was removed; the compiler now reports `'do ... while' was removed; use 'while'`.

Output:
```text
Count: 3
Count: 2
Count: 1
Executed at least once!
```

### 5. Labeled Infinite `loop`

Infinite loops created with `loop` can be assigned labels so that `break` or `continue` can target specific nested loops:

```zenc
let done = false;

outer: loop {
    loop {
        if done {
            break outer; // Breaks out of the outer loop directly
        }
        done = true;
    }
}
```

---

## Early Returns (Guard Clauses)

A common pattern is to check for bad input at the top of a function and leave immediately, so the rest of the body can assume the input is valid. In Zen C you write these guard clauses with a plain `if`, negating the condition with `!` when needed:

**Listing 3-15: `list3-15.zc`**

```zenc
 1 | fn process_ptr(ptr: void*) {
 2 |     if ptr == NULL {
 3 |         println "Null pointer provided! Exiting early.";
 4 |         return;
 5 |     }
 6 |
 7 |     println "Pointer is valid, proceeding with work...";
 8 | }
 9 |
10 | fn validate(is_valid: bool) {
11 |     if !is_valid {
12 |         println "State is invalid!";
13 |         return;
14 |     }
15 |
16 |     println "State is valid.";
17 | }
18 |
19 | fn main() {
20 |     process_ptr(NULL);
21 |     process_ptr((void*)1);
22 |     validate(false);
23 |     validate(true);
24 | }
```

Output:
```text
Null pointer provided! Exiting early.
Pointer is valid, proceeding with work...
State is invalid!
State is valid.
```

---

## Summary of Chapter 3

In Chapter 3, you mastered Zen C's core language concepts:
- **Variables & Constants**: Compile-time `def`, inferred `let`, and read-only `const`.
- **Data Types**: Scalar types (`i8`..`i128`, `u8`..`u128`, `usize`, `f32`, `f64`, `bool`, `char`, `rune`, `string`), C interop types, arbitrary bit-width integers (`iN`/`uN`), numeric literal features, and fixed-size arrays (`T[N]`).
- **Functions & Lambdas**: Named arguments, `const` arguments, default parameters, closures with capture by value (`[=]`) and reference (`[&]`), raw function pointers (`fn*`), and variadic functions (`...`, `va_list`).
- **Control Flow**: Conditionals, `match` pattern matching, `ref` binding, range loops, enumerated iteration, labeled loops, and early-return guard clauses.

In **Chapter 4**, we will explore Zen C's memory management model: **Drop and RAII**!
