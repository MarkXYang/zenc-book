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

**代码清单 3-16：`list3-16.zc`**

```zenc
 1 | struct Point {
 2 |     x: int;
 3 |     y: int;
 4 | }
 5 |
 6 | impl Point {
 7 |     fn add(self, other: Point) -> Point {
 8 |         return Point {
 9 |             x: self.x + other.x,
10 |             y: self.y + other.y,
11 |         };
12 |     }
13 | }
14 |
15 | fn main() {
16 |     let p1 = Point { x: 1, y: 2 };
17 |     let p2 = Point { x: 3, y: 4 };
18 |
19 |     let p3 = p1 + p2; // Automatically desugars to p1.add(p2)
20 |     println "p3 = ({p3.x}, {p3.y})";
21 | }
```

输出：
```text
p3 = (4, 6)
```

### 2. 多维索引重载（`get`）

Zen C 允许重载多维索引 `a[i, j]`，它会脱糖为 `get(a, i, j)`：

**代码清单 3-17：`list3-17.zc`**

```zenc
 1 | struct Matrix {
 2 |     data: int[9];
 3 | }
 4 |
 5 | impl Matrix {
 6 |     fn get(self, row: int, col: int) -> int {
 7 |         return self.data[row * 3 + col];
 8 |     }
 9 | }
10 |
11 | fn main() {
12 |     let m = Matrix {
13 |         data: [
14 |             1, 0, 0,
15 |             0, 1, 0,
16 |             0, 0, 1,
17 |         ],
18 |     };
19 |
20 |     let val = m[1, 2]; // Automatically desugars to Matrix.get(m, 1, 2)
21 |     println "Value at [1, 2]: {val}";
22 | }
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

**代码清单 3-18：`list3-18.zc`**

```zenc
 1 | fn add_bonus(score: int, bonus: int) -> int {
 2 |     return score + bonus;
 3 | }
 4 |
 5 | fn multiply_by(score: int, factor: int) -> int {
 6 |     return score * factor;
 7 | }
 8 |
 9 | fn main() {
10 |     // 50 |> add_bonus(10) desugars to add_bonus(50, 10) -> 60
11 |     // 60 |> multiply_by(2) desugars to multiply_by(60, 2) -> 120
12 |     let final_score = 50 |> add_bonus(10) |> multiply_by(2);
13 |
14 |     println "Final Score: {final_score}";
15 | }
```

输出：
```text
Final Score: 120
```

#### 2. 空值合并运算符（`??`）

空值合并运算符检查指针表达式是否为 `NULL`。如果是 `NULL`，它将求值并返回右侧的后备表达式：

**代码清单 3-19：`list3-19.zc`**

```zenc
 1 | struct Profile {
 2 |     username: string;
 3 | }
 4 |
 5 | fn main() {
 6 |     let active_profile: Profile* = 0; // NULL pointer
 7 |     let default_profile = Profile { username: "GuestUser" };
 8 |
 9 |     // Evaluates to &default_profile because active_profile is NULL
10 |     let user_ptr = active_profile ?? &default_profile;
11 |
12 |     println "Username: {user_ptr.username}";
13 | }
```

输出：
```text
Username: GuestUser
```

#### 3. 空值赋值运算符（`??=`）

空值赋值运算符仅在该指针变量当前为 `NULL` 时才为其赋予新值：

**代码清单 3-20：`list3-20.zc`**

```zenc
 1 | struct Config {
 2 |     port: int;
 3 | }
 4 |
 5 | fn main() {
 6 |     let fallback = Config { port: 8080 };
 7 |     let app_cfg: Config* = 0; // Currently NULL
 8 |
 9 |     app_cfg ??= &fallback; // Assigns fallback because app_cfg was NULL
10 |
11 |     println "Server Port: {app_cfg.port}";
12 | }
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

**代码清单 3-21：`list3-21.zc`**

```zenc
 1 | struct Node {
 2 |     value: int;
 3 | }
 4 |
 5 | impl Node {
 6 |     fn display(self) {
 7 |         println "Node value: {self.value}";
 8 |     }
 9 | }
10 |
11 | fn process_node(ptr: Node*) {
12 |     // Automatically dereferences pointer (equivalent to (*ptr).value)
13 |     println "Value: {ptr.value}";
14 |
15 |     // Automatically dereferences for method calls
16 |     ptr.display();
17 | }
18 |
19 | fn main() {
20 |     let n = Node { value: 42 };
21 |     process_node(&n);
22 | }
```

输出：
```text
Value: 42
Node value: 42
```

---

## 第 3 章总结

在第 3 章中，你已经掌握了 Zen C 的所有核心基础概念：
- **变量与常量**（`def`、`let`、类型推导、`const`）。
- **数据类型**（标量类型、C 互操作类型、任意位宽 `iN`/`uN`、字面量、固定大小数组 `T[N]`）。
- **函数与 Lambda**（命名参数、`const` 参数、默认参数、闭包 `[=]`/`[&]`、原始函数指针 `fn*`、可变参数 `...`）。
- **控制流**（`if`、`match` 模式匹配、`ref` 绑定、范围循环、枚举迭代、提前返回卫语句）。
- **运算符**（运算符重载 `add`/`sub`/`get`/`set`、字符串相等性规则、管道 `|>`、空值合并 `??`、空值赋值 `??=`、安全导航 `?.`、try `?`、自动解引用）。

在**第 4 章**中，我们将深入探讨 Zen C 的自动资源管理：**Drop 与内存安全（RAII）**！
