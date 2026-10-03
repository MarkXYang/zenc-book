# Hash Maps and Sets

In the previous sections, we explored sequential collections: [Vectors](ch08-01-vectors.md) for ordered lists of items, and [Strings](ch08-02-strings.md) for sequences of characters. In both cases, individual elements are accessed using sequential integer indices ($0, 1, 2, \dots$).

However, real-world systems programming problems frequently require organizing data associatively:
- Associating user names with account balances.
- Mapping HTTP route paths (`"/api/v1/users"`) to handler functions.
- Storing a set of unique IP addresses to detect duplicate login attempts.
- Counting the frequency of occurrences of words or error codes.

To handle these associative workloads with optimal efficiency, Zen C's standard library provides two containers based on open-addressing hash tables: **`Map<V>`** (Hash Map) and **`Set<T>`** (Hash Set).

---

## Part 1: Hash Maps (`Map<V>`)

The `Map<V>` type, provided by `std/map.zc`, maps string keys (`char*`) to values of any type `V`.

### Internal Architecture

Unlike traditional chaining hash tables (which allocate a linked list node for every inserted item, causing heavy memory fragmentation), Zen C's `Map<V>` uses an **Open-Addressing Hash Table with Linear Probing**:
- Keys are hashed using a fast, pure Zen C implementation of the **FNV-1a** algorithm.
- Collisions are resolved by probing subsequent slots in contiguous arrays (`keys`, `vals`, `occupied`, `deleted`).
- When load factors increase, the map automatically resizes its internal table to preserve average $O(1)$ lookup, insertion, and deletion performance.

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

### Creating and Modifying a Map

- **`Map<V>::new()`**: Constructs a new, empty map.
- **`put(key, val)`**: Inserts a key-value pair into the map. If the key already exists, its value is updated. The key string is automatically copied into heap memory managed by the map.
- **`get(key) -> Option<V>`**: Looks up a key. Returns `Option<V>::Some(val)` if found, or `Option<V>::None()` if the key is not present.
- **`contains(key) -> bool`**: Returns `true` if the key exists.
- **`remove(key)`**: Removes a key and its associated value, freeing the stored key string.
- **`length()`**: Returns the number of active entries currently stored in the map.

**Listing 8-17: `list8-17.zc`**

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

Output:
```text
Total products: 3
Has apples: true
Has grapes: false
Apples in stock: 50
After removing bananas: 2 items
```

---

### Iterating Over a Map

You can iterate over all active entries in a `Map<V>` using a standard `for` loop. The iterator yields a `MapEntry<V>` struct containing the key and value:

```zenc
struct MapEntry<V> {
    key: char*;
    val: V;
}
```

**Listing 8-18: `list8-18.zc`**

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

Output:
```text
--- Country Capitals ---
France -> Paris
Japan -> Tokyo
Canada -> Ottawa
```

> [!NOTE]
> Because hash tables organize elements according to hash bucket locations, iteration order is determined by the hash function and is not guaranteed to match the insertion order.

---

## Part 2: Hash Sets (`Set<T>`)

The `Set<T>` type, provided by `std/set.zc`, stores unique elements of any value type `T`. It is the standard container for membership testing and deduplication.

### Methods on `Set<T>`

- **`Set<T>::new()`**: Creates an empty set.
- **`add(val) -> bool`**: Inserts a value into the set. Returns `true` if the element was newly inserted, or `false` if it was already present.
- **`contains(val) -> bool`**: Returns `true` if the element exists in the set ($O(1)$ average time).
- **`remove(val) -> bool`**: Removes the element from the set. Returns `true` if it was present and removed.
- **`length()`**: Returns the number of unique elements in the set.
- **`clear()`**: Clears all elements without deallocating internal capacity.

**Listing 8-19: `list8-19.zc`**

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

Output:
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

## Memory Management and Automatic Cleanup (`Drop`)

Both `Map<V>` and `Set<T>` manage heap-allocated buffers and implement the `Drop` trait:

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

- When a map or set variable goes out of scope, its `drop()` method executes automatically.
- For `Map<V>`, `free()` deallocates the table arrays (`keys`, `vals`, `occupied`, `deleted`) as well as all stored heap copies of key strings.
- For `Set<T>`, `free()` deallocates the internal table and status bit arrays.

---

## A Complete Example: Map and Set Operations

Here is a complete program demonstrating dictionary lookups, entry iteration, and unique ID tracking:

**Listing 8-20: `list8-20.zc`**

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

Output:
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
> You can find and run the complete runnable example for this section in [`book/examples/ch08/ch08-03-hash-maps/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-03-hash-maps/main.zc).

---

## Chapter Capstone Application: Text & Vocabulary Frequency Analyzer

Let's bring all the collections covered in this chapter—`Vec<T>`, `String`, `Map<V>`, and `Set<T>`—together into a complete real-world application.

The following program parses a text document, cleans and tokenizes words, counts word frequencies using `Map<int>`, maintains token ordering with `Vec<String>`, and tracks unique word lengths using `Set<int>`:

**Listing 8-21: `list8-21.zc`**

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

Output:
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
> You can find and run the complete capstone application for this chapter in [`book/examples/ch08/text_analyzer/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/text_analyzer/main.zc).

---

## Summary

In this chapter, you learned:
- How **Vectors (`Vec<T>`)** provide dynamically sized, contiguous array storage with amortized $O(1)$ push performance and bounds checking.
- How to iterate over vectors by reference (`for x in &v`) for efficient, in-place mutation without copying data.
- How to use functional iterator combinators (`filter`, `fold`, `find`, `forEach`) with Zen C closures.
- How **`String`** provides a heap-allocated, UTF-8-aware text container wrapping `Vec<char>` with guaranteed null-termination for zero-overhead C interoperability.
- How Unicode code points are handled via `rune`, `utf8_len()`, and UTF-8 string slicing.
- How **`Map<V>`** provides associative string key to value mappings using an open-addressing hash table with linear probing and FNV-1a hashing.
- How **`Set<T>`** enforces unique element storage and provides average $O(1)$ membership testing.
- How all standard collections automatically clean up their heap memory on scope exit by implementing the **`Drop`** trait.

In [Chapter 9](ch09-00-error-handling.md), we will explore **Error Handling** in Zen C—unrecoverable errors with `panic`, and recoverable errors with `Option<T>` and `Result<T, E>`!
