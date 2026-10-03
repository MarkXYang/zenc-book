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
import "std/string.zc";

fn main() {
    // 1. Create a dynamic String from a literal
    let s = String::from("Hello");

    // 2. Append another String by pointer
    let world = String::from(" World");
    s.append(&world);

    // 3. Append a raw C string literal
    s.append_c("!");

    println "Text: {s.c_str()}";
    println "Byte length: {s.length()}";

    // 4. Operator concatenation with +
    let prefix = String::from("Zen");
    let suffix = String::from(" C");
    let lang = prefix + &suffix;
    println "Language: {lang.c_str()}";
}
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
import "std/string.zc";

fn main() {
    let s = String::from("The quick brown fox jumps");

    println "Starts with 'The': {s.starts_with(\"The\")}";
    println "Ends with 'jumps': {s.ends_with(\"jumps\")}";
    println "Contains 'fox': {s.contains_str(\"fox\")}";

    let pos = s.find_str("fox");
    if pos.is_some() {
        println "'fox' found at offset: {pos.unwrap()}";
    }

    // Substring: start at index 4, length 5
    let sub = s.substring(4, 5);
    println "Extracted word: '{sub.c_str()}'";
}
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
import "std/string.zc";

fn main() {
    let s = String::from("Hello, 🌍!");

    // 12 bytes in memory: 7 ASCII bytes + 4 bytes for 🌍 + 1 byte for !
    println "Byte length: {s.length()}";
    // 9 Unicode code points
    println "Unicode character count: {s.utf8_len()}";

    println "--- Runes ---";
    for c in s {
        println "Rune: {c}";
    }

    // Append an emoji rune
    let rocket: rune = '🚀';
    s.push_rune(rocket);
    println "After push_rune: {s.c_str()}";
}
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
import "std/string.zc";

fn main() {
    let raw = String::from("   systems programming in zen c   ");

    // 1. Whitespace trimming
    let trimmed = raw.trim();
    println "Trimmed: '{trimmed.c_str()}'";

    // 2. Case conversion
    let upper = trimmed.to_uppercase();
    println "Uppercase: {upper.c_str()}";

    // 3. String replacement
    let replaced = upper.replace("ZEN C", "HIGH PERFORMANCE ZEN C");
    println "Replaced: {replaced.c_str()}";

    // 4. Splitting into tokens (returns Vec<String>)
    let csv = String::from("red,green,blue,orange");
    let colors = csv.split(',');
    println "Parsed {colors.length()} color tokens:";
    for color in &colors {
        println "  - {(*color).c_str()}";
    }
}
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
import "std/string.zc";

fn main() {
    let s1 = String::from("apple");
    let s2 = String::from("banana");
    let s3 = String::from("apple");

    // Structural comparison
    println "s1 == s3: {s1 == &s3}";
    println "s1 != s2: {s1 != &s2}";
    println "s1 < s2: {s1 < &s2}";

    // Case-insensitive comparison
    let upper_apple = String::from("APPLE");
    println "Case-insensitive equal: {s1.eq_ignore_case(&upper_apple)}";
}
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
import "std/string.zc";

fn main() {
    println "=== 1. String Creation & Concatenation ===";
    let s = String::from("Hello");
    let world = String::from(" World");
    s.append(&world);
    s.append_c("!");
    println "Greeting: {s.c_str()}";
    println "Byte length: {s.length()}";

    println "\n=== 2. Operator Concatenation ===";
    let prefix = String::from("Zen");
    let suffix = String::from(" C");
    let lang = prefix + &suffix;
    println "Concatenated: {lang.c_str()}";

    println "\n=== 3. Querying & Substrings ===";
    println "Starts with 'Hello': {s.starts_with(\"Hello\")}";
    println "Ends with '!': {s.ends_with(\"!\")}";
    println "Contains 'World': {s.contains_str(\"World\")}";

    let pos = s.find_str("World");
    if pos.is_some() {
        println "'World' found at byte offset: {pos.unwrap()}";
    }

    let sub = s.substring(0, 5);
    println "Extracted prefix substring: '{sub.c_str()}'";

    println "\n=== 4. Transformations ===";
    let raw = String::from("   systems programming in zen c   ");
    let trimmed = raw.trim();
    println "Trimmed: '{trimmed.c_str()}'";

    let upper = trimmed.to_uppercase();
    println "Uppercase: {upper.c_str()}";

    let replaced = upper.replace("ZEN C", "HIGH PERFORMANCE ZEN C");
    println "Replaced: {replaced.c_str()}";

    println "\n=== 5. UTF-8 & Unicode Runes ===";
    let utf = String::from("Zen C 🚀");
    println "Byte length: {utf.length()}";
    println "Unicode character (rune) count: {utf.utf8_len()}";

    println "\n=== 6. Splitting & Joining ===";
    let csv = String::from("red,green,blue,orange");
    let colors = csv.split(',');
    println "Parsed {colors.length()} color tokens:";
    for color in &colors {
        println "  - {(*color).c_str()}";
    }
}
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
