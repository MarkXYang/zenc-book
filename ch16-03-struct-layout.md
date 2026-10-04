# Low-Level Struct Layout: Bitfields, Packing, and Alignment

## Low-Level Control: Bitfields & Attributes

Zen C is designed for systems-level control. When writing drivers, network protocols, or memory-constrained embedded systems, you often need exact control over struct layout, padding, and alignment.

### Bitfields

Zen C natively supports C-style bitfields using `field: Type : N;` where `N` is the number of bits allocated to the field:

**Listing 5-6: `list5-6.zc`**

```zenc
 1 | struct Flags {
 2 |     is_readable:   u8 : 1; // 1 bit
 3 |     is_writable:   u8 : 1; // 1 bit
 4 |     is_executable: u8 : 1; // 1 bit
 5 |     mode:          u8 : 2; // 2 bits (values 0-3)
 6 |     reserved:      u8 : 3; // 3 bits padding out the 8-bit byte
 7 | }
 8 |
 9 | fn main() {
10 |     let perms = Flags {
11 |         is_readable: 1,
12 |         is_writable: 1,
13 |         is_executable: 0,
14 |         mode: 2,
15 |         reserved: 0,
16 |     };
17 |
18 |     if perms.is_readable == 1 {
19 |         println "File is readable";
20 |     }
21 | }
```

Output:
```text
File is readable
```

### Packing with `@packed`

By default, the C compiler aligns struct fields on natural boundary multiples (e.g. 4 bytes or 8 bytes) by inserting invisible padding bytes. In binary protocol headers or file formats, padding causes field offsets to mismatch.

Add `@packed` above a struct definition to instruct the compiler to eliminate all padding:

```zenc
@packed
struct EthernetHeader {
    dest_mac:   [u8; 6];
    src_mac:    [u8; 6];
    ether_type: u16;
} // Exact binary size: 14 bytes (no padding between fields)
```

### Alignment with `@align(N)`

To enforce custom memory alignment boundaries (for example, 16-byte or 32-byte alignment required by SIMD instructions):

```zenc
@align(16)
struct Vector4 {
    x: f32;
    y: f32;
    z: f32;
    w: f32;
}
```

You can also combine attributes:

```zenc
@packed @align(4)
struct HardwarePacket {
    id: u8;
    payload_len: u16;
}
```

### Opting Into Copy Semantics (`@derive(Copy)`)

As introduced in [Chapter 4](ch04-02-ownership-and-allocation.md), structs in Zen C default to move semantics to prevent accidental double frees. However, plain data structs containing only primitive values can opt into implicit copying using the `@derive(Copy)` attribute:

**Listing 5-7: `list5-7.zc`**

```zenc
 1 | @derive(Copy)
 2 | struct Point {
 3 |     x: int;
 4 |     y: int;
 5 | }
 6 |
 7 | fn main() {
 8 |     let p1 = Point { x: 1, y: 2 };
 9 |     let p2 = p1; // Copied! p1 remains completely valid.
10 |
11 |     println "p1: ({p1.x}, {p1.y}), p2: ({p2.x}, {p2.y})";
12 | }
```

Output:
```text
p1: (1, 2), p2: (1, 2)
```

> [!CAUTION]
> **Safety Rule**: Types that implement `Copy` must not define a custom destructor (`Drop`).

---

## Working with Pointers to Structs

In systems programming, structs are frequently passed by reference using pointers (`Type*`) to avoid copying large amounts of memory:

**Listing 5-8: `list5-8.zc`**

```zenc
 1 | struct User {
 2 |     username: string;
 3 |     email: string;
 4 |     sign_in_count: int;
 5 |     active: bool;
 6 | }
 7 |
 8 | fn print_user(user: User*) {
 9 |     // In Zen C, dot (.) automatically dereferences pointers!
10 |     println "User: {user.username} <{user.email}>";
11 | }
12 |
13 | fn main() {
14 |     let u = User {
15 |         username: "mark",
16 |         email: "mark@example.com",
17 |         sign_in_count: 5,
18 |         active: true,
19 |     };
20 |
21 |     print_user(&u); // Pass pointer to u
22 | }
```

Output:
```text
User: mark <mark@example.com>
```

> [!IMPORTANT]
> **Unified Dot Operator**: In traditional C, you must write `ptr->field` or `(*ptr).field`. In Zen C, dot syntax (`.`) works uniformly on both **struct values** and **struct pointers**! The compiler automatically transpiles `user.username` to `user->username` in C.

### Safe Navigation Operator (`?.`)

When working with potentially null pointers, Zen C provides the **safe navigation operator** (`?.`). If the pointer is `NULL`, accessing a field evaluates safely to zero/null rather than triggering a segmentation fault:

```zenc
let valid_ptr: User* = &u;
let safe_count = valid_ptr?.sign_in_count; // Evaluates to 5

let null_ptr: User* = NULL;
let zero_count = null_ptr?.sign_in_count; // Evaluates safely to 0 (no segfault!)
```

---
