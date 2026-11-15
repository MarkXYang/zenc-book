# 使用 Result 和 Option 处理可恢复错误

大多数错误并不需要程序崩溃。当一个函数由于所请求的文件不存在或无法解析用户输入而失败时，应该给予调用代码采取补救措施的机会：重试该操作、要求用户提供不同的输入或报告清晰的错误消息。

Zen C 使用两个基础的标准库类型对可恢复错误进行建模：
1. **`Option<T>`**：表示可选存在性——要么值存在（`Some(v)`），要么值缺失（`None()`）。
2. **`Result<T>`**：表示可能成功产生一个值（`Ok(v)`）或失败并带有错误消息（`Err(message)`）的计算。

这两个类型都可以通过导入 `std/option.zc` 和 `std/result.zc` 来使用。

---

## 1. `Option<T>` 类型

在传统 C 语言中，缺失的值通过 `NULL` 指针或类似 `-1` 的魔数哨兵整数表示。这种方法有两个致命缺陷：
- 如果函数返回非指针（例如整数索引），它必须指定一个带外整数作为“未找到”。
- C 类型系统中没有任何机制强制调用者在解引用前检查 `NULL`，这会导致空指针解引用崩溃。

Zen C 的 `Option<T>` 通过在类型系统中显式表达值可能缺失来解决此问题：

```zenc
import "std/option.zc"

struct Option<T> {
    is_some: bool;
    val: T;
}
```

### 创建与检查 Option

你可以使用 `Option<T>::Some(v)` 或 `Option<T>::None()` 构造 option：

```zenc
fn find_port(ports: int[4], target: int) -> Option<int> {
    for i in 0..4 {
        if ports[i] == target {
            return Option<int>::Some(i);
        }
    }
    return Option<int>::None();
}
```

要使用 `Option<T>`，你可以借助辅助方法检查其状态：

```zenc
let result = find_port(ports, 8080);

if result.is_some() {
    println "Port found at index: {result.unwrap()}";
}

// 或者提供安全的默认回退值：
let fallback_idx = find_port(ports, 9000).unwrap_or(-1);
```

---

## 2. `Result<T>` 类型

虽然 `Option<T>` 能表达某件事*是否*成功或失败，但它无法解释*为什么*失败。为了提供丰富的错误上下文，Zen C 提供了 `Result<T>`：

```zenc
import "std/result.zc"

struct Result<T> {
    is_ok: bool;
    val: T;
    err: char*;
}
```

`Result<T>` 的实例包含以下之一：
- **`Ok(val)`**：成功的计算并产生 `val`。
- **`Err(err)`**：携带有错误消息字符串的失败。

### 使用 `Result<T>`

让我们编写一个验证和解析端口字符串的函数：

**代码清单 9-2: `list9-2.zc`**

```zenc
import "std/result.zc"

fn parse_port(port_str: string) -> Result<int> {
    if port_str == "8080" {
        return Result<int>::Ok(8080);
    }
    if port_str == "443" {
        return Result<int>::Ok(443);
    }
    return Result<int>::Err("Invalid port number string");
}

fn main() {
    let r1 = parse_port("8080");
    if r1.is_ok() {
        println "Listening on port {r1.unwrap()}";
    }

    let r2 = parse_port("99999");
    if r2.is_err() {
        println "Configuration error: {r2.err}";
    }
}
```

输出：
```text
Listening on port 8080
Configuration error: Invalid port number string
```

---

## 3. 使用尝试运算符（`?`）传播错误

编写调用多个可能失败的子操作的函数时，在每一行之后手动编写 `if res.is_err() { return res; }` 检查会导致深层嵌套的样板代码。

Zen C 提供了 **`?`** 尝试运算符以使错误传播简洁明了：

```zenc
fn start_service(port_str: string) -> Result<int> {
    // If parse_port returns Err, the ? operator automatically returns early
    let port = parse_port(port_str)?;

    println "Port validated: {port}";
    return Result<int>::Ok(port);
}
```

### `?` 运算符的工作原理

当附加到返回 `Result<T>` 的表达式后，`?` 运算符按如下逻辑求值：
1. 如果结果是 `Ok(val)`，它会解包出 `val` 并继续在当前函数中执行。
2. 如果结果是 `Err(msg)`，它会立即终止当前函数，并将 `Result<T>::Err(msg)` 返回给调用者。

---

> [!TIP]
> ### 🔍 窥探底层 C 代码：`?` 运算符如何脱糖
> 在 GNU C11 中，`?` 尝试运算符会脱糖为高效的 GNU 语句表达式（statement expression）：
>
> ```c
> int32_t port = ({
>     Result__int32_t _try = parse_port(port_str);
>     if (!_try.is_ok) return Result__int32_t__Err(_try.err);
>     _try.val;
> });
> ```
>
> 既没有动态分配，也没有异常表查找。它与手写的 C 返回码检查一样快！

---

接下来，让我们探索如何使用 `defer` 保证在错误路径上的资源清理！
