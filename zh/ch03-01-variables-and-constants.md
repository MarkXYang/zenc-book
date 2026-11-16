# 变量与常量

Zen C 区分了**变量**（内存中的存储单元）和**显式常量**（在编译期求值的值）。理解两者的工作机制，能确保你的程序保持安全、易读且高效。

---

## 显式常量 (`def`)

纯粹存在于编译期的值使用 `def` 关键字进行声明。显式常量在转译期间直接折叠到生成的机器码中，不占用运行时的栈空间。

```zenc
def MAX_BUFFER_SIZE = 1024;
def PI = 3.14159265;
```

你可以将显式常量用作数组长度、循环边界以及配置上限：

```zenc
def MAX_BUFFER_SIZE = 1024;
let buffer: char[MAX_BUFFER_SIZE]; // Valid array size at compile-time
```

---

## 变量 (`let`)

变量使用 `let` 关键字声明。默认情况下，使用 `let` 声明的变量是可变的：

```zenc
let x = 10;
x = 20; // OK: x is modified
```

### 类型推导

Zen C 具备自动类型推导功能。如果初始值能够清晰表明其类型，你无需手动指定类型注解：

```zenc
let count = 42;       // Inferred as int
let price = 19.99;    // Inferred as f64
let message = "Hello"; // Inferred as string
```

在底层，Zen C 将类型推导的变量转译为 C23 的 `auto` 或 GCC 的 `__auto_type` 扩展，没有任何运行时开销。

---

## 只读变量 (`const`)

如果你希望存储在内存中的变量不可修改且为只读，可以使用 `const` 限定其类型：

```zenc
let y: const int = 10;
// y = 20; // Error: cannot assign to const variable
```

### `def` 与 `const` 变量的对比

| 特性 | `def`（显式常量） | `let x: const T`（只读变量） |
| :--- | :--- | :--- |
| **存储方式** | 编译期字面量（在代码中常量折叠） | 栈或数据段内存 |
| **可取地址 (`&`)** | 否 | 是（拥有内存地址） |
| **数组大小指定** | 可作为固定数组大小 | 取决于 C 编译器的 VLA 规则 |

---

## 综合示例

**代码清单 3-1**
```zenc
fn main() {
    def PI = 3.14159265;
    let x = 10;
    x = 20;
    let count = 42;
    let price = 19.99;
    let message = "Hello";
    let y: const int = 10;

    println "PI: {PI}, x: {x}, count: {count}, price: {price}, message: {message}, y: {y}";
}
```

输出：
```text
PI: 3.141593, x: 20, count: 42, price: 19.990000, message: Hello, y: 10
```

接下来，让我们探索 Zen C 的基本数据类型与复合数据类型！
