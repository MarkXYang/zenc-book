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

**Listing 7-8**
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

**Listing 7-9**
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
