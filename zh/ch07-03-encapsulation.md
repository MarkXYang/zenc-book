# 使用 opaque 实现封装

## 5. 封装与数据隐藏（`opaque`）

封装是构建健壮软件工程的基石。在传统 C 语言中，要使结构体字段变为私有，需要创建“不透明指针”（`typedef struct User User;`），并通过 `malloc()` 在堆上动态分配每个实例。这带来了指针间接寻址与内存分配的额外开销。

Zen C 通过 **`opaque`** 关键字提供了零开销封装。

### `opaque struct`：带有栈分配的私有字段

当使用 `opaque` 声明结构体时，其字段对定义它的模块（`.zc` 文件）而言是严格私有的：

```zenc
// user.zc
opaque struct User {
    id: int,
    username: string,
    password_hash: string,
}

// Public constructor
fn user_new(id: int, name: string, hash: string) -> User {
    return User {
        id: id,
        username: name,
        password_hash: hash,
    };
}

// Public accessor functions
fn user_get_id(u: User) -> int {
    return u.id;
}

fn user_get_name(u: User) -> string {
    return u.username;
}
```

现在，在 `main.zc` 中：

**代码清单 7-8**
```zenc
// main.zc
import "user.zc" as user;

fn main() {
    let u = user::user_new(101, "Alice", "secret_hash_987");

    // OK: Accessing data through public API
    println "User ID: {user::user_get_id(u)}, Name: {user::user_get_name(u)}";

    // COMPILE ERROR: Cannot access private field 'password_hash' of opaque struct
    // println "Hash: {u.password_hash}";
}
```

输出：
```text
User ID: 101, Name: Alice
```

如果外部文件尝试直接访问私有字段（例如取消第 10 行的注释），编译器将在编译期拒绝该代码：

```text
error: Cannot access private field 'password_hash' of opaque struct 'user__User'
```

> [!NOTE]
> **栈分配效率**：因为编译器知晓 `User` 的大小和内存布局，所以 `opaque struct` 可以直接在栈上分配或嵌入到其他结构体中，而无需动态堆分配！

---

### `opaque alias`：强标称类型

在 Zen C 中，类型别名（`alias NewName = OldType`）通常是透明的（结构化的），这意味着它们可以与底层类型隐式互换使用。

然而，当使用 `opaque` 修饰时，类型别名就变成了**标称类型（Nominal Type）**：

```zenc
// types.zc
opaque alias UserID = int;
opaque alias AccountID = int;

fn make_user_id(val: int) -> UserID {
    return val; // Conversion allowed inside defining module
}

fn user_id_to_int(uid: UserID) -> int {
    return uid;
}

fn make_account_id(val: int) -> AccountID {
    return val; // Conversion allowed inside defining module
}

fn account_id_to_int(aid: AccountID) -> int {
    return aid;
}
```

在 `types.zc` 外部：

**代码清单 7-9**
```zenc
// main.zc
import "types.zc";

fn main() {
    let uid: UserID = make_user_id(101);
    let aid: AccountID = make_account_id(5001);

    println "Domain types: UserID = {user_id_to_int(uid)}, AccountID = {account_id_to_int(aid)}";

    // COMPILE ERROR: Type validation failed. Expected 'int32_t', but got 'UserID'
    // let raw_int: int = uid;

    // COMPILE ERROR: Cannot assign AccountID to UserID!
    // let wrong: UserID = aid;
}
```

输出：
```text
Domain types: UserID = 101, AccountID = 5001
```

如果我们取消任意一条无效赋值语句的注释，编译器将在编译期阻止领域类型混淆：

```text
error: Type validation failed. Expected 'int32_t', but got 'UserID'
```

`opaque alias` 可以防止标识符之间的意外混淆（例如在需要 `AccountID` 的地方传入了 `UserID`），以零运行时开销在编译期捕获关键的领域逻辑错误。

---
