# 13.5 Writing Error Messages to Standard Error

At the moment, our `main.zc` writes all of its output—both matching lines from `poem.txt` and error messages when arguments or files are invalid—to the terminal using `println`.

In Unix and Windows command-line environments, processes actually have **two** standard output streams:
1. **Standard Output (`stdout`, file descriptor `1`)**: Reserved for the primary data produced by a program (such as the matching lines found by `zgrep`).
2. **Standard Error (`stderr`, file descriptor `2`)**: Reserved for diagnostic, warning, and error messages.

Separating `stdout` from `stderr` allows users to redirect a program's normal output into a file (`> output.txt`) or pipe it into another tool (`| wc -l`) while still seeing error messages immediately on their terminal screen.

---

## 1. Observing the Problem When Errors Go to `stdout`

Suppose a user runs our Section 13.4 version of `zgrep` (which used `println` for errors) and redirects standard output to `output.txt`, but accidentally forgets to pass any command-line arguments:

```bash
$ ./zgrep > output.txt
```

Because the shell's `>` operator redirects **only `stdout`** to `output.txt`, two bad things happen if errors are printed with `println`:
1. The user sees **nothing** on their terminal screen explaining why the command failed.
2. When the user opens `output.txt` expecting search results, they find the error message saved inside their data file instead:

```text
Problem parsing arguments: not enough arguments (usage: zgrep <query> <file_path>)
```

---

## 2. Printing to `stderr` in Zen C (`eprintln`, `eprint`, and `!"..."`)

As we learned in [Chapter 3.4](ch03-04-printing-and-interpolation.md), Zen C provides dedicated built-in keywords and statement shorthands for writing formatted, interpolated strings directly to `stderr`:

| Syntax | Shorthand | Stream | Trailing Newline | Transpiled C11 Call |
| :--- | :--- | :--- | :--- | :--- |
| `println "..."` | `"..."` | `stdout` | Yes | `fprintf(stdout, ...)` |
| `print "..."` | `"..."..` | `stdout` | No | `fprintf(stdout, ...)` |
| `eprintln "..."` | `!"..."` | **`stderr`** | Yes | `fprintf(stderr, ...)` |
| `eprint "..."` | `!"..."..` | **`stderr`** | No | `fprintf(stderr, ...)` |

Both `eprintln "Problem parsing arguments: {config_res.err}";` and its concise shorthand `!"Problem parsing arguments: {config_res.err}";` emit identical C11 code writing to `stderr`.

---

## 3. Updating `main.zc` to Use `eprintln`

Let's update `main.zc` so that argument-parsing errors and file I/O errors are printed with `eprintln` before returning exit code `1`:

**Listing 13-5: `list13-5.zc` — Final `main.zc` writing diagnostics to `stderr`**

```zenc
// File: examples/ch13/ch13-05-stderr/main.zc
import "./zgrep.zc"

fn main(argc: int, argv: char**) -> int {
    let config_res = Config::build(argc, argv);
    if config_res.is_err() {
        eprintln "Problem parsing arguments: {config_res.err}";
        return 1;
    }

    let config = config_res.unwrap();
    let run_res = run(config);
    if run_res.is_err() {
        eprintln "Application error: {run_res.err}";
        return 1;
    }

    return 0;
}
```

> [!TIP]
> You can also write those two error statements using Zen C's `!` stderr shorthand:
> ```zenc
> if config_res.is_err() {
>     !"Problem parsing arguments: {config_res.err}";
>     return 1;
> }
> ```

---

## 4. Verifying `stdout` Redirection vs. `stderr` Diagnostics

Let's compile our finished `zgrep` binary from `examples/ch13/ch13-05-stderr/main.zc` and test shell redirection in both failure and success scenarios:

```bash
$ zc build examples/ch13/ch13-05-stderr/main.zc -o zgrep
```

### Scenario A: Error Diagnostic with `stdout` Redirected (`> output.txt`)

When we run `./zgrep > output.txt` with no arguments:

```bash
$ ./zgrep > output.txt
Problem parsing arguments: not enough arguments (usage: zgrep <query> <file_path>)
$ echo $?
1
```

Notice that:
1. The error message (`Problem parsing arguments: ...`) appears immediately on our terminal screen because `eprintln` writes to `stderr`.
2. The process exits with status code `1`.
3. `output.txt` remains completely empty (0 bytes)—no error text polluted our output file!

### Scenario B: Successful Search with `stdout` Redirected (`> output.txt`)

Now let's run a valid search while redirecting `stdout` to `output.txt`:

```bash
$ ./zgrep to examples/ch13/ch13-05-stderr/poem.txt > output.txt
$ echo $?
0
$ cat output.txt
Are you nobody, too?
How dreary to be somebody!
```

And with `IGNORE_CASE=1`:

```bash
$ IGNORE_CASE=1 ./zgrep to examples/ch13/ch13-05-stderr/poem.txt > output.txt
$ cat output.txt
Are you nobody, too?
How dreary to be somebody!
To tell your name the livelong day
To an admiring bog!
```

---

## 🔍 Peek at the C

When `zc` transpiles `examples/ch13/ch13-05-stderr/main.zc`, `eprintln` emits `fprintf(stderr, ...)` while `println` inside `run()` emits `fprintf(stdout, ...)`:

```c
ZC_FUNC int32_t main(int32_t argc, char** argv)
{
    {
        Result__Config config_res = Config__build(argc, argv);
        if (Result__Config__is_err(&config_res)) {
            fprintf(stderr, "Problem parsing arguments: %s\n", config_res.err);
            return 1;
        }

        Config config = Result__Config__unwrap(&config_res);
        Result__int32_t run_res = run(config);
        if (Result__int32_t__is_err(&run_res)) {
            fprintf(stderr, "Application error: %s\n", run_res.err);
            return 1;
        }

        return 0;
    }
}
```

---

## Summary of Chapter 13

Congratulations! You have built a complete, tested, and idiomatic command-line tool in Zen C:
- You accepted raw command-line arguments with zero startup overhead via **`fn main(argc: int, argv: char**) -> int`**.
- You read files into memory using **`File::read_all`** from `std/fs.zc` while relying on **`Drop`** to automatically release file handles and string buffers.
- You separated your project into a thin **`main.zc`** binary entry point and a testable **`zgrep.zc`** library module with **`struct Config`**, **`Result<T>`**, and the **`?` try operator**.
- You used **Test-Driven Development (TDD)** and `zc run zgrep.zc` to verify both **`search`** and **`search_case_insensitive`**.
- You inspected and tested environment variables (`IGNORE_CASE`) with **`Env::get`**, **`Env::set`**, and **`Env::unset`** from `std/env.zc`.
- You directed error diagnostics to **`stderr`** via **`eprintln`** (`!"..."`) and returned meaningful process exit codes (`0` and `1`).

In **Part III — Going Further**, starting with **[Chapter 14: Functional Features: Closures and Iterators](ch14-00-functional-features.md)**, we will explore Zen C's lambdas, closure captures, raw function pointers (`fn*`), and iterator pipelines!
