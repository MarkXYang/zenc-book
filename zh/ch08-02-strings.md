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

**代码清单 8-11**
```zenc
import "std/string.zc";

fn main() {
    // 1. Create a dynamic String from a literal
    let s = String::from("Hello");
    let world = String::from(" World");
    s.append(&world);
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

**代码清单 8-12**
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

**代码清单 8-13**
```zenc
import "std/string.zc";

fn main() {
    let s = String::from("Hello, 🌍!");

    // 12 bytes in memory: 7 ASCII bytes + 4 bytes for 🌍 + 1 byte for !
    println "Byte length: {s.length()}";
    // 9 Unicode code points
    println "Unicode character count: {s.utf8_len()}";
}
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

**代码清单 8-14**
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

**代码清单 8-15**
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

**代码清单 8-16**
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
