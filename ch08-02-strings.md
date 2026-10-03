# Strings

String manipulation is one of the most common tasks in systems programming, yet it is notoriously bug-prone in traditional C. In C, strings are simply raw arrays of bytes terminated by a null character (`\0`). Programmers must manually keep track of buffer capacities, perform bounds checking, and calculate byte lengths—frequently leading to buffer overflow vulnerabilities and memory corruption.

Zen C provides a modern, robust, and heap-allocated string type called **`String`**, defined in `std/string.zc`. It combines high-level string convenience, UTF-8 Unicode awareness, and automatic memory cleanup with zero-cost C string interoperability.

---

## What is a `String` in Zen C?

It is crucial to understand the distinction between **String Literals** and **Dynamic Strings**:

- **String Literals (`"hello"`)**: These are primitive C string pointers of type `char*` or `const char*`. They point directly to read-only string data stored in the binary's data segment. They have fixed lengths and cannot be grown or modified in place.
- **Dynamic Strings (`String`)**: These are growable, heap-allocated string objects provided by `std/string.zc`. Internally, a `String` wraps a vector of characters:
  ```zenc
  struct String {
      vec: Vec<char>;
  }
  ```
  `String` guarantees that the underlying character vector always ends with a null-terminator (`\0`). This ensures that converting a `String` to a C-compatible string via `.c_str()` is a zero-cost operation that requires no memory allocation or copying!

---

## Creating and Appending Strings

To use `String`, import `std/string.zc`. You can construct a new string from a string literal using `String::from("...")` or `String::new("...")`.

### Modifying Strings
- **`append(&other)`**: Appends another `String` to this one.
- **`append_c("...")`**: Appends a primitive C string literal.
- **`+` and `+=`**: Operator overloads for concatenation.

> [!NOTE]
> To prevent unnecessary copies and heap allocations, Zen C's `append(&other)` and the `+` / `+=` operators take a pointer (`String*`) to the right-hand string. The right-hand operand must therefore be an addressable variable (`&suffix`), rather than a temporary rvalue.

**Listing 8-11: `list8-11.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     // 1. Create a dynamic String from a literal
 5 |     let s = String::from("Hello");
 6 |
 7 |     // 2. Append another String by pointer
 8 |     let world = String::from(" World");
 9 |     s.append(&world);
10 |
11 |     // 3. Append a raw C string literal
12 |     s.append_c("!");
13 |
14 |     println "Text: {s.c_str()}";
15 |     println "Byte length: {s.length()}";
16 |
17 |     // 4. Operator concatenation with +
18 |     let prefix = String::from("Zen");
19 |     let suffix = String::from(" C");
20 |     let lang = prefix + &suffix;
21 |     println "Language: {lang.c_str()}";
22 | }
```

Output:
```text
Text: Hello World!
Byte length: 12
Language: Zen C
```

---

## Querying and Searching

`String` includes rich methods for inspecting and searching text:

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `length()` | `usize` | Returns the number of bytes in the string (excluding `\0`). |
| `is_empty()` | `bool` | Returns `true` if `length() == 0`. |
| `starts_with(prefix)` | `bool` | Checks if the string begins with `prefix`. |
| `ends_with(suffix)` | `bool` | Checks if the string ends with `suffix`. |
| `contains(c)` | `bool` | Checks if byte character `c` is present. |
| `contains_str(str)` | `bool` | Checks if substring `str` is present. |
| `find_str(str)` | `Option<usize>` | Returns `Some(offset)` of the first match, or `None()`. |
| `substring(start, len)` | `String` | Returns a new `String` slice of length `len` starting at `start`. |

**Listing 8-12: `list8-12.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let s = String::from("The quick brown fox jumps");
 5 |
 6 |     println "Starts with 'The': {s.starts_with(\"The\")}";
 7 |     println "Ends with 'jumps': {s.ends_with(\"jumps\")}";
 8 |     println "Contains 'fox': {s.contains_str(\"fox\")}";
 9 |
10 |     let pos = s.find_str("fox");
11 |     if pos.is_some() {
12 |         println "'fox' found at offset: {pos.unwrap()}";
13 |     }
14 |
15 |     // Substring: start at index 4, length 5
16 |     let sub = s.substring(4, 5);
17 |     println "Extracted word: '{sub.c_str()}'";
18 | }
```

Output:
```text
Starts with 'The': true
Ends with 'jumps': true
Contains 'fox': true
'fox' found at offset: 16
Extracted word: 'quick'
```

---

## UTF-8 and Unicode Support

In Zen C, text is encoded using **UTF-8**:
- ASCII characters (such as `'A'`, `'z'`, `'1'`) occupy **1 byte**.
- International characters, accented letters, and symbols occupy **2 to 3 bytes**.
- Emojis (such as `🚀`, `🌍`) occupy **4 bytes**.

Because of variable-width encoding, the number of bytes returned by `length()` does not always equal the number of human-readable characters!

To handle Unicode accurately, Zen C provides:
- **`utf8_len()`**: Returns the actual number of Unicode code points (characters).
- **`rune`**: A 32-bit scalar value representing a single Unicode code point.
- **`push_rune(r)`**: Appends a Unicode `rune` to the string.
- **`for c in s`**: Iterates through each Unicode `rune` in the string.

**Listing 8-13: `list8-13.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let s = String::from("Hello, 🌍!");
 5 |
 6 |     // 12 bytes in memory: 7 ASCII bytes + 4 bytes for 🌍 + 1 byte for !
 7 |     println "Byte length: {s.length()}";
 8 |     // 9 Unicode code points
 9 |     println "Unicode character count: {s.utf8_len()}";
10 |
11 |     println "--- Runes ---";
12 |     for c in s {
13 |         println "Rune: {c}";
14 |     }
15 |
16 |     // Append an emoji rune
17 |     let rocket: rune = '🚀';
18 |     s.push_rune(rocket);
19 |     println "After push_rune: {s.c_str()}";
20 | }
```

Output:
```text
Byte length: 12
Unicode character count: 9
--- Runes ---
Rune: 72
Rune: 101
Rune: 108
Rune: 108
Rune: 111
Rune: 44
Rune: 32
Rune: 127757
Rune: 33
After push_rune: Hello, 🌍!🚀
```

---

## String Transformations and Splitting

`String` provides high-level transformations that return new, modified `String` instances:

- **`to_lowercase()`** / **`to_uppercase()`**: Converts ASCII characters to lowercase or uppercase.
- **`trim()`**, **`trim_start()`**, **`trim_end()`**: Strips leading and trailing whitespace.
- **`replace(target, replacement)`**: Replaces occurrences of `target` with `replacement`.
- **`split(delim)`**: Splits the string by a delimiter character and returns a `Vec<String>`.

**Listing 8-14: `list8-14.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let raw = String::from("   systems programming in zen c   ");
 5 |
 6 |     // 1. Whitespace trimming
 7 |     let trimmed = raw.trim();
 8 |     println "Trimmed: '{trimmed.c_str()}'";
 9 |
10 |     // 2. Case conversion
11 |     let upper = trimmed.to_uppercase();
12 |     println "Uppercase: {upper.c_str()}";
13 |
14 |     // 3. String replacement
15 |     let replaced = upper.replace("ZEN C", "HIGH PERFORMANCE ZEN C");
16 |     println "Replaced: {replaced.c_str()}";
17 |
18 |     // 4. Splitting into tokens (returns Vec<String>)
19 |     let csv = String::from("red,green,blue,orange");
20 |     let colors = csv.split(',');
21 |     println "Parsed {colors.length()} color tokens:";
22 |     for color in &colors {
23 |         println "  - {(*color).c_str()}";
24 |     }
25 | }
```

Output:
```text
Trimmed: 'systems programming in zen c'
Uppercase: SYSTEMS PROGRAMMING IN ZEN C
Replaced: SYSTEMS PROGRAMMING IN HIGH PERFORMANCE ZEN C
Parsed 4 color tokens:
  - red
  - green
  - blue
  - orange
```

---

## Comparison Operators

You can compare strings using standard comparison operators or specialized methods:

**Listing 8-15: `list8-15.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let s1 = String::from("apple");
 5 |     let s2 = String::from("banana");
 6 |     let s3 = String::from("apple");
 7 |
 8 |     // Structural comparison
 9 |     println "s1 == s3: {s1 == &s3}";
10 |     println "s1 != s2: {s1 != &s2}";
11 |     println "s1 < s2: {s1 < &s2}";
12 |
13 |     // Case-insensitive comparison
14 |     let upper_apple = String::from("APPLE");
15 |     println "Case-insensitive equal: {s1.eq_ignore_case(&upper_apple)}";
16 | }
```

Output:
```text
s1 == s3: true
s1 != s2: true
s1 < s2: true
Case-insensitive equal: true
```

---

## C Interoperability and String Interpolation

Because `String` maintains null-termination:
- Calling `s.c_str()` yields a standard `char*` pointer that can be passed directly to C functions (such as `puts`, `fopen`, or third-party C libraries) with zero runtime overhead.
- Zen C's string interpolation (`"{s.c_str()}"` or `"{s.to_string()}"`) allows you to format strings effortlessly in print statements.

---

## A Complete Example

Here is a comprehensive example demonstrating string creation, concatenation, searching, Unicode runes, transformations, and token splitting:

**Listing 8-16: `list8-16.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     println "=== 1. String Creation & Concatenation ===";
 5 |     let s = String::from("Hello");
 6 |     let world = String::from(" World");
 7 |     s.append(&world);
 8 |     s.append_c("!");
 9 |     println "Greeting: {s.c_str()}";
10 |     println "Byte length: {s.length()}";
11 |
12 |     println "\n=== 2. Operator Concatenation ===";
13 |     let prefix = String::from("Zen");
14 |     let suffix = String::from(" C");
15 |     let lang = prefix + &suffix;
16 |     println "Concatenated: {lang.c_str()}";
17 |
18 |     println "\n=== 3. Querying & Substrings ===";
19 |     println "Starts with 'Hello': {s.starts_with(\"Hello\")}";
20 |     println "Ends with '!': {s.ends_with(\"!\")}";
21 |     println "Contains 'World': {s.contains_str(\"World\")}";
22 |
23 |     let pos = s.find_str("World");
24 |     if pos.is_some() {
25 |         println "'World' found at byte offset: {pos.unwrap()}";
26 |     }
27 |
28 |     let sub = s.substring(0, 5);
29 |     println "Extracted prefix substring: '{sub.c_str()}'";
30 |
31 |     println "\n=== 4. Transformations ===";
32 |     let raw = String::from("   systems programming in zen c   ");
33 |     let trimmed = raw.trim();
34 |     println "Trimmed: '{trimmed.c_str()}'";
35 |
36 |     let upper = trimmed.to_uppercase();
37 |     println "Uppercase: {upper.c_str()}";
38 |
39 |     let replaced = upper.replace("ZEN C", "HIGH PERFORMANCE ZEN C");
40 |     println "Replaced: {replaced.c_str()}";
41 |
42 |     println "\n=== 5. UTF-8 & Unicode Runes ===";
43 |     let utf = String::from("Zen C 🚀");
44 |     println "Byte length: {utf.length()}";
45 |     println "Unicode character (rune) count: {utf.utf8_len()}";
46 |
47 |     println "\n=== 6. Splitting & Joining ===";
48 |     let csv = String::from("red,green,blue,orange");
49 |     let colors = csv.split(',');
50 |     println "Parsed {colors.length()} color tokens:";
51 |     for color in &colors {
52 |         println "  - {(*color).c_str()}";
53 |     }
54 | }
```

Output:
```text
=== 1. String Creation & Concatenation ===
Greeting: Hello World!
Byte length: 12

=== 2. Operator Concatenation ===
Concatenated: Zen C

=== 3. Querying & Substrings ===
Starts with 'Hello': true
Ends with '!': true
Contains 'World': true
'World' found at byte offset: 6
Extracted prefix substring: 'Hello'

=== 4. Transformations ===
Trimmed: 'systems programming in zen c'
Uppercase: SYSTEMS PROGRAMMING IN ZEN C
Replaced: SYSTEMS PROGRAMMING IN HIGH PERFORMANCE ZEN C

=== 5. UTF-8 & Unicode Runes ===
Byte length: 10
Unicode character (rune) count: 7

=== 6. Splitting & Joining ===
Parsed 4 color tokens:
  - red
  - green
  - blue
  - orange
```

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch08/ch08-02-strings/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-02-strings/main.zc).

---

Now that you have mastered strings, let's explore **[Hash Maps and Sets](ch08-03-hash-maps.md)**!
