# 哈希映射与哈希集合

在前面的小节中，我们探讨了顺序集合：用于存储有序元素列表的[向量](ch08-01-vectors.md)，以及用于字符序列的[字符串](ch08-02-strings.md)。在这两种情况下，各个元素都是使用连续的整数索引（$0, 1, 2, \dots$）进行访问的。

然而，实际的系统编程问题通常需要以关联方式组织数据：
- 将用户名与账户余额关联。
- 将 HTTP 路由路径（`"/api/v1/users"`）映射到处理函数。
- 存储一组唯一的 IP 地址以检测重复登录尝试。
- 统计单词或错误代码的出现频率。

为了以最优效率处理这些关联工作负载，Zen C 标准库提供了两个基于开地址哈希表的容器：**`Map<V>`**（哈希映射）和 **`Set<T>`**（哈希集合）。

---

## 第一部分：哈希映射（`Map<V>`）

由 `std/map.zc` 提供的 `Map<V>` 类型将字符串键（`char*`）映射到任意类型 `V` 的值。

### 内部架构

与传统的拉链法哈希表（每个插入项都分配一个链表节点，导致严重的内存碎片）不同，Zen C 的 `Map<V>` 使用**采用线性探测的开地址哈希表**（Open-Addressing Hash Table with Linear Probing）：
- 使用纯 Zen C 实现的快速 **FNV-1a** 算法对键进行哈希。
- 通过在连续数组（`keys`、`vals`、`occupied`、`deleted`）中探测后续槽位来解决冲突。
- 当负载因子增加时，映射会自动调整其内部表的大小，以保持平均 $O(1)$ 的查找、插入和删除性能。

```zenc
struct Map<V> {
    keys:     char**;
    vals:     V*;
    occupied: bool*;
    deleted:  bool*;
    len:      usize;
    cap:      usize;
}
```

---

### 创建与修改映射

- **`Map<V>::new()`**：构造一个新的空映射。
- **`put(key, val)`**：向映射中插入一个键值对。如果键已存在，则更新其值。键字符串会自动复制到由映射管理的堆内存中。
- **`get(key) -> Option<V>`**：查找键。如果找到则返回 `Option<V>::Some(val)`，如果键不存在则返回 `Option<V>::None()`。
- **`contains(key) -> bool`**：如果键存在则返回 `true`。
- **`remove(key)`**：移除键及其关联值，并释放存储的键字符串。
- **`length()`**：返回当前存储在映射中的活动条目数。

**代码清单 8-17**
```zenc
import "std/map.zc";

fn main() {
    // 1. Create a map mapping string keys to integer values
    let inventory = Map<int>::new();

    // 2. Insert key-value pairs
    inventory.put("apples", 50);
    inventory.put("bananas", 30);
    inventory.put("oranges", 25);

    println "Total products: {inventory.length()}";
    println "Has apples: {inventory.contains(\"apples\")}";
    println "Has grapes: {inventory.contains(\"grapes\")}";

    // 3. Retrieve values safely using Option
    let apple_count = inventory.get("apples");
    if apple_count.is_some() {
        println "Apples in stock: {apple_count.unwrap()}";
    }

    // 4. Remove an entry
    inventory.remove("bananas");
    println "After removing bananas: {inventory.length()} items";
}
```

输出：
```text
Total products: 3
Has apples: true
Has grapes: false
Apples in stock: 50
After removing bananas: 2 items
```

---

### 遍历映射

你可以使用标准 `for` 循环遍历 `Map<V>` 中的所有活动条目。迭代器会产生包含键和值的 `MapEntry<V>` 结构体：

```zenc
struct MapEntry<V> {
    key: char*;
    val: V;
}
```

**代码清单 8-18**
```zenc
import "std/map.zc";

fn main() {
    let capitals = Map<char*>::new();
    capitals.put("France", "Paris");
    capitals.put("Japan", "Tokyo");
    capitals.put("Canada", "Ottawa");

    println "--- Country Capitals ---";
    for entry in capitals {
        println "{entry.key} -> {entry.val}";
    }
}
```

输出：
```text
--- Country Capitals ---
France -> Paris
Japan -> Tokyo
Canada -> Ottawa
```

> [!NOTE]
> 由于哈希表根据哈希桶位置组织元素，遍历顺序由哈希函数决定，无法保证与插入顺序一致。

---

## 第二部分：哈希集合（`Set<T>`）

由 `std/set.zc` 提供的 `Set<T>` 类型存储任意值类型 `T` 的唯一元素。它是进行成员测试和去重的标准容器。

### `Set<T>` 上的方法

- **`Set<T>::new()`**：创建一个空集合。
- **`add(val) -> bool`**：向集合中插入一个值。如果元素是新插入的则返回 `true`，如果已经存在则返回 `false`。
- **`contains(val) -> bool`**：如果元素存在于集合中则返回 `true`（平均 $O(1)$ 时间）。
- **`remove(val) -> bool`**：从集合中移除该元素。如果元素存在且被成功移除则返回 `true`。
- **`length()`**：返回集合中唯一元素的数量。
- **`clear()`**：清空所有元素但不释放内部容量。

**代码清单 8-19**
```zenc
import "std/set.zc";

fn main() {
    let visited_ports = Set<int>::new();
    // 1. Add elements (duplicates return false)
    println "Add 80: {visited_ports.add(80)}";
    println "Add 443: {visited_ports.add(443)}";
    println "Add 80 again: {visited_ports.add(80)}"; // duplicate!

    // 2. Query set size and membership
    println "Total unique ports: {visited_ports.length()}";
    println "Visited 443: {visited_ports.contains(443)}";
    println "Visited 8080: {visited_ports.contains(8080)}";

    // 3. Remove an element
    visited_ports.remove(80);
    println "After remove(80), count: {visited_ports.length()}";
}
```

输出：
```text
Add 80: true
Add 443: true
Add 80 again: false
Total unique ports: 2
Visited 443: true
Visited 8080: false
After remove(80), count: 1
```

---

## 内存管理与自动清理（`Drop`）

`Map<V>` 和 `Set<T>` 都管理堆分配的缓冲区并实现了 `Drop` trait：

```zenc
impl Drop for Map {
    fn drop(self) {
        self.free();
    }
}

impl Drop for Set {
    fn drop(self) {
        self.free();
    }
}
```

- 当映射或集合变量离开作用域时，其 `drop()` 方法会自动执行。
- 对于 `Map<V>`，`free()` 会释放哈希表数组（`keys`、`vals`、`occupied`、`deleted`）以及所有存储在堆中的键字符串副本。
- 对于 `Set<T>`，`free()` 会释放内部表和状态位数组。

---

## 完整示例：映射与集合操作

这是一个演示字典查找、条目遍历和唯一 ID 跟踪的完整程序：

**代码清单 8-20**
```zenc
import "std/map.zc";
import "std/set.zc";

fn main() {
    println "=== 1. Hash Map (Map<V>) Operations ===";
    let scores = Map<int>::new();

    scores.put("Alice", 95);
    scores.put("Bob", 88);
    scores.put("Charlie", 92);

    println "Total registered scores: {scores.length()}";
    println "Has score for 'Alice': {scores.contains(\"Alice\")}";
    println "Has score for 'Diana': {scores.contains(\"Diana\")}";

    let alice_opt = scores.get("Alice");
    if alice_opt.is_some() {
        println "Alice's recorded score: {alice_opt.unwrap()}";
    }

    println "\n--- Iterating Key-Value Entries ---";
    for entry in scores {
        println "Student: {entry.key}, Grade: {entry.val}";
    }

    println "\n--- Removing Entries ---";
    scores.remove("Bob");
    println "Scores count after removing Bob: {scores.length()}";
    println "Has score for 'Bob': {scores.contains(\"Bob\")}";

    println "\n=== 2. Hash Set (Set<T>) Operations ===";
    let registered_ids = Set<int>::new();

    println "Adding ID 101: {registered_ids.add(101)}";
    println "Adding ID 202: {registered_ids.add(202)}";
    println "Adding duplicate ID 101: {registered_ids.add(101)}";

    println "Total unique IDs in set: {registered_ids.length()}";
    println "Contains ID 101: {registered_ids.contains(101)}";
    println "Contains ID 303: {registered_ids.contains(303)}";

    registered_ids.remove(202);
    println "After remove(202), set size: {registered_ids.length()}";
    println "Contains ID 202: {registered_ids.contains(202)}";
}
```

输出：
```text
=== 1. Hash Map (Map<V>) Operations ===
Total registered scores: 3
Has score for 'Alice': true
Has score for 'Diana': false
Alice's recorded score: 95

--- Iterating Key-Value Entries ---
Student: Charlie, Grade: 92
Student: Bob, Grade: 88
Student: Alice, Grade: 95

--- Removing Entries ---
Scores count after removing Bob: 2
Has score for 'Bob': false

=== 2. Hash Set (Set<T>) Operations ===
Adding ID 101: true
Adding ID 202: true
Adding duplicate ID 101: false
Total unique IDs in set: 2
Contains ID 101: true
Contains ID 303: false
After remove(202), set size: 1
Contains ID 202: false
```

> [!TIP]
> 你可以在 [`book/examples/ch08/ch08-03-hash-maps/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-03-hash-maps/main.zc) 中找到并运行本节的完整可执行示例。

---

## 本章综合应用项目：文本与词汇频率分析器

让我们将本章介绍的所有集合——`Vec<T>`、`String`、`Map<V>` 和 `Set<T>`——整合到一个完整的实际应用程序中。

以下程序解析文本文件，清洗并切分词汇，使用 `Map<int>` 统计词频，使用 `Vec<String>` 维护词元顺序，并使用 `Set<int>` 跟踪唯一的单词长度：

**代码清单 8-21**
```zenc
import "std/vec.zc";
import "std/string.zc";
import "std/map.zc";
import "std/set.zc";

fn main() {
    println "=== Zen C Text Analyzer ===";

    // 1. Load sample document into a dynamic String
    let document = String::from("zen-c is fast. zen-c is safe. modern zen-c combines speed with safety.");
    println "Input document: '{document.c_str()}'";
    println "Document length: {document.length()} bytes";

    // 2. Normalize text and tokenize into words
    let sanitized = document.replace(".", "");
    let tokens = sanitized.split(' ');
    println "Total words extracted: {tokens.length()}";

    // 3. Collect word frequencies using Map<int> and order unique words in Vec<String>
    let freq_map = Map<int>::new();
    let unique_words = Vec<String>::new();

    for token in &tokens {
        let normalized = (*token).trim().to_lowercase();
        let word_key = normalized.c_str();

        let count_opt = freq_map.get(word_key);
        if count_opt.is_some() {
            freq_map.put(word_key, count_opt.unwrap() + 1);
        } else {
            freq_map.put(word_key, 1);
            unique_words.push(normalized);
        }
    }

    // 4. Track distinct word lengths using Set<int>
    let length_set = Set<int>::new();
    for entry in freq_map {
        let word_len: int = (int)strlen(entry.key);
        length_set.add(word_len);
    }

    // 5. Report statistics
    println "\n--- Frequency Distribution ---";
    println "Distinct vocabulary size: {freq_map.length()} words";
    for entry in freq_map {
        println "  - '{entry.key}': {entry.val} occurrence(s)";
    }

    println "\n--- Vocabulary Length Analysis ---";
    println "Unique word lengths observed: {length_set.length()}";
    println "Contains length 2: {length_set.contains(2)}";
    println "Contains length 5: {length_set.contains(5)}";
    println "Contains length 10: {length_set.contains(10)}";

    println "\n=== Text Analysis Complete ===";
}
```

输出：
```text
=== Zen C Text Analyzer ===
Input document: 'zen-c is fast. zen-c is safe. modern zen-c combines speed with safety.'
Document length: 70 bytes
Total words extracted: 12

--- Frequency Distribution ---
Distinct vocabulary size: 9 words
  - 'speed': 1 occurrence(s)
  - 'is': 2 occurrence(s)
  - 'safety': 1 occurrence(s)
  - 'safe': 1 occurrence(s)
  - 'with': 1 occurrence(s)
  - 'zen-c': 3 occurrence(s)
  - 'modern': 1 occurrence(s)
  - 'combines': 1 occurrence(s)
  - 'fast': 1 occurrence(s)

--- Vocabulary Length Analysis ---
Unique word lengths observed: 5
Contains length 2: true
Contains length 5: true
Contains length 10: false

=== Text Analysis Complete ===
```

> [!TIP]
> 你可以在 [`book/examples/ch08/text_analyzer/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/text_analyzer/main.zc) 中找到并运行本章的完整综合应用项目。

---

## 小结

在本章中，你学到了：
- **向量（`Vec<T>`）**如何提供具有均摊 $O(1)$ 追加性能和边界检查的动态大小连续数组存储。
- 如何通过引用遍历向量（`for x in &v`）以实现高效的原地修改而无需拷贝数据。
- 如何将函数式迭代器组合子（`filter`、`fold`、`find`、`forEach`）与 Zen C 闭包结合使用。
- **`String`** 如何提供一个基于 `Vec<char>` 包装的堆分配、UTF-8 感知文本容器，并保证以 null 结尾以实现零开销 C 互操作。
- 如何通过 `rune`、`utf8_len()` 和 UTF-8 字符串切片处理 Unicode 码点。
- **`Map<V>`** 如何使用基于线性探测和 FNV-1a 哈希的开地址哈希表提供从字符串键到值的关联映射。
- **`Set<T>`** 如何强制唯一元素存储并提供平均 $O(1)$ 的成员测试。
- 所有标准集合如何通过实现 **`Drop`** trait 在离开作用域时自动清理堆内存。

在[第 9 章](ch09-00-error-handling.md)中，我们将探索 Zen C 的**错误处理**——使用 `panic` 处理不可恢复错误，以及使用 `Option<T>` 和 `Result<T, E>` 处理可恢复错误！
