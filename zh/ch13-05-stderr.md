# 13.5 将错误信息写入标准错误

目前，我们的 `main.zc` 将所有输出——包括来自 `poem.txt` 的匹配行以及参数或文件无效时的错误消息——都使用 `println` 打印到了终端。

在 Unix 和 Windows 命令行环境中，进程实际上具有**两个**标准输出流：
1. **标准输出（`stdout`，文件描述符 `1`）**：专用于程序生成的主要数据（例如 `zgrep` 找到的匹配行）。
2. **标准错误（`stderr`，文件描述符 `2`）**：专用于诊断、警告和错误消息。

将 `stdout` 与 `stderr` 分开，允许用户将程序的正常输出重定向到文件中（`> output.txt`）或通过管道传递给另一个工具（`| wc -l`），同时仍能在终端屏幕上立即看到错误消息。

---

## 1. 观察错误输出到 `stdout` 带来的问题

假设用户运行 13.4 节版本的 `zgrep`（该版本使用 `println` 打印错误）并将标准输出重定向到 `output.txt`，但偶然忘记了传入任何命令行参数：

```bash
$ ./zgrep > output.txt
```

因为 shell 的 `>` 运算符**仅重定向 `stdout`** 到 `output.txt`，如果使用 `println` 打印错误，就会发生两件坏事：
1. 用户在终端屏幕上**看不到任何内容**来解释命令为什么失败。
2. 当用户打开期望包含搜索结果的 `output.txt` 时，却发现错误消息被保存在了数据文件中：

```text
Problem parsing arguments: not enough arguments (usage: zgrep <query> <file_path>)
```

---

## 2. 在 Zen C 中输出到 `stderr`（`eprintln`、`eprint` 与 `!"..."`）

正如我们在 [第 3.4 节](ch03-04-printing-and-interpolation.md) 中所学到的，Zen C 提供了专用的内置关键字和语句简写，用于将格式化插值字符串直接写入 `stderr`：

| 语法 | 简写形式 | 流 | 末尾换行 | 转译出的 C11 调用 |
| :--- | :--- | :--- | :--- | :--- |
| `println "..."` | `"..."` | `stdout` | 是 | `fprintf(stdout, ...)` |
| `print "..."` | `"..."..` | `stdout` | 否 | `fprintf(stdout, ...)` |
| `eprintln "..."` | `!"..."` | **`stderr`** | 是 | `fprintf(stderr, ...)` |
| `eprint "..."` | `!"..."..` | **`stderr`** | 否 | `fprintf(stderr, ...)` |

无论是 `eprintln "Problem parsing arguments: {config_res.err}";` 还是其简练的简写形式 `!"Problem parsing arguments: {config_res.err}";`，都会发射写入 `stderr` 的相同 C11 代码。

---

## 3. 更新 `main.zc` 使用 `eprintln`

让我们更新 `main.zc`，以便在返回退出码 `1` 之前使用 `eprintln` 打印参数解析错误和文件 I/O 错误：

**示例 13-5: `list13-5.zc` —— 将诊断信息写入 `stderr` 的最终 `main.zc`**

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
> 你也可以使用 Zen C 的 `!` stderr 简写形式书写这两个错误语句：
> ```zenc
> if config_res.is_err() {
>     !"Problem parsing arguments: {config_res.err}";
>     return 1;
> }
> ```

---

## 4. 验证 `stdout` 重定向与 `stderr` 诊断信息

让我们从 `examples/ch13/ch13-05-stderr/main.zc` 编译完成的 `zgrep` 二进制文件，并在失败和成功场景下测试 shell 重定向：

```bash
$ zc build examples/ch13/ch13-05-stderr/main.zc -o zgrep
```

### 场景 A：重定向 `stdout`（`> output.txt`）时的错误诊断

当我们在不带参数的情况下运行 `./zgrep > output.txt`：

```bash
$ ./zgrep > output.txt
Problem parsing arguments: not enough arguments (usage: zgrep <query> <file_path>)
$ echo $?
1
```

请注意：
1. 错误消息（`Problem parsing arguments: ...`）立即显示在我们的终端屏幕上，因为 `eprintln` 写入到了 `stderr`。
2. 进程以状态码 `1` 退出。
3. `output.txt` 保持完全为空（0 字节）——没有错误文本污染我们的输出文件！

### 场景 B：重定向 `stdout`（`> output.txt`）时的成功搜索

现在让我们在将 `stdout` 重定向到 `output.txt` 的同时运行一次有效的搜索：

```bash
$ ./zgrep to examples/ch13/ch13-05-stderr/poem.txt > output.txt
$ echo $?
0
$ cat output.txt
Are you nobody, too?
How dreary to be somebody!
```

在带有 `IGNORE_CASE=1` 的情况下：

```bash
$ IGNORE_CASE=1 ./zgrep to examples/ch13/ch13-05-stderr/poem.txt > output.txt
$ cat output.txt
Are you nobody, too?
How dreary to be somebody!
To tell your name the livelong day
To an admiring bog!
```

---

## 🔍 窥探底层 C 代码

当 `zc` 转译 `examples/ch13/ch13-05-stderr/main.zc` 时，`eprintln` 发射 `fprintf(stderr, ...)`，而 `run()` 内部的 `println` 则发射 `fprintf(stdout, ...)`：

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

## 第 13 章小结

恭喜！你已经在 Zen C 中构建了一个完整、经过测试且符合惯用法（idiomatic）的命令行工具：
- 你通过 **`fn main(argc: int, argv: char**) -> int`** 以零启动开销接收了原始命令行参数。
- 你使用来自 `std/fs.zc` 的 **`File::read_all`** 将文件读取到内存中，同时依靠 **`Drop`** 自动释放文件句柄和字符串缓冲区。
- 你将项目拆分为轻量的 **`main.zc`** 二进制入口点和可测试的 **`zgrep.zc`** 库模块，并配合使用 **`struct Config`**、**`Result<T>`** 以及 **`?` 尝试运算符**。
- 你使用**测试驱动开发（TDD）**和 `zc run zgrep.zc` 验证了 **`search`** 与 **`search_case_insensitive`**。
- 你使用来自 `std/env.zc` 的 **`Env::get`**、**`Env::set`** 和 **`Env::unset`** 检查并测试了环境变量（`IGNORE_CASE`）。
- 你通过 **`eprintln`**（`!"..."`）将错误诊断定向到 **`stderr`**，并返回了有意义的进程退出码（`0` 和 `1`）。

在**第三部分 —— 进阶探索**中，从 **[第 14 章：函数式特性：闭包与迭代器](ch14-00-functional-features.md)** 开始，我们将探索 Zen C 的 lambda、闭包捕获、原始函数指针（`fn*`）以及迭代器管道！
