# 使用环境变量

命令行工具通常允许用户通过**环境变量**来配置持久化的偏好设置——例如颜色主题、详细程度级别或大小写敏感性——这样他们就不必在每次调用时都传入相同的标志。

在本节中，我们将为 `zgrep` 增强一项额外特性：当设置了 `IGNORE_CASE` 环境变量时（例如 `IGNORE_CASE=1 ./zgrep to poem.txt`），`zgrep` 将执行**不区分大小写**的搜索，从而同时匹配 `"to"`、`"To"` 和 `"TO"`。

---

## 1. 跨平台环境变量（`std/env.zc`）

在标准 C 中，使用 `getenv("IGNORE_CASE")` 读取环境变量会返回一个原生 `char*`，如果变量未设置，该指针可能为 `NULL`；而设置或取消设置环境变量则需要平台特定的函数（POSIX 上的 `setenv`/`unsetenv` 与 Windows 上的 `_putenv_s`）。

Zen C 的 `std/env.zc` 模块将这些平台差异封装在 `Env` 结构体和 `Option<T>` 之后：

| 方法 | 签名 | 说明 |
| :--- | :--- | :--- |
| `Env::get` | `fn get(name: string) -> Option<string>` | 如果设置了 `name`，则返回借用进程环境字符串的 `Some(string)`；如果未设置，则返回 `None()`。零堆分配。 |
| `Env::get_dup` | `fn get_dup(name: string) -> Option<String>` | 返回包含环境变量值的新鲜堆分配副本的 `Some<String>`，或者返回 `None()`。 |
| `Env::set` | `fn set(name: string, value: string) -> EnvRes` | 在当前进程环境中设置 `name=value`（返回 `EnvRes::OK` 或 `EnvRes::ERR`）。 |
| `Env::unset` | `fn unset(name: string) -> EnvRes` | 从当前进程环境中移除 `name`（返回 `EnvRes::OK` 或 `EnvRes::ERR`）。 |

> [!TIP]
> **何时该用 `Env::get`，何时该用 `Env::get_dup`？**
> - 当你只需要立即检查或比较环境变量时（例如检查是否设置了 `IGNORE_CASE`），请使用 **`Env::get(name)`**。因为它直接借用操作系统的环境指针，执行零堆分配。
> - 当你需要一个比后续的 `Env::set` 或 `Env::unset` 调用存活更久的拥有所有权的 `String` 时，请使用 **`Env::get_dup(name)`**（因为后续调用可能会重新分配 C 运行时的内部环境表）。

---

## 2. 为 `search_case_insensitive` 编写一个失败的测试

遵循我们在 13.3 节中的 TDD 工作流，让我们在 `zgrep.zc` 中为 `search_case_insensitive(query: string, contents: string) -> Vec<String>` 函数添加一个新的单元测试，同时更新我们现有的 `search` 测试，以验证在区分大小写模式下 `"duct"` *不会*匹配 `"Duct tape."`：

```zenc
test "case-sensitive search distinguishes uppercase and lowercase" {
    let query = "duct";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.\nDuct tape.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 1, "Case-sensitive search should only match lowercase 'duct'");
    assert(results.get_ref(0).eq_str("safe, fast, productive."), "Line content should match");
}

test "case-insensitive search matches regardless of casing" {
    let query = "rUsT";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.\nTrust me.";

    let results = search_case_insensitive(query, contents);
    expect_eq((int)results.length(), 1, "Expected 1 matching line for 'rUsT'");
    assert(results.get_ref(0).eq_str("Trust me."), "Should match 'Trust me.'");
}
```

---

## 3. 实现 `search_case_insensitive`

为了在不考虑 ASCII 字母大小写的情况下比较行，我们使用 `String::to_lowercase()`（来自 `std/string.zc`）将 `query` 和每个候选行都转换为小写，同时将**原始的** `cleaned` 行（保持其原始大小写完好无损）推入 `results`：

```zenc
fn search_case_insensitive(query: string, contents: string) -> Vec<String> {
    let results = Vec<String>::new();
    let q_str = String::from(query);
    let query_lower = q_str.to_lowercase();

    let text = String::from(contents);
    let lines = text.split('\n');

    for line in &lines {
        let cleaned = (*line).trim_end();
        let line_lower = cleaned.to_lowercase();
        if line_lower.contains_str(query_lower.c_str()) {
            results.push(cleaned);
        }
    }

    return results;
}
```

---

## 4. 将 `IGNORE_CASE` 接入 `Config` 和 `run()`

现在让我们向 `struct Config` 添加一个 `ignore_case: bool` 字段，并通过检查 `Env::get("IGNORE_CASE")` 在 `Config::build` 内部填充它：

```zenc
struct Config {
    query: string,
    file_path: string,
    ignore_case: bool,
}

impl Config {
    fn build(argc: int, argv: char**) -> Result<Config> {
        if argc < 3 {
            return Result<Config>::Err("not enough arguments (usage: zgrep <query> <file_path>)");
        }

        let query: string = argv[1];
        let file_path: string = argv[2];

        let ignore_case = false;
        let env_val = Env::get("IGNORE_CASE");
        if env_val.is_some() {
            let val = env_val.unwrap();
            // Treat any non-empty value other than "0" as enabled
            if strlen(val) > 0 && strcmp(val, "0") != 0 {
                ignore_case = true;
            }
        }

        return Result<Config>::Ok(Config {
            query: query,
            file_path: file_path,
            ignore_case: ignore_case,
        });
    }
}
```

在 `run(config: Config)` 中，我们根据 `config.ignore_case` 在 `search_case_insensitive` 和 `search` 之间进行调度：

```zenc
fn run(config: Config) -> Result<int> {
    let contents = File::read_all(config.file_path)?;

    let matches: Vec<String> = if config.ignore_case {
        search_case_insensitive(config.query, contents.c_str())
    } else {
        search(config.query, contents.c_str())
    };

    let count: int = (int)matches.length();
    for line in &matches {
        println "{(*line).c_str()}";
    }

    return Result<int>::Ok(count);
}
```

---

## 5. 完整的可运行示例

以下是更新后的 `examples/ch13/ch13-04-env-variables/zgrep.zc` 模块，包括第三个单独验证 `Env::set`、`Env::get` 和 `Env::unset` 的单元测试：

**代码清单 13-4: 支持 `IGNORE_CASE` 环境变量的 `zgrep.zc`**

```zenc
// File: examples/ch13/ch13-04-env-variables/zgrep.zc
import "std/fs.zc"
import "std/env.zc"
import "std/string.zc"
import "std/vec.zc"
import "std/result.zc"
import "std/option.zc"

struct Config {
    query: string,
    file_path: string,
    ignore_case: bool,
}

impl Config {
    fn build(argc: int, argv: char**) -> Result<Config> {
        if argc < 3 {
            return Result<Config>::Err("not enough arguments (usage: zgrep <query> <file_path>)");
        }

        let query: string = argv[1];
        let file_path: string = argv[2];

        let ignore_case = false;
        let env_val = Env::get("IGNORE_CASE");
        if env_val.is_some() {
            let val = env_val.unwrap();
            if strlen(val) > 0 && strcmp(val, "0") != 0 {
                ignore_case = true;
            }
        }

        return Result<Config>::Ok(Config {
            query: query,
            file_path: file_path,
            ignore_case: ignore_case,
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

fn search_case_insensitive(query: string, contents: string) -> Vec<String> {
    let results = Vec<String>::new();
    let q_str = String::from(query);
    let query_lower = q_str.to_lowercase();

    let text = String::from(contents);
    let lines = text.split('\n');

    for line in &lines {
        let cleaned = (*line).trim_end();
        let line_lower = cleaned.to_lowercase();
        if line_lower.contains_str(query_lower.c_str()) {
            results.push(cleaned);
        }
    }

    return results;
}

fn run(config: Config) -> Result<int> {
    let contents = File::read_all(config.file_path)?;

    let matches: Vec<String> = if config.ignore_case {
        search_case_insensitive(config.query, contents.c_str())
    } else {
        search(config.query, contents.c_str())
    };

    let count: int = (int)matches.length();
    for line in &matches {
        println "{(*line).c_str()}";
    }

    return Result<int>::Ok(count);
}

test "case-sensitive search distinguishes uppercase and lowercase" {
    let query = "duct";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.\nDuct tape.";

    let results = search(query, contents);
    expect_eq((int)results.length(), 1, "Case-sensitive search should only match lowercase 'duct'");
    assert(results.get_ref(0).eq_str("safe, fast, productive."), "Line content should match");
}

test "case-insensitive search matches regardless of casing" {
    let query = "rUsT";
    let contents = "Zen C:\nsafe, fast, productive.\nPick three.\nTrust me.";

    let results = search_case_insensitive(query, contents);
    expect_eq((int)results.length(), 1, "Expected 1 matching line for 'rUsT'");
    assert(results.get_ref(0).eq_str("Trust me."), "Should match 'Trust me.'");
}

test "Env::set, Env::get, and Env::unset control environment state" {
    Env::set("IGNORE_CASE", "1");
    let present = Env::get("IGNORE_CASE");
    assert(present.is_some(), "IGNORE_CASE should be Some after Env::set");
    assert(strcmp(present.unwrap(), "1") == 0, "IGNORE_CASE value should be '1'");

    Env::unset("IGNORE_CASE");
    let absent = Env::get("IGNORE_CASE");
    assert(absent.is_none(), "IGNORE_CASE should be None after Env::unset");
}
```

首先，运行 `zgrep.zc` 中的单元测试套件：

```bash
$ zc run -q examples/ch13/ch13-04-env-variables/zgrep.zc
  TEST: case-sensitive search distinguishes uppercase and lowercase ... OK
  TEST: case-insensitive search matches regardless of casing ... OK
  TEST: Env::set, Env::get, and Env::unset control environment state ... OK

0 test(s) failed
```

现在构建 `zgrep` 可执行文件，并在有无 `IGNORE_CASE=1` 的情况下对比在 `poem.txt` 中搜索 `"to"` 的结果：

```bash
$ zc build examples/ch13/ch13-04-env-variables/main.zc -o zgrep

# 1. Default case-sensitive search (matches only lowercase "to"):
$ ./zgrep to examples/ch13/ch13-04-env-variables/poem.txt
Are you nobody, too?
How dreary to be somebody!

# 2. Case-insensitive search via IGNORE_CASE=1 (also matches "To"):
$ IGNORE_CASE=1 ./zgrep to examples/ch13/ch13-04-env-variables/poem.txt
Are you nobody, too?
How dreary to be somebody!
To tell your name the livelong day
To an admiring bog!
```

> [!NOTE]
> **在不同 Shell 中设置环境变量**
> - **Bash / Zsh (Linux 与 macOS)**：在命令前加上 `IGNORE_CASE=1 ./zgrep to poem.txt` 即可针对单次调用设置它，或者使用 `export IGNORE_CASE=1` 针对当前 shell 会话设置它。
> - **PowerShell (Windows)**：运行 `$Env:IGNORE_CASE=1; .\zgrep.exe to poem.txt`（使用 `Remove-Item Env:IGNORE_CASE` 清除它）。

---

## 🔍 窥探底层 C 代码：`Env::get` 如何映射到 `getenv`

在 `std/env.zc` 的底层，`Env::get` 调用标准 C 的 `getenv(name)`，并将指针包装在栈上的 `Option__string` 值结构体中：

```c
ZC_FUNC Option__string Env__get(string name)
{
    string value = getenv(name);
    if ((value == NULL)) {
        return Option__string__None();
    }
    return Option__string__Some(value);
}
```

因为 `Option__string` 是一个包含两个字段的栈结构体（`{ bool is_some; char* val; }`），所以检查 `env_val.is_some()` 和解包 `env_val.unwrap()` 编译后只是简单的栈布尔值检查，零动态内存分配开销。

我们的 `zgrep` 工具几乎完成了！目前只剩下一个细节：现在 `main.zc` 使用 `println` 打印错误消息，这会将它们发送到标准输出（`stdout`）。让我们在 **[13.5 将错误信息写入标准错误](ch13-05-stderr.md)** 中解决这个问题！
