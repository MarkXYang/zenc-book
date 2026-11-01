# How to Write Tests

Zen C provides first-class language syntax for writing automated tests: the `test` declaration, the `assert` and `expect` statements, and the automatically imported `std/test.zc` helper module. Because these constructs are built directly into the compiler, you can write expressive unit tests right next to the structs and functions they verify without installing or configuring any external test libraries.

---

## The Anatomy of a `test` Block

A test in Zen C is declared at the top level of a file using the `test` keyword, followed by a human-readable string literal describing the behavior under test, and a block `{ ... }` containing the test body:

```zenc
test "descriptive name of the behavior" {
    // Arrange, Act, Assert
}
```

Unlike ordinary `fn` declarations, `test` blocks use arbitrary string literals for their names. This allows you to write clear, space-separated descriptions like `"Rectangle::area computes width * height"` or `"RingBuffer::pop returns None when empty"` instead of cramming everything into snake_case identifiers.

Let's build a complete example that tests a `Rectangle` struct and its methods:

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

Because this file contains `test` blocks and no `fn main()`, running `zc run` compiles and executes the test suite automatically:

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

## Checking Invariants with `assert` and `expect`

Zen C provides two built-in verification statements—`assert` and `expect`—which can be written either with parentheses (like a function call) or without parentheses (like a statement):

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

### How `assert` and `expect` Report Failures

In Zen C's test runner, both `assert` and `expect` increment the global failure counter (`_zc_test_failures`) and print a diagnostic to `stderr` when their condition evaluates to `false`:

- `assert(cond, "msg")` prints:
  ```text
    Assertion failed: msg
  ```
- `expect(cond, "msg")` prints:
  ```text
    Expectation failed: msg
  ```

If you omit the custom message string, `assert(cond)` defaults to `"Assertion failed"` and `expect(cond)` defaults to `"Expectation failed"`.

> **Tip: Semantic Intent of `assert` vs. `expect`**
> In Zen C's built-in test runner, neither `assert` nor `expect` aborts the process with `SIGABRT`; both record the failure in `_zc_test_failures` and allow subsequent checks and tests to run so you can see *all* broken expectations in a single test run.
>
> By convention:
> - Use **`assert`** for preconditions and structural invariants (e.g., verifying that a pointer is non-null or a parse result is `Ok` before inspecting its fields). If you must stop the current `test` block immediately when a precondition fails, pair `assert` with an early `return;` inside an `if` or `guard`.
> - Use **`expect`** (and the `expect_*` helpers) when verifying multiple independent properties of an output (such as checking `width`, `height`, and `area` in sequence).

---

## Lazy String Interpolation in Failure Messages

When a test fails, knowing *that* `rect.area() == 50` was false is only half the battle—you want to know what `rect.area()` actually returned.

Both `assert` and `expect` support full Zen C `{...}` string interpolation inside their failure message argument:

```zenc
test "interpolated failure messages" {
    let r = Rectangle::new(6, 7);
    let expected = 42;
    assert(r.area() == expected, "For {r.width}x{r.height}, expected {expected} but got {r.area()}");
}
```

Best of all, Zen C compiles the failure message **lazily**. The `snprintf` formatting for the interpolated string is placed *inside* the `if (!(cond))` failure branch in the generated C code. When your test passes, zero string formatting or buffer allocation takes place!

---

## Standard Test Helpers (`std/test.zc`)

Whenever the Zen C parser encounters a `test` block in your file, it automatically imports the standard testing module (`std/test.zc`). This module provides three convenient comparison helpers on top of `expect`:

| Helper Function | Signature | Description |
| :--- | :--- | :--- |
| `expect_eq` | `fn expect_eq(actual: int, expected: int, msg: string)` | Checks that `actual == expected`. |
| `expect_ne` | `fn expect_ne(actual: int, expected: int, msg: string)` | Checks that `actual != expected`. |
| `expect_approx_eq` | `fn expect_approx_eq(actual: f64, expected: f64, epsilon: f64, msg: string)` | Checks that `\|actual - expected\| <= epsilon` for floating-point results. |

### Testing Floating-Point Math with `expect_approx_eq`

Because IEEE 754 floating-point arithmetic is subject to rounding (for example, `0.1 + 0.2` in binary floating point is `0.30000000000000004`), testing `f64` calculations with exact `==` is a classic source of flaky tests. Always use `expect_approx_eq` with an explicit tolerance `epsilon`:

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

## Testing `Option<T>`, `Result<T>`, `defer`, and `Drop`

Because a `test "name" { ... }` block compiles to a regular C function scope, all of Zen C's resource management and error-handling features work seamlessly inside tests:

1. **`defer` statements** registered inside a `test` block are guaranteed to execute when the test finishes.
2. **Types implementing `Drop`** (such as `Vec<T>`, `Map<V>`, or custom RAII structs) are automatically cleaned up via their `Drop::drop` glue at the end of the `test` block.
3. **Verifying `Drop` execution**: You can test your own custom `Drop` implementations by creating an inner block `{ ... }` inside a test and asserting that a cleanup counter or state flag was updated when the inner block exited!

Here is an example demonstrating how to test both `Result<T>` error paths and deterministic RAII `Drop` cleanup inside a `test` block:

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

## 🔍 Peek at the C: How `test`, `assert`, and `expect` Compile

When you transpile a file containing `test` blocks with `zc transpile`, you can see the exact C11 code that powers Zen C's testing framework.

First, in the runtime preamble, Zen C emits a global failure counter `_zc_test_failures` and two variadic macros:

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

Second, each `test "name" { ... }` block is emitted as an isolated `static int _z_test_N()` function that snapshots `_zc_test_failures` before running the test body and compares it afterward:

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

Notice two clever details in this generated C code:
1. Because `__zenc_assert` expands `if (!(cond))` around the message arguments, the GNU statement expression `({ static ZC_TLS char _z_buf[1024]; snprintf(...); _z_buf; })` is **never executed** when `Rectangle__area(&rect) == 50` is true.
2. Each test compares `_zc_before == _zc_test_failures`, so even if `_z_test_0()` fails, `_z_test_1()` starts with a clean baseline and reports its own `OK` or `FAIL` status independently.
