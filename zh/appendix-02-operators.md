# 附录 B：运算符与语法糖

# 运算符与运算符重载

Zen C 提供了丰富完备的运算符体系。除了标准算术和位运算之外，Zen C 还支持对用户自定义结构体进行**运算符重载**，以及现代**语法糖运算符**，例如管道运算符（`|>`）、空值合并（`??`）、空值赋值（`??=`）、安全导航（`?.`）和 try 运算符（`?`）。

---

## 可重载运算符

在 Zen C 中，你可以通过在 `impl` 块中实现特定的方法名，为自定义 `struct` 类型定义运算符的自定义行为。

### 可重载运算符表

| 类别 | 运算符 | 需实现的方法名 |
| :--- | :--- | :--- |
| **算术运算** | `+`, `-`, `*`, `/`, `%`, `**` | `add`, `sub`, `mul`, `div`, `rem`, `pow` |
| **比较运算** | `==`, `!=` | `eq`, `neq` |
| | `<`, `>`, `<=`, `>=` | `lt`, `gt`, `le`, `ge` |
| **位运算** | `&`, `\|`, `^` | `bitand`, `bitor`, `bitxor` |
| | `<<`, `>>` | `shl`, `shr` |
| **一元运算** | `-` | `neg` |
| | `!` | `not` |
| | `~` | `bitnot` |
| **索引访问** | `a[i]` | `get(a, i)` |
| | `a[i, j]`（多维索引） | `get(a, i, j)` |
| | `a[i] = v`（索引赋值） | `set(a, i, v)` |

---

## 运算符重载示例

### 1. 算术运算符重载（`add`）

通过在结构体上实现 `fn add(self, other: Point) -> Point`，你可以直接在实例上使用标准 `+` 运算符：

**代码清单 B-1**
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

输出：
```text
p3 = (4, 6)
```

### 2. 多维索引重载（`get`）

Zen C 允许重载多维索引 `a[i, j]`，它会脱糖为 `get(a, i, j)`：

**代码清单 B-2**
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

输出：
```text
Value at [1, 2]: 0
```

---

## 字符串相等性规则

Zen C 中的字符串比较遵循严格的语义规则，具体取决于确切的字符串类型：

> [!NOTE]
> **字符串相等性语义**：
> - `string == string`：执行**值比较**（等价于调用 `strcmp`）。
> - `char* == char*`：执行**指针比较**（检查两个指针是否指向完全相同的内存地址）。
> - 混合比较（例如 `string == char*`）：默认执行**指针比较**。

```zenc
let s1: string = "hello";
let s2: string = "hello";

if s1 == s2 {
    println "Strings have matching contents!"; // Executes value comparison (strcmp)
}
```

---

## 语法糖运算符

Zen C 包含了现代内置语法糖运算符，能够简化代码可读性并消除样板代码。

### 语法糖概览

| 运算符 | 名称 | 描述与脱糖形式 |
| :--- | :--- | :--- |
| `\|>` | **管道** | `x \|> f(y)` 脱糖为 `f(x, y)` |
| `??` | **空值合并** | 如果 `val` 为 `NULL`（针对指针），`val ?? default` 返回 `default` |
| `??=` | **空值赋值** | 仅当 `val` 当前为 `NULL` 时，`val ??= init` 将 `init` 赋值给 `val` |
| `?.` | **安全导航** | 仅当 `ptr` 不为 `NULL` 时，`ptr?.field` 访问 `field` |
| `?` | **Try 运算符** | `res?` 解包成功值，遇错误则提前返回（针对 `Result` / `Option`） |
| `.` | **自动解引用** | `ptr.field` 自动解引用指针（等价于 `(*ptr).field`） |

---

### 语法糖运算符的详细代码示例

#### 1. 管道运算符（`|>`）

管道运算符将左侧表达式作为第一个参数传递给右侧函数。你可以将多个函数调用串联在一起，形成干净、可读性强的从左到右的数据流：

**代码清单 B-3**
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

输出：
```text
Final Score: 120
```

#### 2. 空值合并运算符（`??`）

空值合并运算符检查指针表达式是否为 `NULL`。如果是 `NULL`，它将求值并返回右侧的后备表达式：

**代码清单 B-4**
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

输出：
```text
Username: GuestUser
```

#### 3. 空值赋值运算符（`??=`）

空值赋值运算符仅在该指针变量当前为 `NULL` 时才为其赋予新值：

**代码清单 B-5**
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

输出：
```text
Server Port: 8080
```

#### 4. 安全导航运算符（`?.`）

安全导航运算符通过指针安全地访问结构体字段。如果指针为 `NULL`，该表达式会直接短路返回 `NULL` 而不会发生崩溃：

```zenc
struct Session {
    id: int;
}

fn print_session(s: Session*) {
    // Safely reads id if s is non-null
    let sess_id = s?.id;
}
```

#### 5. Try 运算符（`?`）

`?` 运算符从 `Result<T, E>` 或 `Option<T>` 类型中解包成功值。如果遇到错误或 `None`，它会从当前函数提前返回：

```zenc
fn read_config_file(path: string) -> Result<Config, string> {
    let file = open_file(path)?; // Returns early if open_file failed
    let cfg = parse_config(file)?; // Returns early if parse_config failed
    return Result::Ok(cfg);
}
```

#### 6. 自动解引用特性（`ptr.field` 与 `ptr.method()`）

在标准 C 中，访问指针字段需要繁琐的箭头语法（`ptr->field`）或显式解引用（`(*ptr).field`）。在 Zen C 中，指针字段访问（`ptr.field`）和方法调用（`ptr.method()`）均会**自动解引用**指针：

**代码清单 B-6**
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

输出：
```text
Value: 42
Node value: 42
```
