# Encapsulation with opaque

## 5. Encapsulation and Data Hiding (`opaque`)

Encapsulation is a cornerstone of robust software engineering. In traditional C, making struct fields private requires creating an "opaque pointer" (`typedef struct User User;`) and dynamically allocating every instance on the heap via `malloc()`. This adds pointer indirection and allocation overhead.

Zen C provides zero-overhead encapsulation via the **`opaque`** keyword.

### `opaque struct`: Private Fields with Stack Allocation

When a struct is declared with `opaque`, its fields are strictly private to the defining module (`.zc` file):

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

Now, in `main.zc`:

**Listing 7-8: `list7-8.zc`**

```zenc
 1 | // main.zc
 2 | import "user.zc" as user;
 3 |
 4 | fn main() {
 5 |     let u = user::user_new(101, "Alice", "secret_hash_987");
 6 |
 7 |     // OK: Accessing data through public API
 8 |     println "User ID: {user::user_get_id(u)}, Name: {user::user_get_name(u)}";
 9 |
10 |     // COMPILE ERROR: Cannot access private field 'password_hash' of opaque struct
11 |     // println "Hash: {u.password_hash}";
12 | }
```

Output:
```text
User ID: 101, Name: Alice
```

If an external file attempts to access a private field directly (e.g., uncommenting line 10), the compiler rejects the code at compile time:

```text
error: Cannot access private field 'password_hash' of opaque struct 'user__User'
```

> [!NOTE]
> **Stack Allocation Efficiency**: Because the compiler knows the size and memory layout of `User`, an `opaque struct` can be allocated directly on the stack or embedded inside other structs without dynamic heap allocation!

---

### `opaque alias`: Strong Nominal Types

In Zen C, type aliases (`alias NewName = OldType`) are normally transparent (structural), meaning they can be implicitly used interchangeably with their underlying type.

However, when qualified with `opaque`, the type alias becomes a **Nominal Type**:

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

Outside of `types.zc`:

**Listing 7-9: `list7-9.zc`**

```zenc
 1 | // main.zc
 2 | import "types.zc";
 3 |
 4 | fn main() {
 5 |     let uid: UserID = make_user_id(101);
 6 |     let aid: AccountID = make_account_id(5001);
 7 |
 8 |     println "Domain types: UserID = {user_id_to_int(uid)}, AccountID = {account_id_to_int(aid)}";
 9 |
10 |     // COMPILE ERROR: Type validation failed. Expected 'int32_t', but got 'UserID'
11 |     // let raw_int: int = uid;
12 |
13 |     // COMPILE ERROR: Cannot assign AccountID to UserID!
14 |     // let wrong: UserID = aid;
15 | }
```

Output:
```text
Domain types: UserID = 101, AccountID = 5001
```

If we uncomment either invalid assignment, the compiler prevents domain type confusion at compile time:

```text
error: Type validation failed. Expected 'int32_t', but got 'UserID'
```

`opaque alias` prevents accidental confusion between identifiers (such as passing a `UserID` where an `AccountID` is expected), catching critical domain logic bugs at compile time with zero runtime cost.

---
