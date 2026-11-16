# 注释、打印与字符串插值

本节介绍如何为代码添加注释、向 stdout 和 stderr 输出内容、通过**字符串插值**在字符串中嵌入表达式、编写多行字符串以及读取交互式用户输入。

---

## 注释

Zen C 使用与 C 相同的注释语法，并额外提供一种文档注释形式：

| 语法 | 种类 | 说明 |
| :--- | :--- | :--- |
| `// ...` | 行注释 | 直到行尾的内容都会被忽略。 |
| `/* ... */` | 块注释 | 可以跨越多行。 |
| `/// ...` | 文档注释 | 附加在紧随其后的声明上，由 `zc-doc` 收集。 |

```zenc
/// Returns the area of a width-by-height rectangle.
fn area(width: int, height: int) -> int {
    // Multiply the two sides.
    return width * height; /* inline block comment */
}

fn main() {
    println "Area: {area(3, 4)}"; // prints 12
}
```

对该文件运行 `zc-doc` 会生成 Markdown 文档，其中 `area` 的签名上方包含 `///` 注释的文字。你将在[第 15 章](ch15-04-developer-tooling.md)中进一步了解 `zc-doc`。

---

## 打印关键字

Zen C 包含了用于将格式化文本打印到标准输出（`stdout`）或标准错误（`stderr`）的内置关键字：

| 关键字 | 输出目标 | 结尾换行 | 描述 |
| :--- | :--- | :--- | :--- |
| `print "..."` | `stdout` | 否 | 向 `stdout` 打印文本，不添加换行符。 |
| `println "..."` | `stdout` | **是** | 向 `stdout` 打印文本，自动在结尾添加换行符。 |
| `eprint "..."` | `stderr` | 否 | 向 `stderr` 打印错误输出，不添加换行符。 |
| `eprintln "..."` | `stderr` | **是** | 向 `stderr` 打印错误输出，自动在结尾添加换行符。 |

**代码清单 3-5**
```zenc
fn main() {
    print "Hello ";
    println "world!";

    eprint "Warning: ";
    eprintln "low disk space!";
}
```

输出：
```text
Hello world!
```

标准错误（Stderr）：
```text
Warning: low disk space!
```

---

## 打印简写

Zen C 允许直接将字符串字面量作为语句使用，以便进行快速、简洁的控制台打印：

| 简写语法 | 等价关键字 | 输出目标与行为 |
| :--- | :--- | :--- |
| `"Hz"` | `println "Hz"` | 向 `stdout` 打印**并**换行 |
| `"Hz"..` | `print "Hz"` | 向 `stdout` 打印**且不**换行 |
| `!"Err"` | `eprintln "Err"` | 向 `stderr` 打印**并**换行 |
| `!"Err"..` | `eprint "Err"` | 向 `stderr` 打印**且不**换行 |

**代码清单 3-6**
```zenc
fn main() {
    "Processing item"..; // Equivalent to print
    " Done!";            // Equivalent to println

    !"Critical Error!"..; // Equivalent to eprint
    !" Details follow.";  // Equivalent to eprintln
}
```

输出：
```text
Processing item Done!
```

标准错误（Stderr）：
```text
Critical Error! Details follow.
```

---

## 字符串插值

你可以使用 `{}` 语法直接将变量和表达式嵌入到字符串字面量中。

在 Zen C 中，字符串插值是**隐式**的：任何包含 `{...}` 的字符串字面量都会自动转译为插值字符串。你也可以显式地给字符串加上 `f` 前缀（例如 `f"..."`）来强制采用格式化插值语义。

**代码清单 3-7**
```zenc
let count = 42;
let name = "Zen C";

// Implicit interpolation
println "Project: {name}, Items: {count}";

// Shorthand printing with interpolation
"Project: {name}, Items: {count}";
```

输出：
```text
Project: Zen C, Items: 42
Project: Zen C, Items: 42
```

### 1. 转义字面量花括号

若要在插值字符串中输出字面量 `{` 或 `}` 字符，只需双写花括号（`{{` 和 `}}`）：

**代码清单 3-8**
```zenc
let json = "JSON payload: {{\"status\": 200}}";
println "{json}";
```

输出：
```text
JSON payload: {"status": 200}
```

### 2. 原始字符串 (`r"..."`)

若要定义转义序列（`\n`、`\t`）和插值花括号（`{...}`）都被视作纯字面量文本的字符串，可以在字符串字面量前加上 `r` 前缀：

```zenc
let regex = r"\w+\d+"; // Contains literal backslashes
let raw_json = r'{"key": "value"}'; // No brace escaping required
```

---

## 多行字符串 (`"""..."""`)

Zen C 支持使用三引号（`"""`）的原生多行字符串块。多行字符串会保留换行符和引号，无需手动使用 `\n` 或 `\"` 转义，非常适合用于嵌入式语言（GLSL、SQL、HTML）或代码生成场景：

```zenc
let prompt = """
  Please enter your choice:
  1. Start game
  2. Exit
""";
```

### 带前缀的多行字符串

与单行字符串一样，多行字符串也可以显式添加前缀：
- `f"""..."""`：显式将多行文本块标记为**插值字符串**。
- `r"""..."""`：显式将多行文本块标记为**原始字符串**（禁用插值和转义处理）。

```zenc
let target = "Server";
let template = f"""
  Configuration for {target}:
  Status: ACTIVE
""";

let raw_script = r"""
  fn test() {
      println "{not_interpolated}";
  }
""";
```

---

## 交互式输入提示符 (`?`)

Zen C 提供了使用 `?` 前缀运算符请求用户输入的简写语法。

### 1. 基本输入提示

- `? "Prompt text"`：打印提示信息（不换行）并从 stdin 读取一行输入。

### 2. 扫描输入到变量 (`? "Prompt" (var)`)

- `? "Enter age: " (age)`：打印提示字符串，并自动将用户输入直接扫描读取到 `age` 中。格式说明符会根据变量的类型自动推导。

**代码清单 3-9**
```zenc
fn main() {
    let age: int;

    // Prompts "How old are you? " and scans user input into `age`
    ? "How old are you? " (age);

    println "You are {age} years old.";
}
```

输出（输入 `25` 时）：
```text
How old are you? 25
You are 25 years old.
```

---

接下来，让我们看看 Zen C 如何通过条件语句和循环控制程序的执行流程！
