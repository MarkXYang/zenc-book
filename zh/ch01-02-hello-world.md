# Hello, World!

现在你已经安装了 Zen C，是时候编写你的第一个程序了。在学习一门新编程语言时，编写一个在屏幕上输出 `Hello, world!` 的小程序是一项传统。

---

## 创建项目目录

首先打开终端，并创建一个目录来存放你的项目代码：

```bash
mkdir hello_world
cd hello_world
```

---

## 编写 Zen C 程序

接下来，创建一个名为 `main.zc` 的新源文件。Zen C 源文件始终使用 `.zc` 文件扩展名。

在编辑器中打开 `main.zc` 并输入以下代码：

**代码清单 1-1**
```zenc
fn main() {
    println "Hello, world!";
}
```

保存该文件。

---

## 运行程序

你可以使用 `zc run` 命令一步完成编译并运行程序：

```bash
zc run main.zc
```

你应当会看到类似如下的输出：

```text
   Compiling main.zc...
     Running ./main
Hello, world!
```

恭喜！你已经正式编写并执行了你的第一个 Zen C 程序。

---

## Zen C 程序剖析

让我们详细剖析这个简单程序的各个组成部分：

```zenc
fn main() {
    println "Hello, world!";
}
```

1. **`fn main()`**：`fn` 关键字用于声明一个函数。名为 `main` 的函数很特殊：它是每个 Zen C 可执行程序的入口点。与标准 C 语言中必须声明返回类型 `int main(void)` 并显式写出 `return 0;` 不同，Zen C 会自动为你处理 `main` 函数的返回状态设置。
2. **花括号 `{}`**：函数体用花括号（`{}`）包裹，定义了该函数块的作用域。
3. **`println "Hello, world!";`**：这行代码将字符串打印到标准输出，后跟一个换行符。
   - > [!IMPORTANT]
     > 请注意，在 Zen C 中，`println` 是一个**关键字**，而非普通的函数调用。因此，它的参数**不需要**加括号：`println "Hello, world!";`。
4. **分号 `;`**：Zen C 中的每条语句都以分号 `;` 结尾。

---

## 分步编译与运行

在快速开发时，`zc run` 非常方便，但你也可以使用 `zc build` 将程序编译为独立的二进制可执行文件：

```bash
zc build main.zc -o hello
```

这会在当前目录下生成一个名为 `hello` 的经过优化的原生二进制文件。你可以直接运行它：

```bash
./hello
```

输出：
```text
Hello, world!
```

---

## 底层原理：转译为 C 代码

Zen C 最强大的特性之一是**透明编译**。Zen C 在调用 GCC 或 Clang 等宿主编译器之前，会先编译为标准 GNU C11 源代码。

你可以随时使用 `zc transpile` 子命令来查看生成的 C 代码：

```bash
zc transpile main.zc -o main.c
```

打开 `main.c`。你将看到标准 C 头文件（`stdio.h`、`stdlib.h`）、类型定义、安全辅助函数以及干净编译出的 `main` 函数：

```c
ZC_FUNC int main(void)
{
    {
        ({ fprintf(stdout, "%s", "Hello, world!"); fprintf(stdout, "\n"); 0; });
    }
}
```

请注意，`println "Hello, world!"` 直接转译为标准 C 文件流打印（`fprintf(stdout, ...)`），没有任何黑盒或外部运行时。

在下一节中，我们将深入探索 `zc` 工具链。
