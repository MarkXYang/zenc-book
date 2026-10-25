# 13.3 Refactoring to Improve Modularity and Error Handling

Before we add the line-searching algorithm and environment variable support, let's refactor our prototype into a clean, modular, and testable architecture. We will make four concrete improvements:

1. **Split the project into `main.zc` and `zgrep.zc`** so our core logic can be unit-tested directly with `zc run zgrep.zc`.
2. **Group configuration values into a `Config` struct** with a `Config::build(argc, argv) -> Result<Config>` constructor.
3. **Extract a `run(config: Config) -> Result<int>` function** that uses the `?` try operator to propagate I/O errors cleanly back to `main()`.
4. **Implement `search(query, contents) -> Vec<String>` using Test-Driven Development (TDD)** with Zen C's built-in `test "..."` blocks.

---

## 1. Separation of Concerns for Binary Projects

In [Chapter 11.2](ch11-02-running-tests.md), we saw how Zen C's compiler synthesizes a `main()` test runner whenever a `.zc` file contains `test` blocks and **no** user-defined `fn main()`.

This gives rise to a best practice for structuring Zen C command-line programs:
- **`zgrep.zc` (Library Module + Unit Tests)**: Contains `struct Config`, `run()`, `search()`, and all `test "..."` blocks. It does **not** define `fn main()`.
- **`main.zc` (Binary Entry Point)**: Imports `./zgrep.zc`, defines `fn main(argc: int, argv: char**) -> int`, calls `Config::build` and `run`, reports any `Err` to the user, and returns the process exit code.

With this layout:
- Running `zc run zgrep.zc` executes the unit test suite.
- Running `zc build main.zc -o zgrep` builds the production CLI executable.

---

## 2. Grouping Configuration into `struct Config`

Instead of keeping `query` and `file_path` as separate variables, let's define a `Config` struct in `zgrep.zc` and give it a `Config::build` constructor that validates `argc` and returns `Result<Config>`:

```zc
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

Notice the naming choice: rather than naming the constructor `Config::new`, we name it `Config::build` because programmers generally expect `new` to never fail, whereas `Config::build` validates user input and returns a `Result<Config>` that may be `Err`.

---

## 3. Extracting `run(config: Config) -> Result<int>`

Next, we extract all file-reading and line-printing work out of `main()` into a `run` function inside `zgrep.zc`:

```zc
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

Look at the first line of `run`:

```zc
let contents = File::read_all(config.file_path)?;
```

Instead of calling `.expect(...)` and crashing on a missing or unreadable file, we use the **`?` try operator** (from [Chapter 9.2](ch09-02-option-and-result.md)):
- If `File::read_all` succeeds with `Ok(String)`, `?` unwraps the `String` into `contents`.
- If `File::read_all` fails with `Err("Failed to open file")`, `?` immediately returns `Result<int>::Err("Failed to open file")` to `main()`.

---

## 4. Developing `search()` with Test-Driven Development (TDD)

Now that `zgrep.zc` is separate from `main.zc`, we can write our core `search(query: string, contents: string) -> Vec<String>` function using **Test-Driven Development (TDD)**:

1. **Red**: Write a test that calls `search("duct", ...)` and asserts the expected matching line, then verify it fails when `search` returns an empty vector.
2. **Green**: Implement `search` to split `contents` into lines, check each line with `.contains_str(query)`, and push matching lines into `results`.
3. **Refactor**: Ensure trailing `\r` characters (from Windows CRLF line endings) are trimmed cleanly and verify all tests pass.

### Writing the Unit Tests First

At the bottom of `zgrep.zc`, we write three `test` blocks covering a single match, zero matches, and multiple matches:

```zc
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

### Implementing `search()`

To implement `search`, we wrap `contents` in a `String`, split it on `'\n'` via `.split('\n')`, strip any trailing whitespace/carriage returns with `.trim_end()`, and check whether each line contains `query` using `.contains_str(query)`:

```zc
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

## 5. Complete Runnable Example

Here are the complete `zgrep.zc` library module (`examples/ch13/ch13-03-refactoring/zgrep.zc`) and `main.zc` entry point (`examples/ch13/ch13-03-refactoring/main.zc`).

**Listing 13-3: `zgrep.zc` and `main.zc`**

```zc
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

And here is `main.zc`:

```zc
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

First, run the unit tests in `zgrep.zc`:

```bash
$ zc run -q examples/ch13/ch13-03-refactoring/zgrep.zc
  TEST: search finds one matching line ... OK
  TEST: search returns empty Vec when query is absent ... OK
  TEST: search finds multiple matching lines ... OK

0 test(s) failed
```

Next, compile `main.zc` into the `zgrep` executable and test both success and error paths:

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

## 🔍 Peek at the C: Conditional Move Tracking in `search()`

Look closely at the loop inside `search()`:

```zc
for line in &lines {
    let cleaned = (*line).trim_end();
    if cleaned.contains_str(query) {
        results.push(cleaned);
    }
}
```

In each iteration of the loop, `cleaned` is a newly heap-allocated `String`:
- When `cleaned.contains_str(query)` is **`true`**, ownership of `cleaned` is **moved** into `results.push(cleaned)`.
- When `cleaned.contains_str(query)` is **`false`**, `cleaned` is **not** moved and must be freed at the end of the loop iteration so its memory does not leak!

When you inspect the generated C11 code for `search()`, you can see how Zen C's compiler tracks ownership with a per-variable drop flag (`__z_drop_flag_cleaned`):

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

And at the end of `search()`, Zen C moves `results` out to the caller (`__z_drop_flag_results = 0`) while automatically freeing the temporary `lines` vector and `text` string (`Vec__String__Drop__glue(&lines)` and `String__Drop__glue(&text)`). Zero leaks, zero double-frees, and zero manual `free()` bookkeeping!

Next, let's add case-insensitive searching controlled by an environment variable in **[13.4 Working with Environment Variables](ch13-04-env-variables.md)**!
