# 桥接 C 返回码与 errno

Zen C 最大的优势之一是能够与现有 C 库和 POSIX 操作系统 API 直接互操作。然而，传统 C 代码并不返回 `Result<T>` 类型；它使用的是：
1. 整数返回码（`0` 表示成功，`-1` 或非零表示错误）。
2. 在 `<errno.h>` 中定义的全局线程局部 **`errno`** 变量。
3. 用于分配或句柄失败的 `NULL` 指针返回。

为了编写惯用的 Zen C 应用程序，你应该在程序边界处包装原始 C 库调用，将 C 错误约定转换为干净、类型安全的 `Result<T>` 结构体。

---

## 包装 C 文件操作

考虑标准 C 库函数 `fopen`：
```c
FILE *fopen(const char *pathname, const char *mode);
```
如果 `fopen` 失败，它返回 `NULL` 并设置 `errno` 以指示错误原因（例如 `ENOENT` 表示文件不存在，`EACCES` 表示权限被拒绝）。

在 Zen C 中，我们可以编写一个干净、安全的外层包装：

**代码清单 9-4: `list9-4.zc`**

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

输出：
```text
Attempting to open nonexistent file...
OS Error caught cleanly: No such file or directory
```

调用者不再面对不透明的 `NULL` 或静默失败，而是直接在 `res.err` 中接收到描述性错误消息（`"No such file or directory"`）。

---

## 转换整数状态码

许多 POSIX API（例如 `unlink`、`rename` 或套接字操作）在成功时返回 `0`，失败时返回 `-1`：

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

通过将 C API 包装在 `Result<T>` 中，你的业务逻辑将彻底摆脱传统的 C 哨兵值和全局 `errno` 检查。

接下来，让我们建立明确的准则，探讨何时使用 `panic` 以及何时使用 `Result`！
