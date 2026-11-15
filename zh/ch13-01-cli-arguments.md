# 13.1 接收命令行参数

`zgrep` 的首要任务是接收用户传入的两个命令行参数：
1. 要搜索的**查询字符串（query string）**。
2. 要在其中搜索的**文件路径（file path）**。

我们希望用户能够编译 `zgrep`，并在 shell 中像这样调用它：

```bash
$ ./zgrep needle haystack.txt
```

---

## 1. `main(argc: int, argv: char**)` 入口点

在前面的章节中，我们的大多数程序都使用无参数入口点（`fn main()`）。在构建命令行工具时，Zen C 也直接支持标准 C ABI 入口点签名：

```zenc
fn main(argc: int, argv: char**) -> int {
    // ...
    return 0;
}
```

因为 Zen C 直接编译为 C11，所以 `fn main(argc: int, argv: char**) -> int` 一对一地映射到操作系统的进程入口点（`int main(int argc, char** argv)`），具有**零启动分配开销**：

- **`argc: int`**（*参数数量，argument count*）：传递给进程的参数总数，包括程序自身的调用名称。`argc` 始终至少为 `1`。
- **`argv: char**`**（*参数向量，argument vector*）：指向以空字符结尾的 C 字符串（`char*` / `string`）数组的指针，其中：
  - `argv[0]` 是用于调用二进制文件的名称或路径（例如 `"./zgrep"`）。
  - `argv[1]` 是用户提供的第一个参数（我们的搜索查询）。
  - `argv[2]` 是用户提供的第二个参数（我们的目标文件路径）。
  - C11 标准保证 `argv[argc]` 是一个 `NULL` 指针。

---

## 2. 读取并打印 `argv`

让我们首先编写一个小程序，遍历 `0..argc` 并打印进程接收到的每一个参数。

由于 Zen C 的 `string` 类型是 `char*` 的直接别名，对 `argv[i]` 进行索引会产生一个可以直接绑定到 `string` 变量并通过 `println` 进行插值的值：

**示例 13-1: `list13-1.zc` —— 检查 `argc` 和 `argv` 并提取 `query` 和 `file_path`**

```zenc
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

## 3. 使用参数构建和运行 CLI 程序

在开发接受位置命令行参数的 CLI 工具时，使用 `zc build -o <binary>` 编译你的二进制文件，然后直接调用生成的可执行文件：

```bash
$ zc build examples/ch13/ch13-01-cli-arguments/main.zc -o zgrep
   Compiling examples/ch13/ch13-01-cli-arguments/main.zc...
    Finished build in 0.08s with 0 errors and 0 warnings
```

现在传入两个参数（`needle` 和 `haystack.txt`）运行 `./zgrep`：

```bash
$ ./zgrep needle haystack.txt
Received 3 argument(s):
  argv[0] = ./zgrep
  argv[1] = needle
  argv[2] = haystack.txt

Searching for: 'needle'
In file:       'haystack.txt'
```

而如果我们不带参数运行 `./zgrep`（或通过 `zc run examples/ch13/ch13-01-cli-arguments/main.zc` 运行），`argc` 为 `1`，我们的后备默认值（`"frog"` 和 `"poem.txt"`）将生效：

```bash
$ zc run -q examples/ch13/ch13-01-cli-arguments/main.zc
Received 1 argument(s):
  argv[0] = ./main

Searching for: 'frog'
In file:       'poem.txt'
```

> [!NOTE]
> **为什么传递 CLI 参数时使用 `zc build`？**
> `zc` 编译器驱动程序会将 `zc build` 和 `zc run` 命令行上的额外非标志参数视为要编译到翻译单元中的附加源文件。使用 `zc build main.zc -o zgrep` 编译一次并运行 `./zgrep <query> <file_path>`，可以确保所有参数直接传递给程序的 `argv`。

---

## 4. 借用的 `string` 指针与拥有的 `Vec<String>`

注意在示例 13-1 中，`query = argv[1];` 和 `file_path = argv[2];` **没有**在堆上分配任何内存。

在 C 和 Zen C 中，支撑 `argv[0..argc]` 的内存在操作系统的进程启动帧中拥有所有权，并在 `main()` 的整个执行期间保持有效。因此，将 `argv[1]` 和 `argv[2]` 作为 `string`（`char*`）指针借用是完全安全的，且具有零堆分配成本。

如果你的 CLI 工具需要修改、拆分或将参数存储在可增长的集合中，也可以使用 `std/vec.zc` 和 `std/string.zc` 将 `argv` 收集到 `Vec<String>` 中：

```zenc
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

对于 `zgrep` 而言，将 `argv[1]` 和 `argv[2]` 作为 `string` 切片借用就完全足够了。

---

## 🔍 窥探底层 C 代码

当 `zc` 转译 `examples/ch13/ch13-01-cli-arguments/main.zc` 时，`fn main(argc: int, argv: char**) -> int` 成为标准的 C11 `main` 函数，并直接从 `argv` 进行指针赋值：

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

现在 `zgrep` 已经能够接收搜索查询和文件路径，让我们在 **[13.2 读取文件](ch13-02-reading-file.md)** 中从磁盘读取目标文件吧！
