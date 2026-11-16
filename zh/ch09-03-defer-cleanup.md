# 使用 defer 进行错误路径清理

在系统编程中，函数经常会获取必须在函数返回前释放的资源：
- 在堆上分配内存。
- 打开文件流和文件描述符。
- 获取 POSIX 互斥锁。
- 打开网络套接字。

当函数执行到一半发生错误时，如果提前返回而未释放已获取的资源，就会导致内存泄漏、套接字耗尽或死锁。

在传统 C 语言中，开发者使用臭名昭著的 **`goto cleanup`** 惯用法来处理这种情况：

```c
// Traditional C: Fragile goto ladders
int process_file(const char* path) {
    FILE* f = fopen(path, "r");
    if (!f) return -1;

    char* buf = malloc(1024);
    if (!buf) {
        fclose(f); // Easy to forget!
        return -1;
    }

    if (read_data(f, buf) < 0) {
        goto cleanup; // Jumps to manual cleanup
    }

    // Success path
cleanup:
    free(buf);
    fclose(f);
    return 0;
}
```

`goto cleanup` 极其容易出错：遗漏一个 `fclose` 或跳转到错误的标签都会导致严重的漏洞。

---

## Zen C 的解决方案：确定性 `defer`

在 Zen C 中，你可以使用 **`defer`**（在[第 4 章](ch04-00-ownership-pointers-cleanup.md)中首次介绍）来解决这个问题。

使用 `defer` 调度的语句保证在所在作用域退出时执行，无论是正常完成还是由于错误提前返回。

**代码清单 9-3**
```zenc
include <stdio.h>
import "std/result.zc"

fn process_stream(fail_flag: bool) -> Result<int> {
    println "[step 1] Allocating buffer / opening stream...";
    defer println "[cleanup] Stream closed and buffer freed cleanly via defer!";

    if fail_flag {
        println "[step 2] Encountered unexpected protocol error!";
        return Result<int>::Err("Protocol communication failure");
    }

    println "[step 2] Data processed successfully.";
    return Result<int>::Ok(42);
}

fn main() {
    println "=== Scenario A: Error Path ===";
    let r1 = process_stream(true);
    if r1.is_err() {
        println "Received error: {r1.err}";
    }

    println "\n=== Scenario B: Success Path ===";
    let r2 = process_stream(false);
    if r2.is_ok() {
        println "Received value: {r2.unwrap()}";
    }
}
```

输出：
```text
=== Scenario A: Error Path ===
[step 1] Allocating buffer / opening stream...
[step 2] Encountered unexpected protocol error!
[cleanup] Stream closed and buffer freed cleanly via defer!
Received error: Protocol communication failure

=== Scenario B: Success Path ===
[step 1] Allocating buffer / opening stream...
[step 2] Data processed successfully.
[cleanup] Stream closed and buffer freed cleanly via defer!
Received value: 42
```

注意 `[cleanup]` 在**两种**情况下都执行了，保证了零资源泄漏！

---

## 使用 `Drop` Trait 进行 RAII 清理

当使用实现了 `Drop` trait 的高级类型（例如 `Vec<T>`、`String` 或自定义资源包装器）时，Zen C 编译器会在作用域退出时自动清理变量。

如果你将 RAII 类型与早期错误返回结合使用，编译器会在 return 语句完成之前，自动对所有存活的局部变量调用析构器。

接下来，让我们学习如何将 C 的整数返回码和全局 `errno` 桥接为惯用的 `Result<T>`！
