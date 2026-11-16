# Bridging C Return Codes and errno

One of Zen C's greatest strengths is direct interoperability with existing C libraries and POSIX operating system APIs. However, traditional C code does not return `Result<T>` types; it uses:
1. Integer return codes (`0` for success, `-1` or non-zero for error).
2. The global, thread-local **`errno`** variable defined in `<errno.h>`.
3. `NULL` pointer returns for allocation or handle failures.

To write idiomatic Zen C applications, you should wrap raw C library calls at your program's boundary, converting C error conventions into clean, type-safe `Result<T>` structures.

---

## Wrapping C File Operations

Consider the standard C library function `fopen`:
```c
FILE *fopen(const char *pathname, const char *mode);
```
If `fopen` fails, it returns `NULL` and sets `errno` to indicate the error reason (e.g., `ENOENT` for file not found, `EACCES` for permission denied).

In Zen C, we can write a clean, safe wrapper:

**Listing 9-4**
```zenc
include <errno.h>
include <string.h>
include <stdio.h>
import "std/result.zc"

fn safe_open_file(path: char*, mode: char*) -> Result<void*> {
    let f = fopen(path, mode);
    if f == NULL {
        // Translate C errno to human-readable string
        let err_msg = strerror(errno);
        return Result<void*>::Err(err_msg);
    }
    return Result<void*>::Ok(f);
}

fn main() {
    println "Attempting to open nonexistent file...";
    let res = safe_open_file("missing_config_file.json", "r");

    if res.is_err() {
        println "OS Error caught cleanly: {res.err}";
    } else {
        println "File opened successfully!";
        fclose(res.unwrap());
    }
}
```

Output:
```text
Attempting to open nonexistent file...
OS Error caught cleanly: No such file or directory
```

Instead of an opaque `NULL` or silent failure, the caller receives a descriptive error message (`"No such file or directory"`) directly inside `res.err`.

---

## Converting Integer Status Codes

Many POSIX APIs (such as `unlink`, `rename`, or socket operations) return `0` on success and `-1` on failure:

```zenc
include <errno.h>
include <string.h>
include <stdio.h>
import "std/result.zc"

fn safe_remove_file(path: char*) -> Result<bool> {
    let rc = remove(path);
    if rc != 0 {
        return Result<bool>::Err(strerror(errno));
    }
    return Result<bool>::Ok(true);
}
```

By wrapping C APIs in `Result<T>`, your business logic remains completely free of legacy C sentinel values and global `errno` checks.

Next, let's establish clear guidelines on when to use `panic` versus `Result`!
