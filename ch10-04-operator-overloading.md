# Operator Overloading

In mathematical computing, game engines, linear algebra, and collection libraries, writing nested method calls like `v1.add(v2.mul(scale))` or `matrix.set(row, col, matrix.get(row, col) + 1)` quickly obscures the underlying algorithm.

Zen C allows you to **overload operators** for your custom `struct` types simply by implementing methods with specific, well-known names inside an `impl` block. No special keywords, trait ceremony, or macros are required!

When the compiler encounters an operator expression like `a + b`, `-a`, or `m[r, c]`, it checks whether `a`'s struct type defines the corresponding operator method (such as `add`, `neg`, or `get`) and rewrites the expression into a direct C function call.

---

## 1. Arithmetic & Unary Operators

To overload binary `+`, `-`, `*`, `/`, or unary `-`, implement `add`, `sub`, `mul`, `div`, or `neg` on your struct:

**Listing 10-12: `list10-12.zc`**

```zenc
@derive(Copy)
struct Vec2 {
    x: int;
    y: int;
}

impl Vec2 {
    fn new(x: int, y: int) -> Vec2 {
        return Vec2 { x: x, y: y };
    }

    // Overloads binary '+'
    fn add(self, other: Vec2) -> Vec2 {
        return Vec2 {
            x: self.x + other.x,
            y: self.y + other.y,
        };
    }

    // Overloads binary '-'
    fn sub(self, other: Vec2) -> Vec2 {
        return Vec2 {
            x: self.x - other.x,
            y: self.y - other.y,
        };
    }

    // Overloads unary '-' (-v)
    fn neg(self) -> Vec2 {
        return Vec2 {
            x: -self.x,
            y: -self.y,
        };
    }

    fn to_string(self) -> char* {
        let s = "({self.x}, {self.y})";
        return s;
    }
}

fn main() {
    let v1 = Vec2::new(3, 4);
    let v2 = Vec2::new(1, 2);

    let sum = v1 + v2;  // Calls v1.add(v2)
    let diff = v1 - v2; // Calls v1.sub(v2)
    let inv = -v1;      // Calls v1.neg()

    println "v1 + v2 = {sum}";
    println "v1 - v2 = {diff}";
    println "-v1     = {inv}";
}
```

Output:
```text
v1 + v2 = (4, 6)
v1 - v2 = (2, 2)
-v1     = (-3, -4)
```

### Automatic Compound Assignment (`+=`, `-=`, `*=`, `|=`)

Whenever you implement a binary operator method like `add`, `sub`, `mul`, or `bitor`, Zen C **automatically enables the corresponding compound assignment operator** (`+=`, `-=`, `*=`, `|=`):

```zenc
let pos = Vec2::new(10, 20);
let vel = Vec2::new(2, -3);

pos += vel; // Automatically desugars to: pos = pos.add(vel)
println "Updated position: {pos}"; // (12, 17)
```

---

## 2. Comparison Operators (`==`, `!=`, `<`, `>`, `<=`, `>=`)

You can overload equality (`eq`, `neq`) and relational ordering (`lt`, `gt`, `le`, `ge`) to compare structs naturally:

**Listing 10-13: `list10-13.zc`**

```zenc
@derive(Copy)
struct Version {
    major: int;
    minor: int;
}

impl Version {
    fn new(major: int, minor: int) -> Version {
        return Version { major: major, minor: minor };
    }

    fn eq(self, other: Version) -> bool {
        return self.major == other.major && self.minor == other.minor;
    }

    fn neq(self, other: Version) -> bool {
        return !self.eq(other);
    }

    fn lt(self, other: Version) -> bool {
        if self.major != other.major {
            return self.major < other.major;
        }
        return self.minor < other.minor;
    }
}

fn main() {
    let v1 = Version::new(1, 4);
    let v2 = Version::new(1, 4);
    let v3 = Version::new(2, 0);

    println "v1 == v2: {v1 == v2}";
    println "v1 != v3: {v1 != v3}";
    println "v1 < v3:  {v1 < v3}";
}
```

Output:
```text
v1 == v2: true
v1 != v3: true
v1 < v3:  true
```

> [!NOTE]
> **Automatic `!=` Fallback & Pointer Equality**:
> - If you implement `eq` without defining `neq`, the compiler automatically rewrites `a != b` to `!a.eq(b)`.
> - If both operands of `==` or `!=` are **pointers** (`Version* == Version*`), Zen C performs raw pointer address comparison rather than calling `.eq()`, so you can always check whether two pointers reference the same memory address.

---

## 3. Indexing Operators (`[i]` and Multi-Index `[r, c]`)

Zen C supports overloading array subscript notation for both **single-dimensional** and **multi-dimensional** indexing:
- **Reading (`a[i]` or `a[r, c]`)**: Calls `get(self, i)` or `get(self, r, c)`.
- **Writing (`a[i] = val` or `a[r, c] = val`)**: Calls `set(self, i, val)` or `set(self, r, c, val)`.

Let's implement a 3×3 matrix that supports natural 2D indexing `mat[row, col]` for both reading and writing:

**Listing 10-14: `list10-14.zc`**

```zenc
struct Matrix3x3 {
    data: int[9];
}

impl Matrix3x3 {
    fn identity() -> Matrix3x3 {
        return Matrix3x3 {
            data: [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1,
            ],
        };
    }

    // Overloads multi-index read: mat[row, col]
    fn get(self, row: int, col: int) -> int {
        return self.data[row * 3 + col];
    }

    // Overloads multi-index write: mat[row, col] = val
    fn set(self, row: int, col: int, val: int) {
        self.data[row * 3 + col] = val;
    }
}

fn main() {
    let mat = Matrix3x3::identity();

    // Update element at row 1, col 2 using multi-index set:
    mat[1, 2] = 42;

    // Read elements using multi-index get:
    println "mat[0, 0] = {mat[0, 0]}";
    println "mat[1, 2] = {mat[1, 2]}";
}
```

Output:
```text
mat[0, 0] = 1
mat[1, 2] = 42
```

> [!TIP]
> ### 🔍 Peek at the C: How Operator & Index Overloading Compiles
> When you run `zc transpile` on **Listing 10-14**, the 2D indexing expressions `mat[1, 2] = 42` and `mat[1, 2]` compile directly into standard C function calls with bounds-checked array access:
>
> ```c
> Matrix3x3 mat = Matrix3x3__identity();
>
> // mat[1, 2] = 42  -->  Matrix3x3__set(&mat, 1, 2, 42)
> Matrix3x3__set((&mat), 1, 2, 42);
>
> // mat[1, 2]       -->  Matrix3x3__get(&mat, 1, 2)
> int32_t val = Matrix3x3__get((&mat), 1, 2);
> ```

---

## 4. Complete Operator Overloading Reference Table

The following table summarizes all overloadable operators in Zen C and their corresponding method signatures:

| Category | Operator | Method Name | Typical Signature |
| :--- | :--- | :--- | :--- |
| **Arithmetic** | `a + b` | `add` | `fn add(self, other: T) -> T` |
| | `a - b` | `sub` | `fn sub(self, other: T) -> T` |
| | `a * b` | `mul` | `fn mul(self, other: T) -> T` |
| | `a / b` | `div` | `fn div(self, other: T) -> T` |
| | `a % b` | `rem` | `fn rem(self, other: T) -> T` |
| | `a ** b` | `pow` | `fn pow(self, exp: int) -> T` |
| **Comparison** | `a == b` | `eq` | `fn eq(self, other: T) -> bool` |
| | `a != b` | `neq` | `fn neq(self, other: T) -> bool` |
| | `a < b` | `lt` | `fn lt(self, other: T) -> bool` |
| | `a > b` | `gt` | `fn gt(self, other: T) -> bool` |
| | `a <= b` | `le` | `fn le(self, other: T) -> bool` |
| | `a >= b` | `ge` | `fn ge(self, other: T) -> bool` |
| **Bitwise & Shift** | `a & b` | `bitand` | `fn bitand(self, other: T) -> T` |
| | `a \| b` | `bitor` | `fn bitor(self, other: T) -> T` |
| | `a ^ b` | `bitxor` | `fn bitxor(self, other: T) -> T` |
| | `a << b` | `shl` | `fn shl(self, shift: int) -> T` |
| | `a >> b` | `shr` | `fn shr(self, shift: int) -> T` |
| **Unary** | `-a` | `neg` | `fn neg(self) -> T` |
| | `!a` | `not` | `fn not(self) -> bool` |
| | `~a` | `bitnot` | `fn bitnot(self) -> T` |
| **Indexing** | `a[i]` | `get` | `fn get(self, idx: int) -> V` |
| | `a[i] = v` | `set` | `fn set(self, idx: int, val: V)` |
| | `a[r, c]` | `get` | `fn get(self, r: int, c: int) -> V` |
| | `a[r, c] = v` | `set` | `fn set(self, r: int, c: int, val: V)` |

---

## Summary of Chapter 10

In this chapter, you mastered the tools Zen C provides for writing expressive, reusable abstractions without sacrificing C11 performance:
1. **Generic Data Types (`<T>`)**: Writing generic functions, structs, enums, and `impl` blocks that compile via zero-cost **monomorphization**.
2. **Traits (`trait` & `impl Trait for Type`)**: Defining shared behavior contracts and passing polymorphic trait objects (`{ self, vtable }`) when runtime flexibility is needed.
3. **Standard Traits & `@derive(...)`**: Leveraging `Drop`, `Copy`, `Clone`, `Iterator<T>` / `Iterable<T>`, `to_string`, and `@derive(Copy, Clone, Eq, Debug, ToJson, FromJson)`.
4. **Operator Overloading**: Defining natural arithmetic, comparison, unary, bitwise, and multi-dimensional indexing operators via clean method names.

In **[Chapter 11: Writing Automated Tests](ch11-00-testing.md)**, we will learn how to verify the correctness of our code using Zen C's built-in testing framework and debuggers!
