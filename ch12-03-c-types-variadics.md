# C Types, Strings, and Variadics

## Variadic Functions (`...` and `va_list`)

Zen C supports variadic functions (functions that take a variable number of arguments) using standard C `...` syntax and `va_list` helpers:

**Listing 3-7: `list3-7.zc`**

```zenc
 1 | fn custom_log(fmt: char*, ...) {
 2 |     let ap: va_list;
 3 |     va_start(ap, fmt);
 4 |     vprintf(fmt, ap); // Uses C stdio vprintf
 5 |     va_end(ap);
 6 | }
 7 |
 8 | fn main() {
 9 |     custom_log("Logging %s with status code %d\n", "HTTP Request", 200);
10 | }
```

Output:
```text
Logging HTTP Request with status code 200
```

---
