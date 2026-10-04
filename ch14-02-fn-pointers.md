# Raw Function Pointers (fn*)

## Raw Function Pointers (`fn*`)

For zero-overhead C interop, Zen C provides raw function pointers using the `fn*` syntax. Unlike closures, raw function pointers do not allocate environment state, making them 100% compatible with native C callbacks.

**Listing 3-6: `list3-6.zc`**

```zenc
 1 | // Function accepting a raw C function pointer
 2 | fn set_callback(cb: fn*(int)) {
 3 |     cb(42);
 4 | }
 5 |
 6 | fn my_handler(code: int) {
 7 |     println "Handler received code: {code}";
 8 | }
 9 |
10 | // Function returning a raw function pointer
11 | fn get_callback() -> fn*(int) {
12 |     return my_handler;
13 | }
14 |
15 | fn main() {
16 |     set_callback(my_handler);
17 |
18 |     // Pointer to function pointers (fn**) are also supported
19 |     let ptr: fn*(int) = my_handler;
20 |     let pptr: fn**(int) = &ptr;
21 | }
```

Output:
```text
Handler received code: 42
```

---
