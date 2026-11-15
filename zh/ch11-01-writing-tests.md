# 如何编写测试

Zen C 为编写自动化测试提供了一等语言语法：`test` 声明、`assert` 与 `expect` 语句，以及自动导入的 `std/test.zc` 辅助模块。因为这些结构直接构建在编译器内部，所以你可以在所验证的结构体和函数旁边直接编写富有表现力的单元测试，而无需安装或配置任何外部测试库。

---

## `test` 块的解剖

Zen C 中的测试在文件顶层使用 `test` 关键字声明，后跟描述被测行为的人类可读字符串字面量，以及包含测试主体的块 `{ ... }`：

```zenc
test "descriptive name of the behavior" {
    // Arrange, Act, Assert
}
```

与普通的 `fn` 声明不同，`test` 块使用任意字符串字面量作为名称。这允许你编写清晰的、以空格分隔的描述（如 `"Rectangle::area computes width * height"` 或 `"RingBuffer::pop returns None when empty"`），而不是将所有内容生硬地挤在 snake_case 标识符中。

让我们构建一个完整的示例来测试 `Rectangle` 结构体及其方法：

```zenc
// File: examples/ch11/ch11-01-writing-tests/main.zc

struct Rectangle {
    width: int,
    height: int,
}

impl Rectangle {
    fn new(w: int, h: int) -> Rectangle {
        return Rectangle { width: w, height: h };
    }

    fn area(self) -> int {
        return self.width * self.height;
    }

    fn can_hold(self, other: Rectangle) -> bool {
        return self.width > other.width && self.height > other.height;
    }

    fn scale(self, factor: int) {
        self.width *= factor;
        self.height *= factor;
    }
}

test "Rectangle::area calculates width times height" {
    let rect = Rectangle::new(10, 5);
    assert(rect.area() == 50, "Expected area 50, got {rect.area()}");
}

test "larger rectangle can hold smaller rectangle" {
    let larger = Rectangle::new(8, 7);
    let smaller = Rectangle::new(5, 1);

    assert(larger.can_hold(smaller), "8x7 should hold 5x1");
    expect(!smaller.can_hold(larger), "5x1 should not hold 8x7");
}

test "Rectangle::scale mutates dimensions in place" {
    let rect = Rectangle::new(3, 4);
    rect.scale(2);

    expect_eq(rect.width, 6, "width should double to 6");
    expect_eq(rect.height, 8, "height should double to 8");
    expect_eq(rect.area(), 48, "scaled area should be 48");
}
```

因为此文件包含 `test` 块且没有 `fn main()`，所以运行 `zc run` 会自动编译并执行测试套件：

```bash
$ zc run examples/ch11/ch11-01-writing-tests/main.zc
   Compiling examples/ch11/ch11-01-writing-tests/main.zc...
     Running ./main
  TEST: Rectangle::area calculates width times height ... OK
  TEST: larger rectangle can hold smaller rectangle ... OK
  TEST: Rectangle::scale mutates dimensions in place ... OK

0 test(s) failed
```

---

## 使用 `assert` 和 `expect` 检查不变量

Zen C 提供了两个内置的验证语句——`assert` 和 `expect`——它们既可以带括号编写（如函数调用），也可以不带括号编写（如语句）：

```zenc
// Parenthesized style (idiomatic in expressions and multi-argument checks)
assert(x > 0);
assert(x == 42, "Expected x to be 42, got {x}");

expect(items.len == 3);
expect(items.len == 3, "Expected 3 items, found {items.len}");

// Statement style (parentheses omitted)
assert x > 0, "x must be positive";
expect items.len == 3, "items should have 3 elements";
```

### `assert` 和 `expect` 如何报告失败

在 Zen C 的测试运行器中，当条件求值为 `false` 时，`assert` 和 `expect` 都会递增全局失败计数器（`_zc_test_failures`）并向 `stderr` 打印诊断信息：

- `assert(cond, "msg")` 打印：
  ```text
    Assertion failed: msg
  ```
- `expect(cond, "msg")` 打印：
  ```text
    Expectation failed: msg
  ```

如果省略自定义消息字符串，`assert(cond)` 默认为 `"Assertion failed"`，`expect(cond)` 默认为 `"Expectation failed"`。

> **提示：`assert` 与 `expect` 的语义意图**
> 在 Zen C 内置的测试运行器中，`assert` 和 `expect` 都不会使用 `SIGABRT` 中止进程；两者都会在 `_zc_test_failures` 中记录失败，并允许后续的检查和测试继续运行，这样你就可以在单次测试运行中看到*所有*未通过的期望。
>
> 按照惯例：
> - 将 **`assert`** 用于前置条件和结构不变量（例如，在检查其字段之前验证指针非空或解析结果为 `Ok`）。如果必须在前置条件失败时立即停止当前 `test` 块，请将 `assert` 与 `if` 块内的提前 `return;` 配合使用。
> - 在验证输出的多个独立属性时使用 **`expect`**（以及 `expect_*` 辅助函数）（例如按顺序检查 `width`、`height` 和 `area`）。

---

## 失败消息中的惰性字符串插值

当测试失败时，仅仅知道 `rect.area() == 50` 为假只是完成了一半的工作——你还想知道 `rect.area()` 实际返回了什么。

`assert` 和 `expect` 都在其失败消息参数中支持完整的 Zen C `{...}` 字符串插值：

```zenc
test "interpolated failure messages" {
    let r = Rectangle::new(6, 7);
    let expected = 42;
    assert(r.area() == expected, "For {r.width}x{r.height}, expected {expected} but got {r.area()}");
}
```

最棒的是，Zen C 对失败消息进行**惰性**编译。插值字符串的 `snprintf` 格式化放置在生成 C 代码的 `if (!(cond))` 失败分支*内部*。当你的测试通过时，完全不会发生字符串格式化或缓冲区分配！

---

## 标准测试辅助函数（`std/test.zc`）

每当 Zen C 解析器在你的文件中遇到 `test` 块时，它都会自动导入标准测试模块（`std/test.zc`）。该模块在 `expect` 的基础上提供了三个方便的比较辅助函数：

| 辅助函数 | 签名 | 说明 |
| :--- | :--- | :--- |
| `expect_eq` | `fn expect_eq(actual: int, expected: int, msg: string)` | 检查 `actual == expected`。 |
| `expect_ne` | `fn expect_ne(actual: int, expected: int, msg: string)` | 检查 `actual != expected`。 |
| `expect_approx_eq` | `fn expect_approx_eq(actual: f64, expected: f64, epsilon: f64, msg: string)` | 对浮点结果检查 `\|actual - expected\| <= epsilon`。 |

### 使用 `expect_approx_eq` 测试浮点数学

由于 IEEE 754 浮点运算受舍入影响（例如，二进制浮点数中的 `0.1 + 0.2` 是 `0.30000000000000004`），使用精确的 `==` 测试 `f64` 计算是不稳定测试（flaky test）的经典根源。请务必使用带有显式容差 `epsilon` 的 `expect_approx_eq`：

```zenc
fn circle_area(radius: f64) -> f64 {
    return 3.141592653589793 * radius * radius;
}

test "floating-point approximations" {
    let sum = 0.1 + 0.2;
    expect_approx_eq(sum, 0.3, 1e-9, "0.1 + 0.2 should be approximately 0.3");

    let area = circle_area(2.5);
    expect_approx_eq(area, 19.634954, 1e-5, "Circle area within 1e-5 tolerance");
}
```

---

## 测试 `Option<T>`、`Result<T>`、`defer` 与 `Drop`

因为 `test "name" { ... }` 块会被编译为普通的 C 函数作用域，所以 Zen C 的所有资源管理和错误处理特性都可以在测试中无缝工作：

1. 在 `test` 块内注册的 **`defer` 语句**保证在测试结束时执行。
2. **实现 `Drop` 的类型**（如 `Vec<T>`、`Map<V>` 或自定义 RAII 结构体）会在 `test` 块末尾通过其 `Drop::drop` 胶水代码自动清理。
3. **验证 `Drop` 执行**：你可以通过在测试内部创建内部块 `{ ... }` 并断言在内部块退出时清理计数器或状态标志已更新，来测试你自己的自定义 `Drop` 实现！

以下示例演示了如何在 `test` 块内测试 `Result<T>` 错误路径和确定性 RAII `Drop` 清理：

```zenc
import "std/result.zc"

struct TempBuffer {
    id: int,
    drop_counter: int*,
}

impl Drop for TempBuffer {
    fn drop(self) {
        if self.drop_counter != NULL {
            (*self.drop_counter) += 1;
        }
    }
}

fn parse_port(input: int) -> Result<int> {
    if input <= 0 || input > 65535 {
        return Result<int>::Err("Port out of valid range (1..65535)");
    }
    return Result<int>::Ok(input);
}

test "Result<T> success and error paths" {
    let valid = parse_port(8080);
    assert(valid.is_ok(), "8080 should be a valid port");
    expect_eq(valid.unwrap(), 8080, "Unwrapped port should be 8080");

    let invalid = parse_port(70000);
    assert(invalid.is_err(), "70000 should be rejected");
}

test "RAII Drop runs deterministically at end of scope" {
    let drops = 0;

    {
        let buf1 = TempBuffer { id: 1, drop_counter: &drops };
        let buf2 = TempBuffer { id: 2, drop_counter: &drops };
        expect_eq(drops, 0, "Buffers are still alive inside inner scope");
    }

    expect_eq(drops, 2, "Both buffers must be dropped upon exiting inner scope");
}
```

---

## 🔍 窥探底层 C 代码：`test`、`assert` 与 `expect` 是如何编译的

当你使用 `zc transpile` 转译包含 `test` 块的文件时，你可以看到驱动 Zen C 测试框架的确切 C11 代码。

首先，在运行时序言（preamble）中，Zen C 会生成一个全局失败计数器 `_zc_test_failures` 和两个变长宏：

```c
int _zc_test_failures = 0;

#define __zenc_assert(cond, msg, ...) do { \
    if (!(cond)) { \
        fprintf(stderr, "  Assertion failed: " msg "\n", ##__VA_ARGS__); \
        _zc_test_failures++; \
    } \
} while(0)

#define __zenc_expect(cond, msg, ...) do { \
    if (!(cond)) { \
        fprintf(stderr, "  Expectation failed: " msg "\n", ##__VA_ARGS__); \
        _zc_test_failures++; \
    } \
} while(0)
```

其次，每个 `test "name" { ... }` 块都会作为一个独立的 `static int _z_test_N()` 函数生成，它会在运行测试主体之前快照 `_zc_test_failures` 并在之后进行比较：

```c
static int _z_test_0() {
    fprintf(stderr, "  TEST: Rectangle::area calculates width times height ... ");
    int _zc_before = _zc_test_failures;
    {
        struct Rectangle rect = Rectangle__new(10, 5);
        __zenc_assert((Rectangle__area(&rect) == 50), "%s", ({
            static ZC_TLS char _z_buf[1024];
            snprintf(_z_buf, 1024, "Expected area 50, got %lld", (long long)(Rectangle__area(&rect)));
            _z_buf;
        }));
    }
    if (_zc_before == _zc_test_failures) {
        fprintf(stderr, "OK\n");
    } else {
        fprintf(stderr, "FAIL\n");
    }
    return _zc_test_failures - _zc_before;
}
```

注意生成的 C 代码中两个巧妙的细节：
1. 因为 `__zenc_assert` 在消息参数周围展开了 `if (!(cond))`，所以当 `Rectangle__area(&rect) == 50` 为真时，GNU 语句表达式 `({ static ZC_TLS char _z_buf[1024]; snprintf(...); _z_buf; })` **永远不会执行**。
2. 每个测试都会比较 `_zc_before == _zc_test_failures`，因此即使 `_z_test_0()` 失败，`_z_test_1()` 也会以干净的基线开始并独立报告其自己的 `OK` 或 `FAIL` 状态。
