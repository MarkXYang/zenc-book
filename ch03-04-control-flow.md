# Control Flow

The ability to control execution flow based on conditions, pattern matching, or repetition is fundamental to programming. Zen C provides modern conditional expressions, powerful `match` pattern matching, reference binding, rich range and enumerated loops, labeled loop control, and guard statements (`guard`, `unless`).

---

## Conditionals

### 1. `if`, `else if`, and `else`

Standard conditional branching tests boolean conditions:

**Listing 3-8: `list3-8.zc`**

```zenc
let x = 15;

if x > 10 {
    println "Large";
} else if x > 5 {
    println "Medium";
} else {
    println "Small";
}
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
let val = 12;

match val {
    1         => { println "One"; },
    2 || 3    => { println "Two or Three"; },    // OR with ||
    4 or 5    => { println "Four or Five"; },    // OR with 'or'
    6, 7, 8   => { println "Six to Eight"; },    // OR with comma
    10 .. 15  => { println "10 to 14"; },        // Exclusive range
    10 ..< 15 => { println "10 to 14 (Explicit)"; }, // Exclusive range
    20 ..= 25 => { println "20 to 25 (Inclusive)"; }, // Inclusive range
    _         => { println "Other"; },           // Wildcard fallback
}
```

Output:
```text
10 to 14
```

### 2. Destructuring Enums

`match` can destructure tagged union enums directly:

**Listing 3-10: `list3-10.zc`**

```zenc
enum Shape {
    Circle(f64),
    Rect(f64, f64),
    Point,
}

fn main() {
    let shape = Shape::Circle(5.0);

    match shape {
        Shape::Circle(r)  => { println "Circle radius: {r}"; },
        Shape::Rect(w, h) => { println "Rectangle area: {w * h}"; },
        Shape::Point      => { println "Point"; },
    }
}
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
import "std/option.zc";

fn main() {
    let opt = Option<int>::Some(42);

    match opt {
        Option::Some(ref n) => {
            // 'n' is a pointer/reference to the value inside 'opt'
            // 'opt' is NOT moved or destroyed here
            println "Inspected value: {*n}";
        },
        Option::None => {},
    }
}
```

Output:
```text
Inspected value: 42
```

---

## Loops and Iteration

Zen C provides rich loop constructs: range loops, array/collection loops, enumerated loops, `while`, `do-while`, and labeled infinite `loop` blocks.

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
let arr: int[5] = [10, 20, 30, 40, 50];

for val in arr {
    println "Element: {val}";
}
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
let arr: int[3] = [100, 200, 300];

// i = 0, 1, 2; val = 100, 200, 300
for i, val in arr {
    println "arr[{i}] = {val}";
}
```

Output:
```text
arr[0] = 100
arr[1] = 200
arr[2] = 300
```

### 4. `while` and `do-while` Loops

**Listing 3-14: `list3-14.zc`**

```zenc
// Standard while loop
let count = 3;
while count > 0 {
    println "Count: {count}";
    count--;
}

// do-while loop (guaranteed to execute at least once)
let x = 0;
do {
    println "Executed at least once!";
    x++;
} while x < 0;
```

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

## Advanced Control Statements (`guard` and `unless`)

Zen C introduces `guard` and `unless` statements to simplify early-exit error handling and negative condition checks:

- **`guard`**: Checks a condition. If the condition is `false`, the mandatory `else` block executes and **must** exit the current scope (via `return`, `break`, or `continue`).
- **`unless`**: An inverted `if` statement. It executes its block when the condition is `false`.

**Listing 3-15: `list3-15.zc`**

```zenc
fn process_ptr(ptr: void*) {
    guard ptr != NULL else {
        println "Null pointer provided! Exiting early.";
        return;
    }

    println "Pointer is valid, proceeding with work...";
}

fn validate(is_valid: bool) {
    unless is_valid {
        println "State is invalid!";
        return;
    }

    println "State is valid.";
}

fn main() {
    process_ptr(NULL);
    process_ptr((void*)1);
    validate(false);
    validate(true);
}
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
- **Control Flow**: Conditionals, `match` pattern matching, `ref` binding, range loops, enumerated iteration, labeled loops, `guard`, and `unless`.

In **Chapter 4**, we will explore Zen C's memory management model: **Drop and RAII**!
