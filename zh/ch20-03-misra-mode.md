# MISRA C:2012 合规模式

在汽车（ISO 26262）、航空航天（DO-178C）、医疗设备（IEC 62304）和铁路系统中，软件必须遵循严格的编码规范，旨在防止未定义行为、运行时歧义以及不可追溯的控制流。

系统软件中应用最广泛的安全标准是 **MISRA C:2012**（*汽车工业软件可靠性协会*）。

Zen C 具有内置的 **`--misra`** 合规模式。当使用 `zc --misra` 调用时，编译器将充当静态合规审计员，并在语义分析期间强制执行 MISRA C:2012 规则——同时生成严格合规、防御性的 C 代码。

---

## 1. 启用 MISRA 模式

要在 MISRA 合规模式下检查或构建 Zen C 程序，请传入 `--misra` 标志：

```bash
# Verify static compliance without building
zc check --misra file.zc

# Build or run directly under MISRA compliance
zc run -q --misra file.zc

# Transpile to inspect the generated MISRA-compliant C11
zc transpile --misra file.zc -o output.c
```

当启用 `--misra` 时，编译器会对照安全准则执行静态验证，并拒绝不合规的结构。

---

## 2. `zc --misra` 强制执行的核心 MISRA 规则

| MISRA 规则 | 要求 | Zen C 强制执行机制 |
| :--- | :--- | :--- |
| **规则 14.4** | 控制 `if`、`while` 或 `for` 语句的条件必须具有基本布尔类型。 | 指针（`if (ptr)`）和整数（`while (n)`）被禁止用作条件。你必须编写显式布尔表达式：`if ptr != NULL` 和 `while n > 0`。 |
| **规则 15.7** | 所有 `if ... else if` 结构必须以 `else` 语句结尾。 | 省略兜底的 `else` 子句会产生编译错误，或者促使在生成的 C 代码中自动插入防御性的空 `else { }` 块。 |
| **规则 17.4** | 函数的所有退出路径必须汇聚到单一退出点。 | 转译器将所有返回路径路由到包含统一定义的 `_misra_ret` 变量的终端 `_misra_end_of_func` 标签。 |
| **规则 10.4** | 二元运算符的操作数必须共享相同的基本类型类别。 | 拒绝不同符号性或位宽之间的隐式提升；必须进行显式转换。 |
| **规则 2.1** | 项目中不得包含不可达代码。 | 无条件返回之后的死代码会被标记为审计失败。 |
| **规则 19.2** | 在安全关键代码中不应使用 union 关键字。 | 除非提供显式合规依据，否则未标记的 `union` 声明会产生 MISRA 违规警告/错误。 |

---

## 3. 🔍 窥探底层 C 代码：单出口下沉与防御性子句

考虑一个带有多个返回路径和一个 `if` 语句的简单函数：

```zenc
fn is_big(n: int) -> bool {
    let big: bool = false;
    if n > 10 {
        big = true;
    }
    return big;
}
```

在 `zc transpile --misra` 下，编译器会生成防御性格式化的 C11 代码，满足 MISRA 规则 15.7（显式 `else { }` 兜底）和规则 17.4（单一返回点）：

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

## 4. 完整示例：代码清单 20-3

代码清单 20-3 演示了一个干净且严格遵循 MISRA C:2012 准则的安全关键数值截断和校验和例程。

**代码清单 20-3**：符合 MISRA 规范的数值例程（`examples/ch20/ch20-03-misra-mode/main.zc`）

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

验证代码清单 20-3 是否通过静态 MISRA 检查并以零违规运行：

```console
$ zc check --misra examples/ch20/ch20-03-misra-mode/main.zc
$ zc run -q --misra examples/ch20/ch20-03-misra-mode/main.zc
$ echo $?
0
```

---

## 本节小结

- 使用 `--misra` 依照 MISRA C:2012 安全准则审计 Zen C 源文件。
- 始终在分支结构中使用显式布尔条件（`ptr != NULL`、`val > 0`）。
- 确保所有 `if ... else if` 链都以显式 `else` 分支结束。
- 转译出的 MISRA 代码强制执行单点函数返回和显式类型转换，可直接用于汽车和航空航天的资格认证审计。
