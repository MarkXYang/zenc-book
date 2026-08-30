# Operators and Operator Overloading

Zen C provides a comprehensive set of operators. In addition to standard arithmetic and bitwise operations, Zen C supports **operator overloading** for user-defined structs as well as modern **syntactic sugar operators** such as the pipeline operator (`|>`), null coalescing (`??`), and safe navigation (`?.`).

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
    println "p3 = ({p3.x}, {p3.y})"; // Prints (4, 6)
}
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

Zen C includes modern built-in syntactic sugar operators that streamline code and reduce boilerplate:

| Operator | Name | Description & Desugaring |
| :--- | :--- | :--- |
| `\|>` | **Pipeline** | `x \|> f(y)` desugars to `f(x, y)` |
| `??` | **Null Coalescing** | `val ?? default` returns `default` if `val` is `null` (for pointers) |
| `??=` | **Null Assignment** | `val ??= init` assigns `init` to `val` only if `val` is currently `null` |
| `?.` | **Safe Navigation** | `ptr?.field` accesses `field` only if `ptr` is not `null` |
| `?` | **Try Operator** | `res?` unpacks value or returns early on error (`Result` / `Option`) |

### Pipeline Operator (`|>`) Example

The pipeline operator passes the left-hand expression as the first argument to the right-hand function call:

```zenc
fn add_amount(val: int, amount: int) -> int {
    return val + amount;
}

fn main() {
    // 10 |> add_amount(5) desugars to add_amount(10, 5)
    let result = 10 |> add_amount(5);
    println "Pipeline result: {result}"; // 15
}
```

### Auto-Dereference Feature

In C, accessing a pointer field requires `ptr->field` or `(*ptr).field`. In Zen C, pointer field access (`ptr.field`) and method invocation (`ptr.method()`) **automatically dereference** the pointer:

```zenc
struct Node {
    value: int;
}

fn print_node(ptr: Node*) {
    // Automatically dereferences pointer (no need for -> or (*ptr))
    println "Node value: {ptr.value}";
}
```

---

## Summary of Chapter 3

In Chapter 3, you mastered all the core foundational concepts of Zen C:
- **Variables & Constants** (`def`, `let`, type inference, `const`).
- **Data Types** (scalar types, C interop types, arbitrary bit-width `iN`/`uN`, literals, fixed-size arrays `T[N]`).
- **Functions & Lambdas** (named arguments, `const` args, defaults, closures `[=]`/`[&]`, raw pointers `fn*`, variadics `...`).
- **Control Flow** (`if`, `match` pattern matching, `ref` binding, range loops, enumerated iteration, `guard`, `unless`).
- **Operators** (operator overloading `add`/`sub`/`get`/`set`, string equality rules, pipeline `|>`, null coalescing `??`, safe navigation `?.`, auto-dereference).

In **Chapter 4**, we will dive into Zen C's automatic resource management: **Drop and Memory Safety (RAII)**!
