# 附录 F：Zen C 快速参考速查表

Zen C 单页语法与标准库速查参考。

## 变量与常量

```zenc
let x = 42;                 // Inferred type (int)
let count: u64 = 100;       // Explicit type annotation
def MAX_USERS = 256;        // Compile-time constant
alias UserId = u64;         // Type alias
```

## 函数

```zenc
fn add(a: i32, b: i32) -> i32 {
    return a + b;
}

@inline
fn square(x: i32) -> i32 { return x * x; }
```

## 控制流

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

## 结构体、枚举、Trait 与模式匹配

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

## 资源清理（`defer`）与错误处理

```zenc
let buf = malloc(1024);
defer free(buf);            // Runs when enclosing scope exits

// Option / Result unwrapping
let val = opt.unwrap();
```

## 编译期与互操作

```zenc
comptime {
    yield("def BUILD_ID = 1;");
}

let bytes = embed "asset.bin";          // Raw byte slice { data, len }
let text = embed "banner.txt" as string;

include <stdio.h>                       // C header include
import "std/vec.zc"                     // Zen C module import
```

## 常用 CLI 命令

```sh
zc run -q main.zc           # Compile and run quietly
zc build -O2 main.zc        # Build optimized binary
zc test tests.zc            # Run unit tests
zc check main.zc            # Type-check only
zc transpile main.zc        # Emit C11 source
zc-format --check main.zc   # Verify canonical formatting
```
