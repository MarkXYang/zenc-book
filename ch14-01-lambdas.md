# Lambdas and Closure Capture

## Lambdas (Closures)

Lambdas are anonymous functions that can capture variables from their surrounding scope. Zen C supports both concise **Arrow Syntax** and block-based **Block Syntax**.

### 1. Basic Syntax

```zenc
let factor = 2;

// Concise Arrow Syntax
let doubler = x -> x * factor;

// Full Block Syntax
let full_doubler = fn(x: int) -> int { return x * factor; };
```

### 2. Capture by Value (Default / `[=]`)

By default, variables are captured by value (creating a read-only copy inside the closure):

```zenc
let original = 10;

// Implicit capture by value
let implicit_cb = x -> original + x;

// Explicit capture by value using [=]
let explicit_cb = [=] x -> original + x;

// let fail = x -> original += x; // Error: cannot assign to value-captured variable
```

### 3. Capture by Reference (`[&]`)

To mutate variables in the outer environment, use reference capture (`[&]`):

**Listing 3-5: `list3-5.zc`**

```zenc
 1 | fn main() {
 2 |     let val = 10;
 3 |
 4 |     // Block syntax capture by reference
 5 |     let modify = fn[&]() {
 6 |         val += 1;
 7 |     };
 8 |     modify(); // val is now 11
 9 |     println "val after modify: {val}";
10 |
11 |     // Arrow syntax capture by reference
12 |     let modify_arrow = [&] x -> val += x;
13 |     modify_arrow(5); // val is now 16
14 |     println "val after modify_arrow: {val}";
15 |
16 |     // Arrow syntax with multiple arguments
17 |     let sum_into = [&] (a, b) -> val += (a + b);
18 |     sum_into(2, 2); // val is now 20
19 |     println "val after sum_into: {val}";
20 | }
```

Output:
```text
val after modify: 11
val after modify_arrow: 16
val after sum_into: 20
```

---
