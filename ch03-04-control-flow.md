# Control Flow

The ability to execute code depending on whether a condition is `true`, or to run code repeatedly while a condition is `true`, are basic building blocks in programming. The most common constructs for controlling execution flow in Zen C are `if` branches and loops (`loop`, `while`, `for`).

---

## `if` Expressions and Branches

An `if` statement allows you to branch your code depending on conditions:

```zenc
let number = 6;

if number % 4 == 0 {
    println "number is divisible by 4";
} else if number % 3 == 0 {
    println "number is divisible by 3";
} else if number % 2 == 0 {
    println "number is divisible by 2";
} else {
    println "number is not divisible by 4, 3, or 2";
}
```

---

## Repetition with Loops

Zen C provides three loop constructs: `loop`, `while`, and `for`.

### 1. Infinite Loops with `loop`

The `loop` keyword creates an infinite loop that runs until explicitly stopped with `break`:

```zenc
let count = 0;

loop {
    count++;
    println "Count: {count}";

    if count == 3 {
        break; // Stop the loop
    }
}
```

### 2. Conditional Loops with `while`

A `while` loop runs as long as a boolean condition evaluates to `true`:

```zenc
let number = 3;

while number > 0 {
    println "Countdown: {number}";
    number--;
}

println "LIFTOFF!";
```

### 3. Iteration with `for` Loops

The `for` loop in Zen C provides standard C-style counter loops with modern syntax:

```zenc
let arr: i32[5] = [10, 20, 30, 40, 50];

for (let i = 0; i < 5; i++) {
    println "arr[{i}] = {arr[i]}";
}
```

### Skipping Iterations with `continue`

The `continue` keyword skips the remaining statements in the current loop iteration and moves directly to the next iteration:

```zenc
for (let i = 1; i <= 5; i++) {
    if i % 2 == 0 {
        continue; // Skip even numbers
    }
    println "Odd number: {i}";
}
```

---

## Summary of Chapter 3

In Chapter 3, you learned the core foundational concepts of Zen C:
- Manifest constants (`def`) vs variables (`let`) and const qualification (`const`).
- Scalar primitive types (`i8`..`i64`, `usize`, `f32`, `f64`, `bool`, `char`, `string`) and fixed-size arrays (`T[N]`).
- Defining functions (`fn`) with parameters and explicit return types (`-> T`).
- Managing execution with `if / else if / else` branches and `loop`, `while`, `for`, `break`, and `continue`.

In **Chapter 4**, we will dive into one of Zen C's most unique features: **Understanding Memory Management & Implicit RAII (`Drop`)**!
