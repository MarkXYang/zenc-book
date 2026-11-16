# MISRA C:2012 Compliance Mode

In automotive (ISO 26262), aerospace (DO-178C), medical devices (IEC 62304), and railway systems, software must adhere to stringent coding standards designed to prevent undefined behavior, run-time ambiguities, and untraceable control flow.

The most widely adopted safety standard in systems software is **MISRA C:2012** (*Motor Industry Software Reliability Association*).

Zen C features a built-in **`--misra`** compliance mode. When invoked with `zc --misra`, the compiler acts as a static compliance auditor and enforces MISRA C:2012 rules during semantic analysis—and emits strictly compliant, defensive C code.

---

## 1. Enabling MISRA Mode

To check or build a Zen C program in MISRA compliance mode, pass the `--misra` flag:

```bash
# Verify static compliance without building
zc check --misra file.zc

# Build or run directly under MISRA compliance
zc run -q --misra file.zc

# Transpile to inspect the generated MISRA-compliant C11
zc transpile --misra file.zc -o output.c
```

When `--misra` is enabled, the compiler performs static validation against safety guidelines and rejects non-compliant constructs.

---

## 2. Key MISRA Rules Enforced by `zc --misra`

| MISRA Rule | Requirement | Zen C Enforcement |
| :--- | :--- | :--- |
| **Rule 14.4** | Conditions controlling `if`, `while`, or `for` statements must have essential boolean type. | Pointers (`if (ptr)`) and integers (`while (n)`) are prohibited as conditions. You must write explicit boolean expressions: `if ptr != NULL` and `while n > 0`. |
| **Rule 15.7** | All `if ... else if` constructs must be terminated with an `else` statement. | Omitting the fallback `else` clause generates a compile error or prompts automatic insertion of defensive empty `else { }` blocks in generated C. |
| **Rule 17.4** | All exit paths of a function must lead to a single point of exit. | The transpiler routes all return paths to a single terminal `_misra_end_of_func` label holding a unified `_misra_ret` variable. |
| **Rule 10.4** | Operands of binary operators must share the same essential type category. | Implicit promotions across differing signedness or widths are rejected; explicit casts are required. |
| **Rule 2.1** | A project shall not contain unreachable code. | Dead code following unconditional returns is flagged as an audit failure. |
| **Rule 19.2** | The union keyword should not be used in safety-critical code. | Untagged `union` declarations produce a MISRA violation unless explicitly justified. |

---

## 3. 🔍 Peek at the C: Single-Exit Lowering and Defensive Clauses

Consider a simple function with multiple return paths and an `if` statement:

```zenc
fn is_big(n: int) -> bool {
    let big: bool = false;
    if n > 10 {
        big = true;
    }
    return big;
}
```

Under `zc transpile --misra`, the compiler emits defensively formatted C11 satisfying MISRA Rule 15.7 (explicit `else { }` fallback) and Rule 17.4 (single return point):

```c
static ZC_FUNC bool is_big(int32_t n) {
    bool _misra_ret = 0;
    {
        bool big = false;
        if (((n > (int32_t)(10)))) {
            ((big = (bool)(true)));
        } else { } /* MISRA 15.7: explicit terminal else */
        _misra_ret = big;
        goto _misra_end_of_func;
    }
    _misra_end_of_func: /* MISRA 17.4: single point of exit */
    return _misra_ret;
}
```

---

## 4. Complete Example: Listing 20-3

Listing 20-3 demonstrates a clean, safety-critical numerical clamping and checksum routine that adheres strictly to MISRA C:2012 guidelines.

**Listing 20-3**: MISRA-compliant numerical routines (`examples/ch20/ch20-03-misra-mode/main.zc`)

```zenc
// File: examples/ch20/ch20-03-misra-mode/main.zc
//
// Compile with: zc run -q --misra main.zc
// Or transpile: zc transpile --misra main.zc -o misra_clean.c

fn clamp_value(val: int, min_val: int, max_val: int) -> int {
    let result: int = val;
    if val < min_val {
        result = min_val;
    } else if val > max_val {
        result = max_val;
    } else {
        result = val;
    }
    return result;
}

fn compute_checksum(count: int) -> int {
    let sum: int = 0;
    let i: int = 0;
    while i < count {
        let clamped: int = clamp_value(i * 10, 20, 80);
        sum = sum + clamped;
        i = i + 1;
    }
    return sum;
}

fn main() -> int {
    let check: int = compute_checksum(10);
    let exit_code: int = 1;

    // Checksum verification:
    // i=0: clamp(0)  = 20
    // i=1: clamp(10) = 20
    // i=2: clamp(20) = 20
    // i=3: clamp(30) = 30
    // i=4: clamp(40) = 40
    // i=5: clamp(50) = 50
    // i=6: clamp(60) = 60
    // i=7: clamp(70) = 70
    // i=8: clamp(80) = 80
    // i=9: clamp(90) = 80
    // Sum = 20+20+20+30+40+50+60+70+80+80 = 470
    if check == 470 {
        exit_code = 0;
    } else {
        exit_code = 1;
    }

    return exit_code;
}
```

Verify that Listing 20-3 passes static MISRA checking and runs with zero violations:

```console
$ zc check --misra examples/ch20/ch20-03-misra-mode/main.zc
$ zc run -q --misra examples/ch20/ch20-03-misra-mode/main.zc
$ echo $?
0
```

---

## Summary

- Use `--misra` to audit Zen C source files against MISRA C:2012 safety guidelines.
- Always use explicit boolean conditions (`ptr != NULL`, `val > 0`) in branch constructs.
- Ensure all `if ... else if` chains conclude with an explicit `else` branch.
- Transpiled MISRA code enforces single-point function returns and explicit type casts, ready for automotive and aerospace qualification audits.
