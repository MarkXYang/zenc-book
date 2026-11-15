# 编写猜数游戏

让我们通过亲自动手完成一个实战项目，快速走进 Zen C 的世界！本章将通过在一个真实程序中使用 Zen C 的核心概念来向你介绍它们。你将学习到变量、用户输入、条件控制流、循环、字符串插值以及标准 C 语言库的互操作。

我们将构建一个经典的编程入门项目：**猜数游戏**。它的工作原理如下：
1. 程序在 1 到 100 之间生成一个随机的神秘数字。
2. 提示玩家输入一个猜测值。
3. 输入猜测后，程序会指出该猜测值是**太大了**、**太小了**还是**猜对了**。
4. 如果猜对了，游戏会打印一条祝贺信息并退出。否则，程序将继续提示进行下一次猜测，直到玩家获胜为止。

---

## 创建新项目

要创建新项目，请为游戏新建一个目录并进入该目录：

```bash
mkdir guessing_game
cd guessing_game
```

创建一个名为 `main.zc` 的新源文件：

```bash
touch main.zc
```

---

## 处理玩家的猜测

我们首先提示用户输入，并将输入内容回显到屏幕上。打开 `main.zc` 并添加以下代码：

**代码清单 2-1：`list2-1.zc`**

```zenc
 1 | fn main() {
 2 |     println "=== Guess the Number! ===";
 3 |
 4 |     print "Please input your guess: ";
 5 |
 6 |     let guess: int = 0;
 7 |     scanf("%d", &guess);
 8 |
 9 |     println "You guessed: {guess}";
10 | }
```

### 逐行解释代码

让我们详细剖析这段代码的每一部分：

1. **`fn main()`**：正如你在第 1 章中学到的，`fn main()` 是程序的入口点。
2. **`println "=== Guess the Number! ===";`**：打印标题并换行。记住，`println` 在 Zen C 中是一条语句关键字，不需要加括号。
3. **`print "Please input your guess: ";`**：与 `println` 不同，`print` 输出文本后末尾不添加换行符。这使终端光标停留在同一行，以便用户在提示符后直接输入内容。
4. **`let guess: int = 0;`**：
   - `let` 关键字用于声明变量。
   - `: int` 显式指定 `guess` 的类型为 32 位有符号整数。
   - `=` 赋予初始值 `0`。
5. **`scanf("%d", &guess);`**：Zen C 直接转译为标准 C。可以直接调用 `scanf` 等标准 C 库函数，将输入内容读入 `guess` 的指针地址（`&guess`）。
6. **`println "You guessed: {guess}";`**：Zen C 提供了强大的**字符串插值**功能。放在字符串字面量 `{}` 括号中的任何变量，都会在运行时自动格式化并显示，无需手动书写格式占位符！

### 测试第一部分

使用 `zc run` 编译并运行你的程序：

```bash
zc run main.zc
```

输出：
```text
=== Guess the Number! ===
Please input your guess: 42
You guessed: 42
```

---

## 生成神秘数字

接下来，我们需要生成一个 1 到 100 之间的随机神秘数字，让游戏每次玩起来都有新鲜感。

更新 `main.zc`，为随机数生成器设置种子并生成一个秘密整数：

**代码清单 2-2：`list2-2.zc`**

```zenc
 1 | include <time.h>
 2 |
 3 | fn main() {
 4 |     println "=== Guess the Number! ===";
 5 |
 6 |     // Seed the random number generator with current Unix time
 7 |     srand(time(0));
 8 |     let secret_number = (rand() % 100) + 1;
 9 |
10 |     print "Please input your guess: ";
11 |
12 |     let guess: int = 0;
13 |     scanf("%d", &guess);
14 |
15 |     println "You guessed: {guess}";
16 | }
```

### 理解类型推导 (`let`)

注意 `secret_number` 是如何声明的：

```zenc
let secret_number = (rand() % 100) + 1;
```

在 Zen C 中，你并不总是需要编写像 `: int` 这样显式的类型注解。Zen C 具有**自动类型推导**功能。因为 `rand()` 返回一个整数，Zen C 会自动推导判定 `secret_number` 的类型为 `int`。

- `rand() % 100` 生成一个介于 `0` 到 `99` 之间的随机整数。
- 加上 `+ 1` 将范围平移为 `1` 到 `100`。

---

## 比较猜测值与神秘数字

现在我们既有了用户的猜测值，也有了神秘数字，接下来可以使用 `if`、`else if` 和 `else` 条件语句对它们进行比较。

更新 `main.zc`：

**代码清单 2-3：`list2-3.zc`**

```zenc
 1 | include <time.h>
 2 |
 3 | fn main() {
 4 |     println "=== Guess the Number! ===";
 5 |
 6 |     srand(time(0));
 7 |     let secret_number = (rand() % 100) + 1;
 8 |
 9 |     print "Please input your guess: ";
10 |
11 |     let guess: int = 0;
12 |     scanf("%d", &guess);
13 |
14 |     println "You guessed: {guess}";
15 |
16 |     if guess < secret_number {
17 |         println "Too small!";
18 |     } else if guess > secret_number {
19 |         println "Too big!";
20 |     } else {
21 |         println "You win!";
22 |     }
23 | }
```

输出：
```text
=== Guess the Number! ===
Please input your guess: 50
You guessed: 50
Too small!
```

### 比较是如何工作的

- `if guess < secret_number`：检查用户猜测的值是否小于神秘数字。如果为真，则打印 `"Too small!"`。
- `else if guess > secret_number`：检查猜测值是否大于神秘数字。如果为真，则打印 `"Too big!"`。
- `else`：如果两者都不满足，则猜测值必定等于神秘数字，打印 `"You win!"`。

---

## 使用循环允许多次猜测

目前游戏在接收一次猜测后就会退出。为了让玩家能够持续猜测直到找出神秘数字，我们把猜测逻辑包装在一个无限 `loop` 中。

更新 `main.zc`，加入 `loop` 代码块和 `break` 语句：

**代码清单 2-4：`list2-4.zc`**

```zenc
 1 | include <time.h>
 2 |
 3 | fn main() {
 4 |     println "=== Guess the Number! ===";
 5 |
 6 |     // Seed the random number generator
 7 |     srand(time(0));
 8 |     let secret_number = (rand() % 100) + 1;
 9 |
10 |     loop {
11 |         print "Please input your guess: ";
12 |
13 |         let guess: int = 0;
14 |         if scanf("%d", &guess) != 1 {
15 |             println "Please enter a valid integer!";
16 |             break;
17 |         }
18 |
19 |         println "You guessed: {guess}";
20 |
21 |         if guess < secret_number {
22 |             println "Too small!";
23 |         } else if guess > secret_number {
24 |             println "Too big!";
25 |         } else {
26 |             println "You win! You guessed the secret number!";
27 |             break; // Exit the loop on victory
28 |         }
29 |     }
30 | }
```

### 解释循环控制流

1. **`loop { ... }`**：创建一个无限循环。花括号内的代码会一直重复执行，直到遇到 `break` 语句。
2. **`if scanf("%d", &guess) != 1`**：验证输入。如果 `scanf` 无法读取整数（例如用户输入了文本或发送了 EOF），游戏会提示玩家并安全跳出循环。
3. **`break;`**：一旦用户猜对了神秘数字，立即退出 `loop`。

---

## 完整的可执行代码

以下是你的 Zen C 猜数游戏的完整可用代码：

**代码清单 2-5：`list2-5.zc`**

```zenc
 1 | include <time.h>
 2 |
 3 | fn main() {
 4 |     println "=== Guess the Number! ===";
 5 |
 6 |     // Seed the random number generator
 7 |     srand(time(0));
 8 |     let secret_number = (rand() % 100) + 1;
 9 |
10 |     loop {
11 |         print "Please input your guess: ";
12 |
13 |         let guess: int = 0;
14 |         if scanf("%d", &guess) != 1 {
15 |             println "Please enter a valid integer!";
16 |             break;
17 |         }
18 |
19 |         println "You guessed: {guess}";
20 |
21 |         if guess < secret_number {
22 |             println "Too small!";
23 |         } else if guess > secret_number {
24 |             println "Too big!";
25 |         } else {
26 |             println "You win! You guessed the secret number!";
27 |             break; // Exit the loop on victory
28 |         }
29 |     }
30 | }
```

---

## 构建并试玩游戏

使用 `zc build` 将游戏编译为优化后的原生可执行二进制文件：

```bash
zc build main.zc -o guessing_game
```

现在启动并试玩你的游戏吧！

```bash
./guessing_game
```

试玩示例：
```text
=== Guess the Number! ===
Please input your guess: 50
You guessed: 50
Too small!
Please input your guess: 75
You guessed: 75
Too big!
Please input your guess: 62
You guessed: 62
You win! You guessed the secret number!
```

---

## 本章小结

在第 2 章中，你成功在 Zen C 中构建了一个完整的交互式项目！你学到了如何：
- 使用显式类型（`let guess: int`）或自动类型推导（`let secret_number`）声明变量。
- 使用 `print`、`println` 和字符串插值（`{guess}`）执行标准输入/输出。
- 使用 `if`、`else if` 和 `else` 执行条件分支逻辑。
- 使用 `loop` 创建重复执行循环，并使用 `break` 进行受控退出。
- 无缝与标准 C 函数（`rand`、`srand`、`time`、`scanf`）进行互操作。

在**第 3 章**中，我们将深入探索 Zen C 的通用编程概念：变量、常量、基础数据类型、函数、Lambda 以及高级控制流结构！
