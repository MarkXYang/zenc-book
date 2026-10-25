# 13.4 Working with Environment Variables

Command-line tools often let users configure persistent preferences—such as color themes, verbosity levels, or case sensitivity—via **environment variables** so they don't have to pass the same flag on every invocation.

In this section, we will enhance `zgrep` with an extra feature: when the `IGNORE_CASE` environment variable is set (for example, `IGNORE_CASE=1 ./zgrep to poem.txt`), `zgrep` will perform a **case-insensitive** search and match `"to"`, `"To"`, and `"TO"` alike.

---

## 1. Cross-Platform Environment Variables (`std/env.zc`)

In standard C, reading an environment variable with `getenv("IGNORE_CASE")` returns a raw `char*` that may be `NULL` if the variable is unset, while setting or unsetting variables requires platform-specific functions (`setenv`/`unsetenv` on POSIX vs. `_putenv_s` on Windows).

Zen C's `std/env.zc` module wraps these platform differences behind the `Env` struct and `Option<T>`:

| Method | Signature | Description |
| :--- | :--- | :--- |
| `Env::get` | `fn get(name: string) -> Option<string>` | Returns `Some(string)` borrowing the process environment string if `name` is set, or `None()` if unset. Zero heap allocation. |
| `Env::get_dup` | `fn get_dup(name: string) -> Option<String>` | Returns `Some(String)` containing a freshly heap-allocated copy of the environment variable value, or `None()`. |
| `Env::set` | `fn set(name: string, value: string) -> EnvRes` | Sets `name=value` in the current process environment (`EnvRes::OK` or `EnvRes::ERR`). |
| `Env::unset` | `fn unset(name: string) -> EnvRes` | Removes `name` from the current process environment (`EnvRes::OK` or `EnvRes::ERR`). |

> [!TIP]
> **When should you use `Env::get` vs. `Env::get_dup`?**
> - Use **`Env::get(name)`** when you only need to inspect or compare the environment variable immediately (like checking whether `IGNORE_CASE` is set). Because it borrows the OS environment pointer directly, it performs zero heap allocations.
> - Use **`Env::get_dup(name)`** when you need an owned `String` that outlives subsequent `Env::set` or `Env::unset` calls (which may reallocate the C runtime's internal environment table).

---

## 2. Writing a Failing Test for `search_case_insensitive`

Following our TDD workflow from Section 13.3, let's add a new unit test in `zgrep.zc` for a `search_case_insensitive(query: string, contents: string) -> Vec<String>` function, while also updating our existing `search` test to verify that `"duct"` does *not* match `"Duct tape."` in case-sensitive mode:

```zc
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

## 3. Implementing `search_case_insensitive`

To compare lines without regard to ASCII letter case, we convert both the `query` and each candidate line to lowercase using `String::to_lowercase()` (from `std/string.zc`), while pushing the **original** `cleaned` line (with its original casing intact) into `results`:

```zc
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

## 4. Wiring `IGNORE_CASE` into `Config` and `run()`

Now let's add an `ignore_case: bool` field to `struct Config` and populate it inside `Config::build` by checking `Env::get("IGNORE_CASE")`:

```zc
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

And in `run(config: Config)`, we dispatch between `search_case_insensitive` and `search` based on `config.ignore_case`:

```zc
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

## 5. Complete Runnable Example

Here is the updated `examples/ch13/ch13-04-env-variables/zgrep.zc` module, including a third unit test that verifies `Env::set`, `Env::get`, and `Env::unset` in isolation:

**Listing 13-4: `list13-4.zc` — `zgrep.zc` with `IGNORE_CASE` environment variable support**

```zc
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

First, run the unit test suite in `zgrep.zc`:

```bash
$ zc run -q examples/ch13/ch13-04-env-variables/zgrep.zc
  TEST: case-sensitive search distinguishes uppercase and lowercase ... OK
  TEST: case-insensitive search matches regardless of casing ... OK
  TEST: Env::set, Env::get, and Env::unset control environment state ... OK

0 test(s) failed
```

Now build the `zgrep` executable and compare searching for `"to"` in `poem.txt` with and without `IGNORE_CASE=1`:

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
> **Setting Environment Variables Across Shells**
> - **Bash / Zsh (Linux & macOS)**: Prefix the command with `IGNORE_CASE=1 ./zgrep to poem.txt` to set it for a single invocation, or `export IGNORE_CASE=1` for the current shell session.
> - **PowerShell (Windows)**: Run `$Env:IGNORE_CASE=1; .\zgrep.exe to poem.txt` (and `Remove-Item Env:IGNORE_CASE` to clear it).

---

## 🔍 Peek at the C: How `Env::get` Maps to `getenv`

Under the hood in `std/env.zc`, `Env::get` calls standard C's `getenv(name)` and wraps the pointer in an `Option__string` value struct on the stack:

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

Because `Option__string` is a two-field stack struct (`{ bool is_some; char* val; }`), checking `env_val.is_some()` and unwrapping `env_val.unwrap()` compiles down to a simple stack boolean check with zero dynamic memory allocation.

Our `zgrep` tool is almost complete! There is just one remaining detail: right now, `main.zc` prints error messages using `println`, which sends them to standard output (`stdout`). Let's fix that in **[13.5 Writing Error Messages to Standard Error](ch13-05-stderr.md)**!
