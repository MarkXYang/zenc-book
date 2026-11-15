# 打印与字符串插值

Zen C 提供了丰富的选项，用于向 stdout 和 stderr 输出内容、通过**字符串插值**在字符串中嵌入表达式、编写多行字符串以及处理交互式用户输入提示。

---

## 打印关键字

Zen C 包含了用于将格式化文本打印到标准输出（`stdout`）或标准错误（`stderr`）的内置关键字：

| 关键字 | 输出目标 | 结尾换行 | 描述 |
| :--- | :--- | :--- | :--- |
| `print "..."` | `stdout` | 否 | 向 `stdout` 打印文本，不添加换行符。 |
| `println "..."` | `stdout` | **是** | 向 `stdout` 打印文本，自动在结尾添加换行符。 |
| `eprint "..."` | `stderr` | 否 | 向 `stderr` 打印错误输出，不添加换行符。 |
| `eprintln "..."` | `stderr` | **是** | 向 `stderr` 打印错误输出，自动在结尾添加换行符。 |

**代码清单 3-22：`list3-22.zc`**

```zenc
 1 | fn main() {
 2 |     print "Hello ";
 3 |     println "world!";
 4 |
 5 |     eprint "Warning: ";
 6 |     eprintln "low disk space!";
 7 | }
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

**代码清单 3-23：`list3-23.zc`**

```zenc
 1 | fn main() {
 2 |     "Processing item"..; // Equivalent to print
 3 |     " Done!";            // Equivalent to println
 4 |
 5 |     !"Critical Error!"..; // Equivalent to eprint
 6 |     !" Details follow.";  // Equivalent to eprintln
 7 | }
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

**代码清单 3-24：`list3-24.zc`**

```zenc
 1 | let count = 42;
 2 | let name = "Zen C";
 3 |
 4 | // Implicit interpolation
 5 | println "Project: {name}, Items: {count}";
 6 |
 7 | // Shorthand printing with interpolation
 8 | "Project: {name}, Items: {count}";
```

输出：
```text
Project: Zen C, Items: 42
Project: Zen C, Items: 42
```

### 1. 转义字面量花括号

若要在插值字符串中输出字面量 `{` 或 `}` 字符，只需双写花括号（`{{` 和 `}}`）：

**代码清单 3-25：`list3-25.zc`**

```zenc
 1 | let json = "JSON payload: {{\"status\": 200}}";
 2 | println "{json}";
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

**代码清单 3-26：`list3-26.zc`**

```zenc
 1 | fn main() {
 2 |     let age: int;
 3 |
 4 |     // Prompts "How old are you? " and scans user input into `age`
 5 |     ? "How old are you? " (age);
 6 |
 7 |     println "You are {age} years old.";
 8 | }
```

输出（输入 `25` 时）：
```text
How old are you? 25
You are 25 years old.
```

---

## 第 3 章总结

在第 3 章中，你已经掌握了 Zen C 的所有核心基础概念：
- **变量与常量**（`def`、`let`、类型推导、`const`）。
- **数据类型**（标量类型、C 互操作类型、任意位宽 `iN`/`uN`、字面量、固定大小数组 `T[N]`）。
- **函数与 Lambda**（命名参数、`const` 参数、默认参数、闭包 `[=]`/`[&]`、原始指针 `fn*`、变长参数 `...`）。
- **控制流**（`if`、`match` 模式匹配、`ref` 绑定、范围循环、枚举迭代、提前返回保护子句）。
- **运算符**（运算符重载 `add`/`sub`/`get`/`set`、字符串相等规则、管道 `|>`、空值合并 `??`、安全导航 `?.`、自动解引用）。
- **打印与字符串插值**（`print`/`println`/`eprint`/`eprintln`、字符串简写 `"Hz"`/`!"Err"`、隐式 `{}` 插值、原始字符串 `r"..."`、多行文本块 `"""`、输入提示符 `?`）。

在**第 4 章**中，我们将探索 Zen C 的自动内存管理与资源清理：**Drop 与内存安全（RAII）**！
