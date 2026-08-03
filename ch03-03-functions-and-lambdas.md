# Functions and Lambdas

Functions are the fundamental building blocks of Zen C code. You've already seen `fn main()`, which is the entry point of every executable.

---

## Defining Functions

Functions in Zen C are declared using the `fn` keyword. Function names use snake_case by convention.

```zenc
fn print_greeting() {
    println "Hello from a function!";
}
```

---

## Parameters

Functions can accept input parameters. Parameter type annotations are written as `name: Type`:

```zenc
fn print_number(x: i32) {
    println "The value is: {x}";
}

fn print_sum(a: i32, b: i32) {
    let sum = a + b;
    println "Sum: {sum}";
}
```

---

## Return Values

Functions return values to the caller using the arrow (`->`) return type syntax and the `return` keyword:

```zenc
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

fn multiply(a: i32, b: i32) -> i32 {
    return a * b;
}
```

Calling a function with a return value:

```zenc
fn main() {
    let result = add(5, 10);
    println "5 + 10 = {result}";
}
```

---

## Early Returns

You can return early from a function using `return`:

```zenc
fn absolute_value(x: int) -> int {
    if x < 0 {
        return -x;
    }
    return x;
}
```

Next, let's explore control flow constructs!
