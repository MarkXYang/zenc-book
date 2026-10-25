# 13.1 Accepting Command Line Arguments

The first task for `zgrep` is to accept two command-line arguments from the user:
1. The **query string** to search for.
2. The **file path** to search within.

We want our users to be able to compile `zgrep` and invoke it from their shell like this:

```bash
$ ./zgrep needle haystack.txt
```

---

## 1. The `main(argc: int, argv: char**)` Entry Point

In earlier chapters, most of our programs used a parameterless entry point (`fn main()`). When building command-line tools, Zen C also supports the standard C ABI entry-point signature directly:

```zc
fn main(argc: int, argv: char**) -> int {
    // ...
    return 0;
}
```

Because Zen C compiles directly to C11, `fn main(argc: int, argv: char**) -> int` maps one-to-one onto the operating system's process entry point (`int main(int argc, char** argv)`) with **zero startup allocation overhead**:

- **`argc: int`** (*argument count*): The total number of arguments passed to the process, including the program's own invocation name. `argc` is always at least `1`.
- **`argv: char**`** (*argument vector*): A pointer to an array of null-terminated C strings (`char*` / `string`), where:
  - `argv[0]` is the name or path used to invoke the binary (for example, `"./zgrep"`).
  - `argv[1]` is the first user-supplied argument (our search query).
  - `argv[2]` is the second user-supplied argument (our target file path).
  - `argv[argc]` is guaranteed by the C11 standard to be a `NULL` pointer.

---

## 2. Reading and Printing `argv`

Let's start by writing a short program that iterates over `0..argc` and prints every argument received by the process.

Because Zen C's `string` type is a direct alias for `char*`, indexing `argv[i]` yields a value that can be bound directly to a `string` variable and interpolated into `println`:

**Listing 13-1: `list13-1.zc` — Inspecting `argc` and `argv` and extracting `query` and `file_path`**

```zc
// File: examples/ch13/ch13-01-cli-arguments/main.zc

fn main(argc: int, argv: char**) -> int {
    println "Received {argc} argument(s):";
    for i in 0..argc {
        let arg: string = argv[i];
        println "  argv[{i}] = {arg}";
    }

    // Default to sample values when run without arguments (`zc run main.zc`),
    // or extract argv[1] and argv[2] when invoked as `./zgrep <query> <file_path>`.
    let query: string = "frog";
    let file_path: string = "poem.txt";
    if argc >= 3 {
        query = argv[1];
        file_path = argv[2];
    }

    println "";
    println "Searching for: '{query}'";
    println "In file:       '{file_path}'";

    return 0;
}
```

---

## 3. Building and Running CLI Programs with Arguments

When developing a CLI tool that accepts positional command-line arguments, compile your binary with `zc build -o <binary>` and then invoke the resulting executable directly:

```bash
$ zc build examples/ch13/ch13-01-cli-arguments/main.zc -o zgrep
   Compiling examples/ch13/ch13-01-cli-arguments/main.zc...
    Finished build in 0.08s with 0 errors and 0 warnings
```

Now run `./zgrep` with two arguments (`needle` and `haystack.txt`):

```bash
$ ./zgrep needle haystack.txt
Received 3 argument(s):
  argv[0] = ./zgrep
  argv[1] = needle
  argv[2] = haystack.txt

Searching for: 'needle'
In file:       'haystack.txt'
```

And if we run `./zgrep` with no arguments (or via `zc run examples/ch13/ch13-01-cli-arguments/main.zc`), `argc` is `1` and our fallback defaults (`"frog"` and `"poem.txt"`) take effect:

```bash
$ zc run -q examples/ch13/ch13-01-cli-arguments/main.zc
Received 1 argument(s):
  argv[0] = ./main

Searching for: 'frog'
In file:       'poem.txt'
```

> [!NOTE]
> **Why use `zc build` when passing CLI arguments?**
> The `zc` compiler driver treats extra non-flag arguments on the `zc build` and `zc run` command line as additional source files to compile into the translation unit. Compiling once with `zc build main.zc -o zgrep` and running `./zgrep <query> <file_path>` ensures all arguments are passed directly to your program's `argv`.

---

## 4. Borrowed `string` Pointers vs. Owned `Vec<String>`

Notice that in Listing 13-1, `query = argv[1];` and `file_path = argv[2];` do **not** allocate any memory on the heap.

In C and Zen C, the memory backing `argv[0..argc]` is owned by the operating system's process startup frame and remains valid for the entire duration of `main()`. Therefore, borrowing `argv[1]` and `argv[2]` as `string` (`char*`) pointers is completely safe and costs zero heap allocations.

If your CLI tool needs to mutate, split, or store arguments in a growable collection, you can also collect `argv` into a `Vec<String>` using `std/vec.zc` and `std/string.zc`:

```zc
import "std/vec.zc"
import "std/string.zc"

fn collect_args(argc: int, argv: char**) -> Vec<String> {
    let args = Vec<String>::with_capacity((usize)argc);
    for i in 0..argc {
        args.push(String::from(argv[i]));
    }
    return args;
}
```

For `zgrep`, borrowing `argv[1]` and `argv[2]` as `string` slices is all we need.

---

## 🔍 Peek at the C

When `zc` transpiles `examples/ch13/ch13-01-cli-arguments/main.zc`, `fn main(argc: int, argv: char**) -> int` becomes a standard C11 `main` function with direct pointer assignments from `argv`:

```c
typedef char* string;

ZC_FUNC int32_t main(int32_t argc, char** argv)
{
    {
        fprintf(stdout, "Received %d argument(s):\n", argc);
        for (ZC_AUTO i = 0; i < argc; i++) {
            string arg = argv[i];
            fprintf(stdout, "  argv[%d] = %s\n", i, arg);
        }

        string query = "frog";
        string file_path = "poem.txt";
        if ((argc >= 3)) {
            (query = argv[1]);
            (file_path = argv[2]);
        }

        fprintf(stdout, "\n");
        fprintf(stdout, "Searching for: '%s'\n", query);
        fprintf(stdout, "In file:       '%s'\n", file_path);
        return 0;
    }
}
```

Now that `zgrep` can accept a search query and a file path, let's read the target file from disk in **[13.2 Reading a File](ch13-02-reading-file.md)**!
