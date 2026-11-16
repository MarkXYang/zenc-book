# 运算符重载

在数学计算、游戏引擎、线性代数和集合库中，编写像 `v1.add(v2.mul(scale))` 或 `matrix.set(row, col, matrix.get(row, col) + 1)` 这样的嵌套方法调用很快就会掩盖底层算法的意图。

Zen C 允许你为自定义 `struct` 类型**重载运算符**，只需在 `impl` 块内实现具有特定已知名称的方法即可。不需要特殊关键字、繁琐的 trait 仪式或宏！

当编译器遇到像 `a + b`、`-a` 或 `m[r, c]` 这样的运算符表达式时，它会检查 `a` 的结构体类型是否定义了相应的运算符方法（如 `add`、`neg` 或 `get`），并将该表达式重写为直接的 C 函数调用。

---

## 1. 算术与一元运算符

要重载二元 `+`、`-`、`*`、`/` 或一元 `-`，请在结构体上实现 `add`、`sub`、`mul`、`div` 或 `neg`：

**代码清单 10-12**
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

输出：
```text
v1 + v2 = (4, 6)
v1 - v2 = (2, 2)
-v1     = (-3, -4)
```

### 自动复合赋值（`+=`、`-=`、`*=`、`|=`）

每当你实现像 `add`、`sub`、`mul` 或 `bitor` 这样的二元运算符方法时，Zen C **会自动启用相应的复合赋值运算符**（`+=`、`-=`、`*=`、`|=`）：

```zenc
let pos = Vec2::new(10, 20);
let vel = Vec2::new(2, -3);

pos += vel; // Automatically desugars to: pos = pos.add(vel)
println "Updated position: {pos}"; // (12, 17)
```

---

## 2. 比较运算符（`==`、`!=`、`<`、`>`、`<=`、`>=`）

你可以重载相等性（`eq`、`neq`）和关系比较（`lt`、`gt`、`le`、`ge`）以自然地比较结构体：

**代码清单 10-13**
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

输出：
```text
v1 == v2: true
v1 != v3: true
v1 < v3:  true
```

> [!NOTE]
> **自动 `!=` 回退与指针相等性**：
> - 如果你实现了 `eq` 但未定义 `neq`，编译器会自动将 `a != b` 重写为 `!a.eq(b)`。
> - 如果 `==` 或 `!=` 的两个操作数都是**指针**（`Version* == Version*`），Zen C 会执行原始指针地址比较，而不是调用 `.eq()`，因此你始终可以检查两个指针是否引用相同的内存地址。

---

## 3. 索引运算符（`[i]` 与多维索引 `[r, c]`）

Zen C 支持重载数组下标表示法，用于**一维**和**多维**索引：
- **读取（`a[i]` 或 `a[r, c]`）**：调用 `get(self, i)` 或 `get(self, r, c)`。
- **写入（`a[i] = val` 或 `a[r, c] = val`）**：调用 `set(self, i, val)` 或 `set(self, r, c, val)`。

让我们实现一个 3×3 矩阵，它支持自然的 2D 索引 `mat[row, col]` 用于读取和写入：

**代码清单 10-14**
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

输出：
```text
mat[0, 0] = 1
mat[1, 2] = 42
```

> [!TIP]
> ### 🔍 窥探底层 C 代码：运算符与索引重载是如何编译的
> 当你对**代码清单 10-14** 运行 `zc transpile` 时，2D 索引表达式 `mat[1, 2] = 42` 和 `mat[1, 2]` 会直接编译为带有边界检查数组访问的标准 C 函数调用：
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

## 4. 完整的运算符重载参考表

下表总结了 Zen C 中所有可重载的运算符及其对应的方法签名：

| 类别 | 运算符 | 方法名 | 典型签名 |
| :--- | :--- | :--- | :--- |
| **算术运算符** | `a + b` | `add` | `fn add(self, other: T) -> T` |
| | `a - b` | `sub` | `fn sub(self, other: T) -> T` |
| | `a * b` | `mul` | `fn mul(self, other: T) -> T` |
| | `a / b` | `div` | `fn div(self, other: T) -> T` |
| | `a % b` | `rem` | `fn rem(self, other: T) -> T` |
| | `a ** b` | `pow` | `fn pow(self, exp: int) -> T` |
| **比较运算符** | `a == b` | `eq` | `fn eq(self, other: T) -> bool` |
| | `a != b` | `neq` | `fn neq(self, other: T) -> bool` |
| | `a < b` | `lt` | `fn lt(self, other: T) -> bool` |
| | `a > b` | `gt` | `fn gt(self, other: T) -> bool` |
| | `a <= b` | `le` | `fn le(self, other: T) -> bool` |
| | `a >= b` | `ge` | `fn ge(self, other: T) -> bool` |
| **位运算与移位** | `a & b` | `bitand` | `fn bitand(self, other: T) -> T` |
| | `a \| b` | `bitor` | `fn bitor(self, other: T) -> T` |
| | `a ^ b` | `bitxor` | `fn bitxor(self, other: T) -> T` |
| | `a << b` | `shl` | `fn shl(self, shift: int) -> T` |
| | `a >> b` | `shr` | `fn shr(self, shift: int) -> T` |
| **一元运算符** | `-a` | `neg` | `fn neg(self) -> T` |
| | `!a` | `not` | `fn not(self) -> bool` |
| | `~a` | `bitnot` | `fn bitnot(self) -> T` |
| **索引运算符** | `a[i]` | `get` | `fn get(self, idx: int) -> V` |
| | `a[i] = v` | `set` | `fn set(self, idx: int, val: V)` |
| | `a[r, c]` | `get` | `fn get(self, r: int, c: int) -> V` |
| | `a[r, c] = v` | `set` | `fn set(self, r: int, c: int, val: V)` |

---

## 第 10 章小结

在本章中，你掌握了 Zen C 提供的在不牺牲 C11 性能的前提下编写富有表现力、可复用抽象的工具：
1. **泛型数据类型（`<T>`）**：编写泛型函数、结构体、枚举和 `impl` 块，通过零成本**单态化**进行编译。
2. **Traits（`trait` 与 `impl Trait for Type`）**：定义共享行为契约，并在需要运行时灵活性时传递多态 trait 对象（`{ self, vtable }`）。
3. **标准 Trait 与 `@derive(...)`**：利用 `Drop`、`Copy`、`Clone`、`Iterator<T>` / `Iterable<T>`、`to_string` 以及 `@derive(Copy, Clone, Eq, Debug, ToJson, FromJson)`。
4. **运算符重载**：通过清晰的方法名称定义自然的算术、比较、一元、位运算和多维索引运算符。

在**[第 11 章：编写自动化测试与调试](ch11-00-testing.md)**中，我们将学习如何使用 Zen C 内置的测试框架和调试器验证代码的正确性！
