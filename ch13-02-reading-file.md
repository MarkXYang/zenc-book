# 13.2 Reading a File

Now that `zgrep` knows which query string and file path to use, our next step is to open the target file and read its contents into memory.

---

## 1. Creating a Sample Text File (`poem.txt`)

To test `zgrep` against real multi-line text, let's create a small file named `poem.txt` containing Emily Dickinson's famous poem *"I'm nobody! Who are you?"*:

```text
I'm nobody! Who are you?
Are you nobody, too?
Then there's a pair of us - don't tell!
They'd banish us, you know.

How dreary to be somebody!
How public, like a frog
To tell your name the livelong day
To an admiring bog!
```

This short text has several properties that make it great for testing a search tool:
- Words that appear on a single line (such as `"frog"` or `"banish"`).
- Words that appear on multiple lines (such as `"nobody"` or `"you"`).
- Words that appear with different capitalization across lines (such as `"to"` vs. `"To"`), which we will use in [Section 13.4](ch13-04-env-variables.md) when testing case-insensitive search.

---

## 2. File I/O in Zen C (`std/fs.zc`)

In traditional C, reading an entire file into a dynamically allocated string requires a surprisingly error-prone sequence of calls:
1. Call `fopen(path, "rb")` and check for `NULL`.
2. Call `fseek(fp, 0, SEEK_END)` and `ftell(fp)` to determine the byte length, then `fseek(fp, 0, SEEK_SET)` to rewind.
3. Call `malloc(size + 1)` and check for `NULL`.
4. Call `fread(buf, 1, size, fp)` and manually write the null terminator `buf[read] = '\0'`.
5. Call `fclose(fp)` and remember to `free(buf)` on every exit path.

Zen C's standard filesystem module (`import "std/fs.zc"`) encapsulates all of this behind the `File` type and `Result<T>`:

| Method | Signature | Description |
| :--- | :--- | :--- |
| `File::read_all` | `fn read_all(path: char*) -> Result<String>` | Opens `path`, reads its entire contents into an owned `String`, closes the file handle, and returns `Ok(String)` or `Err(msg)`. |
| `File::read_lines` | `fn read_lines(path: char*) -> Result<Vec<String>>` | Reads `path`, splits it on `'\n'` (stripping any trailing `'\r'` on Windows/CRLF files), and returns `Ok(Vec<String>)`. |
| `File::open` | `fn open(path: char*, mode: char*) -> Result<File>` | Opens a `File` handle (`fopen`). `File` implements `Drop`, so the underlying `FILE*` is closed automatically when `File` goes out of scope. |
| `File::exists` | `fn exists(path: char*) -> bool` | Returns `true` if `path` exists on disk. |
| `File::metadata` | `fn metadata(path: char*) -> Result<Metadata>` | Queries file size (`u64`), `is_file`, and `is_dir`. |

---

## 3. Reading `poem.txt` with `File::read_all`

Let's update `main.zc` to import `std/fs.zc`, read the target file with `File::read_all(file_path)`, and print its contents.

For this initial prototype, we will unwrap the `Result<String>` using `.expect("Should have been able to read the file")` (in the next section, we will replace `.expect(...)` with graceful `Result` error propagation):

**Listing 13-2: `list13-2.zc` — Reading the contents of `poem.txt` into a `String`**

```zc
// File: examples/ch13/ch13-02-reading-file/main.zc
import "std/fs.zc"
import "std/string.zc"
import "std/result.zc"

fn resolve_default_poem() -> string {
    if File::exists("poem.txt") {
        return "poem.txt";
    }
    return "examples/ch13/ch13-02-reading-file/poem.txt";
}

fn main(argc: int, argv: char**) -> int {
    let query: string = "the";
    let file_path: string = resolve_default_poem();
    if argc >= 3 {
        query = argv[1];
        file_path = argv[2];
    }

    println "Searching for '{query}'";
    println "In file {file_path}";

    let contents: String = File::read_all(file_path)
        .expect("Should have been able to read the file");

    println "\nWith text:\n{contents.c_str()}";
    assert(contents.length() > 0, "poem.txt should not be empty");

    return 0;
}
```

Let's run our program with `zc run`:

```bash
$ zc run -q examples/ch13/ch13-02-reading-file/main.zc
Searching for 'the'
In file examples/ch13/ch13-02-reading-file/poem.txt

With text:
I'm nobody! Who are you?
Are you nobody, too?
Then there's a pair of us - don't tell!
They'd banish us, you know.

How dreary to be somebody!
How public, like a frog
To tell your name the livelong day
To an admiring bog!
```

Or build the binary and pass a custom query and file path explicitly:

```bash
$ zc build examples/ch13/ch13-02-reading-file/main.zc -o zgrep
$ ./zgrep frog examples/ch13/ch13-02-reading-file/poem.txt
Searching for 'frog'
In file examples/ch13/ch13-02-reading-file/poem.txt

With text:
I'm nobody! Who are you?
...
```

---

## 4. Automatic Memory and Handle Cleanup (`Drop`)

Notice what is *not* in Listing 13-2:
- There is no manual `fclose(fp)` call. Inside `File::read_all`, the `File` handle is closed immediately after reading, and even when you use `File::open` directly, `std/fs.zc` defines:
  ```zc
  impl Drop for File {
      fn drop(self) {
          self.close();
      }
  }
  ```
- There is no manual `contents.free()` or `free(buf)` call at the end of `main()`. Because `String` wraps `Vec<char>`, which implements `Drop`, the Zen C compiler automatically inserts the destructor call (`String__Drop__glue(&contents)`) before `main` returns!

---

## 🔍 Peek at the C

Inspecting the transpiled C11 code for `main()` in `examples/ch13/ch13-02-reading-file/main.zc` shows how `File::read_all`, `Result::expect`, and automatic RAII cleanup work together:

```c
ZC_FUNC int32_t main(int32_t argc, char** argv)
{
    {
        string query = /* ... */;
        string file_path = /* ... */;

        // 1. File::read_all returns Result__String; Result::expect unwraps the String
        //    and registers __z_drop_flag_contents = 1 for RAII cleanup:
        int __z_drop_flag_contents = 1;
        String contents = ({
            Result__String _z_arg0 = File__read_all(file_path);
            Result__String__expect(&_z_arg0, "Should have been able to read the file");
        });

        fprintf(stdout, "\nWith text:\n%s\n", String__c_str(&contents));
        __zenc_assert((String__length(&contents) > 0), "poem.txt should not be empty");

        // 2. Automatically emitted by Zen C's Drop glue before returning 0:
        {
            int32_t _z_ret = 0;
            if (__z_drop_flag_contents) String__Drop__glue(&contents);
            return _z_ret;
        }
    }
}
```

---

## What Needs Improvement?

Our prototype works—it accepts arguments and reads `poem.txt`—but it has several structural flaws that would hurt us as the program grows:

1. **Single-Function Monolith**: `main()` is currently responsible for parsing CLI arguments, resolving configuration, and reading files.
2. **Unstructured Configuration**: `query` and `file_path` are loose local variables. As we add flags and environment options (like case-insensitivity), passing individual parameters around becomes unwieldy.
3. **Unfriendly Panic Diagnostics**: If the user forgets an argument or passes a non-existent file path like `nonexistent.txt`, `.expect(...)` aborts with a raw panic message (`Panic: Should have been able to read the file: Failed to open file`) instead of a clean CLI error message.
4. **Untestable Logic**: Because everything lives inside `main()`, we cannot write `test "..."` blocks to unit-test our line-searching algorithm in isolation.

Let's fix all four problems in **[13.3 Refactoring to Improve Modularity and Error Handling](ch13-03-refactoring.md)**!
