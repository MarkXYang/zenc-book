# Vectors (Vec)

The most common and versatile dynamic collection in Zen C is the **Vector** (`Vec<T>`), provided by `std/vec.zc`. A vector is a contiguous, dynamically resizable array allocated on the heap.

Vectors are ideal when you need to store a sequence of elements of the same type and you do not know the exact number of elements in advance, or when the list needs to grow and shrink dynamically as your program runs.

---

## The Internal Memory Layout of `Vec<T>`

In Zen C, `Vec<T>` is defined as a simple 3-word structure:

```zenc
struct Vec<T> {
    data: T*;
    len:  usize;
    cap:  usize;
}
```

- **`data`**: A pointer to the heap-allocated contiguous buffer containing the actual elements.
- **`len`**: The current number of elements currently stored in the vector.
- **`cap`**: The total capacity of the allocated heap buffer (the maximum number of elements the buffer can hold before needing to reallocate).

When you push a new element to a vector and `len == cap`, the vector automatically triggers a dynamic resize (`grow()`):
1. It doubles the current capacity ($8 \to 16 \to 32 \to 64 \to \dots$).
2. It reallocates the heap buffer via `realloc`.
3. It updates `data` and `cap`, guaranteeing an amortized $O(1)$ append time.

---

## Creating a Vector

To use vectors, import `std/vec.zc`. Zen C provides two constructor methods:

### 1. `Vec<T>::new()` (Lazy Allocation)
Creates an empty vector with `data = NULL`, `len = 0`, and `cap = 0`. No heap allocation occurs until the first element is pushed!

### 2. `Vec<T>::with_capacity(cap)` (Pre-allocation)
If you know in advance how many elements the vector will hold, pre-allocating capacity avoids repeated `realloc` calls and buffer copies.

```zenc
import "std/vec.zc";

fn main() {
    // 1. Lazy allocation: 0 initial capacity
    let v = Vec<int>::new();
    println "Initial length: {v.length()}, capacity: {v.cap}";

    // Pushing elements triggers growth
    v.push(10);
    v.push(20);
    v.push(30);

    println "After 3 pushes -> length: {v.length()}, capacity: {v.cap}";
    println "First: {v.first()}, Last: {v.last()}";
    println "Element at index 1: {v[1]}";

    // 2. Pre-allocated capacity: avoids resizing overhead
    let preallocated = Vec<int>::with_capacity(64);
    println "Preallocated capacity: {preallocated.cap}";
}
```

Output:
```text
Initial length: 0, capacity: 0
After 3 pushes -> length: 3, capacity: 8
First: 10, Last: 30
Element at index 1: 20
Preallocated capacity: 64
```

---

## Modifying Elements: Insert, Remove, and Pop

In addition to `push()`, `Vec<T>` provides fine-grained control over adding and removing items:

- **`insert(idx, item)`**: Inserts `item` at position `idx`, shifting all subsequent elements to the right. Panics if `idx > len`.
- **`remove(idx) -> T`**: Removes and returns the element at `idx`, shifting subsequent elements to the left. Panics if `idx >= len`.
- **`pop() -> T`**: Removes and returns the final element. Panics if the vector is empty.
- **`pop_opt() -> Option<T>`**: Safe variant of `pop()`. Returns `Some(val)` if an element was popped, or `None()` if the vector was already empty.
- **`clear()`**: Resets `len = 0` without freeing the allocated heap buffer, allowing you to reuse the allocated capacity.

```zenc
import "std/vec.zc";

fn main() {
    let v = Vec<int>::new();
    v.push(10);
    v.push(20);
    v.push(30);

    // Insert 15 at index 1: [10, 15, 20, 30]
    v.insert(1, 15);
    println "After insert(1, 15), length: {v.length()}";

    // Remove element at index 2 (which is 20): [10, 15, 30]
    let removed = v.remove(2);
    println "Removed element: {removed}";

    // Pop the last element (30): [10, 15]
    let popped = v.pop();
    println "Popped element: {popped}";

    // Safe pop using pop_opt():
    let opt = v.pop_opt();
    if opt.is_some() {
        println "Safely popped: {opt.unwrap()}";
    }

    println "Remaining length: {v.length()}";
}
```

Output:
```text
After insert(1, 15), length: 4
Removed element: 20
Popped element: 30
Safely popped: 15
Remaining length: 1
```

---

## Reading Elements and Bounds Checking

You can access elements in a vector using:
1. **Indexing Syntax (`v[idx]`)** or **`v.get(idx)`**: Returns a copy of the element.
2. **`v.get_ref(idx) -> T*`**: Returns a direct pointer to the element inside the vector's buffer. This is especially useful for inspecting or modifying large structs without incurring copy overhead.
3. **`v.first()`** and **`v.last()`**: Return copies of the first and last elements respectively.

> [!CAUTION]
> Like arrays, vector indexing is zero-based (`0` to `len - 1`). If you attempt to access an index outside this range, Zen C immediately panics with `Panic: Index out of bounds`, preventing buffer overruns and uninitialized memory reads!

---

## Iterating Over Vectors

Zen C provides two idiomatic ways to iterate over vectors:

### 1. Iterating by Value (`for x in v`)
Consumes copies of each element during iteration.

### 2. Iterating by Reference (`for x in &v`)
Yields pointers (`T*`) to each element in the vector. This allows you to inspect elements without copying, or **mutate elements in place** using pointer dereference (`*x`):

```zenc
import "std/vec.zc";

fn main() {
    let scores = Vec<int>::new();
    scores.push(45);
    scores.push(58);
    scores.push(72);

    println "--- Original Scores ---";
    for s in &scores {
        println "Score: {*s}";
    }

    // In-place mutation: curve every score by +10
    for s in &scores {
        *s = *s + 10;
    }

    println "\n--- Curved Scores ---";
    for s in &scores {
        println "Curved score: {*s}";
    }
}
```

Output:
```text
--- Original Scores ---
Score: 45
Score: 58
Score: 72

--- Curved Scores ---
Curved score: 55
Curved score: 68
Curved score: 82
```

---

## Functional Iterator Combinators

`Vec<T>` integrates seamlessly with Zen C's functional iterator combinators. Calling `.iterator()` produces a `VecIter<T>` that supports:

- **`filter(predicate)`**: Collects elements satisfying a boolean predicate into a new `Vec<T>`.
- **`fold(initial, accumulator)`**: Reduces the vector elements to a single accumulated value.
- **`find(predicate)`**: Returns `Option<T>::Some(val)` for the first matching element, or `None()`.
- **`forEach(callback)`**: Executes a function for each element.

```zenc
import "std/vec.zc";

fn main() {
    let nums = Vec<int>::new();
    nums.push(1);
    nums.push(2);
    nums.push(3);
    nums.push(4);
    nums.push(5);

    // 1. Filter: select even numbers
    let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
    println "Evens count: {evens.length()}";
    for e in &evens {
        println "  Even: {*e}";
    }

    // 2. Fold: sum all numbers
    let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
    println "Sum: {sum}";

    // 3. Find: find first value greater than 3
    let found = nums.iterator().find(fn(x: int) -> bool { return x > 3; });
    if found.is_some() {
        println "First number > 3: {found.unwrap()}";
    }
}
```

Output:
```text
Evens count: 2
  Even: 2
  Even: 4
Sum: 15
First number > 3: 4
```

---

## Operator Overloading on `Vec`

Zen C overloads common operators for `Vec<T>` to make code expressive and concise:

| Operator | Syntax | Method | Description |
| :--- | :--- | :--- | :--- |
| `+` | `v1 + &v2` | `add` | Concatenates two vectors into a new vector. |
| `+=` | `v1 += &v2` | `add_assign` | Appends elements of `v2` into `v1` in place. |
| `<<` | `v << item` | `shl` | Appends `item` to the back (stream push). |
| `>>` | `v >> &out` | `shr` | Pops the last element into `out` (stream pop). |
| `*` | `v * n` | `mul` | Returns a new vector with elements repeated $n$ times. |
| `*=` | `v *= n` | `mul_assign` | Repeats elements in-place $n$ times. |
| `==` | `v1 == &v2` | `eq` | Checks structural equality (same length and byte-wise identical elements). |
| `!=` | `v1 != &v2` | `neq` | Structural inequality check. |
| `[]` | `v[i]` | `index` | Direct zero-based element indexing. |

```zenc
import "std/vec.zc";

fn main() {
    let a = Vec<int>::new();
    a << 10; // Stream push
    a << 20;

    let b = Vec<int>::new();
    b << 30;
    b << 40;

    // Concatenate into a new vector
    let c = a + &b;
    println "Concatenated length: {c.length()}";

    // Stream pop
    let popped: int = 0;
    c >> &popped;
    println "Popped via >>: {popped}";

    // Repeat vector elements
    let repeated = a * 2;
    println "Repeated length: {repeated.length()}";

    // Structural equality
    let a_copy = a.clone();
    println "a == a_copy: {a == &a_copy}";
}
```

Output:
```text
Concatenated length: 4
Popped via >>: 40
Repeated length: 4
a == a_copy: true
```

---

## Vectors of Custom Structs

Vectors work seamlessly with user-defined structs:

```zenc
import "std/vec.zc";

struct Task {
    id: int;
    priority: int;
}

fn main() {
    let tasks = Vec<Task>::new();
    tasks.push(Task { id: 101, priority: 1 });
    tasks.push(Task { id: 102, priority: 3 });
    tasks.push(Task { id: 103, priority: 2 });

    for t in &tasks {
        println "Task #{(*t).id} (Priority: {(*t).priority})";
    }
}
```

Output:
```text
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

---

## Memory Management and Move Semantics

`Vec<T>` automatically implements the `Drop` trait:

```zenc
impl Drop for Vec {
    fn drop(self) {
        self.free();
    }
}
```

- **Scope Exit**: When a vector variable goes out of scope, its `drop()` method is automatically called, safely freeing its heap buffer (`dealloc<T>(self.data)`).
- **Deep Copying with `.clone()`**: Assigning or passing vectors passes value copies of the 3-word struct. To create an independent copy with its own separate heap buffer, call `v.clone()`.
- **Transferring Ownership with `.forget()`**: If you want to detach the underlying heap buffer from the vector (for example, to pass the raw buffer to a C library function without `Drop` freeing it), call `v.forget()`. This zeroes out `data`, `len`, and `cap`.

---

## A Complete Example

Here is a complete program demonstrating creation, modification, iteration, operators, and custom struct usage:

```zenc
import "std/vec.zc";

struct Task {
    id: int;
    priority: int;
}

fn main() {
    println "=== 1. Basic Vector Operations ===";
    let v = Vec<int>::new();
    v.push(10);
    v.push(20);
    v.push(30);

    println "Length: {v.length()}, First: {v.first()}, Last: {v.last()}";
    println "Element at index 1: {v[1]}";

    println "\n=== 2. Insert, Remove, and Pop ===";
    v.insert(1, 15);
    println "After insert(1, 15), length: {v.length()}";

    let removed = v.remove(2);
    println "Removed element at index 2: {removed}";

    let popped = v.pop();
    println "Popped last element: {popped}";

    let opt = v.pop_opt();
    if opt.is_some() {
        println "Safely popped: {opt.unwrap()}";
    }

    println "\n=== 3. Iteration by Reference and Mutation ===";
    for x in &v {
        *x = *x * 5;
    }
    for x in &v {
        println "Mutated value: {*x}";
    }

    println "\n=== 4. Functional Combinators ===";
    let nums = Vec<int>::new();
    nums.push(1);
    nums.push(2);
    nums.push(3);
    nums.push(4);
    nums.push(5);

    let evens = nums.iterator().filter(fn(x: int) -> bool { return x % 2 == 0; });
    println "Filtered evens count: {evens.length()}";
    for e in &evens {
        println "  Even: {*e}";
    }

    let sum = nums.iterator().fold(0, fn(acc: int, x: int) -> int { return acc + x; });
    println "Sum of nums: {sum}";

    let first_even = nums.iterator().find(fn(x: int) -> bool { return x % 2 == 0; });
    if first_even.is_some() {
        println "First even number found: {first_even.unwrap()}";
    }

    println "\n=== 5. Operator Overloading ===";
    let v2 = Vec<int>::new();
    v2 << 100;
    v2 << 200;

    let combined = v + &v2;
    println "Combined vector length: {combined.length()}";
    for item in &combined {
        println "  Combined item: {*item}";
    }

    let popped_val: int = 0;
    v2 >> &popped_val;
    println "Popped from v2 via >>: {popped_val}";

    let repeated = v * 2;
    println "Repeated vector length: {repeated.length()}";

    println "\n=== 6. Vector of Custom Structs ===";
    let task_list = Vec<Task>::new();
    task_list.push(Task { id: 101, priority: 1 });
    task_list.push(Task { id: 102, priority: 3 });
    task_list.push(Task { id: 103, priority: 2 });

    for t in &task_list {
        println "Task #{(*t).id} (Priority: {(*t).priority})";
    }
}
```

Output:
```text
=== 1. Basic Vector Operations ===
Length: 3, First: 10, Last: 30
Element at index 1: 20

=== 2. Insert, Remove, and Pop ===
After insert(1, 15), length: 4
Removed element at index 2: 20
Popped last element: 30
Safely popped: 15

=== 3. Iteration by Reference and Mutation ===
Mutated value: 50

=== 4. Functional Combinators ===
Filtered evens count: 2
  Even: 2
  Even: 4
Sum of nums: 15
First even number found: 2

=== 5. Operator Overloading ===
Combined vector length: 3
  Combined item: 50
  Combined item: 100
  Combined item: 200
Popped from v2 via >>: 200
Repeated vector length: 2

=== 6. Vector of Custom Structs ===
Task #101 (Priority: 1)
Task #102 (Priority: 3)
Task #103 (Priority: 2)
```

> [!TIP]
> You can find and run the complete runnable example for this section in [`book/examples/ch08/ch08-01-vectors/main.zc`](file:///home/mark/code/zenc-app/book/examples/ch08/ch08-01-vectors/main.zc).

---

Now that you have mastered vectors, let's explore **[Strings](ch08-02-strings.md)**!
