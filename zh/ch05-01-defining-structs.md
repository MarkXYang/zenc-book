# 定义与实例化结构体

结构体允许你创建自定义的命名数据类型，将多个值打包在一起。结构体中的每个值被称为一个**字段（field）**，并且每个字段都拥有显式的标识符名称和类型。

---

## 定义结构体

要定义结构体，请使用 `struct` 关键字，后跟采用大驼峰命名法（`UpperCamelCase` / PascalCase）的结构体名称。在大括号 `{ }` 内部，声明每个字段的名称，后跟冒号 `:` 和数据类型，并以分号 `;`（或逗号 `,`）结尾：

```zenc
struct User {
    username: string;
    email: string;
    sign_in_count: u64;
    active: bool;
}
```

字段可以是任何合法的 Zen C 类型：
- 原始标量类型（`int`、`u32`、`f64`、`bool`、`char`、`string`）
- 指针（`void*`、`User*`）
- 固定大小数组（`[int; 4]`）
- 其他结构体类型（嵌套结构体）

```zenc
struct Point {
    x: int;
    y: int;
}

struct Rectangle {
    top_left: Point;
    width: int;
    height: int;
}
```

---

## 实例化结构体

要创建结构体的实例，请在结构体名称后紧跟包含各个字段 `key: value` 对的大括号：

```zenc
let user1 = User {
    username: "mark",
    email: "mark@example.com",
    sign_in_count: 1,
    active: true,
};
```

> [!TIP]
> **尾随逗号**：在最后一个字段初始化项后添加逗号是合法的，并且在多行初始化语句中是被推荐的做法，这能使未来的 diff 更加整洁。

### 完整字段初始化规则

默认情况下，Zen C 要求必须在结构体字面量中提供该结构体定义的所有**全部字段**。如果遗漏了任何字段，编译器将拒绝初始化并给出有用的诊断信息：

```zenc
let incomplete = User {
    username: "mark",
    email: "mark@example.com",
    // Missing sign_in_count and active!
};
```

**编译器错误：**
```text
error: Missing field 'sign_in_count' in initializer for struct 'User'
  --> src/main.zc:12:18
   |
12 |     let incomplete = User {
   |                      ^ here
   = help: All struct fields must be initialized
```

这种严格性消除了 C 语言中未初始化结构体字段包含垃圾内存值的常见隐患。

### 使用 `Struct{}` 进行零初始化

如果你想快速对整个结构体进行零初始化（等价于 C 语言的 `memset(&s, 0, sizeof(s))` 或 C11 的 `(struct User){0}`），可以使用空大括号 `{}` 实例化它：

```zenc
let blank_user = User {};
// blank_user.username is NULL (0)
// blank_user.sign_in_count is 0
// blank_user.active is false
```

你也可以声明带有类型注解但没有立即初始化的变量：

```zenc
let u: User;
u.username = "alice";
u.email = "alice@example.com";
u.sign_in_count = 0;
u.active = true;
```

---

## 访问与更新字段

要访问保存在结构体中的值，请使用**点号标记法（dot notation）**（`.`）：

**代码清单 5-1**
```zenc
let user1 = User {
    username: "mark",
    email: "mark@example.com",
    sign_in_count: 1,
    active: true,
};

println "User: {user1.username}, Logins: {user1.sign_in_count}";

// Update fields on a mutable instance declared with 'let':
user1.email = "mark.new@example.com";
user1.sign_in_count = user1.sign_in_count + 1;

println "Updated email: {user1.email}";
```

输出：
```text
User: mark, Logins: 1
Updated email: mark.new@example.com
```

对于嵌套结构体，可以链式使用点号访问器：

```zenc
let rect = Rectangle {
    top_left: Point { x: 0, y: 10 },
    width: 100,
    height: 50,
};

println "Top-left X: {rect.top_left.x}, Y: {rect.top_left.y}";
rect.top_left.x = 20;
```

---

## 解构结构体

Zen C 支持对结构体变量进行**基于模式的解构**。这允许你在单条语句中将一个或多个字段提取到独立的局部变量中。

### 简写解构

当局部变量名称与结构体字段名称相同时：

**代码清单 5-2**
```zenc
let p = Point { x: 10, y: 20 };

// Unpacks p.x into 'x', and p.y into 'y'
let Point { x, y } = p;

println "x = {x}, y = {y}";
```

输出：
```text
x = 10, y = 20
```

### 在解构期间重命名字段

如果你希望将字段赋值给具有不同名称的变量，请指定 `field_name: new_variable_name`：

**代码清单 5-3**
```zenc
let Point { x: pos_x, y: pos_y } = p;

println "pos_x = {pos_x}, pos_y = {pos_y}";
```

输出：
```text
pos_x = 10, pos_y = 20
```

解构在处理函数返回值、处理配置选项或解包几何坐标时尤其有用。

---

## 结构体基础小结

在本节中，你学习了：
- 如何使用命名字段定义自定义结构体类型。
- 如何在强制完整初始化的规则下实例化结构体。
- 如何使用 `Struct{}` 对结构体的所有字节进行零初始化。
- 如何使用统一的点号标记法（`.`）读取和更新字段。
- 如何使用简写和重命名语法将结构体字段解构到局部变量中。

接下来，让我们构建一个完整的计算矩形面积的示例程序！
