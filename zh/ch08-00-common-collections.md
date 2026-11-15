# 常用集合

Zen C 中的大多数原生类型——例如整数、浮点数、rune（符文）以及固定大小数组（`[T; N]`）——都表示在编译期已知固定大小的值。固定大小数组直接分配在栈上或嵌入在结构体内部。虽然栈分配速度极快，但它也伴随着一个根本性的约束：数组的大小必须是编译期常量，且在程序运行期间无法增长或缩小。

实际的系统编程问题通常需要存储大小在运行时才能确定的数据集合：
- 从配置文件或网络套接字中读取未知数量的行。
- 构建一个能够动态加入和断开连接的网络客户端列表。
- 在文档解析过程中累加词元（token）。
- 使用关联键在内存中对记录建立索引，以实现 $O(1)$ 查找。

为了安全高效地解决这些问题，Zen C 标准库提供了**常用集合**（Common Collections）。

---

## Zen C 集合的独特之处

与传统 C 语言中动态数据结构需要手动处理 `malloc`、`realloc` 和指针算术不同，Zen C 集合提供了现代的高级抽象，同时又不会牺牲底层性能或内存透明度：

1. **一等泛型支持**：像 `Vec<T>` 和 `Set<T>` 这样的集合对任意类型 `T` 都是泛型的，消除了使用 `void*` 转换或不安全类型双关（type punning）的必要。
2. **RAII 与自动清理（`Drop`）**：每个标准集合都实现了 `Drop` trait（`impl Drop for Vec`、`impl Drop for String`、`impl Drop for Map`、`impl Drop for Set`）。当集合变量离开其所在作用域时，其分配的堆缓冲区会自动释放，消除了手动调用 `free()` 和内存泄漏的隐患。
3. **移动语义与所有权**：按值传递集合会转移所有权。你可以使用 `.clone()` 进行显式深拷贝，或使用 `.forget()` 防止自动释放。
4. **运算符重载**：常用操作拥有自然的语法——使用 `+` 和 `+=` 进行拼接，使用 `<<` 和 `>>` 进行流式推入和弹出，使用 `[]` 进行索引，以及使用 `==` 和 `!=` 进行结构相等性检查。
5. **函数式迭代器与组合子**：除标准 `for` 循环外，集合还提供高性能迭代器管道（`filter`、`fold`、`find`、`forEach`）。
6. **零开销 C 兼容性**：标准 `String` 保证以 null 结尾，可通过 `.c_str()` 以零成本直接传递给 C 库函数。

---

## 栈数组与动态集合对比

下表总结了固定大小栈数组与动态堆集合之间的关键权衡：

| 特性 | 固定大小数组 (`[T; N]`) | 动态集合 (`Vec<T>`、`String` 等) |
| :--- | :--- | :--- |
| **存储位置** | 栈（或结构体内联） | 堆（栈上保存指针，数据存储在堆上） |
| **大小已知时机** | 编译期 | 运行时（动态） |
| **可伸缩性** | 固定，无法扩容 | 动态（通过 `realloc` 自动增长） |
| **分配开销** | 零（移动栈指针） | 堆分配（`malloc` / `realloc`） |
| **清理机制** | 出栈时自动回收 | 自动 RAII（`Drop` trait 释放堆缓冲区） |
| **适用场景** | 小型固定缓冲区（例如坐标、固定数据包报头） | 无界数据、文本处理、关联查找 |

---

## 三大核心集合

本章重点介绍 Zen C 中功能最丰富且最常用的三种集合类型：

### 1. 向量（`Vec<T>`）
存储在堆上的连续可扩容数组。向量支持通过索引快速随机访问（$O(1)$），并在末尾高效追加元素（摊销 $O(1)$）。

**代码清单 8-1: `list8-1.zc`**

```zenc
 1 | import "std/vec.zc";
 2 |
 3 | fn main() {
 4 |     let numbers = Vec<int>::new();
 5 |     numbers.push(10);
 6 |     numbers.push(20);
 7 |     numbers.push(30);
 8 |
 9 |     println "Vector length: {numbers.length()}";
10 |     println "First element: {numbers.first()}";
11 |     println "Element at index 1: {numbers[1]}";
12 | }
```

输出：
```text
Vector length: 3
First element: 10
Element at index 1: 20
```

### 2. 可扩容字符串（`String`）
包装了 `Vec<char>` 的堆分配、UTF-8 感知字符串类型。它提供了字符串操作方法（拼接、修剪、大小写转换、拆分、子串提取），同时保持 null 结尾以实现无缝的 C 互操作性。

**代码清单 8-2: `list8-2.zc`**

```zenc
 1 | import "std/string.zc";
 2 |
 3 | fn main() {
 4 |     let greeting = String::from("Hello");
 5 |     let target = String::from(" Zen C!");
 6 |     greeting.append(&target);
 7 |
 8 |     println "{greeting.c_str()}";
 9 |     println "Character count: {greeting.utf8_len()}";
10 | }
```

输出：
```text
Hello Zen C!
Character count: 12
```

### 3. 哈希映射（`Map<V>`）与哈希集合（`Set<T>`）
由高性能开地址哈希表驱动的关联容器：
- **`Map<V>`**：将字符串键映射到类型为 `V` 的值，平均具有 $O(1)$ 的查找、插入和删除复杂度。
- **`Set<T>`**：存储类型为 `T` 的唯一值，自动丢弃重复添加的元素。

**代码清单 8-3: `list8-3.zc`**

```zenc
 1 | import "std/map.zc";
 2 |
 3 | fn main() {
 4 |     let inventory = Map<int>::new();
 5 |     inventory.put("apples", 15);
 6 |     inventory.put("oranges", 8);
 7 |
 8 |     let count = inventory.get("apples");
 9 |     if count.is_some() {
10 |         println "Apples in stock: {count.unwrap()}";
11 |     }
12 | }
```

输出：
```text
Apples in stock: 15
```

---

## 本章路线图

本章分为三个小节：

1. **[Vectors (Vec)](ch08-01-vectors.md)**：深入探讨动态数组——创建向量、追加、插入、索引、引用迭代、运算符重载以及函数式迭代器组合子。
2. **[Strings](ch08-02-strings.md)**：精通 Zen C 的可扩容 `String` 类型——理解字符串字面量与 `String`、Unicode rune 处理、转换、拆分以及 C 字符串互操作。
3. **[Hash Maps and Sets](ch08-03-hash-maps.md)**：通过关联方式存储和查找数据——使用 `Map<V>` 维护键值对关系，使用 `Set<T>` 维护唯一值集合，并在一个综合文本分析项目中综合运用所有集合。

让我们从精通向量开始吧！
