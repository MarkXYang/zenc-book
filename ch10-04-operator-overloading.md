# Operator Overloading

## Operator Overloading via Methods

Zen C allows you to overload operators for your custom struct types simply by implementing methods with specific operator names. No complex syntax or special macros are required!

When the compiler encounters an operator expression like `a + b`, it checks whether `a`'s struct type implements the corresponding operator method (such as `add`).

### Arithmetic Operator Overloading

To overload `+`, implement `fn add`:

**Listing 5-12: `list5-12.zc`**

```zenc
 1 | struct Vec2 {
 2 |     x: int;
 3 |     y: int;
 4 | }
 5 |
 6 | impl Vec2 {
 7 |     fn new(x: int, y: int) -> Vec2 {
 8 |         return Vec2 { x: x, y: y };
 9 |     }
10 |
11 |     // Overloads binary '+'
12 |     fn add(self, other: Vec2) -> Vec2 {
13 |         return Vec2 {
14 |             x: self.x + other.x,
15 |             y: self.y + other.y,
16 |         };
17 |     }
18 |
19 |     // Overloads binary '-'
20 |     fn sub(self, other: Vec2) -> Vec2 {
21 |         return Vec2 {
22 |             x: self.x - other.x,
23 |             y: self.y - other.y,
24 |         };
25 |     }
26 | }
27 |
28 | fn main() {
29 |     let v1 = Vec2::new(1, 2);
30 |     let v2 = Vec2::new(3, 4);
31 |
32 |     let v3 = v1 + v2; // Calls v1.add(v2)
33 |     println "v3 = ({v3.x}, {v3.y})";
34 |
35 |     let v4 = v3 - v1; // Calls v3.sub(v1)
36 |     println "v4 = ({v4.x}, {v4.y})";
37 | }
```

Output:
```text
v3 = (4, 6)
v4 = (3, 4)
```

### Equality Operator Overloading

To overload `==` and `!=`, implement `fn eq`:

**Listing 5-13: `list5-13.zc`**

```zenc
 1 | struct Vec2 {
 2 |     x: int;
 3 |     y: int;
 4 | }
 5 |
 6 | impl Vec2 {
 7 |     fn new(x: int, y: int) -> Vec2 {
 8 |         return Vec2 { x: x, y: y };
 9 |     }
10 |
11 |     // Overloads binary '=='
12 |     fn eq(self, other: Vec2) -> bool {
13 |         return self.x == other.x && self.y == other.y;
14 |     }
15 | }
16 |
17 | fn main() {
18 |     let a = Vec2::new(10, 20);
19 |     let b = Vec2::new(10, 20);
20 |     let c = Vec2::new(5, 5);
21 |
22 |     println "a == b: {a == b}";
23 |     println "a == c: {a == c}";
24 | }
```

Output:
```text
a == b: true
a == c: false
```

### Complete Operator Overloading Table

The following table lists the operator methods supported by Zen C:

| Category | Operator | Method Name | Example Signature |
| :--- | :--- | :--- | :--- |
| **Arithmetic** | `+` | `add` | `fn add(self, other: T) -> T` |
| | `-` | `sub` | `fn sub(self, other: T) -> T` |
| | `*` | `mul` | `fn mul(self, other: T) -> T` |
| | `/` | `div` | `fn div(self, other: T) -> T` |
| | `%` | `rem` | `fn rem(self, other: T) -> T` |
| | `**` | `pow` | `fn pow(self, exp: int) -> T` |
| **Comparison** | `==` | `eq` | `fn eq(self, other: T) -> bool` |
| | `!=` | `neq` | `fn neq(self, other: T) -> bool` |
| | `<` | `lt` | `fn lt(self, other: T) -> bool` |
| | `>` | `gt` | `fn gt(self, other: T) -> bool` |
| | `<=` | `le` | `fn le(self, other: T) -> bool` |
| | `>=` | `ge` | `fn ge(self, other: T) -> bool` |
| **Bitwise** | `&` | `bitand` | `fn bitand(self, other: T) -> T` |
| | `\|` | `bitor` | `fn bitor(self, other: T) -> T` |
| | `^` | `bitxor` | `fn bitxor(self, other: T) -> T` |
| | `<<` | `shl` | `fn shl(self, shift: int) -> T` |
| | `>>` | `shr` | `fn shr(self, shift: int) -> T` |
| **Unary** | `-` | `neg` | `fn neg(self) -> T` |
| | `!` | `not` | `fn not(self) -> bool` |
| | `~` | `bitnot` | `fn bitnot(self) -> T` |
| **Indexing** | `c[idx]` | `get` | `fn get(self, idx: int) -> T` |
| | `c[idx] = v` | `set` | `fn set(self, idx: int, val: T)` |

> [!TIP]
> **Compound Assignments**: Compound assignments (`+=`, `-=`, `*=`, `|=`) automatically desugar into their corresponding operator method and assignment! For instance, `f1 |= f2` works as expected when `bitor` is defined.

---
