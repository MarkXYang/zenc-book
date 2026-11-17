# Control Flow

The ability to control execution flow based on conditions, pattern matching, or repetition is fundamental to programming. Zen C provides modern conditional expressions, practical `match` basics, rich range and enumerated loops, labeled loop control, and early-return guard clauses.

---

## Conditionals

### 1. `if`, `else if`, and `else`

Standard conditional branching tests boolean conditions:

**Listing 3-10**
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

**Listing 3-11**
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

### 2. Enum Matching at a Glance

`match` also works on enum variants:

```zenc
enum Status {
    Ready,
    Busy,
    Error,
}

fn describe(s: Status) {
    match s {
        Status::Ready => { println "Ready"; },
        Status::Busy => { println "Busy"; },
        Status::Error => { println "Error"; },
    }
}
```

You will learn enum payload destructuring patterns and `ref` binding in depth in [Chapter 6](ch06-03-patterns.md).

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

**Listing 3-12**
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

**Listing 3-13**
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

### 4. `while` Loops

Zen C has a single conditional loop, `while`. When the body must run at least once before the condition is tested (what C calls `do … while`), loop unconditionally and `break` at the bottom:

**Listing 3-14**
```zenc
// Standard while loop
let count = 3;
while count > 0 {
    println "Count: {count}";
    count--;
}

// Run the body once before testing the condition
let x = 0;
while true {
    println "Executed at least once!";
    x++;
    if !(x < 0) {
        break;
    }
}
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

**Listing 3-15**
```zenc
fn process_ptr(ptr: void*) {
    if ptr == NULL {
        println "Null pointer provided! Exiting early.";
        return;
    }

    println "Pointer is valid, proceeding with work...";
}

fn validate(is_valid: bool) {
    if !is_valid {
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

In Chapter 3, you learned Zen C's core language concepts:
- **Variables & Constants**: Compile-time `def`, inferred `let`, and read-only `const`.
- **Data Types**: Scalar types (`i8`..`i128`, `u8`..`u128`, `usize`, `f32`, `f64`, `bool`, `char`, `rune`, `string`), C interop types, arbitrary bit-width integers (`iN`/`uN`), numeric literal features, and fixed-size arrays (`T[N]`).
- **Functions**: Named arguments, `const` arguments, and default parameters.
- **Comments, Printing and Interpolation**: `//` and `///` comments, `print`/`println`/`eprint`/`eprintln`, `{}` interpolation, raw and multiline strings, and input prompts.
- **Control Flow**: Conditionals, `match` basics, range loops, enumerated iteration, labeled loops, and early-return guard clauses.

In **Chapter 4**, we will look at how Zen C handles ownership, pointers, and cleanup.
