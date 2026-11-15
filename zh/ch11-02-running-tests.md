# 使用 zc 运行测试

编写好 `test` 块后，你该如何执行它们、跨模块组织它们，并将它们接入你的构建脚本或持续集成（CI）流水线？

在 Zen C 中，无需安装或配置单独的测试运行器二进制文件。`zc` 编译器本身会合成测试运行器，并通过 `zc run` 直接执行你的测试。

---

## 使用 `zc run` 运行测试文件

要编译并执行文件中的所有 `test` 块，请将 `.zc` 文件传给 `zc run`：

```bash
$ zc run examples/ch11/ch11-01-writing-tests/main.zc
   Compiling examples/ch11/ch11-01-writing-tests/main.zc...
     Running ./main
  TEST: Rectangle::area calculates width times height ... OK
  TEST: larger rectangle can hold smaller rectangle ... OK
  TEST: Rectangle::scale mutates dimensions in place ... OK

0 test(s) failed
```

如果你希望在终端或 CI 日志中获得更清晰的输出，不包含 `Compiling ...` 和 `Running ...` 状态行，请传递 `-q`（`--quiet`）标志：

```bash
$ zc run -q examples/ch11/ch11-01-writing-tests/main.zc
  TEST: Rectangle::area calculates width times height ... OK
  TEST: larger rectangle can hold smaller rectangle ... OK
  TEST: Rectangle::scale mutates dimensions in place ... OK

0 test(s) failed
```

### 退出码与失败报告

当每个 `assert` 和 `expect` 都通过时，测试二进制文件以状态码 `0` 退出。如果任何 `test` 块中存在一个或多个失败的检查，运行器会在行内打印失败诊断信息，将受影响的测试标记为 `FAIL`，在底部打印失败检查的总数，并以等于 `_zc_test_failures` 的非零状态码退出：

```text
  TEST: division by non-zero ... OK
  TEST: bounds check ...   Assertion failed: Expected index < 10, got 12
FAIL

1 test(s) failed
```

因为 `zc run` 会将子进程的退出码直接转发给你的 shell（`$?`），所以任何失败的测试都会自动中止 `make test`、在 `set -e` 下运行的 shell 脚本以及 CI 工作流（例如 GitHub Actions）。

---

## 模块内单元测试模式

Zen C 最高效的工作流之一是**模块内单元测试**（in-module unit testing）：将 `test` 块直接放置在库模块文件的底部，与它们所测试的结构体和函数并排排列。

单个 `.zc` 文件如何既作为可测试单元，又作为可导入的库模块，而不会引发 `main()` 重复错误？

秘密在于 Zen C 代码生成器处理 `main()` 的方式：

1. **不存在用户定义的 `fn main()`**：如果编译的程序定义了至少一个 `test` 块且**没有** `fn main()`，`zc` 会自动生成：
   ```c
   int main() { return _z_run_tests(); }
   ```
2. **存在用户定义的 `fn main()`**：如果编译的程序（或导入你模块的入口文件）定义了自己的 `fn main()`，`zc` 仍然会生成 `_z_run_tests()`，但会**省略**自动生成的 `main()`，以便使用你应用程序的 `fn main()` 作为入口点。

让我们通过一个由两个文件组成的项目来看看实际效果：一个是包含实现代码和单元测试的 `stats.zc` 库模块，另一个是导入 `stats.zc` 的 `app.zc` 二进制入口点。

### 1. 包含嵌入单元测试的库模块（`stats.zc`）

```zenc
// File: examples/ch11/ch11-02-running-tests/stats.zc

struct Summary {
    count: int,
    sum: int,
    min: int,
    max: int,
}

impl Summary {
    fn from_slice(values: int[]) -> Summary {
        assert(values.len > 0, "Summary::from_slice requires a non-empty slice");
        let s = Summary {
            count: values.len,
            sum: 0,
            min: values[0],
            max: values[0],
        };
        for i in 0..values.len {
            let v = values[i];
            s.sum += v;
            if v < s.min { s.min = v; }
            if v > s.max { s.max = v; }
        }
        return s;
    }

    fn mean(self) -> f64 {
        return (f64)self.sum / (f64)self.count;
    }
}

// In-module unit tests right next to the code they verify!
test "Summary::from_slice computes count, sum, min, and max" {
    let data: int[5] = [12, 5, 20, 8, 15];
    let s = Summary::from_slice(data);

    expect_eq(s.count, 5, "count should be 5");
    expect_eq(s.sum, 60, "sum should be 60");
    expect_eq(s.min, 5, "min should be 5");
    expect_eq(s.max, 20, "max should be 20");
    expect_approx_eq(s.mean(), 12.0, 1e-9, "mean should be 12.0");
}

test "Summary::from_slice handles negative numbers" {
    let data: int[3] = [-10, 0, 10];
    let s = Summary::from_slice(data);

    expect_eq(s.sum, 0, "sum of symmetric range should be 0");
    expect_eq(s.min, -10, "min should be -10");
    expect_eq(s.max, 10, "max should be 10");
}
```

因为 `stats.zc` 没有 `fn main()`，所以运行 `zc run stats.zc` 会直接执行其单元测试：

```bash
$ zc run -q examples/ch11/ch11-02-running-tests/stats.zc
  TEST: Summary::from_slice computes count, sum, min, and max ... OK
  TEST: Summary::from_slice handles negative numbers ... OK

0 test(s) failed
```

### 2. 应用程序入口点（`app.zc`）

现在让我们从应用程序入口点 `app.zc` 导入 `stats.zc`，该文件定义了 `fn main()`：

```zenc
// File: examples/ch11/ch11-02-running-tests/app.zc

import "./stats.zc"

fn main() -> int {
    let latencies: int[4] = [42, 38, 50, 30];
    let report = Summary::from_slice(latencies);

    println "Samples: {report.count}, Min: {report.min}ms, Max: {report.max}ms, Mean: {report.mean()}ms";
    return 0;
}
```

当我们运行 `app.zc` 时，`zc` 检测到 `fn main()` 并正常运行应用程序：

```bash
$ zc run -q examples/ch11/ch11-02-running-tests/app.zc
Samples: 4, Min: 30ms, Max: 50ms, Mean: 40.000000ms
```

---

## 从 `fn main()` 中手动调用 `_z_run_tests()`

如果你有一个定义了 `fn main()` 的单文件工具，或者一个希望在带有 `--self-test` 参数调用时运行所有编译进来的单元测试的应用程序，该怎么办？

每当你的程序（或其导入的模块）中存在至少一个 `test` 块时，Zen C 编译器都会生成 C 测试运行器函数 `int _z_run_tests()`。你可以直接从 Zen C 代码中调用 `_z_run_tests()`！

```zenc
fn clamp(val: int, lo: int, hi: int) -> int {
    if val < lo { return lo; }
    if val > hi { return hi; }
    return val;
}

test "clamp bounds values to [lo, hi]" {
    expect_eq(clamp(-5, 0, 100), 0, "below lower bound clamps to lo");
    expect_eq(clamp(42, 0, 100), 42, "in-range value is unchanged");
    expect_eq(clamp(250, 0, 100), 100, "above upper bound clamps to hi");
}

fn main() -> int {
    println "Running embedded self-tests...";
    let failures = _z_run_tests();
    if failures != 0 {
        return failures;
    }

    println "All self-tests passed! Starting application...";
    println "clamp(150, 0, 100) = {clamp(150, 0, 100)}";
    return 0;
}
```

---

## 使用 `@cfg(...)` 的条件测试

在系统编程中，某些测试仅在特定操作系统、编译器后端或特性配置下才有意义。你可以将 `@cfg(...)` 属性直接附加到 `test` 块上——包括 `not(...)`、`any(...)` 和 `all(...)` 组合子：

```zenc
@cfg(linux)
test "Linux procfs path resolution" {
    assert(true, "Runs only on Linux hosts");
}

@cfg(apple)
test "macOS Mach timebase conversion" {
    assert(true, "Runs only on macOS hosts");
}

@cfg(not(windows))
test "POSIX path separator is forward slash" {
    let sep = '/';
    assert(sep == '/', "POSIX uses '/'");
}

@cfg(STRESS_TESTS)
test "expensive 10-million-element stress test" {
    // Only compiled and executed when `-DSTRESS_TESTS` is passed!
    let total = 0;
    for i in 0..10000 {
        total += i;
    }
    assert(total > 0);
}
```

通过使用 `@cfg(STRESS_TESTS)` 门控缓慢或依赖硬件的测试，日常开发中默认的 `zc run` 保持在亚秒级别，而每晚的 CI 作业可以使用 `-D` 启用它们：

```bash
$ zc run -DSTRESS_TESTS tests/suite.zc
```

---

## 多文件测试套件与 Makefile 集成

随着项目规模的增长，跨多个模块运行测试有两种方式：

### 方案 1：汇总测试文件 `tests/all_tests.zc`

因为 `zc` 在合成 `_z_run_tests()` 时会收集所有导入模块中的 `test` 块，所以你可以创建一个导入项目中每个模块的单个 `tests/all_tests.zc` 文件：

```zenc
// File: tests/all_tests.zc
import "../src/math.zc"
import "../src/parser.zc"
import "../src/storage.zc"

test "integration: parser output feeds into storage" {
    // Cross-module integration test
    assert(true);
}
```

运行 `zc run -q tests/all_tests.zc` 会编译所有导入的模块，并在单个二进制文件中执行来自 `math.zc`、`parser.zc`、`storage.zc` 和 `all_tests.zc` 的每个 `test` 块！

### 方案 2：在 `Makefile` 中运行每个测试文件

或者，如果你更希望测试文件之间保持完全的进程隔离，可以在 `Makefile` 目标中遍历测试文件：

```makefile
ZC ?= zc
TEST_FILES := $(wildcard tests/test_*.zc)

.PHONY: test
test:
	@for f in $(TEST_FILES); do \
		echo "=== Running $$f ==="; \
		$(ZC) run -q "$$f" || exit 1; \
	done
```

---

## 🔍 窥探底层 C 代码：生成的 `_z_run_tests()` 测试脚手架

当 `zc` 完成生成每个独立的 `static int _z_test_N()` 函数后，它会在 C 翻译单元的底部生成 `_z_run_tests()` 以及（当不存在用户 `main` 时）`main()` 入口点：

```c
int _z_run_tests() {
    int _zc_total = 0;
    _zc_total += _z_test_0();
    _zc_total += _z_test_1();
    fprintf(stderr, "\n%d test(s) failed\n", _zc_total);
    return _zc_total;
}

int main() { return _z_run_tests(); }
```

如果 `test` 块标注了 `@cfg(...)`，则 `static int _z_test_N()` 函数定义及其在 `_z_run_tests()` 内部对应的 `_zc_total += _z_test_N();` 调用都会包装在 `#if ...` / `#endif` 预处理器保护中。被禁用的测试会被完全从二进制文件中编译剔除。
