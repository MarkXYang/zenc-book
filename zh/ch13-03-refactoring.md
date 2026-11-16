# 重构以提高模块化与错误处理能力

在添加行搜索算法和环境变量支持之前，让我们将原型重构为整洁、模块化且可测试的架构。我们将进行四项具体的改进：

1. **将项目拆分为 `main.zc` 和 `zgrep.zc`**，以便我们的核心逻辑可以直接通过 `zc run zgrep.zc` 进行单元测试。
2. **将配置值归类到 `Config` 结构体中**，并提供 `Config::build(argc, argv) -> Result<Config>` 构造函数。
3. **提取 `run(config: Config) -> Result<int>` 函数**，使用 `?` 尝试运算符将 I/O 错误干净地向上传播给 `main()`。
4. **使用测试驱动开发（TDD）实现 `search(query, contents) -> Vec<String>`**，借助 Zen C 内置的 `test "..."` 块进行验证。

---

## 1. 二进制项目的关注点分离

在 [11.2 节](ch11-02-running-tests.md) 中，我们了解了每当一个 `.zc` 文件包含 `test` 块且**没有**用户定义的 `fn main()` 时，Zen C 编译器就会合成一个 `main()` 测试运行器。

这为构建 Zen C 命令行程序带来了一种最佳实践：
- **`zgrep.zc`（库模块 + 单元测试）**：包含 `struct Config`、`run()`、`search()` 以及所有的 `test "..."` 块。它**不**定义 `fn main()`。
- **`main.zc`（二进制入口点）**：导入 `./zgrep.zc`，定义 `fn main(argc: int, argv: char**) -> int`，调用 `Config::build` 和 `run`，向用户报告任何 `Err`，并返回进程退出码。

采用这种布局：
- 运行 `zc run zgrep.zc` 会执行单元测试套件。
- 运行 `zc build main.zc -o zgrep` 会构建生产环境的 CLI 可执行文件。

---

## 2. 将配置归类到 `struct Config`

让我们在 `zgrep.zc` 中定义一个 `Config` 结构体，而不是将 `query` 和 `file_path` 作为独立的变量保留，并为其提供一个校验 `argc` 并返回 `Result<Config>` 的 `Config::build` 构造函数：

```zenc
import "std/result.zc"

struct Config {
    query: string,
    file_path: string,
}

impl Config {
    fn build(argc: int, argv: char**) -> Result<Config> {
        if argc < 3 {
            return Result<Config>::Err("not enough arguments (usage: zgrep <query> <file_path>)");
        }

        let query: string = argv[1];
        let file_path: string = argv[2];

        return Result<Config>::Ok(Config {
            query: query,
            file_path: file_path,
        });
    }
}
```

注意命名的选择：我们没有将构造函数命名为 `Config::new`，而是命名为 `Config::build`，因为程序员通常期望 `new` 永不失败，而 `Config::build` 会校验用户输入并返回可能为 `Err` 的 `Result<Config>`。

---

## 3. 提取 `run(config: Config) -> Result<int>`

接下来，我们将所有读取文件和打印行的工作从 `main()` 中提取到 `zgrep.zc` 内部的 `run` 函数中：

```zenc
fn run(config: Config) -> Result<int> {
    let contents = File::read_all(config.file_path)?;
    let matches = search(config.query, contents.c_str());

    let count: int = (int)matches.length();
    for line in &matches {
        println "{(*line).c_str()}";
    }

    return Result<int>::Ok(count);
}
```

观察 `run` 的第一行：

```zenc
let contents = File::read_all(config.file_path)?;
```

我们没有调用 `.expect(...)` 并在遇到丢失或不可读的文件时发生崩溃，而是使用了 **`?` 尝试运算符**（来自 [第 9.2 节](ch09-02-option-and-result.md)）：
- 如果 `File::read_all` 成功返回 `Ok(String)`，`?` 会将 `String` 解包到 `contents` 中。
- 如果 `File::read_all` 失败并返回 `Err("Failed to open file")`，`?` 会立即将 `Result<int>::Err("Failed to open file")` 返回给 `main()`。

---

## 4. 使用测试驱动开发（TDD）实现 `search()`

现在 `zgrep.zc` 已经与 `main.zc` 分离，我们可以使用**测试驱动开发（TDD）**来编写核心的 `search(query: string, contents: string) -> Vec<String>` 函数：

1. **红（Red）**：编写一个调用 `search("duct", ...)` 并断言预期匹配行的测试，然后验证当 `search` 返回空向量时测试失败。
2. **绿（Green）**：实现 `search` 以将 `contents` 拆分为行，使用 `.contains_str(query)` 检查每一行，并将匹配的行推入 `results`。
3. **重构（Refactor）**：确保末尾的 `\r` 字符（来自 Windows CRLF 换行符）被干净修剪，并验证所有测试均通过。

### 先写单元测试

在 `zgrep.zc` 的底部，我们编写三个 `test` 块，涵盖单个匹配、零匹配和多个匹配：

```zenc
test "search finds one matching line" {
    let query = "duct";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 1, "Expected exactly 1 matching line");
    assert(results.get_ref(0).eq_str("safe, fast, productive."), "Matching line should equal 'safe, fast, productive.'");
}

test "search returns empty Vec when query is absent" {
    let query = "monad";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 0, "Expected 0 matches when query is not present");
}

test "search finds multiple matching lines" {
    let query = "you";
    let contents = "I'm nobody! Who are you?\nAre you nobody, too?\nHow dreary to be somebody!";

    let results = search(query, contents);
    expect_eq((int)results.length(), 2, "Expected 2 lines containing 'you'");
}
```

### 实现 `search()`

为了实现 `search`，我们将 `contents` 封装在 `String` 中，通过 `.split('\n')` 将其按 `'\n'` 切分，使用 `.trim_end()` 剥离任何末尾的空白/回车符，并使用 `.contains_str(query)` 检查每行是否包含 `query`：

```zenc
fn search(query: string, contents: string) -> Vec<String> {
    let results = Vec<String>::new();
    let text = String::from(contents);
    let lines = text.split('\n');

    for line in &lines {
        let cleaned = (*line).trim_end();
        if cleaned.contains_str(query) {
            results.push(cleaned);
        }
    }

    return results;
}
```

---

## 5. 完整的可运行示例

以下是完整的 `zgrep.zc` 库模块（`examples/ch13/ch13-03-refactoring/zgrep.zc`）和 `main.zc` 入口点（`examples/ch13/ch13-03-refactoring/main.zc`）。

**代码清单 13-3: `zgrep.zc` 与 `main.zc`**

```zenc
// File: examples/ch13/ch13-03-refactoring/zgrep.zc
import "std/fs.zc"
import "std/string.zc"
import "std/vec.zc"
import "std/result.zc"

struct Config {
    query: string,
    file_path: string,
}

impl Config {
    fn build(argc: int, argv: char**) -> Result<Config> {
        if argc < 3 {
            return Result<Config>::Err("not enough arguments (usage: zgrep <query> <file_path>)");
        }

        let query: string = argv[1];
        let file_path: string = argv[2];

        return Result<Config>::Ok(Config {
            query: query,
            file_path: file_path,
        });
    }
}

fn search(query: string, contents: string) -> Vec<String> {
    let results = Vec<String>::new();
    let text = String::from(contents);
    let lines = text.split('\n');

    for line in &lines {
        let cleaned = (*line).trim_end();
        if cleaned.contains_str(query) {
            results.push(cleaned);
        }
    }

    return results;
}

fn run(config: Config) -> Result<int> {
    let contents = File::read_all(config.file_path)?;
    let matches = search(config.query, contents.c_str());

    let count: int = (int)matches.length();
    for line in &matches {
        println "{(*line).c_str()}";
    }

    return Result<int>::Ok(count);
}

test "search finds one matching line" {
    let query = "duct";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 1, "Expected exactly 1 matching line");
    assert(results.get_ref(0).eq_str("safe, fast, productive."), "Matching line should equal 'safe, fast, productive.'");
}

test "search returns empty Vec when query is absent" {
    let query = "monad";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 0, "Expected 0 matches when query is not present");
}

test "search finds multiple matching lines" {
    let query = "you";
    let contents = "I'm nobody! Who are you?\nAre you nobody, too?\nHow dreary to be somebody!";

    let results = search(query, contents);
    expect_eq((int)results.length(), 2, "Expected 2 lines containing 'you'");
}
```

下面是 `main.zc`：

```zenc
// File: examples/ch13/ch13-03-refactoring/main.zc
import "./zgrep.zc"

fn main(argc: int, argv: char**) -> int {
    let config_res = Config::build(argc, argv);
    if config_res.is_err() {
        println "Problem parsing arguments: {config_res.err}";
        return 1;
    }

    let config = config_res.unwrap();
    let run_res = run(config);
    if run_res.is_err() {
        println "Application error: {run_res.err}";
        return 1;
    }

    return 0;
}
```

首先，运行 `zgrep.zc` 中的单元测试：

```bash
$ zc run -q examples/ch13/ch13-03-refactoring/zgrep.zc
  TEST: search finds one matching line ... OK
  TEST: search returns empty Vec when query is absent ... OK
  TEST: search finds multiple matching lines ... OK

0 test(s) failed
```

接着，将 `main.zc` 编译为 `zgrep` 可执行文件，并测试成功和错误路径：

```bash
$ zc build examples/ch13/ch13-03-refactoring/main.zc -o zgrep

$ ./zgrep frog examples/ch13/ch13-03-refactoring/poem.txt
How public, like a frog

$ ./zgrep body examples/ch13/ch13-03-refactoring/poem.txt
I'm nobody! Who are you?
Are you nobody, too?
How dreary to be somebody!

$ ./zgrep
Problem parsing arguments: not enough arguments (usage: zgrep <query> <file_path>)

$ ./zgrep frog missing.txt
Application error: Failed to open file
```

---

## 🔍 窥探底层 C 代码：`search()` 中的条件移动追踪

仔细观察 `search()` 内部的循环：

```zenc
for line in &lines {
    let cleaned = (*line).trim_end();
    if cleaned.contains_str(query) {
        results.push(cleaned);
    }
}
```

在循环的每一次迭代中，`cleaned` 都是一个在堆上新分配的 `String`：
- 当 `cleaned.contains_str(query)` 为 **`true`** 时，`cleaned` 的所有权被**移动**到 `results.push(cleaned)` 中。
- 当 `cleaned.contains_str(query)` 为 **`false`** 时，`cleaned` **没有**被移动，必须在每次循环迭代结束时释放，以免内存泄漏！

检查为 `search()` 生成的 C11 代码时，你可以看到 Zen C 编译器如何使用每个变量的析构标志（`__z_drop_flag_cleaned`）来追踪所有权：

```c
int __z_drop_flag_cleaned = 1;
String cleaned = String__trim_end((&(*line)));

if (String__contains_str((&cleaned), query)) {
    // Moving `cleaned` into `results.push` zeroes __z_drop_flag_cleaned:
    Vec__String__push((&results), ({ __z_drop_flag_cleaned = 0; cleaned; }));
}

// Only drops `cleaned` if it was NOT moved into `results`!
if (__z_drop_flag_cleaned) String__Drop__glue(&cleaned);
```

而在 `search()` 结束时，Zen C 将 `results` 移动给调用方（`__z_drop_flag_results = 0`），同时自动释放临时的 `lines` 向量和 `text` 字符串（`Vec__String__Drop__glue(&lines)` 和 `String__Drop__glue(&text)`）。零泄漏、零双重释放，并且零手动 `free()` 账目管理！

接下来，让我们在 **[13.4 使用环境变量](ch13-04-env-variables.md)** 中添加由环境变量控制的不区分大小写搜索功能！
