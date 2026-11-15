# 13.2 读取文件

现在 `zgrep` 已经知道要使用哪个查询字符串和文件路径，接下来的步骤是打开目标文件并将其内容读取到内存中。

---

## 1. 创建示例测试文件（`poem.txt`）

为了在真实的多行文本上测试 `zgrep`，让我们创建一个名为 `poem.txt` 的小文件，其中包含艾米莉·狄金森（Emily Dickinson）的名诗 *《I'm nobody! Who are you?》*：

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

这段简短的文本具有几个非常适合测试搜索工具的特征：
- 仅出现在单行中的单词（例如 `"frog"` 或 `"banish"`）。
- 出现在多行中的单词（例如 `"nobody"` 或 `"you"`）。
- 在不同行中大小写不同的单词（例如 `"to"` 与 `"To"`），我们将在 [13.4 节](ch13-04-env-variables.md) 测试不区分大小写的搜索时用到。

---

## 2. Zen C 中的文件 I/O（`std/fs.zc`）

在传统 C 语言中，将整个文件读取到动态分配的字符串中需要一系列极易出错的调用：
1. 调用 `fopen(path, "rb")` 并检查是否为 `NULL`。
2. 调用 `fseek(fp, 0, SEEK_END)` 和 `ftell(fp)` 确定字节长度，然后调用 `fseek(fp, 0, SEEK_SET)` 回绕。
3. 调用 `malloc(size + 1)` 并检查是否为 `NULL`。
4. 调用 `fread(buf, 1, size, fp)` 并手动写入空终止符 `buf[read] = '\0'`。
5. 调用 `fclose(fp)`，并在每个退出路径上牢记调用 `free(buf)`。

Zen C 的标准文件系统模块（`import "std/fs.zc"`）将这一切封装在 `File` 类型和 `Result<T>` 之后：

| 方法 | 签名 | 说明 |
| :--- | :--- | :--- |
| `File::read_all` | `fn read_all(path: char*) -> Result<String>` | 打开 `path`，将其全部内容读取到拥有所有权的 `String` 中，关闭文件句柄，并返回 `Ok(String)` 或 `Err(msg)`。 |
| `File::read_lines` | `fn read_lines(path: char*) -> Result<Vec<String>>` | 读取 `path`，按 `'\n'` 进行拆分（自动剥离 Windows/CRLF 文件中末尾的 `'\r'`），并返回 `Ok(Vec<String>)`。 |
| `File::open` | `fn open(path: char*, mode: char*) -> Result<File>` | 打开一个 `File` 句柄（`fopen`）。`File` 实现了 `Drop`，因此当 `File` 离开作用域时，底层 `FILE*` 会被自动关闭。 |
| `File::exists` | `fn exists(path: char*) -> bool` | 如果磁盘上存在 `path`，则返回 `true`。 |
| `File::metadata` | `fn metadata(path: char*) -> Result<Metadata>` | 查询文件大小（`u64`）、`is_file` 以及 `is_dir`。 |

---

## 3. 使用 `File::read_all` 读取 `poem.txt`

让我们更新 `main.zc`，导入 `std/fs.zc`，使用 `File::read_all(file_path)` 读取目标文件，并打印其内容。

对于这个初始原型，我们将使用 `.expect("Should have been able to read the file")` 解包 `Result<String>`（在下一节中，我们将用优雅的 `Result` 错误传播替换 `.expect(...)`）：

**示例 13-2: `list13-2.zc` —— 将 `poem.txt` 的内容读取到 `String` 中**

```zenc
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

让我们使用 `zc run` 运行程序：

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

或者编译二进制文件，显式传递自定义查询和文件路径：

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

## 4. 自动内存与句柄清理（`Drop`）

请注意在示例 13-2 中*没有*出现什么：
- 没有手动调用 `fclose(fp)`。在 `File::read_all` 内部，`File` 句柄在读取完毕后立即关闭；即便直接使用 `File::open`，`std/fs.zc` 也定义了：
  ```zenc
  impl Drop for File {
      fn drop(self) {
          self.close();
      }
  }
  ```
- 在 `main()` 的结尾处没有手动调用 `contents.free()` 或 `free(buf)`。因为 `String` 封装了实现了 `Drop` 的 `Vec<char>`，Zen C 编译器会在 `main` 返回之前自动插入析构函数调用（`String__Drop__glue(&contents)`）！

---

## 🔍 窥探底层 C 代码

检查 `examples/ch13/ch13-02-reading-file/main.zc` 中 `main()` 转译出的 C11 代码，展示了 `File::read_all`、`Result::expect` 和自动 RAII 清理是如何协同工作的：

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

## 有哪些地方需要改进？

我们的原型已经可以工作——它能接收参数并读取 `poem.txt`——但随着程序的增长，它存在的几个结构性缺陷会带来麻烦：

1. **单函数巨石（Monolith）**：`main()` 目前同时负责解析 CLI 参数、处理配置以及读取文件。
2. **缺乏结构的配置**：`query` 和 `file_path` 是分散的局部变量。随着我们添加标志和环境选项（例如大小写不敏感性），在各处传递单独的参数会变得臃肿不堪。
3. **不友好的 Panic 诊断**：如果用户遗漏了参数或传递了一个不存在的文件路径（如 `nonexistent.txt`），`.expect(...)` 会直接以原生 panic 消息终止（`Panic: Should have been able to read the file: Failed to open file`），而不是输出干净的 CLI 错误信息。
4. **无法测试的逻辑**：因为所有逻辑都写在 `main()` 内部，我们无法编写 `test "..."` 块来单独对行搜索算法进行单元测试。

让我们在 **[13.3 重构以提高模块化与错误处理能力](ch13-03-refactoring.md)** 中解决这四个问题！
