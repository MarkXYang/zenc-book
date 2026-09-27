# Operators and Operator Overloading

Zen C provides a comprehensive set of operators. In addition to standard arithmetic and bitwise operations, Zen C supports **operator overloading** for user-defined structs as well as modern **syntactic sugar operators** such as the pipeline operator (`|>`), null coalescing (`??`), null assignment (`??=`), safe navigation (`?.`), and the try operator (`?`).

---

## Overloadable Operators

In Zen C, you can define custom behavior for operators on custom `struct` types by implementing specific method names in an `impl` block.

### Overloadable Operators Table

| Category | Operator | Implemented Method Name |
| :--- | :--- | :--- |
| **Arithmetic** | `+`, `-`, `*`, `/`, `%`, `**` | `add`, `sub`, `mul`, `div`, `rem`, `pow` |
| **Comparison** | `==`, `!=` | `eq`, `neq` |
| | `<`, `>`, `<=`, `>=` | `lt`, `gt`, `le`, `ge` |
| **Bitwise** | `&`, `\|`, `^` | `bitand`, `bitor`, `bitxor` |
| | `<<`, `>>` | `shl`, `shr` |
| **Unary** | `-` | `neg` |
| | `!` | `not` |
| | `~` | `bitnot` |
| **Index Access** | `a[i]` | `get(a, i)` |
| | `a[i, j]` (Multi-index) | `get(a, i, j)` |
| | `a[i] = v` (Index assign) | `set(a, i, v)` |

---

## Operator Overloading Examples

### 1. Arithmetic Operator Overloading (`add`)

By implementing `fn add(self, other: Point) -> Point` on a struct, you can use the standard `+` operator directly on instances:

```zenc
struct Point {
    x: int;
    y: int;
}

impl Point {
    fn add(self, other: Point) -> Point {
        return Point {
            x: self.x + other.x,
            y: self.y + other.y,
        };
    }
}

fn main() {
    let p1 = Point { x: 1, y: 2 };
    let p2 = Point { x: 3, y: 4 };

    let p3 = p1 + p2; // Automatically desugars to p1.add(p2)
    println "p3 = ({p3.x}, {p3.y})";
}
```

Output:
```text
p3 = (4, 6)
```

### 2. Multi-Index Overloading (`get`)

Zen C allows overloading multi-dimensional indexing `a[i, j]`, which desugars to `get(a, i, j)`:

```zenc
struct Matrix {
    data: int[9];
}

impl Matrix {
    fn get(self, row: int, col: int) -> int {
        return self.data[row * 3 + col];
    }
}

fn main() {
    let m = Matrix {
        data: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1,
        ],
    };

    let val = m[1, 2]; // Automatically desugars to Matrix.get(m, 1, 2)
    println "Value at [1, 2]: {val}";
}
```

Output:
```text
Value at [1, 2]: 0
```

---

## String Equality Rules

String comparison in Zen C follows strict semantic rules depending on the exact string type:

> [!NOTE]
> **String Equality Semantics**:
> - `string == string`: Performs **value comparison** (equivalent to calling `strcmp`).
> - `char* == char*`: Performs **pointer comparison** (checks if both pointers address the exact same memory location).
> - Mixed comparison (e.g., `string == char*`): Defaults to **pointer comparison**.

```zenc
let s1: string = "hello";
let s2: string = "hello";

if s1 == s2 {
    println "Strings have matching contents!"; // Executes value comparison (strcmp)
}
```

---

## Syntactic Sugar Operators

Zen C includes modern built-in syntactic sugar operators that streamline code readability and eliminate boilerplate.

### Syntactic Sugar Summary

| Operator | Name | Description & Desugaring |
| :--- | :--- | :--- |
| `\|>` | **Pipeline** | `x \|> f(y)` desugars to `f(x, y)` |
| `??` | **Null Coalescing** | `val ?? default` returns `default` if `val` is `NULL` (for pointers) |
| `??=` | **Null Assignment** | `val ??= init` assigns `init` to `val` only if `val` is currently `NULL` |
| `?.` | **Safe Navigation** | `ptr?.field` accesses `field` only if `ptr` is not `NULL` |
| `?` | **Try Operator** | `res?` unpacks value or returns early on error (`Result` / `Option`) |
| `.` | **Auto-Dereference** | `ptr.field` automatically dereferences pointer (equivalent to `(*ptr).field`) |

---

### Detailed Code Examples for Syntactic Sugar Operators

#### 1. Pipeline Operator (`|>`)

The pipeline operator passes the left-hand expression as the first parameter to the right-hand function. You can chain multiple function calls together in a clean, readable left-to-right flow:

```zenc
fn add_bonus(score: int, bonus: int) -> int {
    return score + bonus;
}

fn multiply_by(score: int, factor: int) -> int {
    return score * factor;
}

fn main() {
    // 50 |> add_bonus(10) desugars to add_bonus(50, 10) -> 60
    // 60 |> multiply_by(2) desugars to multiply_by(60, 2) -> 120
    let final_score = 50 |> add_bonus(10) |> multiply_by(2);

    println "Final Score: {final_score}";
}
```

Output:
```text
Final Score: 120
```

#### 2. Null Coalescing Operator (`??`)

The null coalescing operator checks if a pointer expression is `NULL`. If it is `NULL`, it evaluates and returns the right-hand fallback expression:

```zenc
struct Profile {
    username: string;
}

fn main() {
    let active_profile: Profile* = 0; // NULL pointer
    let default_profile = Profile { username: "GuestUser" };

    // Evaluates to &default_profile because active_profile is NULL
    let user_ptr = active_profile ?? &default_profile;

    println "Username: {user_ptr.username}";
}
```

Output:
```text
Username: GuestUser
```

#### 3. Null Assignment Operator (`??=`)

The null assignment operator assigns a value to a pointer variable only if that pointer is currently `NULL`:

```zenc
struct Config {
    port: int;
}

fn main() {
    let fallback = Config { port: 8080 };
    let app_cfg: Config* = 0; // Currently NULL

    app_cfg ??= &fallback; // Assigns fallback because app_cfg was NULL

    println "Server Port: {app_cfg.port}";
}
```

Output:
```text
Server Port: 8080
```

#### 4. Safe Navigation Operator (`?.`)

The safe navigation operator safely accesses a struct field through a pointer. If the pointer is `NULL`, the expression short-circuits to `NULL` without crashing:

```zenc
struct Session {
    id: int;
}

fn print_session(s: Session*) {
    // Safely reads id if s is non-null
    let sess_id = s?.id;
}
```

#### 5. Try Operator (`?`)

The `?` operator unwraps successful values from `Result<T, E>` or `Option<T>` types. If an error or `None` is encountered, it returns early from the current function:

```zenc
fn read_config_file(path: string) -> Result<Config, string> {
    let file = open_file(path)?; // Returns early if open_file failed
    let cfg = parse_config(file)?; // Returns early if parse_config failed
    return Result::Ok(cfg);
}
```

#### 6. Auto-Dereference Feature (`ptr.field` & `ptr.method()`)

In standard C, accessing a pointer field requires verbose arrow syntax (`ptr->field`) or dereferencing (`(*ptr).field`). In Zen C, pointer field access (`ptr.field`) and method calls (`ptr.method()`) **automatically dereference** the pointer:

```zenc
struct Node {
    value: int;
}

impl Node {
    fn display(self) {
        println "Node value: {self.value}";
    }
}

fn process_node(ptr: Node*) {
    // Automatically dereferences pointer (equivalent to (*ptr).value)
    println "Value: {ptr.value}";

    // Automatically dereferences for method calls
    ptr.display();
}

fn main() {
    let n = Node { value: 42 };
    process_node(&n);
}
```

Output:
```text
Value: 42
Node value: 42
```

---

## Summary of Chapter 3

In Chapter 3, you mastered all the core foundational concepts of Zen C:
- **Variables & Constants** (`def`, `let`, type inference, `const`).
- **Data Types** (scalar types, C interop types, arbitrary bit-width `iN`/`uN`, literals, fixed-size arrays `T[N]`).
- **Functions & Lambdas** (named arguments, `const` args, defaults, closures `[=]`/`[&]`, raw pointers `fn*`, variadics `...`).
- **Control Flow** (`if`, `match` pattern matching, `ref` binding, range loops, enumerated iteration, `guard`, `unless`).
- **Operators** (operator overloading `add`/`sub`/`get`/`set`, string equality rules, pipeline `|>`, null coalescing `??`, null assignment `??=`, safe navigation `?.`, try `?`, auto-dereference).

In **Chapter 4**, we will dive into Zen C's automatic resource management: **Drop and Memory Safety (RAII)**!
