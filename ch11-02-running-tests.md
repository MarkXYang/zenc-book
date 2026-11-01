# Running Tests with `zc`

Once you have written `test` blocks, how do you execute them, organize them across modules, and wire them into your build scripts or Continuous Integration (CI) pipeline?

In Zen C, there is no separate test-runner binary to install or configure. The `zc` compiler itself synthesizes the test runner and executes your tests directly via `zc run`.

---

## Running Test Files with `zc run`

To compile and execute all `test` blocks in a file, pass the `.zc` file to `zc run`:

```bash
$ zc run examples/ch11/ch11-01-writing-tests/main.zc
   Compiling examples/ch11/ch11-01-writing-tests/main.zc...
     Running ./main
  TEST: Rectangle::area calculates width times height ... OK
  TEST: larger rectangle can hold smaller rectangle ... OK
  TEST: Rectangle::scale mutates dimensions in place ... OK

0 test(s) failed
```

If you want cleaner output in a terminal or CI log without the `Compiling ...` and `Running ...` status lines, pass the `-q` (`--quiet`) flag:

```bash
$ zc run -q examples/ch11/ch11-01-writing-tests/main.zc
  TEST: Rectangle::area calculates width times height ... OK
  TEST: larger rectangle can hold smaller rectangle ... OK
  TEST: Rectangle::scale mutates dimensions in place ... OK

0 test(s) failed
```

### Exit Codes and Failure Reporting

When every `assert` and `expect` passes, the test binary exits with status code `0`. If one or more checks fail across any `test` block, the runner prints the failure diagnostics inline, marks the affected test as `FAIL`, prints the total number of failed checks at the bottom, and exits with a non-zero status code equal to `_zc_test_failures`:

```text
  TEST: division by non-zero ... OK
  TEST: bounds check ...   Assertion failed: Expected index < 10, got 12
FAIL

1 test(s) failed
```

Because `zc run` forwards the child binary's exit code directly to your shell (`$?`), any failing test automatically halts `make test`, shell scripts running under `set -e`, and CI workflows (such as GitHub Actions).

---

## The In-Module Unit Testing Pattern

One of Zen C's most productive workflows is **in-module unit testing**: placing `test` blocks directly at the bottom of a library module file right alongside the structs and functions they test.

How does a single `.zc` file act as both a testable unit and an importable library module without causing duplicate `main()` errors?

The secret lies in how the Zen C code generator handles `main()`:

1. **No user `fn main()` present**: If the compiled program defines at least one `test` block and **no** `fn main()`, `zc` automatically emits:
   ```c
   int main() { return _z_run_tests(); }
   ```
2. **User `fn main()` present**: If the compiled program (or the entry-point file importing your module) defines its own `fn main()`, `zc` still emits `_z_run_tests()`, but **omits** the auto-generated `main()` so your application's `fn main()` serves as the entry point.

Let's see this in action with a two-file project: a `stats.zc` library module containing both implementation code and unit tests, and an `app.zc` binary entry point that imports `stats.zc`.

### 1. The Library Module with Embedded Unit Tests (`stats.zc`)

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

Because `stats.zc` has no `fn main()`, running `zc run stats.zc` executes its unit tests directly:

```bash
$ zc run -q examples/ch11/ch11-02-running-tests/stats.zc
  TEST: Summary::from_slice computes count, sum, min, and max ... OK
  TEST: Summary::from_slice handles negative numbers ... OK

0 test(s) failed
```

### 2. The Application Entry Point (`app.zc`)

Now let's import `stats.zc` from our application entry point `app.zc`, which defines `fn main()`:

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

When we run `app.zc`, `zc` sees `fn main()` and runs the application normally:

```bash
$ zc run -q examples/ch11/ch11-02-running-tests/app.zc
Samples: 4, Min: 30ms, Max: 50ms, Mean: 40.000000ms
```

---

## Invoking `_z_run_tests()` Manually from `fn main()`

What if you have a single-file tool that defines `fn main()`, or an application that wants to run all compiled-in unit tests when invoked with a `--self-test` mode?

Whenever at least one `test` block is present in your program (or its imported modules), the Zen C compiler emits the C test runner function `int _z_run_tests()`. You can call `_z_run_tests()` directly from Zen C code!

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

## Conditional Tests with `@cfg(...)`

In systems programming, some tests only make sense on a specific operating system, compiler backend, or feature configuration. You can attach `@cfg(...)` attributes directly to `test` blocks—including `not(...)`, `any(...)`, and `all(...)` combinators:

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

By gating slow or hardware-dependent tests behind `@cfg(STRESS_TESTS)`, your default `zc run` stays sub-second during everyday development, while your nightly CI job can enable them with `-D`:

```bash
$ zc run -DSTRESS_TESTS tests/suite.zc
```

---

## Multi-File Test Suites and Makefile Integration

As your project grows, you have two ways to run tests across multiple modules:

### Approach 1: An Umbrella `tests/all_tests.zc` File

Because `zc` collects `test` blocks across all imported modules when synthesizing `_z_run_tests()`, you can create a single `tests/all_tests.zc` file that imports every module in your project:

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

Running `zc run -q tests/all_tests.zc` compiles all imported modules and executes every `test` block from `math.zc`, `parser.zc`, `storage.zc`, and `all_tests.zc` in a single binary!

### Approach 2: Running Each Test File in a `Makefile`

Alternatively, if you prefer complete process isolation between test files, you can loop over your test files in a `Makefile` target:

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

## 🔍 Peek at the C: The Generated `_z_run_tests()` Harness

When `zc` finishes emitting each individual `static int _z_test_N()` function, it generates `_z_run_tests()` and (when no user `main` exists) the `main()` entry point at the bottom of the C translation unit:

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

If a `test` block is annotated with `@cfg(...)`, both the `static int _z_test_N()` function definition and its corresponding `_zc_total += _z_test_N();` call inside `_z_run_tests()` are wrapped in `#if ...` / `#endif` preprocessor guards. Disabled tests are completely compiled out of the binary.
