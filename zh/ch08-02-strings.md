# 字符串

字符串操作是系统编程中最常见的任务之一，但在传统 C 语言中它却极易滋生 bug。在 C 语言中，字符串仅仅是以空字符（`\0`）结尾的原始字节数组。程序员必须手动跟踪缓冲区容量、执行边界检查并计算字节长度——这往往会导致缓冲区溢出漏洞和内存损坏。

Zen C 提供了一种现代、健壮且基于堆分配的字符串类型，名为 **`String`**，定义在 `std/string.zc` 中。它将高级字符串操作的便利性、UTF-8 Unicode 感知以及自动内存清理与零成本 C 字符串互操作性融为一体。

---

## 什么是 Zen C 中的字符串（`String`）？

理解**字符串字面量**与**动态字符串**之间的区别至关重要：

- **字符串字面量（`"hello"`）**：这些是 `char*` 或 `const char*` 类型的原始 C 字符串指针。它们直接指向存储在二进制数据段中的只读字符串数据。它们具有固定长度，无法在原处扩容或修改。
- **动态字符串（`String`）**：这些是由 `std/string.zc` 提供的可伸缩、堆分配的字符串对象。在内部，`String` 包装了一个字符向量：
  ```zenc
  struct String {
      vec: Vec<char>;
  }
  ```
  `String` 保证底层字符向量始终以 null 终止符（`\0`）结尾。这确保了通过 `.c_str()` 将 `String` 转换为 C 兼容字符串是一种零成本操作，不需要任何内存分配或拷贝！

---

## 创建与追加字符串

要使用 `String`，请导入 `std/string.zc`。你可以使用 `String::from("...")` 或 `String::new("...")` 从字符串字面量构造新字符串。

### 修改字符串
- **`append(&other)`**：将另一个 `String` 追加到当前字符串末尾。
- **`append_c("...")`**：追加一个原始 C 字符串字面量。
- **`+` 与 `+=`**：用于拼接的运算符重载。

> [!NOTE]
> 为避免不必要的拷贝和堆分配，Zen C 的 `append(&other)` 以及 `+` / `+=` 运算符接受指向右侧字符串的指针（`String*`）。因此，右侧操作数必须是一个可寻址的变量（`&suffix`），而不是临时右值。

**代码清单 8-11: `list8-11.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     // 1. Create a dynamic String from a literal
 5 |     let s = String::from("Hello");
 6 |     let world = String::from(" World");
 7 |     s.append(&world);
 8 |     s.append_c("!");
 9 |
10 |     println "Text: {s.c_str()}";
11 |     println "Byte length: {s.length()}";
12 |
13 |     // 4. Operator concatenation with +
14 |     let prefix = String::from("Zen");
15 |     let suffix = String::from(" C");
16 |     let lang = prefix + &suffix;
17 |     println "Language: {lang.c_str()}";
18 | }
```

输出：
```text
Text: Hello World!
Byte length: 12
Language: Zen C
```

---

## 查询与搜索

`String` 包含了用于检查和搜索文本的丰富方法：

| 方法 | 返回类型 | 说明 |
| :--- | :--- | :--- |
| `length()` | `usize` | 返回字符串中的字节数（不包含 `\0`）。 |
| `is_empty()` | `bool` | 如果 `length() == 0` 则返回 `true`。 |
| `starts_with(prefix)` | `bool` | 检查字符串是否以 `prefix` 开头。 |
| `ends_with(suffix)` | `bool` | 检查字符串是否以 `suffix` 结尾。 |
| `contains(c)` | `bool` | 检查单字节字符 `c` 是否存在。 |
| `contains_str(str)` | `bool` | 检查子字符串 `str` 是否存在。 |
| `find_str(str)` | `Option<usize>` | 返回首个匹配项的 `Some(offset)`，未找到则返回 `None()`。 |
| `substring(start, len)` | `String` | 返回一个从 `start` 开始、长度为 `len` 的新 `String` 切片。 |

**代码清单 8-12: `list8-12.zc`**

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

输出：
```text
Starts with 'The': true
Ends with 'jumps': true
Contains 'fox': true
'fox' found at offset: 16
Extracted word: 'quick'
```

---

## UTF-8 与 Unicode 支持

在 Zen C 中，文本采用 **UTF-8** 编码：
- ASCII 字符（例如 `'A'`、`'z'`、`'1'`）占用 **1 字节**。
- 国际字符、带重音符号的字母以及特殊符号占用 **2 到 3 字节**。
- Emoji 表情符号（例如 `🚀`、`🌍`）占用 **4 字节**。

由于变长编码的特性，`length()` 返回的字节数并不总是等于可读字符的数量！

为了精确处理 Unicode，Zen C 提供了：
- **`utf8_len()`**：返回实际的 Unicode 码点（字符）数量。
- **`rune`**：表示单个 Unicode 码点的 32 位标量值。
- **`push_rune(r)`**：将 Unicode `rune` 追加到字符串中。
- **`for c in s`**：遍历字符串中的每个 Unicode `rune`。

**代码清单 8-13: `list8-13.zc`**

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
10 | }
```

输出：
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

## 字符串转换与拆分

`String` 提供了返回新修改实例的高级转换方法：

- **`to_lowercase()`** / **`to_uppercase()`**：将 ASCII 字符转换为小写或大写。
- **`trim()`**、**`trim_start()`**、**`trim_end()`**：去除首尾空白字符。
- **`replace(target, replacement)`**：将出现的 `target` 替换为 `replacement`。
- **`split(delim)`**：按分隔符拆分字符串并返回 `Vec<String>`。

**代码清单 8-14: `list8-14.zc`**

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

输出：
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

## 比较运算符

你可以使用标准比较运算符或专用方法来比较字符串：

**代码清单 8-15: `list8-15.zc`**

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

输出：
```text
s1 == s3: true
s1 != s2: true
s1 < s2: true
Case-insensitive equal: true
```

---

## C 互操作性与字符串插值

因为 `String` 始终维护 null 结尾：
- 调用 `s.c_str()` 会产生一个标准的 `char*` 指针，可以零运行时开销直接传递给 C 函数（如 `puts`、`fopen` 或第三方 C 库）。
- Zen C 的字符串插值（`"{s.c_str()}"` 或 `"{s.to_string()}"`）允许你在打印语句中轻松格式化字符串。

---

## 完整示例

这是一个演示字符串创建、拼接、搜索、Unicode rune、转换和词元拆分的综合示例：

**代码清单 8-16: `list8-16.zc`**

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

输出：
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
> 你可以在 [`book/examples/ch08/ch08-02-strings/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-02-strings/main.zc) 中找到并运行本节的完整可执行示例。

---

现在你已经掌握了字符串，接下来让我们探索**[哈希映射与哈希集合](ch08-03-hash-maps.md)**！
