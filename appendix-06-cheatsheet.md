# Appendix F: Zen C Quick Reference Cheat Sheet

A one-page syntax and standard library reference for Zen C.

## Variables & Constants

```zenc
let x = 42;                 // Inferred type (int)
let count: u64 = 100;       // Explicit type annotation
def MAX_USERS = 256;        // Compile-time constant
alias UserId = u64;         // Type alias
```

## Functions

```zenc
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

@inline
fn square(x: i32) -> i32 { return x * x; }
```

## Control Flow

```zenc
if x > 0 {
    println "positive";
} else if x == 0 {
    println "zero";
} else {
    println "negative";
}

for i in 0..10 {            // 0..9 (exclusive)
    if i == 5 { continue; }
    println "{i}";
}

while running {
    // ...
}

loop {
    if done { break; }
}
```

## Structs, Enums, Traits & Pattern Matching

```zenc
@derive(Debug, Eq)
struct Point {
    x: i32;
    y: i32;
}

impl Point {
    fn new(x: i32, y: i32) -> Point {
        return Point { x: x, y: y };
    }
}

enum Status {
    Ok(i32),
    Err(string),
}

match status {
    Status::Ok(code) => println "Code: {code}",
    Status::Err(msg) => println "Error: {msg}",
}
```

## Resource Cleanup (`defer`) & Error Handling

```zenc
let buf = malloc(1024);
defer free(buf);            // Runs when enclosing scope exits

// Option / Result unwrapping
let val = opt.unwrap();
```

## Compile-Time & Interop

```zenc
comptime {
    yield("def BUILD_ID = 1;");
}

let bytes = embed "asset.bin";          // Raw byte slice { data, len }
let text = embed "banner.txt" as string;

include <stdio.h>                       // C header include
import "std/vec.zc"                     // Zen C module import
```

## Common CLI Commands

```sh
zc run -q main.zc           # Compile and run quietly
zc build -O2 main.zc        # Build optimized binary
zc test tests.zc            # Run unit tests
zc check main.zc            # Type-check only
zc transpile main.zc        # Emit C11 source
zc-format --check main.zc   # Verify canonical formatting
```
